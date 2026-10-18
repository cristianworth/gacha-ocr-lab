import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { createInventorySession } from '../src/inventory-session.js';
import { runInventoryScan, assessCoverage } from '../src/scan-inventory.js';
import { matchRows } from '../src/genshin-inventory.js';

const fields = () => ({ name: { status: 'recognized', value: 'Identical Sword', candidates: [] },
  level: { status: 'recognized', value: { current: 90, max: 90 }, candidates: [] },
  refinement: { status: 'recognized', value: 1, candidates: [] } });
function row(signature, index, rarities = [5, 5]) {
  return { signature, index, complete: true, top: 90 + index * 130, bottom: 200 + index * 130,
    slots: rarities.map((rarity, column) => ({ row: index, column, rarity, center: { x: 110 + column * 110, y: 140 + index * 130 }, rectangle: { left: 80 + column * 110, top: 90 + index * 130, width: 95, height: 110 }, signature: `${signature}-${column}` })) };
}
function page(rows, { top = true, bottom = false, signature } = {}) {
  return { profile: 'synthetic', panel: { left: 980, top: 90, width: 370, height: 722 }, rows,
    slots: rows.flatMap(row => row.slots), gridSignature: signature ?? rows.map(row => row.signature).join('|'),
    scrollbar: { status: 'recognized', atTop: top, atBottom: bottom } };
}
async function fixture(t, pages, { prepared = true, total = 999, selection = true, stoppedAfter } = {}) {
  const parent = resolve(tmpdir()); const directory = await mkdtemp(join(parent, 'gacha-m3-runner-'));
  t.after(async () => { assert.equal(dirname(directory), parent); assert.ok(basename(directory).startsWith('gacha-m3-runner-')); await rm(directory, { recursive: true, force: true }); });
  const session = await createInventorySession(directory);
  const png = await sharp({ create: { width: 1440, height: 900, channels: 3, background: '#aaaaaa' } }).png().toBuffer();
  let pageIndex = 0; let lastSlot; let statusCalls = 0; const calls = [];
  const backend = {
    async status() { statusCalls += 1; return stoppedAfter && statusCalls >= stoppedAfter ? { armed: false, stopped: true, stopReason: 'focus-lost' } : { armed: true, stopped: false }; },
    async capture(path) { calls.push('capture'); await writeFile(path, png, { flag: 'wx' }); },
    async click(point) { calls.push('click'); lastSlot = pages[pageIndex].slots.find(slot => slot.center.x === point.x && slot.center.y === point.y); assert.ok(lastSlot); },
    async scroll() { calls.push('scroll'); pageIndex = Math.min(pageIndex + 1, pages.length - 1); },
  };
  const dependencies = {
    inspectPreparation: async () => ({ verified: prepared, observedTotal: total }),
    inspectInventory: async () => pages[pageIndex], inspectSelection: async () => typeof selection === 'object' ? selection : ({ selected: selection }),
    fieldFingerprint: async () => Buffer.from([10, 20, 30]),
    readRarity: async () => lastSlot.rarity === null ? { status: 'uncertain', value: null } : { status: 'recognized', value: lastSlot.rarity },
    wait: async () => {},
    readWeapon: async image => ({ schemaVersion: 2, game: 'genshin', itemType: 'weapon', source: image.source, fields: fields(), requiresManualReview: true, ocr: { rawText: 'synthetic double, no recognition' } }),
  };
  return { session, backend, dependencies, calls };
}

test('synthetic scan visits overlapping rows once while preserving identical copies', async t => {
  const initial = page([row('A', 0), row('B', 1), row('C', 2)]);
  const next = page([row('B', 0), row('C', 1), row('D', 2, [4, 4])], { top: false });
  const last = page([row('C', 0), row('D', 1, [4, 4]), row('E', 2, [3])], { top: false });
  const f = await fixture(t, [initial, next, last]);
  const result = await runInventoryScan({ ...f, options: { full: true, expectedCount: 8 } });
  assert.equal(result.reason, 'rarity-cutoff');
  assert.equal(result.error, null);
  assert.equal(f.session.manifest.items.length, 8);
  assert.equal(new Set(f.session.manifest.items.map(item => item.id)).size, 8);
  assert.ok(f.session.manifest.items.every(item => item.fields.name.value === 'Identical Sword'));
  assert.equal(f.session.manifest.observations.length, 9);
  assert.equal(f.session.manifest.coverage.status, 'verified');
  assert.equal(f.session.manifest.captureComplete, true);
  assert.equal(f.session.manifest.reviewStatus, 'pending');
  assert.equal(f.calls.filter(call => call === 'click').length, 9);
  assert.ok((await readFile(join(f.session.directory, 'review.html'), 'utf8')).includes('Revisão humana pendente'));
});

test('synthetic pilot saves a partial inventory at the requested positional limit', async t => {
  const f = await fixture(t, [page([row('A', 0), row('B', 1)])]);
  await runInventoryScan({ ...f, options: { limit: 2 } });
  assert.equal(f.session.manifest.items.length, 2);
  assert.equal(f.session.manifest.termination.reason, 'pilot-limit');
  assert.equal(f.session.manifest.captureComplete, false);
  assert.equal(f.session.manifest.coverage.status, 'unconfirmed');
  assert.equal(f.calls.filter(call => call === 'scroll').length, 0);
});

test('synthetic uncertain rarity remains visible and blocks verified coverage', async t => {
  const f = await fixture(t, [page([row('A', 0, [5, null]), row('B', 1, [3])])]);
  await runInventoryScan({ ...f, options: { full: true, expectedCount: 1 } });
  assert.equal(f.session.manifest.observations[1].status, 'scope-uncertain');
  assert.equal(f.session.manifest.observations[1].fields.name.value, 'Identical Sword');
  assert.equal(f.session.manifest.coverage.status, 'unconfirmed');
  assert.equal(f.session.manifest.coverage.scopePending, 1);
  assert.equal(f.session.manifest.items.length, 1);
});

test('preparation and start failures issue no clicks and keep an actionable partial session', async t => {
  for (const prepared of [true, false]) {
    const f = await fixture(t, [page([row('A', 0)], { top: false })], { prepared });
    await runInventoryScan({ ...f, options: { limit: 1 } });
    assert.equal(f.calls.includes('click'), false);
    assert.equal(f.session.manifest.status, 'failed');
    assert.equal(f.session.manifest.captureComplete, false);
    assert.match(f.session.manifest.termination.reason, /preparation-unverified|start-unverified/u);
    if (prepared) {
      const saved = JSON.parse(await readFile(join(f.session.directory, 'inventory.json'), 'utf8'));
      assert.equal(saved.initialInspection.scrollbar.atTop, false);
      assert.equal(saved.initialInspection.completeRows, 1);
    }
  }
});

test('declared start is recorded as user evidence rather than automatic detection', async t => {
  const f = await fixture(t, [page([row('A', 0)], { top: false })]);
  f.dependencies.inspectInventory = async () => ({ ...page([row('A', 0)]), scrollbar: { status: 'uncertain', atTop: null, atBottom: null } });
  await runInventoryScan({ ...f, options: { limit: 1, startAtTopDeclared: true } });
  assert.equal(f.session.manifest.startEvidence.method, 'user-declared');
  assert.equal(f.session.manifest.items.length, 1);
  assert.equal(f.session.manifest.captureComplete, false);
});

test('synthetic lost-focus and stale selection stop without reusing an old item', async t => {
  const f = await fixture(t, [page([row('A', 0)])], { stoppedAfter: 4 });
  await runInventoryScan({ ...f });
  assert.equal(f.session.manifest.termination.reason, 'focus-lost');
  assert.equal(f.session.manifest.items.length, 0);
  const stale = await fixture(t, [page([row('A', 0)])], { selection: false });
  await runInventoryScan({ ...stale, options: { selectionTimeoutMs: 15 } });
  assert.equal(stale.session.manifest.termination.reason, 'selection-timeout');
  assert.equal(stale.session.manifest.items.length, 0);
  assert.ok(stale.session.manifest.lastDiagnostic.path);
});

test('ambiguous overlap is partial, and confirmed bottom requires repeated unchanged views', async t => {
  const f = await fixture(t, [page([row('A', 0), row('B', 1)]), page([row('A', 0), row('A', 1)], { top: false })]);
  await runInventoryScan({ ...f, options: { full: true }, dependencies: { ...f.dependencies, matchRows } });
  assert.equal(f.session.manifest.termination.reason, 'ambiguous-row-overlap');
  assert.equal(f.session.manifest.captureComplete, false);
  const end = await fixture(t, [page([row('A', 0), row('B', 1)], { bottom: true })]);
  await runInventoryScan({ ...end, options: { full: true, expectedCount: 4 } });
  assert.equal(end.calls.filter(call => call === 'scroll').length, 3);
  assert.equal(end.session.manifest.termination.reason, 'list-end');
  assert.equal(end.session.manifest.coverage.status, 'verified');
});

test('coverage never equates readable fields with complete collection', () => {
  const observations = [{ status: 'included', fields: fields() }];
  assert.equal(assessCoverage({ reason: 'pilot-limit', topVerified: true, expectedCount: 1, observations }).status, 'unconfirmed');
  assert.equal(assessCoverage({ reason: 'rarity-cutoff', topVerified: true, observations }).status, 'unconfirmed');
  assert.equal(assessCoverage({ reason: 'rarity-cutoff', topVerified: true, expectedCount: 2, observations }).status, 'unconfirmed');
  assert.equal(assessCoverage({ reason: 'rarity-cutoff', topVerified: true, expectedCount: 1, observations }).status, 'verified');
});


test('selection contradicted by the grid signature never creates a weapon', async t => {
  const f = await fixture(t, [page([row('A', 0)])], { selection: { selected: true, evidence: { expectedSignatureMatches: false } } });
  await runInventoryScan({ ...f });
  assert.equal(f.session.manifest.termination.reason, 'grid-changed');
  assert.equal(f.session.manifest.items.length, 0);
  assert.equal(f.session.manifest.observations.length, 0);
  assert.ok(f.session.manifest.lastDiagnostic.path);
});

test('declared top never overrides recognized evidence that the list is scrolled', async t => {
  const f = await fixture(t, [page([row('A', 0)], { top: false })]);
  await runInventoryScan({ ...f, options: { startAtTopDeclared: true } });
  assert.equal(f.session.manifest.termination.reason, 'start-unverified');
  assert.equal(f.calls.includes('click'), false);
});

test('pilot page boundary and configured maximum page prevent additional scroll input', async t => {
  for (const options of [{ limit: 20 }, { full: true, maxPages: 1 }]) {
    const f = await fixture(t, [page([row('A', 0), row('B', 1)])]);
    await runInventoryScan({ ...f, options });
    assert.equal(f.calls.includes('scroll'), false);
    assert.equal(f.session.manifest.captureComplete, false);
    assert.equal(f.session.manifest.termination.reason, options.full ? 'page-limit' : 'pilot-page-end');
  }
});


test('abort during OCR preserves the captured copy and terminates with a string cancellation reason', async t => {
  const controller = new AbortController();
  const f = await fixture(t, [page([row('A', 0)])]);
  const outcome = await runInventoryScan({ ...f, signal: controller.signal, dependencies: { ...f.dependencies,
    readWeapon: async () => { controller.abort(); controller.signal.throwIfAborted(); },
  } });
  assert.equal(outcome.reason, 'cancelled');
  assert.equal(f.session.manifest.termination.reason, 'cancelled');
  assert.equal(f.session.manifest.items.length, 1);
  assert.equal(f.session.manifest.items[0].fields, null);
  assert.ok(f.session.manifest.items[0].error);
  assert.equal(f.session.manifest.captureComplete, false);
});


test('an initial low-rarity card does not prove an empty eligible inventory', async t => {
  const f = await fixture(t, [page([row('A', 0, [3, 4])])]);
  await runInventoryScan({ ...f, options: { full: true, expectedCount: 0 } });
  assert.equal(f.session.manifest.termination.reason, 'scope-order-unverified');
  assert.equal(f.session.manifest.captureComplete, false);
  assert.equal(f.session.manifest.coverage.status, 'unconfirmed');
  assert.equal(f.calls.filter(call => call === 'click').length, 1);
});
