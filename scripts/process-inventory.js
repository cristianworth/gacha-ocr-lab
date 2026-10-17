import { parseArgs } from 'node:util';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readImage } from '../src/image.js';
import { readWeapon } from '../src/read-weapon.js';
import { createOcrSession } from '../src/ocr.js';
import { saveSession } from '../src/inventory-session.js';
import { writeSessionReview } from '../src/inventory-review.js';
import { bounded } from '../src/scan-control.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu;
const usage = 'Uso: npm run process:scan -- "data/sessions/<UUID>/inventory.json" [--download-model]';

function isWithin(parent, path) {
  const local = relative(parent, path);
  return local !== '' && !isAbsolute(local) && local !== '..' && !local.startsWith(`..${sep}`);
}

async function confined(directory, subtree, value) {
  if (typeof value !== 'string' || !value) throw new Error(`Caminho ausente em ${subtree}.`);
  const parent = await realpath(join(directory, subtree));
  if (!isWithin(directory, parent)) throw new Error(`Diretorio ${subtree} fora da sessao.`);
  const path = await realpath(resolve(directory, value));
  if (!isWithin(parent, path)) throw new Error(`Arquivo fora de ${subtree} da sessao.`);
  return path;
}

async function processInventory(inventoryPath, downloadModel) {
  const path = await realpath(resolve(inventoryPath));
  const directory = await realpath(dirname(path));
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  if (basename(path) !== 'inventory.json' || manifest.schemaVersion !== 1 || manifest.game !== 'genshin'
      || !uuid.test(manifest.id) || basename(directory) !== manifest.id || !Array.isArray(manifest.observations)
      || !Array.isArray(manifest.items) || manifest.observations.some((item) => !uuid.test(item.id))
      || new Set(manifest.observations.map((item) => item.id)).size !== manifest.observations.length) {
    throw new Error('Sessao Genshin v1/UUID invalida.');
  }
  const session = { id: manifest.id, directory, manifest };
  await mkdir(join(directory, 'results'), { recursive: true });
  const resultsDirectory = await realpath(join(directory, 'results'));
  if (!isWithin(directory, resultsDirectory)) throw new Error('Diretorio results fora da sessao.');
  const report = { startedAt: new Date().toISOString(), downloadModelAllowed: downloadModel, attempted: 0, processed: 0, failed: 0, timedOut: false };
  let worker;
  let initialization;
  let initializationError;
  async function obtainWorker() {
    if (initializationError) throw initializationError;
    if (!initialization) initialization = createOcrSession({ languages: 'eng', cachePath: join(root, '.cache', 'models'), offline: !downloadModel });
    try { worker = await initialization; return worker; }
    catch (error) { initializationError = error; throw error; }
  }
  manifest.reviewStatus = 'pending';
  manifest.processingStatus = 'running';
  manifest.processingComplete = false;
  await saveSession(session);
  try {
    for (const observation of manifest.observations) {
      if (!['included', 'scope-uncertain'].includes(observation.status)) continue;
      report.attempted += 1;
      try {
        const capturePath = await confined(directory, 'captures', observation.capture?.path);
        const image = await readImage(capturePath);
        if (image.source.sha256 !== observation.capture?.sha256) throw new Error('Hash da captura diverge; imagem alterada. OCR nao executado para esta observacao.');
        const prior = [];
        for (const entry of observation.resultHistory ?? []) {
          const priorPath = await confined(directory, 'results', entry.path);
          if (hash(await readFile(priorPath)) !== entry.sha256) throw new Error('Hash de diagnostico historico diverge.');
        }
        if (observation.resultPath) {
          const previousPath = await confined(directory, 'results', observation.resultPath);
          const previousHash = hash(await readFile(previousPath));
          if (observation.resultSha256 && previousHash !== observation.resultSha256) throw new Error('Hash do diagnostico anterior diverge.');
          prior.push({ path: observation.resultPath, sha256: previousHash, archivedAt: new Date().toISOString() });
        }
        const panel = observation.capture?.panel ?? manifest.config?.panel;
        if (!panel) throw new Error('Captura sem painel registrado; nao e permitido adivinhar o recorte.');
        const controller = new AbortController();
        let result;
        try {
          result = await bounded(async () => {
            const ocrSession = await obtainWorker();
            controller.signal.throwIfAborted();
            return readWeapon(image, { game: 'genshin', languages: 'eng', offline: !downloadModel,
              layout: 'screenshot', panel, ocrSession, signal: controller.signal });
          }, 30_000, 'OCR da captura salva');
        } catch (error) { controller.abort(); throw error; }
        if (result.game !== 'genshin' || result.source?.sha256 !== image.source.sha256) throw new Error('Resultado OCR com origem/jogo divergente.');
        const resultBytes = Buffer.from(`${JSON.stringify(result, null, 2)}\n`);
        const resultPath = join(resultsDirectory, `${observation.id}-${randomUUID()}.json`);
        await writeFile(resultPath, resultBytes, { flag: 'wx' });
        observation.resultHistory = [...(observation.resultHistory ?? []), ...prior];
        observation.resultPath = resultPath;
        observation.resultSha256 = hash(resultBytes);
        observation.fields = result.fields;
        observation.error = null;
        report.processed += 1;
      } catch (error) {
        observation.error = error.message;
        report.failed += 1;
        if (error.reason === 'timeout') report.timedOut = true;
      }
      await saveSession(session);
      if (report.timedOut) break;
    }
  } finally {
    if (worker) {
      try { await bounded(() => worker.close(), 5000, 'encerrar OCR'); }
      catch (error) { report.shutdownError = error.message; report.timedOut = true; }
    } else if (initialization) {
      // A worker arriving after the per-image timeout must not outlive this CLI invocation.
      void initialization.then((lateWorker) => lateWorker.close(), () => {}).catch(() => {});
    }
    report.endedAt = new Date().toISOString();
    manifest.processingComplete = !report.timedOut && manifest.observations.every((item) => item.status === 'excluded' || (item.resultPath && !item.error));
    manifest.processingStatus = manifest.processingComplete ? 'complete' : 'incomplete';
    manifest.reviewStatus = 'pending';
    manifest.processingHistory = [...(manifest.processingHistory ?? []), report];
    await saveSession(session);
    await writeSessionReview(session);
  }
  console.log(`Capturas processadas: ${report.processed}; falhas: ${report.failed}.`);
  console.log(`Inventario: ${join(directory, 'inventory.json')}`);
  console.log(`Revisao pendente: ${join(directory, 'review.html')}`);
  console.log('Captura completa e cobertura originais foram preservadas. Nenhum snapshot atualizado.');
  return report;
}

let values;
let positionals;
try {
  ({ values, positionals } = parseArgs({ options: { 'download-model': { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' } }, allowPositionals: true, strict: true }));
  if (!values.help && positionals.length !== 1) throw new Error('Informe exatamente um inventory.json.');
} catch (error) { console.error(`${error.message}\n${usage}`); process.exit(2); }
if (values.help) console.log(usage);
else {
  try {
    const report = await processInventory(positionals[0], values['download-model']);
    process.exitCode = report.failed || report.timedOut ? 1 : 0;
  } catch (error) { console.error(`Erro: ${error.message}`); process.exitCode = 1; }
}

// A failed OCR initialization can leave a library worker alive. Persist and flush before exiting.
if (process.exitCode) {
  await Promise.all([
    new Promise(resolve => process.stdout.write('', resolve)),
    new Promise(resolve => process.stderr.write('', resolve)),
  ]);
  process.exit(process.exitCode);
}
