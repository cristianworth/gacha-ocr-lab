import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readGenshin1280, inspectGenshin1280Selection, inspectGenshin1280Grid } from '../src/genshin-1280.js';

test('offline profile requires an explicit client for window screenshots', async () => {
  const buffer = await sharp({ create: { width: 1282, height: 751, channels: 3, background: 'black' } }).png().toBuffer();
  const image = { buffer, source: {} };
  await assert.rejects(readGenshin1280(image), /retangulo do cliente/);
  await assert.rejects(readGenshin1280(image, { client: { left: 1, top: 30, width: 1279, height: 720 } }), /cliente 1280x720/);
  await assert.rejects(readGenshin1280(image, { client: { left: 3, top: 30, width: 1280, height: 720 } }), /fora da imagem/);
});

test('selection inspection rejects a partial row and does not infer movement', async () => {
  const buffer = await sharp({ create: { width: 1280, height: 720, channels: 3, background: 'black' } }).png().toBuffer();
  const image = { buffer, source: {} };
  await assert.rejects(inspectGenshin1280Selection(image, { rectangle: { left: 79, top: 600, width: 82, height: 102 } }), /cartoes completos/);
  const selection = await inspectGenshin1280Selection(image, { rectangle: { left: 79, top: 80, width: 82, height: 102 } });
  assert.equal(selection.selected, false);
  assert.equal(selection.confirmsMovement, false);
  assert.equal(selection.offlineOnly, true);
  await assert.rejects(inspectGenshin1280Grid(image), /Grade 1280x720 inconclusiva/);
});

test('offline profile translates panel regions and keeps uncertain values', async () => {
  const buffer = await sharp({ create: { width: 1282, height: 751, channels: 3, background: 'black' } }).png().toBuffer();
  const responses = ['Test Weapon', 'Test Weapon', 'Lv. 90/90', 'Lv. 90/80', 'Refinement Rank 1', 'Refinement Rank 1', 'Bow'];
  const result = await readGenshin1280({ buffer, source: { sha256: 'original' } }, {
    client: { left: 1, top: 30, width: 1280, height: 720 },
    ocrSession: { recognize: async () => ({ rawText: responses.shift(), confidence: null }) },
  });
  assert.deepEqual(result.processing.panel, { left: 874, top: 109, width: 327, height: 638 });
  assert.equal(result.source.sha256, 'original');
  assert.equal(result.fields.name.value, 'Test Weapon');
  assert.equal(result.fields.level.status, 'uncertain');
  assert.equal(result.fields.level.value, null);
  assert.equal(result.processing.clientProfileValidatedLive, false);
});
