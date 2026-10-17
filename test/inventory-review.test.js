import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createInventorySession, appendObservation, saveSession } from '../src/inventory-session.js';
import { writeSessionReview } from '../src/inventory-review.js';

async function temporary(t) {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, 'gacha-review-test-'));
  t.after(async () => {
    assert.equal(dirname(directory), parent); assert.ok(basename(directory).startsWith('gacha-review-test-'));
    await rm(directory, { recursive: true, force: true });
  });
  return createInventorySession(join(directory, 'sessions'));
}

test('capture-only review links initial image, preview and last diagnostic without requiring observations', async (t) => {
  const session = await temporary(t);
  Object.assign(session.manifest, { initialCapture: join(session.directory, 'captures', 'initial image.png'),
    preview: 'preview.png', lastDiagnostic: { path: 'captures/last.png', reason: '<selection-timeout>' } });
  await saveSession(session);
  const before = await readFile(join(session.directory, 'inventory.json'));
  const html = await readFile(await writeSessionReview(session), 'utf8');
  assert.match(html, /href="captures\/initial%20image\.png"/u);
  assert.match(html, /href="preview\.png"/u); assert.match(html, /href="captures\/last\.png"/u);
  assert.match(html, /&lt;selection-timeout&gt;/u);
  assert.match(html, /Incluídos: 0/u); assert.match(html, /Revisão humana pendente/u);
  assert.deepEqual(await readFile(join(session.directory, 'inventory.json')), before);
});

test('session review shows compact escaped fields before collapsible raw evidence and rejects unsafe artifact links', async (t) => {
  const session = await temporary(t);
  const malicious = '<script>alert(1)</script>';
  await appendObservation(session, { status: 'included', capture: { path: 'captures/item.png' }, resultPath: 'results/item.json',
    fields: { name: { status: 'recognized', value: malicious }, level: { status: 'recognized', value: { current: 80, max: null } }, refinement: { status: 'uncertain', value: null } },
    rarity: { status: 'recognized', value: 5, evidence: [malicious] } });
  Object.assign(session.manifest, { initialCapture: 'javascript:alert(1)', preview: '../outside.png', lastDiagnostic: { path: 'https://example.com/x.png' } });
  const html = await readFile(await writeSessionReview(session), 'utf8');
  assert.match(html, /<dt>Nome<\/dt><dd>&lt;script&gt;alert\(1\)&lt;\/script&gt; · recognized<\/dd>/u);
  assert.match(html, /<dt>Nível<\/dt><dd>80 · recognized<\/dd>/u);
  assert.match(html, /<dt>Refinamento<\/dt><dd>— · uncertain<\/dd>/u);
  assert.ok(html.indexOf('<dt>Nome</dt>') < html.indexOf('<details>'));
  assert.match(html, /<details><summary>Evidências brutas, posição e raridade<\/summary>/u);
  assert.doesNotMatch(html, /<script|href="javascript:|href="https:|src="\.\.\//u);
  assert.match(html, /href="results\/item\.json"/u);
});
