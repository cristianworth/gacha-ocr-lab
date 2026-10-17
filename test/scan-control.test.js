import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { inspectPreparation, checkScanControl, pixelDistance, bounded, wait } from '../src/scan-control.js';

test('scan control stops on cancellation or lost focus without issuing input', async () => {
  const signal = AbortSignal.abort();
  await assert.rejects(checkScanControl({ status: () => assert.fail('status not needed') }, signal), error => error.reason === 'cancelled');
  await assert.rejects(checkScanControl({ status: async () => ({ armed: false, stopped: true, stopReason: 'focus-lost' }) }), error => error.reason === 'focus-lost');
  assert.equal((await checkScanControl({ status: async () => ({ armed: true, stopped: false }) })).armed, true);
});

test('stability measures fields independently of OCR and rejects incompatible fingerprints', () => {
  assert.equal(pixelDistance(Buffer.from([10, 20]), Buffer.from([10, 20])), 0);
  assert.equal(pixelDistance(Buffer.from([10, 20]), Buffer.from([12, 16])), 3);
  assert.equal(pixelDistance(Buffer.alloc(0), Buffer.alloc(0)), Infinity);
  assert.equal(pixelDistance(null, Buffer.from([1])), Infinity);
});

test('bounded work times out and abortable waits stop promptly', async () => {
  await assert.rejects(bounded(() => new Promise(() => {}), 10, 'synthetic operation'), error => error.reason === 'timeout');
  assert.equal(await bounded(async () => 42, 100, 'completed'), 42);
  const controller = new AbortController();
  const pending = wait(10_000, controller.signal);
  controller.abort();
  await assert.rejects(pending, error => error.reason === 'cancelled');
});


test('preparation requires exact screen labels and agreeing counts without using confidence as proof', async () => {
  const image = await sharp({ create: { width: 1440, height: 900, channels: 3, background: 'white' } }).png().toBuffer();
  async function inspect(texts) {
    let index = 0;
    return inspectPreparation(image, { recognize: async () => ({ rawText: texts[index++], confidence: 100 }) });
  }
  const valid = await inspect(['Weapons', 'Quality', 'Weapons 269/2000', 'Weapons 269/2000']);
  assert.equal(valid.verified, true);
  assert.equal(valid.observedTotal, 269);
  assert.equal(valid.totalIncludesOtherRarities, true);
  const mismatch = await inspect(['Weapons', 'Quality', 'Weapons 269/2000', 'Weapons 26/2000']);
  assert.equal(mismatch.observedTotal, null);
  const clipped = await inspect(['Weapons', 'uality', 'Weapons 269/2000', 'Weapons 269/2000']);
  assert.equal(clipped.verified, false);
  const impossible = await inspect(['Weapons', 'Quality', 'Weapons 269/200', 'Weapons 269/200']);
  assert.equal(impossible.observedTotal, null);
});
