import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { interpretWuwaRegions, readWuwaOffline } from '../src/wuwa-offline.js';

const region = (...text) => ({ attempts: text.map(rawText => ({ rawText })) });
const good = () => ({ name: region('Example', 'Example'), type: region('Sword', 'Sword'), level: region('Level 20/40', 'Level 20/40'), rank: region('Rank 2', 'Rank 2') });
test('fields need agreeing reads; missing and conflicting reads remain reviewable', () => {
  const regions = good();
  regions.name = region('Example', 'Exarnple'); regions.level = region('Level 20/40', ''); regions.rank = region('Rank 2', 'Rank 3');
  const fields = interpretWuwaRegions(regions);
  for (const key of ['name', 'level', 'rank', 'rarity']) { assert.equal(fields[key].status, 'uncertain'); assert.equal(fields[key].value, null); }
  assert.deepEqual(fields.rank.candidates, [2, 3]);
  const punctuation = interpretWuwaRegions({ ...good(), name: region("Hero's Oath!", "Hero's Oath!") });
  assert.equal(punctuation.name.value, "Hero's Oath!");
  assert.equal(interpretWuwaRegions({ ...good(), name: region("Hero's Oath!", "Hero's Oath") }).name.status, 'uncertain');
  assert.equal(interpretWuwaRegions({ ...good(), type: region('', '') }).level.status, 'uncertain');
  assert.equal(interpretWuwaRegions({ ...good(), level: region('Level 90/20', 'Level 90/20') }).level.value, null);
});
test('preserves provenance, original coordinates, raw attempts and rejects invalid geometry', async () => {
  const buffer = await sharp({ create: { width: 1280, height: 720, channels: 3, background: 'black' } }).png().toBuffer();
  const image = { buffer, source: { path: 'input.png', sha256: 'test-hash', bytes: buffer.length, format: 'png' } };
  const outputs = ['Example', 'Example', 'Sword', 'Sword', 'Level 20/40', 'Level 20/40', 'Rank 2', 'Rank 2'];
  const ocrSession = { recognize: async () => ({ rawText: outputs.shift(), tsv: 'raw-tsv' }) };
  const result = await readWuwaOffline(image, { ocrSession });
  assert.equal(result.source.sha256, 'test-hash'); assert.equal(result.source.path, 'input.png');
  assert.deepEqual(result.ocr.regions.name.attempts.map(a => a.id), ['threshold-140', 'threshold-120']);
  assert.deepEqual(result.ocr.regions.level.attempts.map(a => a.id), ['threshold-140', 'threshold-110']);
  assert.equal(result.ocr.regions.name.coordinates, 'original-image'); assert.equal(result.ocr.regions.name.attempts[0].tsv, 'raw-tsv');
  assert.deepEqual(result.fields.level.value, { current: 20, max: 40 }); assert.equal(result.coverageConfirmed, false);
  await assert.rejects(readWuwaOffline(image, { client: { left: 1, top: 0, width: 1280, height: 720 }, ocrSession }), /Regiao fora/);
  await assert.rejects(readWuwaOffline(image, { client: { left: 0, top: 0, width: 600, height: 600 }, ocrSession }), /perfil offline/i);
});
