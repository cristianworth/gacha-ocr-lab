import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildGenshinReviewExport } from '../src/genshin-review-export.js';

const bytes = value => Buffer.from(JSON.stringify(value));
const hash = value => createHash('sha256').update(value).digest('hex');
const sample = () => {
  const observation = { position: { row: 0, column: 0 }, capture: { sha256: 'frame' }, levelEligibility: 'eligible-level',
    reading: { fields: { name: { status: 'uncertain', value: null, candidates: [{ value: 'Weapon' }] }, level: { status: 'recognized', value: { current: 60, max: 60 } } } } };
  const sessionBytes = bytes({ game: 'genshin', scope: { minLevel: 60, rarities: [3, 4, 5] }, observations: [observation, observation], coverageConfirmed: false });
  const reviewBytes = bytes({ game: 'genshin', session: { sha256: hash(sessionBytes) }, reviewer: 'Cristian', date: '2026-11-15', confirmedFields: ['name'],
    observations: [{ number: 1, position: observation.position, capture: observation.capture, name: 'Weapon' }] });
  const rarityBytes = bytes({ game: 'genshin', source: { sessionSha256: hash(sessionBytes), reviewSha256: hash(reviewBytes) },
    results: [{ position: 1, captureSha256: 'frame', rarity: { status: 'recognized', value: 4 } }] });
  return { sessionBytes, reviewBytes, rarityBytes };
};

test('review output preserves uncertain OCR, separately attributes confirmation and keeps duplicate observations', () => {
  const result = buildGenshinReviewExport(sample());
  assert.equal(result.observations.length, 2);
  assert.equal(result.observations[0].fields.name.observed.status, 'uncertain');
  assert.equal(result.observations[0].fields.name.humanReview.value, 'Weapon');
  assert.equal(result.observations[1].fields.name.humanReview, null);
  assert.equal(result.observations[0].fields.rarity.observedSource, 'rarity-replay');
  assert.equal(result.observations[0].fields.rarity.humanReview, null);
  assert.equal(result.observations[1].fields.rarity.observed, null);
  assert.equal(result.inventoryAccepted, false);
});

test('review output rejects foreign sessions, mismatched frames and duplicate review positions', () => {
  const f = sample();
  const review = JSON.parse(f.reviewBytes);
  review.session.sha256 = 'different';
  assert.throws(() => buildGenshinReviewExport({ ...f, reviewBytes: bytes(review) }), /não corresponde/);
  const duplicate = JSON.parse(f.reviewBytes);
  duplicate.observations.push(duplicate.observations[0]);
  assert.throws(() => buildGenshinReviewExport({ ...f, reviewBytes: bytes(duplicate), rarityBytes: null }), /referência de revisão/i);
  const rarity = JSON.parse(f.rarityBytes);
  rarity.results[0].captureSha256 = 'different';
  assert.throws(() => buildGenshinReviewExport({ ...f, rarityBytes: bytes(rarity) }), /referência de raridade/i);
});
