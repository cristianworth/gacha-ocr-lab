import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { createFeedback } from '../src/feedback.js';
import { writeVisualReview, markdownCell } from '../src/review.js';
import { selectLayout } from '../src/regions.js';
import { interpretRegion } from '../src/parse-regions.js';
import { formatReview } from '../src/result.js';

function result() {
  return { schemaVersion: 2, game: 'genshin', source: { path: 'local.png', sha256: 'image-hash' },
    fields: { name: { status: 'recognized', value: 'Example Sword' }, level: { status: 'recognized', value: { current: 80, max: 90 } }, refinement: { status: 'recognized', value: 3 } } };
}

test('human feedback is linked to original bytes, never changes raw result, and requires a reviewer', () => {
  const bytes = Buffer.from(JSON.stringify(result()));
  const original = Buffer.from(bytes);
  const feedback = createFeedback(bytes, { confirmAll: true, reviewer: 'Test reviewer' });
  assert.equal(feedback.fields.name.decision, 'confirmed');
  assert.equal(feedback.resultSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(feedback.appliedToAccount, false);
  assert.deepEqual(bytes, original);
  assert.throws(() => createFeedback(bytes, { confirmAll: true }), /reviewer/u);
  assert.throws(() => createFeedback(bytes, { confirmAll: true, reviewer: 'Test', name: 'Override' }), /ambos/u);
});

test('uncertain results require explicit corrected values; malformed confirmations are refused', () => {
  const raw = result(); raw.fields.name.status = 'uncertain'; raw.fields.name.value = null;
  const bytes = Buffer.from(JSON.stringify(raw));
  assert.throws(() => createFeedback(bytes, { confirmAll: true, reviewer: 'Test' }), /incertos/u);
  const corrected = createFeedback(bytes, { reviewer: 'Test', name: 'Correct Sword', level: '80', refinement: '3' });
  assert.equal(corrected.fields.name.decision, 'corrected');
  assert.equal(corrected.fields.level.value.max, null);
  assert.throws(() => createFeedback(bytes, { reviewer: 'Test', name: 'Correct Sword', level: '90/80', refinement: '3' }), /level/u);
  assert.throws(() => createFeedback(bytes, { reviewer: 'Test', name: 'Correct Sword', level: '80', refinement: 'S' }), /refinement/u);
  const malformed = result(); malformed.fields.level.value.current = 99;
  assert.throws(() => createFeedback(Buffer.from(JSON.stringify(malformed)), { reviewer: 'Test', confirmAll: true }), /level/u);
});

test('visual review keeps raw text visible, escapes markdown cells and preserves original dimensions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gacha-review-'));
  try {
    const image = await sharp({ create: { width: 370, height: 722, channels: 3, background: '#eee' } }).png().toBuffer();
    const selection = selectLayout({ width: 370, height: 722 }, { layout: 'card' });
    const raw = result(); raw.processing = { ...selection, method: 'field-regions' };
    raw.ocr = { rawText: 'raw', imageSize: { width: 370, height: 722 }, regions: {} };
    for (const field of ['name', 'level', 'refinement']) {
      const region = { rectangle: selection.regions[field], attempts: [{ id: 'test', rawText: '<bad>|text\n', confidence: 40 }] };
      raw.ocr.regions[field] = region;
      raw.fields[field] = interpretRegion(field, region);
    }
    raw.ocr.regions.weaponType = { rectangle: selection.regions.weaponType, attempts: [{ id: 'anchor', rawText: 'Sword', confidence: 88 }] };
    const artifacts = await writeVisualReview(raw, image, directory);
    const markdown = await readFile(artifacts.reviewMarkdown, 'utf8');
    assert.match(markdown, /aguarda revisão humana/u);
    assert.match(markdown, /&lt;bad&gt;&#124;text/u);
    assert.match(markdown, /Tipo de arma \(diagnóstico do perfil\)/u);
    assert.match(markdown, /\| anchor \| Sword \| 88 \|/u);
    assert.match(markdown, /condiciona a aceitação dos três campos/u);
    assert.deepEqual(Object.keys(raw.fields), ['name', 'level', 'refinement']);
    const anchor = await sharp(artifacts.regions.weaponType.originalImage).metadata();
    assert.deepEqual([anchor.width, anchor.height], [selection.regions.weaponType.width, selection.regions.weaponType.height]);
    assert.equal(markdownCell('<x>|\n'), '&lt;x&gt;&#124; ');
    const panel = await sharp(artifacts.panelImage).metadata();
    assert.deepEqual([panel.width, panel.height], [370, 722]);
    assert.doesNotMatch(formatReview(raw), /undefined/u);
    assert.match(formatReview(raw), /por tentativa/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
