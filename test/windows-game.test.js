import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { mkdtemp, mkdir, rm, symlink, access, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setImmediate as tick } from 'node:timers/promises';
import { createWindowsGameClient, resolveCapturePath, openWindowsGame } from '../src/windows-game.js';

const expectedSize = { width: 1440, height: 900 };

function helper({ ready = true, onRequest } = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.requests = []; child.killCount = 0; child.exited = false;
  child.reply = (request, result = {}) => child.stdout.write(`${JSON.stringify({ id: request.id, ok: true, result })}\n`);
  child.exit = (code = 0) => {
    if (child.exited) return;
    child.exited = true; child.emit('exit', code, null); child.stdout.end(); child.stderr.end();
  };
  child.kill = () => { child.killCount += 1; queueMicrotask(() => child.exit(null)); return true; };
  child.stdin = new Writable({
    write(chunk, encoding, callback) {
      try {
        for (const line of chunk.toString().trim().split('\n')) {
          const request = JSON.parse(line); child.requests.push(request);
          if (onRequest) onRequest(request, child);
          else child.reply(request, request.op === 'list' ? [] : { op: request.op });
        }
        callback();
      } catch (error) { callback(error); }
    },
    final(callback) { queueMicrotask(() => child.exit()); callback(); },
  });
  if (ready) queueMicrotask(() => child.stdout.write('{"event":"ready","protocol":1}\n'));
  return child;
}

async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'gacha-window-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return realpath(path);
}

async function client(t, options = {}) {
  const outputRoot = await directory(t);
  const child = helper(options);
  const control = await createWindowsGameClient(child, { outputRoot, expectedSize, timeoutMs: 500, readyTimeoutMs: 500 });
  t.after(() => control.close());
  return { control, child, outputRoot };
}

test('Windows helper compiles without enumerating, activating or capturing a real window', { skip: process.platform !== 'win32' }, () => {
  const script = fileURLToPath(new URL('../scripts/windows-game.ps1', import.meta.url));
  const child = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-ValidateOnly'], {
    windowsHide: true, shell: false, encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout.trim()), { event: 'validated', protocol: 1 });
});

test('real helper lists an absent allowed process and rejects attach without activation or capture', { skip: process.platform !== 'win32' }, async (t) => {
  const outputRoot = await directory(t);
  const control = await openWindowsGame({ outputRoot, expectedSize, processNames: ['gacha_ocr_test_nonexistent'] });
  try {
    assert.deepEqual(await control.status(), { attached: false, armed: false, stopped: false, stopReason: null, window: null, emergencyKey: 'F8' });
    assert.deepEqual(await control.list(), []);
    await assert.rejects(control.attach(), error => error.code === 'window-not-found');
    assert.equal((await control.status()).attached, false);
  } finally { await control.close(); }
});

test('RPC serializes commands, preserves IDs and sends no command on open or graceful destruction', async (t) => {
  const { control, child } = await client(t, { onRequest(request, child) {
    if (request.op !== 'list') child.reply(request, { op: request.op });
  } });
  assert.equal(child.requests.length, 0);
  const list = control.list();
  const status = control.status();
  await tick();
  assert.deepEqual(child.requests.map((item) => item.op), ['list']);
  child.reply(child.requests[0], [{ pid: 123 }]);
  assert.deepEqual(await list, [{ pid: 123 }]);
  assert.deepEqual(await status, { op: 'status' });
  await control.attach({ pid: 123 });
  await control.activate(); await control.arm();
  const close = control.close();
  assert.equal(control.close(), close);
  await close;
  assert.deepEqual(child.requests.map((item) => item.op), ['list', 'status', 'attach', 'activate', 'arm', 'close']);
  assert.deepEqual(child.requests.map((item) => item.id), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(child.requests[2].args, { pid: 123 });
  assert.equal(child.killCount, 0);
  await assert.rejects(control.list(), /encerrando/u);
});

test('invalid client coordinates, PID and scroll units never reach the native helper', async (t) => {
  const { control, child } = await client(t);
  for (const coordinates of [{ x: -1, y: 0 }, { x: 1440, y: 0 }, { x: 0, y: 900 }, { x: 1.2, y: 0 }, { x: 1 }, undefined]) {
    await assert.rejects(control.click(coordinates), /Coordenadas/u);
  }
  for (const delta of [0, 11, -11, 120, 0.5, undefined]) await assert.rejects(control.scroll({ x: 100, y: 200, delta }), /delta/u);
  for (const pid of [0, -1, 1.5, '123']) await assert.rejects(control.attach({ pid }), /PID/u);
  assert.equal(child.requests.length, 0);
  await control.click({ x: 1439, y: 899 });
  await control.scroll({ x: 100, y: 200, delta: -1 });
  assert.deepEqual(child.requests.map(({ op, args }) => ({ op, args })), [
    { op: 'click', args: { x: 1439, y: 899 } }, { op: 'scroll', args: { x: 100, y: 200, delta: -1 } },
  ]);
});

test('capture paths remain below outputRoot; nested output is resolved without touching another directory', async (t) => {
  const { control, child, outputRoot } = await client(t);
  for (const path of ['../escape.png', 'frame.jpg', '', resolve(outputRoot, '..', 'other.png')]) await assert.rejects(control.capture(path), /PNG/u);
  assert.equal(child.requests.length, 0);
  await control.capture('nested/frame.png');
  assert.deepEqual(child.requests[0], { id: 1, op: 'capture', args: { path: join(outputRoot, 'nested', 'frame.png') } });
  assert.equal(await resolveCapturePath(outputRoot, join(outputRoot, 'absolute.png')), join(outputRoot, 'absolute.png'));
});

test('a link escaping outputRoot is rejected before creating missing directories outside it', async (t) => {
  const root = await directory(t);
  const output = join(root, 'output'); const outside = join(root, 'outside');
  await mkdir(output); await mkdir(outside);
  await symlink(outside, join(output, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(resolveCapturePath(output, 'link/new-directory/frame.png'), /escapa/u);
  await assert.rejects(access(join(outside, 'new-directory')), { code: 'ENOENT' });
});

test('a helper error preserves its code and does not poison later serialized status calls', async (t) => {
  const { control } = await client(t, { onRequest(request, child) {
    if (request.op === 'activate') child.stdout.write(`${JSON.stringify({ id: request.id, ok: false, error: { code: 'not-attached', message: 'Anexe uma janela primeiro.' } })}\n`);
    else child.reply(request, { stopped: false });
  } });
  await assert.rejects(control.activate(), { code: 'not-attached' });
  assert.deepEqual(await control.status(), { stopped: false });
});

test('timeout kills the helper and rejects queued input instead of resuming after a stall', async (t) => {
  const outputRoot = await directory(t);
  const child = helper({ onRequest() {} });
  const control = await createWindowsGameClient(child, { outputRoot, expectedSize, timeoutMs: 25 });
  const first = control.status(); const queuedInput = control.click({ x: 1, y: 1 });
  await Promise.all([assert.rejects(first, { code: 'timeout' }), assert.rejects(queuedInput, { code: 'timeout' })]);
  assert.deepEqual(child.requests.map((item) => item.op), ['status']);
  assert.equal(child.killCount, 1);
  await control.close();
});

test('invalid protocol and startup failures terminate the helper without any native command', async (t) => {
  const outputRoot = await directory(t);
  const invalid = helper({ ready: false });
  const opening = createWindowsGameClient(invalid, { outputRoot, expectedSize, readyTimeoutMs: 500 });
  invalid.stdout.write('not-json\n');
  await assert.rejects(opening, { code: 'protocol-error' });
  assert.equal(invalid.killCount, 1); assert.equal(invalid.requests.length, 0);
  const absent = helper({ ready: false });
  await assert.rejects(createWindowsGameClient(absent, { outputRoot, expectedSize, readyTimeoutMs: 25 }), { code: 'timeout' });
  assert.equal(absent.killCount, 1); assert.equal(absent.requests.length, 0);
});

test('unexpected helper exit rejects an in-flight operation promptly', async (t) => {
  const outputRoot = await directory(t);
  const child = helper({ onRequest() {} });
  const control = await createWindowsGameClient(child, { outputRoot, expectedSize, timeoutMs: 500 });
  const status = control.status();
  const rejected = assert.rejects(status, { code: 'helper-exited' });
  await tick(); child.exit(3);
  await rejected; await control.close();
});
