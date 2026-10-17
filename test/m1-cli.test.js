import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const prefix = 'gacha-m1-cli-';

async function sandbox(t) {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, prefix));
  t.after(async () => {
    // Only delete the exact temporary checkout created by this test.
    assert.equal(dirname(directory), parent);
    assert.ok(basename(directory).startsWith(prefix));
    await rm(directory, { recursive: true, force: true });
  });
  await cp(join(projectRoot, 'src'), join(directory, 'src'), { recursive: true });
  await mkdir(join(directory, 'scripts'));
  await cp(join(projectRoot, 'scripts', 'review-result.js'), join(directory, 'scripts', 'review-result.js'));
  await writeFile(join(directory, 'package.json'), '{"type":"module","private":true}\n');
  await symlink(join(projectRoot, 'node_modules'), join(directory, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  return directory;
}

function run(directory, script, args) {
  const child = spawnSync(process.execPath, [join(directory, script), ...args], {
    cwd: directory, encoding: 'utf8', timeout: 15_000, windowsHide: true,
  });
  assert.ifError(child.error);
  assert.equal(child.signal, null, child.stderr);
  return child;
}

async function files(directory) {
  try { return await readdir(directory); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function assertNoOutput(directory) {
  for (const name of ['results', 'reviews', 'feedback']) {
    assert.deepEqual(await files(join(directory, 'data', name)), [], `Unexpected ${name} artifacts`);
  }
}

function syntheticResult() {
  return {
    schemaVersion: 2, game: 'genshin', itemType: 'weapon', requiresManualReview: true,
    source: { path: 'synthetic-reference.png', sha256: createHash('sha256').update('synthetic-image-reference').digest('hex') },
    ocr: { rawText: 'Example Sword\nLv. 80/90\nRefinement Rank 3\n', confidence: null },
    fields: {
      name: { status: 'recognized', value: 'Example Sword' },
      level: { status: 'recognized', value: { current: 80, max: 90 } },
      refinement: { status: 'recognized', value: 3 },
    },
  };
}

async function fixture(directory, result = syntheticResult()) {
  const path = join(directory, 'synthetic result.json');
  // Formatting is intentional: review must preserve the original bytes, not just equivalent JSON.
  const bytes = Buffer.from(`  ${JSON.stringify(result, null, 4)}\r\n`);
  await writeFile(path, bytes);
  return { path, bytes, result };
}

async function readFeedback(directory) {
  const output = join(directory, 'data', 'feedback');
  return Promise.all((await files(output)).map(async (name) => ({
    name, value: JSON.parse(await readFile(join(output, name), 'utf8')),
  })));
}

test('CLI rejects invalid layout and panel arguments without producing artifacts', async (t) => {
  const directory = await sandbox(t);
  const cases = [
    ['missing.png', '--layout', 'unknown'],
    ['missing.png', '--layout', 'screenshot'],
    ['missing.png', '--panel', '1,2,3'],
    ['missing.png', '--panel', '1.5,2,3,4'],
    ['missing.png', '--panel', '1,2,3,4', '--layout', 'card'],
    ['missing.png', '--panel', '1,2,3,4', '--layout', 'text'],
  ];
  for (const args of cases) {
    const child = run(directory, 'src/cli.js', args);
    assert.equal(child.status, 2, child.stderr);
    assert.doesNotMatch(child.stderr, /Executando OCR/u);
    assert.doesNotMatch(child.stdout, /Resultado salvo/u);
  }
  await assertNoOutput(directory);
});

test('CLI rejects unreadable or corrupt images without publishing a successful result', async (t) => {
  const directory = await sandbox(t);
  await writeFile(join(directory, 'empty.png'), '');
  await writeFile(join(directory, 'not-image.png'), 'not an image');
  await writeFile(join(directory, 'corrupt.png'), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  for (const [name, message] of [
    ['missing.png', /Nao foi possivel ler/u], ['empty.png', /vazio/u],
    ['not-image.png', /Formato nao aceito/u], ['corrupt.png', /decodificar/u],
  ]) {
    const child = run(directory, 'src/cli.js', [name, '--offline']);
    assert.equal(child.status, 1, child.stderr);
    assert.match(child.stderr, message);
    assert.doesNotMatch(child.stdout, /Resultado salvo|Revisao visual/u);
  }
  await assertNoOutput(directory);
});

test('offline CLI with no model fails locally and saves no result or model', async (t) => {
  const directory = await sandbox(t);
  const imagePath = join(directory, 'blank.png');
  await sharp({ create: { width: 370, height: 722, channels: 3, background: 'white' } }).png().toFile(imagePath);
  const original = await readFile(imagePath);
  const child = run(directory, 'src/cli.js', ['blank.png', '--layout', 'card', '--offline']);
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /Modelo eng ausente no cache/u);
  assert.deepEqual(await files(join(directory, '.cache', 'models')), []);
  assert.deepEqual(await readFile(imagePath), original);
  assert.doesNotMatch(child.stdout, /Resultado salvo|Revisao visual/u);
  await assertNoOutput(directory);
});

test('review CLI saves unique independent feedback linked to the unchanged result bytes', async (t) => {
  const directory = await sandbox(t);
  const input = await fixture(directory);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const child = run(directory, 'scripts/review-result.js', [input.path, '--confirm-all', '--reviewer', 'Synthetic test reviewer']);
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /Revisao registrada separadamente/u);
  }
  const reviews = await readFeedback(directory);
  assert.equal(reviews.length, 2);
  assert.notEqual(reviews[0].name, reviews[1].name);
  for (const { value } of reviews) {
    assert.equal(value.resultPath, input.path);
    assert.equal(value.resultSha256, createHash('sha256').update(input.bytes).digest('hex'));
    assert.equal(value.sourceImageSha256, input.result.source.sha256);
    assert.equal(value.reviewer, 'Synthetic test reviewer');
    assert.equal(value.appliedToAccount, false);
    assert.ok(Object.values(value.fields).every((field) => field.decision === 'confirmed'));
  }
  assert.deepEqual(await readFile(input.path), input.bytes);
  assert.deepEqual(await files(join(directory, 'data', 'results')), []);
});

test('review CLI refuses blanket confirmation for uncertain or absent fields', async (t) => {
  const directory = await sandbox(t);
  for (const status of ['uncertain', 'absent']) {
    const result = syntheticResult();
    result.fields.level = { status, value: null, candidates: [{ current: 80, max: 90 }] };
    const input = await fixture(directory, result);
    const child = run(directory, 'scripts/review-result.js', [input.path, '--confirm-all', '--reviewer', 'Synthetic test reviewer']);
    assert.equal(child.status, 1, child.stderr);
    assert.match(child.stderr, /Campos ausentes\/incertos/u);
    assert.deepEqual(await readFile(input.path), input.bytes);
  }
  await assertNoOutput(directory);
});

test('review CLI records explicit corrections while preserving missing level limit and raw OCR', async (t) => {
  const directory = await sandbox(t);
  const result = syntheticResult();
  result.fields.level = { status: 'uncertain', value: null };
  const input = await fixture(directory, result);
  const child = run(directory, 'scripts/review-result.js', [input.path,
    '--name', 'Example Sword', '--level', '80', '--refinement', '4', '--reviewer', 'Synthetic test reviewer']);
  assert.equal(child.status, 0, child.stderr);
  const [{ value }] = await readFeedback(directory);
  assert.deepEqual(value.fields.name, { value: 'Example Sword', decision: 'confirmed' });
  assert.deepEqual(value.fields.level, { value: { current: 80, max: null }, decision: 'corrected' });
  assert.deepEqual(value.fields.refinement, { value: 4, decision: 'corrected' });
  assert.equal(value.appliedToAccount, false);
  assert.deepEqual(await readFile(input.path), input.bytes);
  assert.equal(JSON.parse(await readFile(input.path, 'utf8')).ocr.rawText, result.ocr.rawText);
});

test('review CLI rejects incomplete, contradictory, or invalid human decisions without feedback', async (t) => {
  const directory = await sandbox(t);
  const input = await fixture(directory);
  for (const args of [
    ['--confirm-all'],
    ['--confirm-all', '--reviewer', 'Test', '--name', 'Override'],
    ['--reviewer', 'Test', '--name', 'Example Sword', '--level', '90/80', '--refinement', '3'],
    ['--reviewer', 'Test', '--name', 'Example Sword', '--level', '80', '--refinement', '6'],
    ['--reviewer', 'Test', '--level', '80', '--refinement', '3'],
  ]) {
    const child = run(directory, 'scripts/review-result.js', [input.path, ...args]);
    assert.equal(child.status, 1, child.stderr);
    assert.match(child.stderr, /Erro:/u);
    assert.doesNotMatch(child.stdout, /Revisao registrada/u);
  }
  assert.deepEqual(await readFile(input.path), input.bytes);
  await assertNoOutput(directory);
});
