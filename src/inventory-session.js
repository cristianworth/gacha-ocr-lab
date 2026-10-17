import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, isAbsolute, join, resolve } from 'node:path';

const queues = new WeakMap();
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;
const statuses = new Set(['included', 'excluded', 'scope-uncertain', 'failed']);

function sessionDirectory(session) {
  if (!uuid.test(session.id) || session.manifest.id !== session.id || !isAbsolute(session.directory)
      || basename(session.directory) !== session.id) throw new Error('Identidade/diretorio da sessao invalido.');
  return session.directory;
}

export async function createInventorySession(root, options = {}) {
  if (options.game !== undefined && options.game !== 'genshin') throw new Error('Sessao de inventario suporta somente Genshin nesta etapa.');
  const parent = resolve(root);
  await mkdir(parent, { recursive: true });
  const id = randomUUID();
  const directory = join(parent, id);
  await mkdir(directory);
  const manifest = {
    schemaVersion: 1, id, game: 'genshin', scope: { rarities: [4, 5] },
    config: structuredClone(options.config ?? {}), startedAt: new Date().toISOString(), status: 'running',
    observations: [], items: [], coverage: { status: 'unconfirmed' },
    captureComplete: false, processingComplete: false, processingStatus: 'running', reviewStatus: 'pending', termination: null,
  };
  const session = { id, directory, manifest };
  await saveSession(session);
  return session;
}

export async function saveSession(session) {
  const directory = sessionDirectory(session);
  session.manifest.items = session.manifest.observations.filter((observation) => observation.status === 'included');
  const bytes = `${JSON.stringify(session.manifest, null, 2)}\n`;
  const previous = queues.get(session) ?? Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    const temporary = join(directory, `.inventory-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, bytes, { encoding: 'utf8', flag: 'wx' });
      await rename(temporary, join(directory, 'inventory.json'));
    } finally { await rm(temporary, { force: true }); }
  });
  queues.set(session, pending);
  await pending;
  return join(directory, 'inventory.json');
}

export async function appendObservation(session, observation) {
  sessionDirectory(session);
  if (!statuses.has(observation.status)) throw new Error('Status de observacao invalido; use included, excluded, scope-uncertain ou failed.');
  const value = {
    ...structuredClone(observation), id: randomUUID(), ordinal: session.manifest.observations.length + 1,
    position: structuredClone(observation.position ?? { row: null, column: null, page: null }),
    capture: structuredClone(observation.capture ?? null),
    rarity: structuredClone(observation.rarity ?? { status: 'uncertain', value: null, evidence: [] }),
    resultPath: observation.resultPath ?? null, fields: structuredClone(observation.fields ?? null), error: observation.error ?? null,
  };
  session.manifest.observations.push(value);
  await saveSession(session);
  return value;
}

export async function finishSession(session, { reason, captureComplete = false, coverage, processingComplete = false, error = null }) {
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('Informe o motivo de termino da sessao.');
  Object.assign(session.manifest, {
    status: error ? 'failed' : 'finished', captureComplete: captureComplete === true,
    processingComplete: processingComplete === true, processingStatus: processingComplete ? 'complete' : 'incomplete',
    coverage: structuredClone(coverage ?? { status: 'unconfirmed' }), reviewStatus: 'pending',
    termination: { reason, error, endedAt: new Date().toISOString() },
  });
  await saveSession(session);
  return session.manifest;
}
