import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDesktopSelection, validatePilotReport } from '../scripts/desktop-selection-entry.js';
import { revalidateWindow, targets } from '../scripts/selection-pilot-entry.js';

const window = { name: 'FixtureGame', pid: 42, title: 'Fixture title', handle: '4200', started: '123' };
const report = game => ({ ...(game === 'wuwa' ? { schemaVersion: 1, game, mode: 'visible-pilot', inventoryAccepted: false }
  : { schema: 'nte-arc-pilot-v1', humanApproved: false }), status: 'partial', reason: 'pilot-limit', coverageConfirmed: false,
  observations: [{ status: 'captured-pending-ocr', capture: { path: 'pending.png' } }],
  scope: { targets: targets[game].map(t => Object.fromEntries(t.split(',').map((v, i) => [['left', 'top', 'width', 'height'][i], Number(v)]))), filter: 'none', order: 'declared-targets', scroll: false } });
const setup = async t => {
  const root = await mkdtemp(join(tmpdir(), "desktop pilot's "));
  const entry = join(root, '.cache', 'desktop-pilot', 'call');
  await mkdir(entry, { recursive: true });
  await writeFile(join(entry, 'window.json'), JSON.stringify(window));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, entry, check: async () => {}, list: async () => [window], print: () => {} };
};

for (const game of ['wuwa', 'nte']) {
  test(`${game} schema validates exact scope and preserves pending OCR`, () => {
    const original = report(game), bytes = JSON.stringify(original);
    assert.equal(validatePilotReport(game, original), original);
    assert.equal(JSON.stringify(original), bytes);
    for (const alter of [r => { r.coverageConfirmed = true; }, r => { r.scope.scroll = true; },
      r => { r.scope.targets.reverse(); }, r => { r.status = 'running'; }, r => { r.scope.filter = 'S'; },
      r => { r.scope.targets[0].left++; }, r => { r.scope = undefined; }]) {
      const candidate = structuredClone(original); alter(candidate);
      assert.throws(() => validatePilotReport(game, candidate));
    }
    assert.throws(() => validatePilotReport(game === 'wuwa' ? 'nte' : 'wuwa', original));
  });
  test(`${game} desktop revalidates immediately before spawning and records partial only after close`, async t => {
    const options = await setup(t); let checked = false, closed = false;
    const result = await runDesktopSelection({ ...options, game, action: 'run',
      list: async () => { checked = true; return [window]; },
      run: async ({ beforeSpawn, windowsHide }) => { assert.equal(windowsHide, true); await beforeSpawn(); assert.ok(checked); closed = true;
        return { code: 0, exitCode: 0, directory: join(options.root, '.cache', game, 'runs', 'pilot-fixture'), report: report(game) }; },
    });
    assert.ok(closed); assert.equal(result.result, 'partial'); assert.equal(result.pendingOcr, 1);
    assert.equal(JSON.parse(await readFile(join(options.entry, 'result.json'), 'utf8')).result, 'partial');
  });
  test(`${game} log error stays an error even with pilot-limit and own result`, async t => {
    const options = await setup(t);
    const result = await runDesktopSelection({ ...options, game, action: 'run',
      run: async () => ({ code: 1, directory: 'own', report: report(game), logError: 'disk unavailable' }),
    });
    assert.equal(result.result, 'error'); assert.match(result.error, /log/); assert.equal(result.directory, 'own');
  });
  for (const [reason, exitCode, failed] of [['pilot-limit', 1, true], ['cancelled', 1, false], ['emergency-f8', 1, false], ['cancelled', 2, true]]) {
    test(`${game} distinguishes ${reason} exit ${exitCode} from a normal partial result`, async t => {
      const options = await setup(t), original = { ...report(game), reason }, bytes = JSON.stringify(original);
      const result = await runDesktopSelection({ ...options, game, action: 'run',
        run: async () => ({ code: 1, exitCode, directory: 'own', report: original }),
      });
      assert.equal(result.result, 'partial'); assert.equal(result.directory, 'own');
      assert.equal(result.childExitCode, exitCode); assert.equal(result.failed, failed);
      if (failed) assert.match(result.error, new RegExp(`codigo ${exitCode}`));
      assert.equal(JSON.stringify(original), bytes);
    });
  }
}
test('NTE preparation failure uses its own schema and cannot masquerade as pilot-limit', () => {
  const partial = { schema: 'nte-arc-pilot-v1', status: 'partial', reason: 'cancelled', error: { stage: 'preparation' }, coverageConfirmed: false, humanApproved: false, observations: [] };
  assert.equal(validatePilotReport('nte', partial), partial);
  assert.throws(() => validatePilotReport('nte', { ...partial, reason: 'pilot-limit' }));
});
test('shared revalidation rejects each identity change, ambiguity and malformed choices', async () => {
  for (const changed of [{ name: 'AnotherGame' }, { pid: 43 }, { handle: '4300' }, { started: '124' }]) {
    assert.equal(await revalidateWindow(window, { list: async () => [{ ...window, ...changed }] }), false);
  }
  assert.equal(await revalidateWindow(window, { list: async () => [window, window] }), false);
  assert.equal(await revalidateWindow(null, { list: async () => [window] }), false);
});
test('desktop prerequisite failure never starts a pilot or inherits a directory', async t => {
  const options = await setup(t); let started = false;
  const result = await runDesktopSelection({ ...options, game: 'wuwa', action: 'list',
    check: async () => { throw new Error('Missing local model'); }, run: async () => { started = true; },
  });
  assert.equal(started, false); assert.equal(result.result, 'error'); assert.equal(result.directory, null);
  assert.match(result.error, /Missing local model/);
});
