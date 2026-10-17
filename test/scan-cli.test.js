import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
const root = fileURLToPath(new URL('../', import.meta.url));
async function sandbox(t) {
  const parent = resolve(tmpdir()); const directory = await mkdtemp(join(parent, 'gacha-m3-cli-'));
  t.after(async () => { assert.equal(dirname(directory), parent); assert.ok(basename(directory).startsWith('gacha-m3-cli-')); await rm(directory, { recursive: true, force: true }); });
  await cp(join(root, 'src'), join(directory, 'src'), { recursive: true });
  await writeFile(join(directory, 'package.json'), '{"type":"module","private":true}\n');
  await symlink(join(root, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  await writeFile(join(directory, 'src', 'windows-game.js'), "export async function openWindowsGame() { throw new Error('NATIVE_BACKEND_MUST_NOT_RUN_IN_THIS_TEST'); }\n");
  return directory;
}
function run(directory, args) {
  const child = spawnSync(process.execPath, [join(directory, 'src', 'scan-cli.js'), ...args], { cwd: directory, encoding: 'utf8', windowsHide: true, timeout: 15_000 });
  assert.ifError(child.error); assert.equal(child.signal, null, child.stderr); return child;
}
async function sessions(directory) {
  const path = join(directory, 'data', 'sessions');
  try { return (await readdir(path)).map(id => join(path, id)); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

test('scan CLI help and rejected arguments create no session and never initialize a native backend', async t => {
  const directory = await sandbox(t);
  const help = run(directory, ['--help']); assert.equal(help.status, 0); assert.match(help.stdout, /F8|1440x900/u);
  for (const args of [['--full', '--limit', '10'], ['--limit', '0'], ['--pid', '-1'], ['--max-pages', '0'], ['--expected-count', '1.5'], ['--capture', '--full'], ['--capture', '--image', 'x.png'], ['--game', 'hsr']]) {
    const result = run(directory, args); assert.equal(result.status, 2, result.stderr); assert.doesNotMatch(result.stderr, /NATIVE_BACKEND/u);
  }
  assert.deepEqual(await sessions(directory), []);
});

test('scan CLI offline model failure saves partial diagnostics before any native activation', async t => {
  const directory = await sandbox(t);
  const result = run(directory, ['--limit', '1', '--delay', '0']);
  assert.equal(result.status, 1, result.stderr); assert.match(result.stderr, /Modelo eng ausente/u); assert.doesNotMatch(result.stderr, /NATIVE_BACKEND/u);
  const [path] = await sessions(directory); const manifest = JSON.parse(await readFile(join(path, 'inventory.json'), 'utf8'));
  assert.equal(manifest.status, 'failed'); assert.equal(manifest.captureComplete, false); assert.deepEqual(manifest.items, []);
  assert.ok(await readFile(join(path, 'review.html'), 'utf8'));
  // Model initialization can fail after the library has allocated a long-lived worker.
  await writeFile(join(directory, 'src', 'ocr.js'), "export const engineVersion='synthetic'; export async function createOcrSession(){setInterval(()=>{},1000);throw new Error('SYNTHETIC_INITIALIZATION_FAILURE');} export async function recognizeImage(){}\n");
  const failed = run(directory, ['--limit', '1', '--delay', '0']);
  assert.equal(failed.status, 1); assert.match(failed.stderr, /SYNTHETIC_INITIALIZATION_FAILURE/u);
  assert.equal((await sessions(directory)).length, 2);
});

test('image diagnostic CLI uses static synthetic vision only and writes copied image, overlay and review', async t => {
  const directory = await sandbox(t);
  await writeFile(join(directory, 'src', 'ocr.js'), "export const engineVersion='not-initialized'; export async function createOcrSession(){throw new Error('OCR_MUST_NOT_RUN');} export async function recognizeImage(){throw new Error('OCR_MUST_NOT_RUN');}\n");
  await writeFile(join(directory, 'src', 'genshin-inventory.js'), `
    export async function inspectInventory(){return {profile:'synthetic-vision',panel:{left:980,top:90,width:370,height:722},slots:[{rectangle:{left:80,top:90,width:95,height:115}}]};}
    export async function readRarity(){return {status:'recognized',value:5,evidence:{synthetic:true}};}
    export async function inspectSelection(){} export function matchRows(){}
  `);
  const original = await sharp({ create: { width:1440,height:900,channels:3,background:'white' } }).png().toBuffer();
  const source = join(directory, 'synthetic.png'); await writeFile(source, original);
  const result = run(directory, ['--image', source]);
  assert.equal(result.status, 0, result.stderr); assert.doesNotMatch(result.stderr, /NATIVE_BACKEND|OCR_MUST_NOT_RUN/u);
  const [path] = await sessions(directory); const manifest = JSON.parse(await readFile(join(path, 'inventory.json'), 'utf8'));
  assert.equal(manifest.termination.reason, 'capture-only'); assert.equal(manifest.captureComplete, false); assert.equal(manifest.diagnostic.profile, 'synthetic-vision');
  assert.deepEqual(await readFile(manifest.initialCapture), original); assert.deepEqual(await readFile(source), original);
  assert.equal((await sharp(manifest.preview).metadata()).width, 1440);
  assert.match(await readFile(join(path, 'review.html'), 'utf8'), /Captura inicial/u);
});
