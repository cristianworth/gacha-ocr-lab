import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { getGame } from '../src/games.js';
import { selectHsrLayout, hsrProfileId } from '../src/hsr-regions.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const prefix = 'gacha-m2-cli-';
const syntheticTexts = {
  name: 'Example Light Cone', level: 'Lv. 80/80', superimposition: 'Superimposition 5',
  path: 'The following effects only work on characters of the Path of Destruction.',
};

async function sandbox(t) {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, prefix));
  t.after(async () => {
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

async function noOutput(directory) {
  for (const name of ['results', 'reviews', 'feedback']) {
    assert.deepEqual(await files(join(directory, 'data', name)), [], name);
  }
}

async function image(directory, width = 345, height = 670) {
  const path = join(directory, 'synthetic blank.png');
  await sharp({ create: { width, height, channels: 3, background: '#abc' } }).png().toFile(path);
  return path;
}

async function installSyntheticOcr(directory) {
  // Only the disposable checkout receives this double. No OCR engine or model runs in these tests.
  await writeFile(join(directory, 'src', 'ocr.js'), `
    import assert from 'node:assert/strict';
    import { hsrFieldVariants } from './hsr-regions.js';
    const texts = ${JSON.stringify(syntheticTexts)};
    export const engineVersion = 'synthetic-double-no-ocr';
    export async function recognizeImage() { throw new Error('Unexpected whole-image fallback'); }
    export async function createOcrSession(options) {
      assert.equal(options.game, 'hsr');
      assert.equal(options.languages, 'eng');
      const attempts = Object.entries(hsrFieldVariants).flatMap(([field, variants]) => variants.map(() => field));
      let index = 0;
      return {
        async recognize(buffer, segmentation) {
          assert.ok(Buffer.isBuffer(buffer));
          const field = attempts[index++];
          assert.equal(segmentation, ['name', 'path'].includes(field) ? 'SINGLE_BLOCK' : 'SINGLE_LINE');
          return { rawText: texts[field], tsv: 'synthetic coordinates', confidence: 0 };
        },
        async close() { assert.equal(index, attempts.length); },
      };
    }
  `);
}

function syntheticResult(game = 'hsr') {
  const config = getGame(game);
  return {
    schemaVersion: 2, game, itemType: config.itemType, requiresManualReview: true,
    source: { path: 'synthetic-image.png', sha256: createHash('sha256').update('synthetic-image').digest('hex') },
    ocr: { rawText: 'Synthetic diagnostic text retained verbatim\n', confidence: null },
    fields: {
      name: { status: 'recognized', value: 'Example Item' },
      level: { status: 'recognized', value: { current: config.maxLevel, max: config.maxLevel } },
      [config.progressionField]: { status: 'recognized', value: 3 },
    },
  };
}

async function fixture(directory, result = syntheticResult()) {
  const path = join(directory, 'synthetic result.json');
  const bytes = Buffer.from(`  ${JSON.stringify(result, null, 4)}\r\n`);
  await writeFile(path, bytes);
  return { path, bytes, result };
}

async function oneFeedback(directory) {
  const output = join(directory, 'data', 'feedback');
  const names = await files(output);
  assert.equal(names.length, 1);
  return JSON.parse(await readFile(join(output, names[0]), 'utf8'));
}

test('HSR CLI rejects unknown games, unsupported language, and text fallback before image access', async (t) => {
  const directory = await sandbox(t);
  const cases = [
    ['missing.png', '--game', 'unknown'], ['missing.png', '--game', 'constructor'],
    ['missing.png', '--game', 'hsr', '--lang', 'por', '--layout', 'card'],
    ['missing.png', '--game', 'hsr', '--lang', 'eng+por', '--layout', 'card'],
    ['missing.png', '--game', 'hsr', '--layout', 'text'],
    ['missing.png', '--game', 'hsr', '--layout', 'unknown'],
  ];
  for (const args of cases) {
    const child = run(directory, 'src/cli.js', args);
    assert.equal(child.status, 2, child.stderr);
    assert.doesNotMatch(child.stderr, /Executando OCR|Nao foi possivel ler/u);
  }
  await noOutput(directory);
});

test('HSR CLI requires a declared panel or explicit cropped-card mode', async (t) => {
  const directory = await sandbox(t);
  for (const args of [[], ['--layout', 'auto'], ['--layout', 'screenshot']]) {
    const child = run(directory, 'src/cli.js', ['missing.png', '--game', 'hsr', ...args]);
    assert.equal(child.status, 2, child.stderr);
    assert.match(child.stderr, /exige --panel/u);
    assert.doesNotMatch(child.stderr, /Executando OCR/u);
  }
  const incompatible = run(directory, 'src/cli.js', ['missing.png', '--game', 'hsr', '--layout', 'card', '--panel', '0,0,345,670']);
  assert.equal(incompatible.status, 2);
  assert.match(incompatible.stderr, /nao combina/u);
  await noOutput(directory);
});

test('HSR CLI rejects out-of-bounds panels and incompatible aspect ratios before OCR', async (t) => {
  const directory = await sandbox(t);
  const path = await image(directory);
  for (const panel of ['10,0,345,670', '0,0,0,670', '0,0,345,100']) {
    const child = run(directory, 'src/cli.js', [path, '--game', 'hsr', '--panel', panel, '--offline']);
    assert.equal(child.status, 1, child.stderr);
    assert.match(child.stderr, /Regiao fora|painel direito inteiro/u);
    assert.doesNotMatch(child.stderr, /Modelo eng/u);
    assert.doesNotMatch(child.stdout, /Resultado salvo/u);
  }
  await noOutput(directory);
});

test('HSR CLI with synthetic OCR responses integrates dispatch, JSON, review crops, and separate confirmation', async (t) => {
  const directory = await sandbox(t);
  const path = await image(directory);
  const originalImage = await readFile(path);
  await installSyntheticOcr(directory);
  const child = run(directory, 'src/cli.js', [path, '--game', 'hsr', '--layout', 'card', '--offline']);
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /Sobreposição \[reconhecido\]: 5/u);
  assert.doesNotMatch(child.stdout, /Refinamento|undefined|whole-image fallback/u);
  const [name] = await files(join(directory, 'data', 'results'));
  const resultPath = join(directory, 'data', 'results', name);
  const bytes = await readFile(resultPath);
  const result = JSON.parse(bytes);
  assert.equal(result.game, 'hsr');
  assert.equal(result.itemType, 'light-cone');
  assert.equal(result.processing.profile, hsrProfileId);
  assert.equal(result.processing.layoutVerified, true);
  assert.equal(result.ocr.engineVersion, 'synthetic-double-no-ocr');
  assert.equal(result.ocr.confidence, null);
  assert.equal(result.requiresManualReview, true);
  assert.deepEqual(Object.keys(result.fields), ['name', 'level', 'superimposition']);
  assert.equal(result.fields.superimposition.value, 5);
  assert.deepEqual(result.fields.level.value, { current: 80, max: 80 });
  assert.ok(result.ocr.regions.path.attempts[0].rawText.includes('Path of Destruction.'));
  const review = await readFile(result.artifacts.reviewMarkdown, 'utf8');
  assert.match(review, /Jogo: hsr · Tipo: light-cone/u);
  assert.match(review, /Restrição de Caminho \(diagnóstico do perfil\)/u);
  assert.match(review, /path-original\.png/u);
  assert.doesNotMatch(review, /Refinamento|Tipo de arma/u);
  assert.equal('refinement' in result.artifacts.regions, false);
  const anchor = await sharp(result.artifacts.regions.path.originalImage).metadata();
  assert.equal(anchor.width, result.processing.regions.path.width);
  assert.equal(anchor.height, result.processing.regions.path.height);
  const panel = await sharp(result.artifacts.panelImage).metadata();
  assert.deepEqual([panel.width, panel.height], [345, 670]);
  assert.deepEqual(await readFile(path), originalImage);
  const confirmation = run(directory, 'scripts/review-result.js', [resultPath, '--confirm-all', '--reviewer', 'Synthetic test reviewer']);
  assert.equal(confirmation.status, 0, confirmation.stderr);
  const feedback = await oneFeedback(directory);
  assert.equal(feedback.game, 'hsr');
  assert.equal(feedback.itemType, 'light-cone');
  assert.deepEqual(feedback.fields.superimposition, { value: 5, decision: 'confirmed' });
  assert.equal('refinement' in feedback.fields, false);
  assert.equal(feedback.resultSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(feedback.appliedToAccount, false);
  assert.deepEqual(await readFile(resultPath), bytes);
});

test('HSR screenshot integration with synthetic OCR keeps source-image coordinates and selected-panel crop', async (t) => {
  const directory = await sandbox(t);
  const path = await image(directory, 1440, 900);
  await installSyntheticOcr(directory);
  const child = run(directory, 'src/cli.js', [path, '--game', 'hsr', '--panel', '1000,100,345,670', '--offline']);
  assert.equal(child.status, 0, child.stderr);
  const [name] = await files(join(directory, 'data', 'results'));
  const result = JSON.parse(await readFile(join(directory, 'data', 'results', name), 'utf8'));
  assert.equal(result.processing.layout, 'screenshot');
  assert.deepEqual(result.source.imageSize, { width: 1440, height: 900 });
  assert.deepEqual(result.processing.panel, { left: 1000, top: 100, width: 345, height: 670 });
  assert.equal(result.processing.regions.name.left, 1005);
  assert.equal(result.processing.regions.name.top, 103);
  assert.equal(result.ocr.regions.name.coordinates, 'original-image');
  const crop = await sharp(result.artifacts.panelImage).metadata();
  assert.deepEqual([crop.width, crop.height], [345, 670]);
});

test('HSR feedback refuses uncertain values, then saves explicit corrections without changing original diagnostics', async (t) => {
  const directory = await sandbox(t);
  const raw = syntheticResult();
  raw.fields.superimposition = { status: 'uncertain', value: null };
  const input = await fixture(directory, raw);
  const confirm = run(directory, 'scripts/review-result.js', [input.path, '--confirm-all', '--reviewer', 'Test']);
  assert.equal(confirm.status, 1);
  assert.match(confirm.stderr, /incertos/u);
  await noOutput(directory);
  const correction = run(directory, 'scripts/review-result.js', [input.path, '--name', 'Example Item', '--level', '70', '--superimposition', '4', '--reviewer', 'Synthetic test reviewer']);
  assert.equal(correction.status, 0, correction.stderr);
  const feedback = await oneFeedback(directory);
  assert.deepEqual(feedback.fields.level, { value: { current: 70, max: null }, decision: 'corrected' });
  assert.deepEqual(feedback.fields.superimposition, { value: 4, decision: 'corrected' });
  assert.equal(feedback.sourceImageSha256, raw.source.sha256);
  assert.equal(feedback.resultSha256, createHash('sha256').update(input.bytes).digest('hex'));
  assert.deepEqual(await readFile(input.path), input.bytes);
});

test('HSR feedback rejects Genshin fields and levels above 80, including malformed blanket confirmations', async (t) => {
  const directory = await sandbox(t);
  let input = await fixture(directory);
  const common = ['--name', 'Example Item', '--reviewer', 'Test'];
  for (const args of [
    ['--level', '80/80', '--refinement', '3'],
    ['--level', '80/80', '--superimposition', '3', '--refinement', '3'],
    ['--level', '90/90', '--superimposition', '3'],
    ['--level', '80/90', '--superimposition', '3'],
    ['--level', '81', '--superimposition', '3'],
    ['--level', '80/80', '--superimposition', '6'],
  ]) {
    const child = run(directory, 'scripts/review-result.js', [input.path, ...common, ...args]);
    assert.equal(child.status, 1, child.stderr);
    assert.deepEqual(await readFile(input.path), input.bytes);
  }
  const malformed = syntheticResult();
  malformed.fields.level.value = { current: 90, max: 90 };
  input = await fixture(directory, malformed);
  const confirm = run(directory, 'scripts/review-result.js', [input.path, '--confirm-all', '--reviewer', 'Test']);
  assert.equal(confirm.status, 1);
  assert.match(confirm.stderr, /1–80/u);
  await noOutput(directory);
});

test('Genshin feedback preserves its 90-level limit and refuses HSR superimposition', async (t) => {
  const directory = await sandbox(t);
  const input = await fixture(directory, syntheticResult('genshin'));
  const invalid = run(directory, 'scripts/review-result.js', [input.path, '--name', 'Example Item', '--level', '90/90', '--superimposition', '3', '--reviewer', 'Test']);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Use --refinement/u);
  await noOutput(directory);
  const valid = run(directory, 'scripts/review-result.js', [input.path, '--confirm-all', '--reviewer', 'Synthetic test reviewer']);
  assert.equal(valid.status, 0, valid.stderr);
  const feedback = await oneFeedback(directory);
  assert.equal(feedback.game, 'genshin');
  assert.deepEqual(feedback.fields.level.value, { current: 90, max: 90 });
  assert.equal(feedback.fields.refinement.value, 3);
  assert.equal('superimposition' in feedback.fields, false);
  assert.deepEqual(await readFile(input.path), input.bytes);
});

test('review CLI refuses unknown game results instead of interpreting them as Genshin', async (t) => {
  const directory = await sandbox(t);
  for (const game of ['unknown', undefined]) {
    const raw = syntheticResult();
    raw.game = game;
    const input = await fixture(directory, raw);
    const child = run(directory, 'scripts/review-result.js', [input.path, '--confirm-all', '--reviewer', 'Test']);
    assert.equal(child.status, 1, child.stderr);
    assert.match(child.stderr, /Resultado Genshin\/HSR/u);
    assert.deepEqual(await readFile(input.path), input.bytes);
  }
  await noOutput(directory);
});

test('HSR game and region contracts stay separate while every crop remains within its source panel', () => {
  assert.equal(getGame().id, 'genshin');
  for (const game of ['unknown', 'constructor', '__proto__']) assert.throws(() => getGame(game), /Jogo desconhecido/u);
  assert.deepEqual(getGame('hsr').fieldNames, ['name', 'level', 'superimposition']);
  assert.equal(getGame('hsr').maxLevel, 80);
  const panel = { left: 1000, top: 100, width: 345, height: 670 };
  const selection = selectHsrLayout({ width: 1440, height: 900 }, { panel });
  assert.equal(selection.profile, hsrProfileId);
  assert.deepEqual(Object.keys(selection.regions), ['name', 'level', 'superimposition', 'path']);
  for (const rectangle of Object.values(selection.regions)) {
    assert.ok(rectangle.left >= panel.left && rectangle.top >= panel.top);
    assert.ok(rectangle.left + rectangle.width <= panel.left + panel.width);
    assert.ok(rectangle.top + rectangle.height <= panel.top + panel.height);
  }
  assert.throws(() => selectHsrLayout({ width: 1440, height: 900 }), /exige --panel/u);
  assert.throws(() => selectHsrLayout({ width: 1440, height: 900 }, { layout: 'text' }), /OCR geral text/u);
  assert.equal(selectHsrLayout({ width: 345, height: 670 }, { layout: 'card' }).layout, 'card');
});
