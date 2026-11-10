import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('desktop entry validates its run directory before opening the backend', async t => {
  const root = await mkdtemp(join(tmpdir(), 'genshin-entry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const run = join(root, '.cache', 'genshin', 'runs', 'pilot');
  await mkdir(run, { recursive: true });
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await copyFile(join(project, 'scripts', 'genshin-pilot.js'), join(root, 'scripts', 'genshin-pilot.js'));
  await writeFile(join(root, 'src', 'windows-game.js'), "export async function openWindowsGame() { throw new Error('backend-sentinel'); }");
  await writeFile(join(root, 'src', 'ocr.js'), 'export async function createOcrSession() { return { close: async () => {} }; }');
  await writeFile(join(root, 'src', 'genshin-pilot-1280.js'), 'export async function runGenshinPilot1280() {}');
  await writeFile(join(root, 'src', 'scan-control.js'), 'export async function wait() {}');
  await writeFile(join(run, 'console.log'), 'desktop log');
  const runEntry = async () => {
    try { await exec(process.execPath, [join(root, 'scripts', 'genshin-pilot.js'), '--prepared', '--run-directory', run]); }
    catch (error) { return error; }
    assert.fail('Expected the test backend to stop execution.');
  };
  const first = await runEntry();
  assert.match(first.stderr, /backend-sentinel/);
  assert.doesNotMatch(first.stderr, /Cannot access 'access'/);
  await writeFile(join(run, 'frame-0000.png'), 'preserve');
  const second = await runEntry();
  assert.match(second.stderr, /nao sera sobrescrita/);
  assert.doesNotMatch(second.stderr, /backend-sentinel/);
});
