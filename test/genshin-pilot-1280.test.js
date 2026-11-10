import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { runGenshinPilot1280 } from '../src/genshin-pilot-1280.js';

async function fixture(t, { dpi = 96, selected = true } = {}) {
  const output = await mkdtemp(join(tmpdir(), 'genshin-pilot-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const png = await sharp({ create: { width: 1280, height: 720, channels: 3, background: 'black' } }).png().toBuffer();
  let clicks = 0;
  const backend = {
    status: async () => ({ armed: true, stopped: false, window: { dpi, width: 1280, height: 720 } }),
    capture: async path => writeFile(path, png),
    click: async () => { clicks += 1; },
  };
  const slot = { row: 0, column: 0, rectangle: { left: 79, top: 80, width: 82, height: 103 } };
  const grid = { slots: [slot], bands: [{ end: 181 }] };
  const dependencies = {
    header: async () => ({ verified: true }),
    inspectSelected: async () => ({ status: 'recognized', selected: slot, grid }),
    inspectGrid: async () => grid,
    inspectSlot: async () => ({ selected }),
    fingerprint: async () => Buffer.from([1, 2, 3]),
    read: async () => ({ processing: { layoutVerified: true }, fields: { name: { value: 'Weapon' }, level: { value: { current: 20, max: 20 } }, refinement: { value: 1 } } }),
    wait: async () => {},
  };
  return { output, backend, dependencies, clicks: () => clicks };
}

test('pilot refuses wrong DPI before capture or input and saves a partial result', async t => {
  const f = await fixture(t, { dpi: 120 });
  const result = await runGenshinPilot1280({ ...f, ocrSession: {} });
  assert.equal(result.reason, 'client-or-dpi-unverified');
  assert.equal(f.clicks(), 0);
  assert.equal(JSON.parse(await readFile(join(f.output, 'session.json'))).captureComplete, false);
});

test('pilot records a stable confirmed selection without claiming coverage', async t => {
  const f = await fixture(t);
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, limit: 1 });
  assert.equal(f.clicks(), 1);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].stability.consecutiveFrames, 2);
  assert.equal(result.reason, 'pilot-limit');
  assert.equal(result.coverageConfirmed, false);
  assert.equal(result.inventoryAccepted, false);
});

test('pilot stops after an unconfirmed selection instead of recording or clicking again', async t => {
  const f = await fixture(t, { selected: false });
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, limit: 1 });
  assert.equal(f.clicks(), 1);
  assert.equal(result.reason, 'selection-or-panel-stability-unconfirmed');
  assert.equal(result.observations.length, 0);
  assert.equal(result.captureComplete, false);
  assert.equal(result.currentAttempt.stage, 'waiting-for-selection');
  assert.equal(result.currentAttempt.frames, 8);
  assert.ok(result.lastCapture.sha256);
});

test('pilot preserves raw OCR when the weapon anchor is unverified', async t => {
  const f = await fixture(t);
  f.dependencies.read = async () => ({ processing: { layoutVerified: false }, ocr: { rawText: 'raw OCR' },
    fields: { name: { value: null }, level: { value: null }, refinement: { value: null } } });
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, limit: 1 });
  const saved = JSON.parse(await readFile(join(f.output, 'session.json')));
  assert.equal(result.reason, 'weapon-type-unverified');
  assert.equal(f.clicks(), 1);
  assert.equal(saved.observations[0].status, 'layout-unverified');
  assert.equal(saved.observations[0].reading.ocr.rawText, 'raw OCR');
});

test('pilot does not click if stop arrives during window status check', async t => {
  const f = await fixture(t);
  const controller = new AbortController();
  f.backend.status = async () => {
    controller.abort();
    return { armed: true, stopped: false, window: { dpi: 96, width: 1280, height: 720 } };
  };
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, signal: controller.signal });
  assert.equal(result.reason, 'cancelled');
  assert.equal(f.clicks(), 0);
});

test('pilot retains the last frame reference if focus is lost just after capture', async t => {
  const f = await fixture(t);
  let checks = 0;
  f.backend.status = async () => ++checks === 1
    ? { armed: true, stopped: false, window: { dpi: 96, width: 1280, height: 720 } }
    : { armed: false, stopped: true, stopReason: 'focus-lost' };
  const result = await runGenshinPilot1280({ ...f, ocrSession: {} });
  assert.equal(result.reason, 'focus-lost');
  assert.ok(result.lastCapture.sha256);
  assert.equal(f.clicks(), 0);
  assert.equal(JSON.parse(await readFile(join(f.output, 'session.json'))).lastCapture.sha256, result.lastCapture.sha256);
});

test('pilot retains a captured observation if OCR fails', async t => {
  const f = await fixture(t);
  f.dependencies.read = async () => { throw new Error('synthetic OCR failure'); };
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, limit: 1 });
  assert.equal(result.reason, 'synthetic OCR failure');
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].status, 'captured-pending-ocr');
  assert.ok(result.observations[0].capture.sha256);
  assert.match(await readFile(join(f.output, 'summary.md'), 'utf8'), /\?/);
});

test('pilot observes a cooperative stop before sending a click', async t => {
  const f = await fixture(t);
  const controller = new AbortController();
  f.dependencies.inspectSelected = async () => {
    controller.abort();
    return { status: 'recognized', selected: { row: 0, column: 0 }, grid: { slots: [{ row: 0, column: 0 }], bands: [] } };
  };
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, signal: controller.signal });
  assert.equal(result.reason, 'cancelled');
  assert.equal(f.clicks(), 0);
  assert.equal(result.captureComplete, false);
});
