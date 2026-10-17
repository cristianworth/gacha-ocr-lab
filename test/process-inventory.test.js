import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { createInventorySession, appendObservation, saveSession, finishSession } from '../src/inventory-session.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const prefix = 'gacha-process-test-';
const originalFields = { name: { status: 'recognized', value: 'Old Sword' }, level: { status: 'recognized', value: { current: 80, max: 90 } }, refinement: { status: 'recognized', value: 3 } };

async function temporary(t) {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, prefix));
  t.after(async () => {
    assert.equal(dirname(directory), parent);
    assert.ok(basename(directory).startsWith(prefix));
    await rm(directory, { recursive: true, force: true });
  });
  await cp(join(projectRoot, 'src'), join(directory, 'src'), { recursive: true });
  await mkdir(join(directory, 'scripts'));
  await cp(join(projectRoot, 'scripts/process-inventory.js'), join(directory, 'scripts/process-inventory.js'));
  await writeFile(join(directory, 'package.json'), '{"type":"module","private":true}\n');
  await symlink(join(projectRoot, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(join(directory, 'src/windows-game.js'), 'throw new Error("Windows backend must never be imported by offline processing");');
  await writeFile(join(directory, 'src/ocr.js'), `
    import { appendFile } from 'node:fs/promises';
    export async function createOcrSession(options) {
      await appendFile('stub-log.txt', JSON.stringify({ event: 'create', offline: options.offline }) + '\\n');
      return { synthetic: true, async close() { await appendFile('stub-log.txt', JSON.stringify({ event: 'close' }) + '\\n'); } };
    }
  `);
  await writeFile(join(directory, 'src/read-weapon.js'), `
    import assert from 'node:assert/strict';
    import { appendFile } from 'node:fs/promises';
    export async function readWeapon(image, options) {
      assert.equal(options.ocrSession.synthetic, true);
      assert.equal(options.game, 'genshin'); assert.equal(options.layout, 'screenshot'); assert.ok(options.panel);
      await appendFile('stub-log.txt', JSON.stringify({ event: 'read' }) + '\\n');
      if (process.env.SYNTHETIC_OCR_FAIL === 'yes') throw new Error('Synthetic OCR failure');
      if (process.env.SYNTHETIC_OCR_HANG === 'yes') return new Promise(() => {});
      return { schemaVersion: 2, game: 'genshin', source: image.source,
        fields: { name: { status: 'recognized', value: 'New Sword' }, level: { status: 'recognized', value: { current: 80, max: 90 } }, refinement: { status: 'recognized', value: 4 } }, requiresManualReview: true };
    }
  `);
  return directory;
}
function run(directory, args, env = {}) {
  const child = spawnSync(process.execPath, [join(directory, 'scripts/process-inventory.js'), ...args], {
    cwd: directory, encoding: 'utf8', windowsHide: true, timeout: 15_000, env: { ...process.env, ...env },
  });
  assert.ifError(child.error); assert.equal(child.signal, null, child.stderr); return child;
}
async function readManifest(fixture) { return JSON.parse(await readFile(fixture.path, 'utf8')); }
async function log(directory) {
  try { return (await readFile(join(directory, 'stub-log.txt'), 'utf8')).trim().split('\n').map(JSON.parse); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}
async function fixture(directory, statuses = ['included']) {
  const session = await createInventorySession(join(directory, 'data/sessions'), { config: { panel: { left: 0, top: 0, width: 370, height: 722 } } });
  await mkdir(join(session.directory, 'captures')); await mkdir(join(session.directory, 'results'));
  const image = await sharp({ create: { width: 370, height: 722, channels: 3, background: '#aaa' } }).png().toBuffer();
  const originals = [];
  for (const [index, status] of statuses.entries()) {
    const capturePath = join(session.directory, 'captures', `${index}.png`);
    const resultPath = join(session.directory, 'results', `${index}.json`);
    await writeFile(capturePath, image);
    const resultBytes = Buffer.from(` ${JSON.stringify({ schemaVersion: 2, game: 'genshin', source: { sha256: hash(image) }, fields: originalFields })}\r\n`);
    await writeFile(resultPath, resultBytes);
    const observation = await appendObservation(session, { status, capture: { path: capturePath, sha256: hash(image), panel: session.manifest.config.panel },
      resultPath, fields: originalFields, rarity: { status: status === 'scope-uncertain' ? 'uncertain' : 'recognized', value: status === 'excluded' ? 3 : status === 'scope-uncertain' ? null : 5, evidence: [] },
      error: status === 'failed' ? 'old failure retained' : null });
    originals.push({ observation, capturePath, resultPath, resultBytes, image });
  }
  await finishSession(session, { reason: 'pilot-limit', captureComplete: false, processingComplete: false, coverage: { status: 'unconfirmed', reason: 'Original coverage retained' } });
  return { session, originals, path: join(session.directory, 'inventory.json') };
}

test('offline process CLI validates arguments and session identity before synthetic OCR or mutation', async (t) => {
  const directory = await temporary(t);
  for (const args of [[], ['a', 'b'], ['--unknown']]) assert.equal(run(directory, args).status, 2);
  assert.equal(run(directory, ['--help']).status, 0);
  const value = await fixture(directory); const original = await readManifest(value);
  for (const mutate of [
    (m) => { m.game = 'hsr'; }, (m) => { m.schemaVersion = 2; }, (m) => { m.id = 'not-a-uuid'; }, (m) => { m.observations[0].id = 'bad'; },
  ]) {
    const manifest = structuredClone(original); mutate(manifest);
    const bytes = Buffer.from(JSON.stringify(manifest)); await writeFile(value.path, bytes);
    const child = run(directory, [value.path]); assert.equal(child.status, 1); assert.match(child.stderr, /Sessao Genshin/u);
    assert.deepEqual(await readFile(value.path), bytes);
  }
  assert.deepEqual(await log(directory), []);
});

test('synthetic processing shares worker and preserves scope, copies, coverage and immutable diagnostics', async (t) => {
  const directory = await temporary(t); const value = await fixture(directory, ['included', 'included', 'scope-uncertain', 'excluded', 'failed']);
  const before = await readManifest(value); const child = run(directory, [value.path]); assert.equal(child.status, 0, child.stderr);
  const manifest = await readManifest(value);
  assert.equal(manifest.items.length, 2); assert.deepEqual(manifest.observations.map((o) => o.status), before.observations.map((o) => o.status));
  assert.deepEqual(manifest.coverage, before.coverage); assert.equal(manifest.captureComplete, before.captureComplete);
  assert.deepEqual(manifest.termination, before.termination); assert.equal(manifest.reviewStatus, 'pending'); assert.equal(manifest.processingComplete, false);
  for (const index of [0, 1, 2]) {
    const observation = manifest.observations[index]; assert.equal(observation.fields.name.value, 'New Sword');
    assert.notEqual(observation.resultPath, value.originals[index].resultPath); assert.equal(observation.resultHistory.length, 1);
    assert.equal(observation.resultHistory[0].path, value.originals[index].resultPath);
    assert.equal(observation.resultHistory[0].sha256, hash(value.originals[index].resultBytes));
    assert.equal(observation.resultSha256, hash(await readFile(observation.resultPath)));
    assert.deepEqual(await readFile(value.originals[index].resultPath), value.originals[index].resultBytes);
    assert.deepEqual(await readFile(value.originals[index].capturePath), value.originals[index].image);
  }
  assert.deepEqual(manifest.observations[3], before.observations[3]); assert.deepEqual(manifest.observations[4], before.observations[4]);
  const events = await log(directory);
  assert.equal(events.filter((e) => e.event === 'create').length, 1); assert.equal(events.filter((e) => e.event === 'read').length, 3);
  assert.equal(events.filter((e) => e.event === 'close').length, 1); assert.equal(events[0].offline, true);
  assert.match(await readFile(join(value.session.directory, 'review.html'), 'utf8'), /New Sword/u);
});

test('synthetic reprocessing creates new UUID results, preserves history and makes downloads explicit', async (t) => {
  const directory = await temporary(t); const value = await fixture(directory);
  assert.equal(run(directory, [value.path]).status, 0);
  const first = await readManifest(value); const firstPath = first.observations[0].resultPath; const firstBytes = await readFile(firstPath);
  assert.equal(run(directory, [value.path, '--download-model']).status, 0);
  const second = await readManifest(value); assert.notEqual(second.observations[0].resultPath, firstPath);
  assert.equal(second.observations[0].resultHistory.length, 2); assert.equal(second.observations[0].resultHistory[1].path, firstPath);
  assert.equal(second.observations[0].resultHistory[1].sha256, hash(firstBytes)); assert.deepEqual(await readFile(firstPath), firstBytes);
  assert.equal(second.processingHistory.length, 2);
  assert.deepEqual((await log(directory)).filter((e) => e.event === 'create').map((e) => e.offline), [true, false]);
});

test('changed captures are rejected before synthetic OCR while prior values and diagnostic bytes remain', async (t) => {
  const directory = await temporary(t); const value = await fixture(directory);
  await writeFile(value.originals[0].capturePath, await sharp({ create: { width: 370, height: 722, channels: 3, background: 'white' } }).png().toBuffer());
  assert.equal(run(directory, [value.path]).status, 1); const manifest = await readManifest(value);
  assert.match(manifest.observations[0].error, /Hash da captura diverge/u); assert.deepEqual(manifest.observations[0].fields, originalFields);
  assert.equal(manifest.observations[0].resultPath, value.originals[0].resultPath);
  assert.deepEqual(await readFile(value.originals[0].resultPath), value.originals[0].resultBytes); assert.deepEqual(await log(directory), []);
  assert.equal(manifest.processingComplete, false); assert.equal(manifest.reviewStatus, 'pending');
});

test('process confines capture/result realpaths and rejects directory junction escapes before synthetic OCR', async (t) => {
  const directory = await temporary(t);
  for (const kind of ['capture-file', 'result-file', 'capture-junction', 'result-junction']) {
    const value = await fixture(directory); const outside = join(directory, `outside-${kind}`); await mkdir(outside);
    if (kind.endsWith('junction')) {
      const subtree = kind.startsWith('capture') ? 'captures' : 'results';
      await rm(outside, { recursive: true }); await rename(join(value.session.directory, subtree), outside);
      await symlink(outside, join(value.session.directory, subtree), process.platform === 'win32' ? 'junction' : 'dir');
    } else if (kind === 'capture-file') {
      const path = join(outside, 'capture.png'); await writeFile(path, value.originals[0].image);
      value.session.manifest.observations[0].capture.path = path; await saveSession(value.session);
    } else {
      const path = join(outside, 'result.json'); await writeFile(path, value.originals[0].resultBytes);
      value.session.manifest.observations[0].resultPath = path; await saveSession(value.session);
    }
    const before = await readdir(outside); const child = run(directory, [value.path]); assert.equal(child.status, 1, `${kind}: ${child.stderr}`);
    assert.deepEqual(await readdir(outside), before);
    if (kind !== 'result-junction') assert.match((await readManifest(value)).observations[0].error, /fora/u);
  }
  assert.deepEqual(await log(directory), []);
});

test('historical diagnostic tampering is detected before another synthetic OCR pass', async (t) => {
  const directory = await temporary(t); const value = await fixture(directory); assert.equal(run(directory, [value.path]).status, 0);
  const before = await log(directory); await writeFile(value.originals[0].resultPath, 'altered old diagnostic');
  assert.equal(run(directory, [value.path]).status, 1);
  assert.match((await readManifest(value)).observations[0].error, /Hash de diagnostico historico/u); assert.deepEqual(await log(directory), before);
});

test('synthetic OCR errors stay per-observation and shared worker closes once', async (t) => {
  const directory = await temporary(t); const value = await fixture(directory, ['included', 'scope-uncertain']);
  assert.equal(run(directory, [value.path], { SYNTHETIC_OCR_FAIL: 'yes' }).status, 1); const manifest = await readManifest(value);
  assert.ok(manifest.observations.every((o) => o.error === 'Synthetic OCR failure')); assert.ok(manifest.observations.every((o) => o.fields.name.value === 'Old Sword'));
  assert.equal((await log(directory)).filter((e) => e.event === 'create').length, 1); assert.equal((await log(directory)).filter((e) => e.event === 'close').length, 1);
  assert.equal(manifest.processingHistory[0].failed, 2);
  await writeFile(join(directory, 'src/ocr.js'), "export async function createOcrSession(){setInterval(()=>{},1000);throw new Error('Synthetic initialization failure');}\n");
  const next = await fixture(directory);
  assert.equal(run(directory, [next.path]).status, 1);
  assert.match((await readManifest(next)).observations[0].error, /Synthetic initialization failure/u);
});

test('synthetic bounded timeout saves partial state and stops later processing while preserving coverage', async (t) => {
  const directory = await temporary(t); const value = await fixture(directory, ['included', 'included']);
  await writeFile(join(directory, 'src/scan-control.js'), `
    import assert from 'node:assert/strict';
    export async function bounded(operation, milliseconds, label) {
      if (label !== 'OCR da captura salva') return operation();
      assert.equal(milliseconds, 30000);
      let timer;
      try { return await Promise.race([operation(), new Promise((_, reject) => {
        timer = setTimeout(() => { const error = new Error('Synthetic bounded timeout'); error.reason = 'timeout'; reject(error); }, 30);
      })]); } finally { clearTimeout(timer); }
    }
  `);
  const before = await readManifest(value); assert.equal(run(directory, [value.path], { SYNTHETIC_OCR_HANG: 'yes' }).status, 1); const manifest = await readManifest(value);
  assert.equal(manifest.processingHistory[0].timedOut, true); assert.match(manifest.observations[0].error, /Synthetic bounded timeout/u);
  assert.equal(manifest.observations[1].error, null); assert.deepEqual(manifest.coverage, before.coverage); assert.equal(manifest.processingComplete, false);
  assert.deepEqual((await log(directory)).map((event) => event.event), ['create', 'read', 'close']);
});

test('process never guesses a missing panel or sends such captures to synthetic OCR', async (t) => {
  const directory = await temporary(t); const value = await fixture(directory);
  delete value.session.manifest.config.panel; delete value.session.manifest.observations[0].capture.panel; await saveSession(value.session);
  assert.equal(run(directory, [value.path]).status, 1); assert.match((await readManifest(value)).observations[0].error, /sem painel registrado/u);
  assert.deepEqual(await log(directory), []);
});
