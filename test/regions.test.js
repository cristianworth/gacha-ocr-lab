import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { inspectImage, selectLayout, validateRectangle, parseRectangle, prepareRegion } from '../src/regions.js';
import { interpretRegion, interpretRegions, normalizeName } from '../src/parse-regions.js';
import { scoreField, summarize } from '../scripts/evaluation-utils.js';

const rectangle = { left: 1, top: 2, width: 10, height: 10 };
const region = (...texts) => ({ rectangle, attempts: texts.map((rawText, index) => ({ id: String(index), rawText })) });

test('region interpretation joins multiline names and normalizes only typography', () => {
  const name = interpretRegion('name', region('“Example\nSword”', '"Example Sword"'));
  assert.equal(name.status, 'recognized');
  assert.equal(name.value, '"Example Sword"');
  assert.equal(name.candidates[0].evidence[0].rawText, '“Example\nSword”');
  assert.equal(normalizeName(' Épée  d’Essai '), "Épée d'Essai");
});

test('conflicts and a single valid reading are uncertain; no confidence majority voting', () => {
  for (const texts of [['Alpha Sword', 'Alpba Sword'], ['Alpha Sword', '']]) {
    const field = interpretRegion('name', region(...texts));
    assert.equal(field.status, 'uncertain');
    assert.equal(field.value, null);
  }
  const field = interpretRegion('level', region('Lv. 80/90', 'Lv. 90/90'));
  assert.equal(field.status, 'uncertain');
  assert.equal(interpretRegion('name', region('', '')).status, 'absent');
});

test('strict regional numeric interpretation never repairs digits or ignores trailing junk', () => {
  for (const raw of ['Lv. 8O/90', 'Lv. 80/9O', 'Lv. 80/', 'Lv. 80/70', 'Lv. 90/90 text', '90']) {
    assert.equal(interpretRegion('level', region(raw, raw)).status, 'uncertain', raw);
  }
  assert.deepEqual(interpretRegion('level', region('Lv. 80', 'Lv. 80')).value, { current: 80, max: null });
  assert.equal(interpretRegion('refinement', region('Refinement Rank 5', 'Refinement Rank 5')).value, 5);
  for (const raw of ['Refinement Rank S', 'Refinement Rank 6', '1', 'Refinement Rank 1/5']) assert.equal(interpretRegion('refinement', region(raw, raw)).value, null);
});

test('unverified panel anchor prevents recognized fields', () => {
  const input = { weaponType: region('Unknown header'), name: region('Alpha Sword', 'Alpha Sword'),
    level: region('Lv. 80/90', 'Lv. 80/90'), refinement: region('Refinement Rank 3', 'Refinement Rank 3') };
  const result = interpretRegions(input);
  assert.equal(result.layoutVerified, false);
  assert.deepEqual(Object.values(result.fields).map((field) => field.status), ['uncertain', 'uncertain', 'uncertain']);
  input.weaponType = region('Sword');
  assert.equal(interpretRegions(input).layoutVerified, true);
});

test('layout selection keeps rectangles in original-image coordinates and rejects invalid input', () => {
  const size = { width: 1444, height: 932 };
  const panel = { left: 982, top: 125, width: 370, height: 722 };
  const screenshot = selectLayout(size, { panel });
  const card = selectLayout({ width: 370, height: 722 }, { layout: 'card' });
  for (const key of Object.keys(card.regions)) {
    assert.equal(screenshot.regions[key].left, card.regions[key].left + panel.left);
    assert.equal(screenshot.regions[key].top, card.regions[key].top + panel.top);
  }
  assert.equal(selectLayout({ width: 370, height: 722 }).layout, 'card');
  assert.equal(selectLayout(size).layout, 'text');
  assert.throws(() => selectLayout(size, { layout: 'screenshot' }), /exige/u);
  assert.throws(() => selectLayout(size, { layout: 'card', panel }), /combinado/u);
  assert.throws(() => validateRectangle({ left: 1400, top: 0, width: 100, height: 10 }, size), /fora/u);
  assert.throws(() => validateRectangle({ left: 0, top: 0, width: 0, height: 1 }, size), /invalidas/u);
  assert.throws(() => parseRectangle('1,2,3.5,4'), /inteiros/u);
  assert.deepEqual(parseRectangle('1,2,3,4'), { left: 1, top: 2, width: 3, height: 4 });
});

test('decoding records original dimensions; preprocessing keeps white padding after inversion', async () => {
  const original = await sharp({ create: { width: 40, height: 30, channels: 3, background: 'white' } }).png().toBuffer();
  const copy = Buffer.from(original);
  assert.deepEqual(await inspectImage(original), { width: 40, height: 30 });
  const prepared = await prepareRegion(original, { left: 5, top: 4, width: 10, height: 6 }, { threshold: 220 });
  const meta = await sharp(prepared.buffer).metadata();
  assert.deepEqual([meta.width, meta.height], [60, 48]);
  const { data } = await sharp(prepared.buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.subarray(0, 3)], [255, 255, 255]);
  assert.deepEqual(original, copy);
  await assert.rejects(inspectImage(Buffer.from('broken')), /decodificar/u);
});

test('evaluation separates correct candidates from accepted values and silent errors', () => {
  const candidate = { status: 'uncertain', value: null, candidates: [{ valid: true, value: 'Example Sword' }] };
  assert.equal(scoreField('name', candidate, 'Example Sword'), 'candidate-only');
  assert.equal(scoreField('name', { ...candidate, status: 'recognized', value: 'Wrong Sword' }, 'Example Sword'), 'wrong-accepted');
  assert.equal(scoreField('name', { ...candidate, status: 'recognized', value: 'Example Sword' }, 'Example Sword'), 'correct');
  assert.equal(scoreField('level', { status: 'absent', value: null, candidates: [] }, null), 'correct-absence');
  const summary = summarize([{ scores: { name: 'candidate-only', level: 'correct', refinement: 'wrong-accepted' } }]);
  assert.equal(summary.name.counts.correct, undefined);
  assert.equal(summary.refinement.counts['wrong-accepted'], 1);
});
