import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, copyFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { inspectNteSelection, inspectNtePreparation, slots, runNtePilot, renderNteSummary } from '../src/nte-pilot.js';

async function tempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), 'nte-pilot-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const prepare = async () => ({ verified: true, ocr: { rawText: 'Arc' } });

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
test('stops on wrong neighbor and saves frames and partial stage', async t => {
  const dir = await tempDir(t); const source = join(dir, 'source.png');
  await writeFile(source, await scene([1]));
  const backend = { status: async () => ({ armed: true, window: { width: 1280, height: 720, dpi: 96 } }), click: async () => {}, capture: async path => copyFile(source, path) };
  const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0]], dependencies: { prepare, wait: async () => {} } });
  assert.equal(result.reason, 'selection-or-panel-stability-unconfirmed'); assert.equal(result.observations.length, 0); assert.equal(result.frames.length, 9);
  assert.equal(JSON.parse(await readFile(join(dir, 'run', 'session.json'))).error.stage, 'selection-and-stability');
});
test('preserves prior observation on guard failure and cancellation after OCR', async t => {
  for (const mode of ['focus', 'cancel']) {
    const dir = await tempDir(t); const source = join(dir, 'source.png');
    await writeFile(source, await scene([0]));
    const controller = new AbortController(); let reads = 0;
    const backend = { status: async () => reads && mode === 'focus' ? { stopped: true, stopReason: 'focus-lost' } : { armed: true, window: { width: 1280, height: 720, dpi: 96 } }, click: async () => {}, capture: async path => copyFile(source, path) };
    const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0]], signal: controller.signal, dependencies: { prepare, wait: async () => {}, read: async () => { reads++; if (mode === 'cancel') controller.abort(); return { fields: {} }; } } });
    assert.equal(result.reason, mode === 'focus' ? 'focus-lost' : 'cancelled'); assert.equal(result.observations.length, 1); assert.equal(result.observations[0].status, 'review-required');
    assert.equal(JSON.parse(await readFile(join(dir, 'run', 'session.json'))).observations.length, 1);
  }
});
test('rejects geometry changes before clicking', async t => {
  const dir = await tempDir(t); let clicked = false;
  const backend = { status: async () => ({ armed: true, window: { width: 1279, height: 720, dpi: 96 } }), click: async () => { clicked = true; } };
  const result = await runNtePilot({ backend, output: dir, targets: [slots[0]] });
  assert.equal(result.reason, 'client-or-dpi-unverified'); assert.equal(clicked, false);
});

test('unstable panel never becomes an observation', async t => {
  const dir = await tempDir(t); const source = join(dir, 'source.png');
  await writeFile(source, await scene([0])); let i = 0;
  const backend = { status: async () => ({ armed: true, window: { width: 1280, height: 720, dpi: 96 } }), click: async () => {}, capture: async path => copyFile(source, path) };
  const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0]], dependencies: { prepare, wait: async () => {}, fingerprint: async () => Buffer.from([(++i % 2) * 255]) } });
  assert.equal(result.reason, 'selection-or-panel-stability-unconfirmed'); assert.equal(result.observations.length, 0);
});
test('stable selections preserve separately ordered observations and crop directories', async t => {
  const dir = await tempDir(t); const source = join(dir, 'source.png');
  await writeFile(source, await scene([0])); let clicked = -1; const dirs = [];
  const backend = { status: async () => ({ armed: true, window: { width: 1280, height: 720, dpi: 96 } }), click: async () => { clicked++; }, capture: async path => copyFile(source, path) };
  const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0], slots[1]], dependencies: { prepare, wait: async () => {}, inspect: async () => ({ verified: true, selected: slots[Math.max(0, clicked)] }), read: async (_image, options) => { dirs.push(options.outputDir); return { fields: {} }; } } });
  assert.equal(result.reason, 'pilot-limit'); assert.equal(result.observations.length, 2); assert.notEqual(dirs[0], dirs[1]); assert.equal(result.coverageConfirmed, false); assert.equal(result.humanApproved, false);
});

test('rejects a second partial outline as ambiguous', async () => {
  const full = await scene([0]); const s = slots[1];
  const partial = Buffer.from(`<svg width="1280" height="720"><path d="M ${s.left} ${s.top + 20} v 60 M ${s.left + 20} ${s.top + 104} h 60" fill="none" stroke="#f32c9b" stroke-width="4"/></svg>`);
  const image = await sharp(full).composite([{ input: partial }]).png().toBuffer();
  const result = await inspectNteSelection(image);
  assert.equal(result.verified, false); assert.equal(result.uncertain.length, 1);
});

test('preflight refuses empty or wrong category and ambiguous initial selection without a click', async t => {
  for (const [text, outlines] of [['', [0]], ['Weapons', [0]], ['Arc', [0, 1]]]) {
    const dir = await tempDir(t), source = join(dir, 'source.png');
    await writeFile(source, await scene(outlines)); let clicks = 0;
    const backend = { status: async () => ({ armed: true, window: { width: 1280, height: 720, dpi: 96 } }), click: async () => { clicks++; }, capture: async path => copyFile(source, path) };
    const fakeSession = async () => ({ recognize: async () => ({ rawText: text }), close: async () => {} });
    const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0]], dependencies: { prepare: image => inspectNtePreparation(image, '', fakeSession) } });
    assert.equal(clicks, 0); assert.equal(result.error.stage, 'preparation');
    assert.equal(result.reason, outlines.length > 1 ? 'initial-selection-unverified' : 'arc-category-unverified');
    assert.ok(result.preparation.frame.sha256);
  }
});

test('cancellation before and after preparation preserves a partial session without clicks', async t => {
  for (const when of ['before', 'after']) {
    const dir = await tempDir(t), source = join(dir, 'source.png'); await writeFile(source, await scene([0]));
    const controller = new AbortController(); let clicks = 0;
    if (when === 'before') controller.abort();
    const backend = { status: async () => ({ armed: true, window: { width: 1280, height: 720, dpi: 96 } }), click: async () => { clicks++; }, capture: async path => copyFile(source, path) };
    const result = await runNtePilot({ backend, output: join(dir, 'run'), targets: [slots[0]], signal: controller.signal, dependencies: { prepare: async () => { controller.abort(); return { verified: true, ocr: { rawText: 'Arc' } }; } } });
    assert.equal(result.reason, 'cancelled'); assert.equal(clicks, 0);
    const saved = JSON.parse(await readFile(join(dir, 'run', 'session.json')));
    assert.equal(saved.error.stage, 'preparation');
    if (when === 'after') assert.equal(saved.preparation.category.ocr.rawText, 'Arc');
  }
});

test('summary distinguishes captured pending OCR from review-required candidates', () => {
  const output = resolve('output');
  const report = { reason: 'cancelled', observations: [
    { target: slots[0], status: 'captured-pending-ocr', frame: { path: join(output, 'frame-001.png') }, reading: null },
    { target: slots[1], status: 'review-required', frame: { path: join(output, 'frame-002.png') }, reading: { fields: { name: { candidate: 'Example' }, level: { candidate: 'Lvl 80' }, element: { candidate: 'Plasma' }, attribute1: { candidate: 'ATK 512' }, attribute2: { candidate: 'ATK 27%' }, tier: { candidate: '1Tier' } } } },
  ] };
  const summary = renderNteSummary(report, output);
  assert.match(summary, /captured-pending-ocr \| \? \| \?/u);
  assert.match(summary, /review-required \| Example \| Lvl 80 \| Plasma \| ATK 512; ATK 27% \| 1Tier/u);
  assert.match(summary, /\[frame\]\(frame-002\.png\)/u);
});

test('CLI anchors run directory to repository when invoked from another cwd', async t => {
  const dir = await tempDir(t);
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const cli = join(repo, 'scripts', 'nte-pilot.js');
  const result = spawnSync(process.execPath, [cli, '--prepared', '--process', 'Unused', '--target', '73,107,105,105', '--models', 'missing-models'], { cwd: dir, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /Modelo eng\.traineddata ausente/u);
  const path = result.stdout.match(/Sessao: (.+)/u)?.[1]?.trim();
  assert.ok(path); assert.equal(dirname(path), join(repo, '.cache', 'nte', 'runs'));
  t.after(() => rm(path, { recursive: true, force: true }));
  const report = JSON.parse(await readFile(join(path, 'session.json')));
  assert.equal(report.error.stage, 'preparation');
});

test('records uncertain click transition when input may have been sent before a guard failure', async t => {
  const dir = await tempDir(t), source = join(dir, 'source.png'), output = join(dir, 'run');
  await writeFile(source, await scene([0])); let sent = false;
  const backend = {
    status: async () => ({ armed: true, window: { width: 1280, height: 720, dpi: 96 } }),
    capture: async path => copyFile(source, path),
    click: async () => { sent = true; throw new Error('post-input-guard-failure'); },
  };
  const result = await runNtePilot({ backend, output, targets: [slots[0]], dependencies: { prepare } });
  const saved = JSON.parse(await readFile(join(output, 'session.json')));
  assert.equal(sent, true); assert.equal(result.reason, 'post-input-guard-failure');
  assert.equal(saved.error.stage, 'click-in-progress'); assert.equal(saved.currentAttempt.stage, 'click-in-progress');
  assert.equal(saved.observations.length, 0); assert.ok(saved.preparation.frame.sha256);
});

test('final guard can stop after recording click transition without sending input', async t => {
  const dir = await tempDir(t), source = join(dir, 'source.png'), output = join(dir, 'run');
  await writeFile(source, await scene([0])); let clicked = false;
  const backend = {
    status: async () => {
      const report = JSON.parse(await readFile(join(output, 'session.json')));
      return report.currentAttempt?.stage === 'click-in-progress' ? { stopped: true, stopReason: 'focus-lost' } : { armed: true, window: { width: 1280, height: 720, dpi: 96 } };
    },
    capture: async path => copyFile(source, path), click: async () => { clicked = true; },
  };
  const result = await runNtePilot({ backend, output, targets: [slots[0]], dependencies: { prepare } });
  const saved = JSON.parse(await readFile(join(output, 'session.json')));
  assert.equal(clicked, false); assert.equal(result.reason, 'focus-lost');
  assert.equal(saved.error.stage, 'click-in-progress'); assert.equal(saved.observations.length, 0);
});
