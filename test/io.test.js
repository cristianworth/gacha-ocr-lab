import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readImage } from '../src/image.js';
import { saveResult, formatReview } from '../src/result.js';
import { parseWeapon } from '../src/parse-weapon.js';

const root = fileURLToPath(new URL('../', import.meta.url));

test('file errors are actionable and unsupported inputs are rejected before OCR', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gacha-ocr-'));
  try {
    await assert.rejects(readImage(join(directory, 'missing.png')), /Nao foi possivel ler/u);
    await assert.rejects(readImage(directory), /Nao foi possivel ler/u);
    const empty = join(directory, 'empty.png');
    await writeFile(empty, '');
    await assert.rejects(readImage(empty), /vazio/u);
    await writeFile(empty, 'not an image');
    await assert.rejects(readImage(empty), /Formato nao aceito/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('structured output preserves raw OCR, incomplete fields and source metadata without overwriting', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gacha-ocr-'));
  try {
    const rawText = 'Não há dados de uma arma.\n';
    const result = { schemaVersion: 1, createdAt: '2026-10-17T00:00:00.000Z',
      source: { path: 'example.png', sha256: 'example-only' },
      ocr: { rawText, confidence: 99, tsv: 'raw coordinates' },
      fields: parseWeapon(rawText), requiresManualReview: true };
    const first = await saveResult(result, directory);
    const second = await saveResult(result, directory);
    assert.notEqual(first, second);
    assert.deepEqual(JSON.parse(await readFile(first, 'utf8')), result);
    assert.match(formatReview(result), /Nome \[ausente\]/u);
    assert.match(formatReview(result), /nao mede a correcao dos campos/u);
    const blocker = join(directory, 'file');
    await writeFile(blocker, 'do not overwrite');
    await assert.rejects(saveResult(result, join(blocker, 'results')));
    assert.equal(await readFile(blocker, 'utf8'), 'do not overwrite');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI rejects batch inputs and invalid options; help does not start OCR', () => {
  for (const args of [[], ['a.png', 'b.png'], ['a.png', '--lang', 'fra'], ['--unknown']]) {
    const child = spawnSync(process.execPath, ['src/cli.js', ...args], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    assert.equal(child.status, 2, child.stderr);
    assert.doesNotMatch(child.stderr, /Executando OCR/u);
  }
  const help = spawnSync(process.execPath, ['src/cli.js', '--help'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Uma imagem/u);
  assert.match(help.stdout, /padrao e eng/u);
  assert.match(help.stdout, /1440x900/u);
  const missing = spawnSync(process.execPath, ['src/cli.js', 'missing.png'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /Nao foi possivel ler/u);
});
