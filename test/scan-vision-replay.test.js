import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { scene } from '../test-support/genshin-scene.js';
import { inspectInventory } from '../src/genshin-inventory.js';
import { createInventorySession } from '../src/inventory-session.js';
import { runInventoryScan } from '../src/scan-inventory.js';

test('synthetic ten-position pilot uses real vision, selection, rarity and stability with simulated OCR/input', async t => {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, 'gacha-vision-replay-'));
  t.after(async () => {
    assert.equal(dirname(directory), parent);
    assert.ok(basename(directory).startsWith('gacha-vision-replay-'));
    await rm(directory, { recursive: true, force: true });
  });
  const names = Array.from({ length: 10 }, (_, index) => index < 2 ? 'Identical Sword' : 'Synthetic Sword ' + index);
  const initial = await scene({ selected: 0, outlineOpacity: 0.65, portrait: true, identicalArt: true, panelText: names[0] });
  const inventory = await inspectInventory(initial);
  const session = await createInventorySession(directory);
  let selected = 0, previous = 0, phase = null, captures = 0;
  const clicks = [];
  const backend = {
    async status() { return { armed: true, stopped: false }; },
    async capture(path) {
      captures += 1;
      if (phase === null) { await writeFile(path, initial, { flag: 'wx' }); return; }
      phase += 1;
      const dim = phase === 1;
      const image = await scene({ selected: dim ? -1 : selected, outlineOpacity: 0.65, portrait: true, identicalArt: true,
        rarity: selected < 6 ? 5 : 4, panelText: names[dim ? previous : selected] });
      await writeFile(path, image, { flag: 'wx' });
    },
    async click(point) {
      previous = selected;
      selected = inventory.slots.findIndex(slot => slot.center.x === point.x && slot.center.y === point.y);
      assert.ok(selected >= 0 && selected < 10);
      clicks.push(selected); phase = 0;
    },
    async scroll() { assert.fail('A pilot must not scroll.'); },
  };
  const dependencies = {
    inspectPreparation: async () => ({ verified: true, observedTotal: 30 }),
    wait: async () => {},
    readWeapon: async image => ({ schemaVersion: 2, game: 'genshin', source: image.source, requiresManualReview: true,
      ocr: { rawText: 'Synthetic OCR double; this test does not measure text recognition.' },
      fields: { name: { status: 'recognized', value: names[selected] },
        level: { status: 'recognized', value: { current: 90, max: 90 } },
        refinement: { status: 'recognized', value: 1 } } }),
  };
  const outcome = await runInventoryScan({ backend, session, dependencies, options: { limit: 10, selectionTimeoutMs: 8000 } });
  assert.equal(outcome.reason, 'pilot-limit', outcome.error);
  assert.deepEqual(clicks, Array.from({ length: 10 }, (_, index) => index));
  assert.equal(captures, 31);
  assert.equal(session.manifest.items.length, 10);
  assert.equal(new Set(session.manifest.items.map(item => item.id)).size, 10);
  assert.deepEqual(session.manifest.items.map(item => item.fields.name.value), names);
  assert.deepEqual(session.manifest.items.map(item => item.rarity.value), [5, 5, 5, 5, 5, 5, 4, 4, 4, 4]);
  assert.ok(session.manifest.items.every(item => item.selection.attempts === 3 && item.selection.stability.meanPixelDistance === 0));
  assert.equal((await readdir(join(session.directory, 'captures'))).length, 11);
  assert.equal(session.manifest.captureComplete, false);
  assert.equal(session.manifest.processingComplete, true);
  assert.equal(session.manifest.reviewStatus, 'pending');
  const review = await readFile(join(session.directory, 'review.html'), 'utf8');
  assert.match(review, /Identical Sword/u);
  assert.match(review, /Revisão humana pendente/u);
});
