import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { inspectNteSelection, slots, runNtePilot } from '../src/nte-pilot.js';

async function scene(indices) {
  const image = sharp({ create: { width: 1280, height: 720, channels: 3, background: '#111111' } });
  const svg = `<svg width="1280" height="720">${indices.map(i => { const s = slots[i]; return `<rect x="${s.left}" y="${s.top}" width="104" height="104" fill="none" stroke="#f32c9b" stroke-width="4"/>`; }).join('')}</svg>`;
  return image.composite([{ input: Buffer.from(svg) }]).png().toBuffer();
}
test('selection requires one outline and rejects missing or multiple targets', async () => {
  assert.equal((await inspectNteSelection(await scene([]))).verified, false);
  const one = await inspectNteSelection(await scene([1]));
  assert.equal(one.verified, true); assert.deepEqual(one.selected, slots[1]);
  assert.equal((await inspectNteSelection(await scene([0, 1]))).verified, false);
});
test('stops on wrong neighbor and saves frames and partial stage', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nte-pilot-')); const source = join(dir, 'source.png');
  const { writeFile } = await import('node:fs/promises'); await writeFile(source, await scene([1]));
  const backend = { status: async () => ({ armed: true, window: { width: 1280, height: 720, dpi: 96 } }), click: async () => {}, capture: async path => copyFile(source, path) };
  const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0]], dependencies: { wait: async () => {} } });
  assert.equal(result.reason, 'selection-or-panel-stability-unconfirmed'); assert.equal(result.observations.length, 0); assert.equal(result.frames.length, 8);
  assert.equal(JSON.parse(await readFile(join(dir, 'run', 'session.json'))).error.stage, 'selection-and-stability');
});
test('preserves prior observation on guard failure and cancellation after OCR', async () => {
  for (const mode of ['focus', 'cancel']) {
    const dir = await mkdtemp(join(tmpdir(), 'nte-pilot-')); const source = join(dir, 'source.png');
    const { writeFile } = await import('node:fs/promises'); await writeFile(source, await scene([0]));
    const controller = new AbortController(); let reads = 0;
    const backend = { status: async () => reads && mode === 'focus' ? { stopped: true, stopReason: 'focus-lost' } : { armed: true, window: { width: 1280, height: 720, dpi: 96 } }, click: async () => {}, capture: async path => copyFile(source, path) };
    const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0]], signal: controller.signal, dependencies: { wait: async () => {}, read: async () => { reads++; if (mode === 'cancel') controller.abort(); return { fields: {} }; } } });
    assert.equal(result.reason, mode === 'focus' ? 'focus-lost' : 'cancelled'); assert.equal(result.observations.length, 1); assert.equal(result.observations[0].status, 'review-required');
    assert.equal(JSON.parse(await readFile(join(dir, 'run', 'session.json'))).observations.length, 1);
  }
});
test('rejects geometry changes before clicking', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nte-pilot-')); let clicked = false;
  const backend = { status: async () => ({ armed: true, window: { width: 1279, height: 720, dpi: 96 } }), click: async () => { clicked = true; } };
  const result = await runNtePilot({ backend, output: dir, targets: [slots[0]] });
  assert.equal(result.reason, 'client-or-dpi-unverified'); assert.equal(clicked, false);
});

test('unstable panel never becomes an observation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nte-pilot-')); const source = join(dir, 'source.png');
  const { writeFile } = await import('node:fs/promises'); await writeFile(source, await scene([0])); let i = 0;
  const backend = { status: async () => ({ armed: true, window: { width: 1280, height: 720, dpi: 96 } }), click: async () => {}, capture: async path => copyFile(source, path) };
  const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0]], dependencies: { wait: async () => {}, fingerprint: async () => Buffer.from([(++i % 2) * 255]) } });
  assert.equal(result.reason, 'selection-or-panel-stability-unconfirmed'); assert.equal(result.observations.length, 0);
});
test('stable selections preserve separately ordered observations and crop directories', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'nte-pilot-')); const source = join(dir, 'source.png');
  const { writeFile } = await import('node:fs/promises'); await writeFile(source, await scene([0])); let clicked = -1; const dirs = [];
  const backend = { status: async () => ({ armed: true, window: { width: 1280, height: 720, dpi: 96 } }), click: async () => { clicked++; }, capture: async path => copyFile(source, path) };
  const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0], slots[1]], dependencies: { wait: async () => {}, inspect: async () => ({ verified: true, selected: slots[clicked] }), read: async (_image, options) => { dirs.push(options.outputDir); return { fields: {} }; } } });
  assert.equal(result.reason, 'pilot-limit'); assert.equal(result.observations.length, 2); assert.notEqual(dirs[0], dirs[1]); assert.equal(result.coverageConfirmed, false); assert.equal(result.humanApproved, false);
});

test('rejects a second partial outline as ambiguous', async () => {
  const full = await scene([0]); const s = slots[1];
  const partial = Buffer.from(`<svg width="1280" height="720"><path d="M ${s.left} ${s.top + 20} v 60 M ${s.left + 20} ${s.top + 104} h 60" fill="none" stroke="#f32c9b" stroke-width="4"/></svg>`);
  const image = await sharp(full).composite([{ input: partial }]).png().toBuffer();
  const result = await inspectNteSelection(image);
  assert.equal(result.verified, false); assert.equal(result.uncertain.length, 1);
});
