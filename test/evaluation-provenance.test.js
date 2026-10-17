import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { frozenFiles, verifyEvaluationFreeze, summarizeReferences } from '../scripts/evaluation-provenance.js';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'gacha-freeze-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const hashes = {};
  for (const file of frozenFiles) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    const content = `frozen fixture: ${file}\n`;
    await writeFile(join(root, file), content);
    hashes[file] = createHash('sha256').update(content).digest('hex');
  }
  const freezePath = join(root, 'profile-freeze.json');
  const freeze = { frozenAt: '2026-10-17T00:00:00.000Z', profile: 'test-profile', hashes, reserved: ['reserved-b', 'reserved-a'] };
  await writeFile(freezePath, JSON.stringify(freeze));
  return { root, freezePath, freeze, samples: [{ id: 'reserved-a' }, { id: 'reserved-b' }] };
}

test('freeze verification preserves original bytes and records all seven verified hashes', async (t) => {
  const input = await fixture(t);
  const original = await readFile(input.freezePath);
  const verified = await verifyEvaluationFreeze(input);
  assert.deepEqual(verified.hashes, input.freeze.hashes);
  assert.deepEqual(verified.reserved, input.freeze.reserved);
  assert.equal(verified.sha256, createHash('sha256').update(original).digest('hex'));
  assert.equal(verified.path, input.freezePath);
  assert.equal(verified.frozenAt, input.freeze.frozenAt);
  assert.equal(verified.profile, input.freeze.profile);
  assert.deepEqual(await readFile(input.freezePath), original);
});

test('every core/lock file is protected against changes after freezing', async (t) => {
  const input = await fixture(t);
  for (const file of frozenFiles) {
    const path = join(input.root, file);
    const original = await readFile(path);
    await writeFile(path, 'changed after freeze');
    await assert.rejects(verifyEvaluationFreeze(input), (error) => error.message.includes(`Arquivo difere do congelamento: ${file}`));
    await writeFile(path, original);
  }
});

test('reserved IDs must match exactly, without duplicate IDs or missing hashes', async (t) => {
  const input = await fixture(t);
  for (const samples of [[{ id: 'reserved-a' }], [{ id: 'reserved-a' }, { id: 'reserved-c' }], [{ id: 'reserved-a' }, { id: 'reserved-a' }]]) {
    await assert.rejects(verifyEvaluationFreeze({ ...input, samples }), /IDs reservados/u);
  }
  const duplicate = { ...input.freeze, reserved: ['reserved-a', 'reserved-a'] };
  await writeFile(input.freezePath, JSON.stringify(duplicate));
  await assert.rejects(verifyEvaluationFreeze(input), /IDs reservados/u);
  const incomplete = { ...input.freeze, hashes: { ...input.freeze.hashes } };
  delete incomplete.hashes['src/image.js'];
  await writeFile(input.freezePath, JSON.stringify(incomplete));
  await assert.rejects(verifyEvaluationFreeze(input), /sete arquivos/u);
  await writeFile(input.freezePath, JSON.stringify({ ...input.freeze, hashes: { ...input.freeze.hashes, 'src/image.js': 'bad-hash' } }));
  await assert.rejects(verifyEvaluationFreeze(input), /Hash invalido/u);
});

test('reference summary distinguishes human confirmation, assistant inspection and missing provenance', () => {
  const rows = [
    { reference: { method: 'visual-inspection', reviewer: 'assistant', humanConfirmed: false } },
    { reference: { method: 'visual-inspection', reviewer: 'Cristian', humanConfirmed: true } },
    { reference: { method: 'visual-inspection', reviewer: 'assistant' } },
    {},
  ];
  const original = structuredClone(rows);
  assert.deepEqual(summarizeReferences(rows), {
    samples: 4,
    reviewers: [{ reviewer: 'assistant', samples: 2 }, { reviewer: 'Cristian', samples: 1 }, { reviewer: null, samples: 1 }],
    humanConfirmation: { confirmed: 1, unconfirmed: 1, unspecified: 2 },
  });
  assert.deepEqual(rows, original);
  assert.deepEqual(summarizeReferences([]), { samples: 0, reviewers: [], humanConfirmation: { confirmed: 0, unconfirmed: 0, unspecified: 0 } });
});

test('evaluation CLI rejects a different reserved set before attempting image access or OCR', async (t) => {
  const input = await fixture(t);
  const manifest = join(input.root, 'manifest.json');
  await writeFile(manifest, JSON.stringify({ samples: [{ id: 'different-id', group: 'g', split: 'evaluation', path: 'missing.png', reference: { method: 'visual-inspection' } }] }));
  const root = fileURLToPath(new URL('../', import.meta.url));
  const child = spawnSync(process.execPath, ['scripts/evaluate.js', '--manifest', manifest, '--freeze', input.freezePath, '--split', 'evaluation', '--final'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
  assert.equal(child.status, 1, child.stderr);
  assert.match(child.stderr, /IDs reservados diferem/u);
  assert.doesNotMatch(child.stderr, /Nao foi possivel ler a imagem|Falha no OCR/u);
  assert.equal(child.stdout, '');
});
