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

test('reading preserves the original OCR cause when closing also fails', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'nte-close-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const buffer = await sharp({ create: { width: 348, height: 496, channels: 3, background: 'white' } }).png().toBuffer();
  const original = new Error('original reading OCR failure', { cause: new Error('original cause') });
  const closing = new Error('reading OCR close failed');
  await assert.rejects(readNteOffline({ buffer, source: {} }, { panel: { left: 0, top: 0, width: 348, height: 496 }, outputDir: dir, cachePath: dir,
    createSession: async () => ({ recognize: async () => { throw original; }, close: async () => { throw closing; } }),
  }), error => error === original && error.cause.message === 'original cause' && error.finalizationError === closing);
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
    assert.deepEqual(result.fields.element.crop.rectangle, { left: 240, top: 86, width: 90, height: 28 });
    assert.equal(result.fields.tier.crop.rectangle.left, 39);
    assert.ok(result.fields.element.processing.operations.includes('threshold-120'));
    assert.ok(result.fields.category.processing.operations.includes('threshold-120'));
    assert.ok(result.fields.tier.processing.operations.includes('normalize'));
    assert.equal(result.review.humanApproved, false);
    assert.equal(result.fields.name.crop.sha256.length, 64);
    assert.ok((await readFile(result.fields.name.crop.path)).length > 0);
    assert.ok(closed);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
