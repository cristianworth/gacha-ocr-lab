import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { panelRegions, readNteOffline } from '../src/nte-offline.js';

test('rejects invalid panel geometry', () => {
  const size = { width: 500, height: 600 };
  assert.throws(() => panelRegions({ left: 0, top: 0, width: 347, height: 496 }, size), /348x496/);
  assert.throws(() => panelRegions({ left: 200, top: 0, width: 348, height: 496 }, size), /fora da imagem/);
  assert.throws(() => panelRegions({ left: 0.5, top: 0, width: 348, height: 496 }, size), /inteiros/);
});

test('preserves provenance, crops, raw OCR and empty fields for review', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nte-offline-'));
  try {
    const buffer = await sharp({ create: { width: 348, height: 496, channels: 3, background: 'white' } }).png().toBuffer();
    let closed = false;
    const source = { path: 'input.png', sha256: 'source-hash' };
    const result = await readNteOffline({ buffer, source }, { panel: { left: 0, top: 0, width: 348, height: 496 }, cachePath: dir, outputDir: dir,
      createSession: async () => ({ recognize: async () => ({ rawText: '', tsv: 'raw tsv' }), close: async () => { closed = true; } }) });
    assert.deepEqual(result.source, source);
    assert.equal(result.fields.name.candidate, null);
    assert.equal(result.fields.name.status, 'review-required');
    assert.equal(result.fields.name.ocr.tsv, 'raw tsv');
    assert.equal(result.review.humanApproved, false);
    assert.equal(result.fields.name.crop.sha256.length, 64);
    assert.ok((await readFile(result.fields.name.crop.path)).length > 0);
    assert.ok(closed);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
