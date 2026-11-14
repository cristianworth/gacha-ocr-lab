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

async function scrollFixture(t, { match = { status: 'matched', offset: 1, overlap: 1, displacement: 12 }, levels = [90, 90, 90] } = {}) {
  const f = await fixture(t);
  const slots = [0, 1].map(row => ({ row, column: 0, rectangle: { left: 79, top: 80 + row * 117, width: 82, height: 103 } }));
  const grid = { slots, bands: [{ end: 181 }, { end: 298 }] };
  let current = null;
  let scrolls = 0;
  let reads = 0;
  const clicks = [];
  f.backend.click = async point => { current = point.y < 200 ? 0 : 1; clicks.push(point); };
  f.backend.scroll = async () => { scrolls += 1; current = null; };
  f.dependencies.inspectSelected = async () => ({ status: 'recognized', selected: scrolls ? null : slots[0], candidateCount: scrolls ? 0 : 1, grid });
  f.dependencies.inspectGrid = async () => grid;
  f.dependencies.inspectSlot = async (_frame, { rectangle }) => ({ selected: current === (rectangle.top < 150 ? 0 : 1) });
  f.dependencies.matchScroll = async () => match;
  f.dependencies.read = async () => {
    const level = levels[reads++];
    return { processing: { layoutVerified: true }, fields: { name: { value: 'Same Name' },
      level: { status: level === null ? 'uncertain' : 'recognized', value: level === null ? null : { current: level, max: 90 } },
      refinement: { value: 1 } } };
  };
  return { ...f, scrolls: () => scrolls, clickList: clicks };
}

test('bounded scroll skips overlap and retains equal names as separate observations', async t => {
  const f = await scrollFixture(t);
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, scrollProbe: true, limit: 3 });
  assert.equal(result.reason, 'position-limit');
  assert.equal(f.scrolls(), 1);
  assert.equal(f.clickList.length, 3);
  assert.deepEqual(result.observations.map(item => item.position.row), [0, 1, 2]);
  assert.equal(result.observations.every(item => item.reading.fields.name.value === 'Same Name'), true);
  assert.equal(result.coverageConfirmed, false);
});

test('ambiguous scroll stops before clicking any new positions', async t => {
  const f = await scrollFixture(t, { match: { status: 'ambiguous' } });
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, scrollProbe: true, limit: 3 });
  assert.equal(result.reason, 'scroll-ambiguous');
  assert.equal(f.scrolls(), 1);
  assert.equal(f.clickList.length, 2);
  assert.equal(result.observations.length, 2);
  assert.ok(result.scroll.after.sha256);
});

test('scroll must remain matched on a second frame before clicking new positions', async t => {
  const f = await scrollFixture(t);
  let calls = 0;
  f.dependencies.matchScroll = async () => ++calls === 1
    ? { status: 'matched', offset: 1, overlap: 1, displacement: 12 }
    : { status: 'unconfirmed' };
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, scrollProbe: true, limit: 3 });
  assert.equal(result.reason, 'scroll-stability-unconfirmed');
  assert.equal(f.scrolls(), 1);
  assert.equal(f.clickList.length, 2);
  assert.ok(result.scroll.after.sha256);
  assert.ok(result.scroll.confirmation.frame.sha256);
});

test('two scroll highlights stay candidates and do not become selected-item facts', async t => {
  const f = await scrollFixture(t);
  const slots = [
    { row: 0, column: 0, rectangle: { left: 79, top: 80, width: 82, height: 103 } },
    { row: 1, column: 0, rectangle: { left: 79, top: 197, width: 82, height: 103 } },
    { row: 1, column: 1, rectangle: { left: 177, top: 197, width: 82, height: 103 } },
  ];
  const grid = { slots, bands: [{ end: 181 }, { end: 298 }] };
  let current;
  f.backend.click = async point => { current = point; };
  f.dependencies.inspectSlot = async (_frame, { rectangle }) => ({ selected: current?.x === Math.round(rectangle.left + rectangle.width / 2) && current?.y === Math.round(rectangle.top + rectangle.height / 2) });
  f.dependencies.inspectGrid = async () => grid;
  f.dependencies.read = async () => ({ processing: { layoutVerified: true }, fields: { name: { value: 'Name' }, level: { status: 'recognized', value: { current: 90, max: 90 } }, refinement: { value: 1 } } });
  f.dependencies.inspectSelected = async () => f.scrolls() === 0 ? { status: 'recognized', selected: slots[0], grid } : {
    status: 'uncertain', selected: null, candidateCount: 2,
    candidates: [{ row: 0, column: 0 }, { row: 0, column: 1 }],
  };
  let options;
  f.dependencies.matchScroll = async (_a, _g, _b, _h, received) => {
    options = received;
    return { status: 'matched', offset: 1, overlap: 1, displacement: 12 };
  };
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, scrollProbe: true, limit: 4 });
  assert.equal(result.reason, 'position-limit');
  assert.equal(options.currentCandidates.length, 2);
  assert.deepEqual(result.scroll.candidates, [{ row: 0, column: 0 }, { row: 0, column: 1 }]);
  assert.equal(result.scroll.confirmation.candidates.length, 2);
  assert.equal(result.observations.length, 4);
});

for (const [secondDisplacement, reason, count] of [[36, 'position-limit', 3], [0, 'scroll-progress-unconfirmed', 2]]) {
  test(`a low target is not clicked before verified upward movement (${secondDisplacement}px)`, async t => {
    const f = await scrollFixture(t);
    const makeGrid = (tops) => ({ slots: tops.map((top, row) => ({ row, column: 0, rectangle: { left: 79, top, width: 82, height: 103 } })),
      bands: tops.map(top => ({ end: top + 101 })) });
    const grids = [makeGrid([80, 197]), makeGrid([185, 534]), makeGrid([149, 498])];
    let current;
    const clicks = [];
    f.backend.click = async point => { current = point; clicks.push(point); };
    f.dependencies.inspectGrid = async () => grids[Math.min(f.scrolls(), 2)];
    f.dependencies.inspectSelected = async () => f.scrolls() === 0
      ? { status: 'recognized', selected: grids[0].slots[0], grid: grids[0] }
      : { status: 'uncertain', selected: null, candidateCount: 0, candidates: [] };
    f.dependencies.inspectSlot = async (_frame, { rectangle }) => ({ selected: current?.x === Math.round(rectangle.left + rectangle.width / 2) && current?.y === Math.round(rectangle.top + rectangle.height / 2) });
    f.dependencies.matchScroll = async () => f.scrolls() === 1
      ? { status: 'matched', offset: 1, overlap: 1, displacement: 12 }
      : { status: 'no-new-complete-row', offset: 0, overlap: 2, displacement: secondDisplacement };
    const result = await runGenshinPilot1280({ ...f, ocrSession: {}, scrollProbe: true, limit: 3 });
    assert.equal(result.reason, reason);
    assert.equal(f.scrolls(), 2);
    assert.equal(clicks.length, count);
    assert.equal(result.observations.length, count);
    if (count === 3) assert.deepEqual(result.observations.map(item => item.position.row), [0, 1, 2]);
  });
}

test('traversal advances across more than four verified scrolls without repeating overlap', async t => {
  const f = await scrollFixture(t, { levels: Array(9).fill(90) });
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, scrollProbe: true, limit: 9 });
  assert.equal(result.reason, 'position-limit');
  assert.equal(f.scrolls(), 7);
  assert.deepEqual(result.observations.map(item => item.position.row), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(result.coverageConfirmed, false);
});

test('traversal stops when repeated movement yields no new safe position', async t => {
  const f = await scrollFixture(t, { match: { status: 'no-new-complete-row', offset: 0, overlap: 2, displacement: 12 } });
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, scrollProbe: true, limit: 3 });
  assert.equal(result.reason, 'scroll-without-position-limit');
  assert.equal(f.scrolls(), 16);
  assert.equal(result.observations.length, 2);
  assert.equal(result.coverageConfirmed, false);
});

test('traversal tolerates small scroll steps and reaches the level cutoff on a later row', async t => {
  const f = await scrollFixture(t, { levels: [70, 60, 59] });
  f.dependencies.matchScroll = async () => f.scrolls() < 10
    ? { status: 'no-new-complete-row', offset: 0, overlap: 2, displacement: 12 }
    : { status: 'matched', offset: 1, overlap: 1, displacement: 12 };
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, scrollProbe: true, limit: 100 });
  assert.equal(f.scrolls(), 10);
  assert.equal(result.reason, 'level-cutoff-reached');
  assert.equal(result.levelScopeComplete, true);
  assert.deepEqual(result.observations.map(item => item.position.row), [0, 1, 2]);
  assert.equal(result.coverageConfirmed, false);
});

test('cancellation during repeated scrolling preserves observations without further input', async t => {
  const f = await scrollFixture(t, { match: { status: 'no-new-complete-row', offset: 0, overlap: 2, displacement: 12 } });
  const controller = new AbortController();
  const scroll = f.backend.scroll;
  f.backend.scroll = async point => { await scroll(point); if (f.scrolls() === 5) controller.abort(); };
  const result = await runGenshinPilot1280({ ...f, ocrSession: {}, signal: controller.signal, scrollProbe: true, limit: 3 });
  assert.equal(result.reason, 'cancelled');
  assert.equal(f.scrolls(), 5);
  assert.equal(result.observations.length, 2);
  assert.equal(JSON.parse(await readFile(join(f.output, 'session.json'))).observations.length, 2);
});

for (const [levels, reason, complete] of [
  [[60, 59], 'level-cutoff-reached', true],
  [[null, 59], 'level-cutoff-with-unresolved-levels', false],
  [[60, 61], 'level-order-contradiction', undefined],
]) {
  test(`level cutoff handles ${JSON.stringify(levels)} without claiming inventory coverage`, async t => {
    const f = await scrollFixture(t, { levels });
    const result = await runGenshinPilot1280({ ...f, ocrSession: {}, scrollProbe: true, limit: 3 });
    assert.equal(result.reason, reason);
    assert.equal(result.levelScopeComplete, complete);
    assert.equal(result.coverageConfirmed, false);
    assert.equal(f.scrolls(), 0);
  });
}
