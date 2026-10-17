import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createInventorySession, appendObservation, saveSession, finishSession } from '../src/inventory-session.js';
import { writeSessionReview } from '../src/inventory-review.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const prefix = 'gacha-m3-session-';

async function temporary(t, cli = false) {
  const parent = resolve(tmpdir());
  const directory = await mkdtemp(join(parent, prefix));
  t.after(async () => {
    assert.equal(dirname(directory), parent);
    assert.ok(basename(directory).startsWith(prefix));
    await rm(directory, { recursive: true, force: true });
  });
  if (cli) {
    await cp(join(projectRoot, 'src'), join(directory, 'src'), { recursive: true });
    await mkdir(join(directory, 'scripts'));
    await cp(join(projectRoot, 'scripts', 'review-session.js'), join(directory, 'scripts', 'review-session.js'));
    await writeFile(join(directory, 'package.json'), '{"type":"module","private":true}\n');
  }
  return directory;
}

function fields(status = 'recognized') {
  return { name: { status, value: status === 'recognized' ? 'Example Sword' : null },
    level: { status: 'recognized', value: { current: 80, max: 90 } }, refinement: { status: 'recognized', value: 3 } };
}
function observation(status = 'included') {
  return { status, position: { row: 1, column: 2, page: 0 },
    capture: { path: 'capture.png', sha256: 'synthetic-hash' },
    rarity: { status: 'recognized', value: 5, evidence: ['five stars'] }, resultPath: 'result.json', fields: fields() };
}
async function persisted(session) { return JSON.parse(await readFile(join(session.directory, 'inventory.json'), 'utf8')); }
async function files(path) { try { return await readdir(path); } catch (error) { if (error.code === 'ENOENT') return []; throw error; } }
function run(directory, args) {
  const child = spawnSync(process.execPath, [join(directory, 'scripts', 'review-session.js'), ...args], {
    cwd: directory, encoding: 'utf8', windowsHide: true, timeout: 10_000,
  });
  assert.ifError(child.error);
  assert.equal(child.signal, null, child.stderr);
  return child;
}

async function reviewFixture(directory, status = 'recognized') {
  const session = await createInventorySession(join(directory, 'data', 'sessions'), { config: { simulated: true } });
  const captureBytes = Buffer.from('synthetic capture reference only; no OCR');
  await writeFile(join(session.directory, 'capture.png'), captureBytes);
  const raw = { schemaVersion: 2, game: 'genshin', itemType: 'weapon', source: { path: 'capture.png', sha256: hash(captureBytes) },
    ocr: { rawText: 'Synthetic diagnostic text\n' }, fields: fields(status), requiresManualReview: true };
  const resultBytes = Buffer.from(` ${JSON.stringify(raw, null, 4)}\r\n`);
  await writeFile(join(session.directory, 'result.json'), resultBytes);
  const item = await appendObservation(session, { ...observation(), capture: { path: 'capture.png', sha256: hash(captureBytes) }, fields: raw.fields });
  await finishSession(session, { reason: 'simulated-end', captureComplete: true, processingComplete: true, coverage: { status: 'verified', reason: 'synthetic complete fixture' } });
  return { session, item, resultBytes, captureBytes, inventoryPath: join(session.directory, 'inventory.json') };
}

async function feedbackFiles(directory, id) { return files(join(directory, 'data', 'feedback', id, 'reviews')); }

test('inventory sessions start independently with safe defaults and cloned configuration', async (t) => {
  const directory = await temporary(t);
  const config = { simulated: true, panel: { width: 370 } };
  const first = await createInventorySession(join(directory, 'sessions'), { config });
  const second = await createInventorySession(join(directory, 'sessions'));
  assert.notEqual(first.id, second.id);
  assert.equal(basename(first.directory), first.id);
  config.panel.width = 1;
  const manifest = await persisted(first);
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.game, 'genshin');
  assert.deepEqual(manifest.scope.rarities, [4, 5]);
  assert.equal(manifest.config.panel.width, 370);
  assert.equal(manifest.status, 'running');
  assert.equal(manifest.captureComplete, false);
  assert.equal(manifest.processingComplete, false);
  assert.equal(manifest.reviewStatus, 'pending');
  assert.equal(manifest.coverage.status, 'unconfirmed');
  assert.equal(manifest.termination, null);
  assert.deepEqual(manifest.items, []);
  await assert.rejects(createInventorySession(join(directory, 'sessions'), { game: 'hsr' }), /somente Genshin/u);
});

test('progressive observations preserve duplicate copies, excluded scope, uncertain rarity and included failures', async (t) => {
  const directory = await temporary(t);
  const session = await createInventorySession(join(directory, 'sessions'));
  const first = await appendObservation(session, observation());
  assert.equal((await persisted(session)).items.length, 1);
  const second = await appendObservation(session, observation());
  assert.notEqual(first.id, second.id);
  await appendObservation(session, { ...observation('excluded'), rarity: { status: 'recognized', value: 3, evidence: [] } });
  await appendObservation(session, { ...observation('scope-uncertain'), rarity: { status: 'uncertain', value: null, evidence: ['possibly four stars'] } });
  await appendObservation(session, { ...observation('failed'), fields: null, error: 'capture failed' });
  await appendObservation(session, { ...observation(), fields: null, resultPath: null, error: 'OCR unavailable' });
  const manifest = await persisted(session);
  assert.equal(manifest.observations.length, 6);
  assert.equal(manifest.items.length, 3);
  assert.deepEqual(manifest.observations.map((item) => item.ordinal), [1, 2, 3, 4, 5, 6]);
  assert.equal(manifest.observations[3].status, 'scope-uncertain');
  assert.equal(manifest.items[2].fields, null);
  assert.equal(manifest.items[2].error, 'OCR unavailable');
  assert.deepEqual(manifest.items[0].fields, manifest.items[1].fields);
  assert.equal(manifest.reviewStatus, 'pending');
  await assert.rejects(appendObservation(session, observation('unknown')), /Status/u);
});

test('atomic saves serialize concurrent appends without stale final files or temporary residue', async (t) => {
  const directory = await temporary(t);
  const session = await createInventorySession(join(directory, 'sessions'));
  await Promise.all(Array.from({ length: 8 }, () => appendObservation(session, observation())));
  const manifest = await persisted(session);
  assert.equal(manifest.items.length, 8);
  assert.deepEqual(manifest.observations.map((item) => item.ordinal), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(await files(session.directory), ['inventory.json']);
  const other = await createInventorySession(join(directory, 'sessions'));
  const before = await readFile(join(other.directory, 'inventory.json'));
  session.manifest.id = other.id;
  await assert.rejects(saveSession(session), /Identidade/u);
  assert.deepEqual(await readFile(join(other.directory, 'inventory.json')), before);
});

test('session termination preserves partial evidence and never turns processing completion into approval', async (t) => {
  const directory = await temporary(t);
  const session = await createInventorySession(join(directory, 'sessions'));
  await appendObservation(session, observation());
  await finishSession(session, { reason: 'user-stopped', captureComplete: false, processingComplete: true,
    coverage: { status: 'unconfirmed', reason: 'inventory traversal incomplete' }, error: 'simulated interruption' });
  const manifest = await persisted(session);
  assert.equal(manifest.status, 'failed');
  assert.equal(manifest.captureComplete, false);
  assert.equal(manifest.processingStatus, 'complete');
  assert.equal(manifest.reviewStatus, 'pending');
  assert.equal(manifest.termination.reason, 'user-stopped');
  assert.equal(manifest.coverage.reason, 'inventory traversal incomplete');
  assert.equal(manifest.items.length, 1);
  assert.ok(manifest.termination.endedAt);
});

test('static session review escapes OCR, shows all pending states and links only session-local artifacts', async (t) => {
  const directory = await temporary(t);
  const session = await createInventorySession(join(directory, 'sessions'));
  const malicious = '<script>alert("OCR")</script><img src=x onerror=alert(1)>';
  const included = observation();
  included.capture.path = join(session.directory, 'capture with spaces.png');
  included.fields.name.value = malicious;
  included.rarity.evidence = [malicious];
  await appendObservation(session, included);
  await appendObservation(session, { ...observation('excluded'), resultPath: 'javascript:alert(1)', capture: { path: '../outside.png' } });
  await appendObservation(session, { ...observation('scope-uncertain'), resultPath: 'https://example.com/secret', capture: { path: 'javascript:alert(1)' } });
  await appendObservation(session, { ...observation('failed'), resultPath: null, fields: null, error: malicious });
  const original = await readFile(join(session.directory, 'inventory.json'));
  const reviewPath = await writeSessionReview(session);
  const html = await readFile(reviewPath, 'utf8');
  assert.match(html, /&lt;script&gt;/u);
  assert.doesNotMatch(html, /<script|<img src=x|href="javascript:|href="https:|src="\.\.\//u);
  assert.match(html, /capture%20with%20spaces\.png/u);
  assert.match(html, /href="result\.json"/u);
  assert.match(html, /Incluídos: 1 · Excluídos: 1 · Raridade incerta: 1 · Falhas: 1/u);
  assert.match(html, /Revisão humana pendente/u);
  assert.match(html, /scope-uncertain/u);
  assert.deepEqual(await readFile(join(session.directory, 'inventory.json')), original);
});

test('session confirm-all saves separate feedback with original session/result hashes and duplicate items intact', async (t) => {
  const directory = await temporary(t, true);
  const fixture = await reviewFixture(directory);
  await appendObservation(fixture.session, { ...observation(), capture: { path: 'capture.png', sha256: hash(fixture.captureBytes) } });
  const original = await readFile(fixture.inventoryPath);
  const child = run(directory, [fixture.inventoryPath, '--confirm-all', '--reviewer', 'Synthetic test reviewer']);
  assert.equal(child.status, 0, child.stderr);
  const [name] = await feedbackFiles(directory, fixture.session.id);
  const feedback = JSON.parse(await readFile(join(directory, 'data', 'feedback', fixture.session.id, 'reviews', name), 'utf8'));
  assert.equal(feedback.sessionSha256, hash(original));
  assert.equal(feedback.items.length, 2);
  assert.notEqual(feedback.items[0].id, feedback.items[1].id);
  assert.equal(feedback.items[0].resultSha256, hash(fixture.resultBytes));
  assert.equal(feedback.appliedToAccount, false);
  assert.deepEqual(await readFile(fixture.inventoryPath), original);
  assert.deepEqual(await readFile(join(fixture.session.directory, 'result.json')), fixture.resultBytes);
});

test('session confirmation rejects incomplete capture, unknown coverage, uncertain rarity, failures and uncertain OCR', async (t) => {
  const directory = await temporary(t, true);
  const fixture = await reviewFixture(directory);
  const original = structuredClone(fixture.session.manifest);
  const mutations = [
    (value) => { value.captureComplete = false; },
    (value) => { value.captureComplete = 'false'; },
    (value) => { value.processingComplete = false; },
    (value) => { value.coverage.status = 'unconfirmed'; },
    (value) => { value.observations[0].status = 'scope-uncertain'; },
    (value) => { value.observations[0].status = 'failed'; },
    (value) => { value.observations[0].error = 'OCR error'; },
    (value) => { value.observations[0].rarity.status = 'uncertain'; },
    (value) => { value.observations[0].rarity.value = 3; },
    (value) => { value.observations[0].fields.name.status = 'uncertain'; },
  ];
  for (const mutate of mutations) {
    fixture.session.manifest = structuredClone(original);
    mutate(fixture.session.manifest);
    await saveSession(fixture.session);
    const before = await readFile(fixture.inventoryPath);
    const child = run(directory, [fixture.inventoryPath, '--confirm-all', '--reviewer', 'Test']);
    assert.equal(child.status, 1, child.stderr);
    assert.match(child.stderr, /Confirmacao total/u);
    assert.deepEqual(await readFile(fixture.inventoryPath), before);
  }
  assert.deepEqual(await feedbackFiles(directory, fixture.session.id), []);
});

test('item review corrects uncertain OCR during partial sessions and preserves all source bytes', async (t) => {
  const directory = await temporary(t, true);
  const fixture = await reviewFixture(directory, 'uncertain');
  fixture.session.manifest.captureComplete = false;
  fixture.session.manifest.coverage.status = 'unconfirmed';
  await saveSession(fixture.session);
  const original = await readFile(fixture.inventoryPath);
  const child = run(directory, [fixture.inventoryPath, '--item', fixture.item.id, '--name', 'Correct Sword', '--level', '80', '--refinement', '4', '--reviewer', 'Synthetic test reviewer']);
  assert.equal(child.status, 0, child.stderr);
  const [name] = await feedbackFiles(directory, fixture.session.id);
  const feedback = JSON.parse(await readFile(join(directory, 'data', 'feedback', fixture.session.id, 'reviews', name), 'utf8'));
  assert.equal(feedback.decision, 'item-reviewed');
  assert.deepEqual(feedback.items[0].fields.name, { value: 'Correct Sword', decision: 'corrected' });
  assert.deepEqual(feedback.items[0].fields.level.value, { current: 80, max: null });
  assert.equal(feedback.items[0].fields.refinement.value, 4);
  assert.equal(feedback.items[0].resultSha256, hash(fixture.resultBytes));
  assert.equal(feedback.sessionSha256, hash(original));
  assert.deepEqual(await readFile(fixture.inventoryPath), original);
  assert.deepEqual(await readFile(join(fixture.session.directory, 'result.json')), fixture.resultBytes);
});

test('session review rejects missing reviewer, mixed modes, unknown items and mismatched result origins', async (t) => {
  const directory = await temporary(t, true);
  const fixture = await reviewFixture(directory);
  for (const args of [
    ['--confirm-all'], ['--item', 'unknown', '--reviewer', 'Test'],
    ['--confirm-all', '--item', fixture.item.id, '--reviewer', 'Test'],
    ['--item', fixture.item.id, '--name', 'Sword', '--level', '90/80', '--refinement', '3', '--reviewer', 'Test'],
  ]) {
    const child = run(directory, [fixture.inventoryPath, ...args]);
    assert.equal(child.status, 1, child.stderr);
  }
  const mismatched = JSON.parse(fixture.resultBytes);
  mismatched.source.sha256 = 'wrong';
  await writeFile(join(fixture.session.directory, 'result.json'), JSON.stringify(mismatched));
  const mismatch = run(directory, [fixture.inventoryPath, '--confirm-all', '--reviewer', 'Test']);
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /nao corresponde/u);
  assert.deepEqual(await feedbackFiles(directory, fixture.session.id), []);
});

test('session review refuses diagnostic files outside its directory instead of approving unrelated data', async (t) => {
  const directory = await temporary(t, true);
  const fixture = await reviewFixture(directory);
  const outside = join(directory, 'outside.json');
  await writeFile(outside, fixture.resultBytes);
  fixture.session.manifest.observations[0].resultPath = outside;
  await saveSession(fixture.session);
  const child = run(directory, [fixture.inventoryPath, '--confirm-all', '--reviewer', 'Test']);
  assert.equal(child.status, 1);
  assert.match(child.stderr, /fora da sessao/u);
  assert.deepEqual(await feedbackFiles(directory, fixture.session.id), []);
});


test('session review refuses changed capture bytes and changed hashed diagnostics', async t => {
  const directory = await temporary(t, true);
  const first = await reviewFixture(directory);
  await writeFile(join(first.session.directory, 'capture.png'), 'changed image bytes');
  const changedImage = run(directory, [first.inventoryPath, '--item', first.item.id, '--name', 'Example Sword', '--level', '80/90', '--refinement', '3', '--reviewer', 'Test']);
  assert.equal(changedImage.status, 1);
  assert.match(changedImage.stderr, /Hash da captura diverge/u);
  assert.deepEqual(await feedbackFiles(directory, first.session.id), []);
  const second = await reviewFixture(directory);
  second.item.resultSha256 = hash(second.resultBytes);
  await saveSession(second.session);
  const altered = JSON.parse(second.resultBytes);
  altered.fields.name.value = 'Changed name';
  await writeFile(join(second.session.directory, 'result.json'), JSON.stringify(altered));
  const changedResult = run(directory, [second.inventoryPath, '--confirm-all', '--reviewer', 'Test']);
  assert.equal(changedResult.status, 1);
  assert.match(changedResult.stderr, /Hash do diagnostico diverge/u);
  assert.deepEqual(await feedbackFiles(directory, second.session.id), []);
});


test('human review can resolve uncertain rarity separately without mutating the original scope', async t => {
  const directory = await temporary(t, true);
  const input = await reviewFixture(directory);
  input.item.status = 'scope-uncertain'; input.item.rarity = { status: 'uncertain', value: null };
  await saveSession(input.session);
  const original = await readFile(input.inventoryPath);
  const common = [input.inventoryPath, '--item', input.item.id, '--name', 'Example Sword', '--level', '80/90', '--refinement', '3', '--reviewer', 'Test'];
  const unresolved = run(directory, common);
  assert.equal(unresolved.status, 1); assert.match(unresolved.stderr, /exige --rarity/u);
  const reviewed = run(directory, [...common, '--rarity', '4']);
  assert.equal(reviewed.status, 0, reviewed.stderr);
  const [name] = await feedbackFiles(directory, input.session.id);
  const feedback = JSON.parse(await readFile(join(directory, 'data', 'feedback', input.session.id, 'reviews', name), 'utf8'));
  assert.deepEqual(feedback.items[0].scopeReview, { rarity: 4, included: true, basis: 'human-visual-review' });
  assert.deepEqual(await readFile(input.inventoryPath), original);
  const excluded = run(directory, [...common, '--rarity', '3']);
  assert.equal(excluded.status, 0, excluded.stderr);
  const entries = await feedbackFiles(directory, input.session.id);
  const reviews = await Promise.all(entries.map(name => readFile(join(directory, 'data', 'feedback', input.session.id, 'reviews', name), 'utf8').then(JSON.parse)));
  assert.ok(reviews.some(review => review.items[0].scopeReview.included === false));
  assert.deepEqual(await readFile(input.inventoryPath), original);
});
