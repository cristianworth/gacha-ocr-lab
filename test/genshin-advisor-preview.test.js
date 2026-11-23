import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { buildGenshinReviewExport } from '../src/genshin-review-export.js';
import { buildGenshinAdvisorPreview, renderGenshinAdvisorPreview } from '../src/genshin-advisor-preview.js';

const bytes = value => Buffer.from(JSON.stringify(value));
const hash = value => createHash('sha256').update(value).digest('hex');
function fixture() {
  const image = Buffer.from('image');
  const observation = { position: { row: 0, column: 0 }, capture: { path: 'frame', sha256: hash(image) }, levelEligibility: 'eligible-level', reading: { fields: {
    name: { status: 'uncertain', value: null, candidates: [{ value: 'Weapon', evidence: [{ rawText: 'Weapon', rectangle: { left: 1 } }] }] },
    level: { status: 'recognized', value: { current: 60, max: 60 } } } } };
  const sessionBytes = bytes({ game: 'genshin', scope: { minLevel: 60, rarities: [3, 4, 5] }, observations: [observation, observation] });
  const reviewBytes = bytes({ game: 'genshin', session: { sha256: hash(sessionBytes) }, reviewer: 'Cristian', date: '2026-11-15', confirmedFields: ['name'], observations: [{ number: 1, position: observation.position, capture: observation.capture, name: 'Weapon' }] });
  const rarityBytes = bytes({ game: 'genshin', source: { sessionSha256: hash(sessionBytes), reviewSha256: hash(reviewBytes) }, results: [] });
  const structuredBytes = bytes(buildGenshinReviewExport({ sessionBytes, reviewBytes, rarityBytes }));
  const advisorBytes = Buffer.from('## Genshin Impact\n#### Owned 5-star weapons\n| Weapon | Signature association | Copies recorded | Refinement per copy |\n|---|---|---|---|\n| Weapon | — | 2 | R1, R1 |\n| Absent | — | 1 | R2 |\n#### Snezhnaya Battle Pass weapons\n| Weapon | Ownership |\n|---|---|\n| Weapon | Owned |\n## Other\n');
  return { sessionBytes, reviewBytes, rarityBytes, structuredBytes, advisorBytes, readCapture: async () => image };
}

test('keeps observations and matching rows separate, preserves uncertainty and field-specific review', async () => {
  const result = await buildGenshinAdvisorPreview(fixture());
  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0].candidateRows.length, 2);
  assert.equal(result.observations[1].candidateRows.length, 2);
  assert.equal(result.observations[0].fields.name.observed.status, 'uncertain');
  assert.equal(result.observations[0].fields.name.humanReview.value, 'Weapon');
  assert.equal(result.observations[0].fields.level.humanReview, null);
  assert.equal(result.observations[1].fields.name.humanReview, null);
  const text = renderGenshinAdvisorPreview(result);
  assert.match(text, /Absent/);
  assert.match(text, /Ausência não remove fatos/);
});

test('rejects changed structured export, capture, linked review and incompatible Advisor table', async () => {
  const f = fixture();
  await assert.rejects(buildGenshinAdvisorPreview({ ...f, structuredBytes: bytes({}) }), /diverge/);
  await assert.rejects(buildGenshinAdvisorPreview({ ...f, readCapture: async () => Buffer.from('changed') }), /Captura divergente/);
  await assert.rejects(buildGenshinAdvisorPreview({ ...f, reviewBytes: bytes({ game: 'genshin', session: { sha256: 'other' }, observations: [] }) }), /não corresponde/);
  await assert.rejects(buildGenshinAdvisorPreview({ ...f, advisorBytes: Buffer.from('## Genshin Impact\n#### Owned 5-star weapons\n') }), /Tabela Advisor incompatível/);
});

test('renders uncertain candidates, divergent field confirmation, unmatched names and original indicators', async () => {
  const result = await buildGenshinAdvisorPreview(fixture());
  result.levelScopeComplete = true;
  result.coverageConfirmed = false;
  result.observations[0].fields.name.humanReview.value = 'Different';
  result.observations[0].fields.level.humanReview = { value: { current: 70, max: 80 }, reviewer: 'Cristian', date: '2026-11-15' };
  result.observations[1].candidateRows = [];
  const text = renderGenshinAdvisorPreview(result, { structuredPath: 'review.json' });
  assert.match(text, /Incerto \(candidatos: Weapon\); confirmado por Cristian em 2026-11-15: Different/);
  assert.match(text, /Automático: 60\/60; confirmado por Cristian em 2026-11-15: 70\/80/);
  assert.match(text, /Sem linha candidata/);
  assert.match(text, /Término por nível: sim; cobertura confirmada: não; inventário aprovado: não/);
  assert.match(text, /review\.json/);
  assert.doesNotMatch(text.split('## Proveniência')[0], /"observed"/);
});

test('CLI accepts automatic session alone and rejects an incompatible optional analysis', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'genshin-preview-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const f = fixture();
  const session = JSON.parse(f.sessionBytes);
  const capturePath = join(dir, 'capture');
  await writeFile(capturePath, 'image');
  for (const observation of session.observations) {
    observation.capture.path = capturePath;
    observation.reading.fields.rarity = { status: 'recognized', value: 4 };
  }
  const sessionBytes = bytes(session);
  const inputs = { 'session.json': sessionBytes, 'structured.json': bytes(buildGenshinReviewExport({ sessionBytes })), 'advisor.md': f.advisorBytes,
    'bad-rarity.json': bytes({ game: 'genshin', source: { sessionSha256: 'other' }, results: [] }) };
  await Promise.all(Object.entries(inputs).map(([name, content]) => writeFile(join(dir, name), content)));
  const args = [resolve('scripts/genshin-advisor-preview.js'), '--session', join(dir, 'session.json'), '--structured', join(dir, 'structured.json'), '--advisor', join(dir, 'advisor.md')];
  const exec = promisify(execFile);
  const { stdout } = await exec(process.execPath, args);
  assert.match(stdout, /Automático: 4★/);
  assert.doesNotMatch(stdout, /confirmado por/);
  await assert.rejects(exec(process.execPath, [...args, '--rarity', join(dir, 'bad-rarity.json')]), /não corresponde/);
  for (const [name, content] of Object.entries(inputs)) assert.deepEqual(await readFile(join(dir, name)), content);
});
