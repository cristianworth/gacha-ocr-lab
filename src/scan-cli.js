import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readImage } from './image.js';
import { createOcrSession } from './ocr.js';
import { openWindowsGame } from './windows-game.js';
import { inspectInventory, readRarity } from './genshin-inventory.js';
import { createInventorySession, finishSession, saveSession } from './inventory-session.js';
import { writeSessionReview } from './inventory-review.js';
import { runInventoryScan } from './scan-inventory.js';
import { bounded, wait } from './scan-control.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `Uso:
  npm run capture -- [--delay 5] [--pid PID]
  npm run scan -- --limit 10 [--at-top] [--delay 5]
  npm run scan -- --full [--expected-count N] [--at-top] [--delay 5]
  npm run scan -- --image "cliente-1440x900.png"

Genshin/ingles, area CLIENTE exatamente 1440x900, aba Weapons, Quality decrescente,
inicio da lista e sem filtros ocultando armas 4/5 estrelas. Captura e diagnostico nao clicam.
Scan usa mouse e rolagem: mantenha o jogo em primeiro plano e controles exclusivos.
F8 interrompe inputs; Ctrl+C cancela o processo com salvamento parcial.
--at-top declara o inicio da lista quando a barra nao permite confirma-lo automaticamente.
--expected-count e uma contagem independente de armas 4/5 estrelas; nao e o total geral da tela.
Sem ela, cobertura fica nao confirmada mesmo quando o percurso termina.
Modelos devem existir no cache; --download-model permite baixar eng antes da ativacao.
O piloto padrao visita ate 10 posicoes. --full habilita rolagem, com limites de seguranca.
Arquivos locais: data/sessions/<id>/inventory.json, review.html, captures/ e results/.
Nenhum dado e importado no Advisor. Exit 0=salvo (pode ser parcial), 1=falha, 2=argumentos, 130=cancelado.`;
let values;
function integer(text, name, min, max) {
  if (!/^\d+$/u.test(String(text))) throw new Error(`${name} deve ser inteiro.`);
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} deve estar entre ${min} e ${max}.`);
  return value;
}
try {
  ({ values } = parseArgs({ options: {
    help: { type: 'boolean', short: 'h' }, capture: { type: 'boolean', default: false }, image: { type: 'string' },
    full: { type: 'boolean', default: false }, limit: { type: 'string' },
    delay: { type: 'string', default: '5' }, pid: { type: 'string' },
    'at-top': { type: 'boolean', default: false }, 'expected-count': { type: 'string' },
    'max-items': { type: 'string', default: '2000' }, 'max-pages': { type: 'string', default: '100' },
    'download-model': { type: 'boolean', default: false },
  }, strict: true }));
  if (!values.help) {
    if (values.full && values.limit !== undefined) throw new Error('Use --full ou --limit, nao ambos.');
    if (values.capture && values.image) throw new Error('Use --capture ou --image, nao ambos.');
    if ((values.capture || values.image) && (values.full || values.limit !== undefined || values['expected-count'] !== undefined || values['at-top'])) throw new Error('Captura/diagnostico nao aceita opcoes de percurso.');
    values.delay = integer(values.delay, '--delay', 0, 30);
    values.limit = integer(values.limit ?? '10', '--limit', 1, 2000);
    values.maxItems = integer(values['max-items'], '--max-items', 1, 10000);
    values.maxPages = integer(values['max-pages'], '--max-pages', 1, 500);
    if (values.pid !== undefined) values.pid = integer(values.pid, '--pid', 1, 2147483647);
    values.expectedCount = values['expected-count'] === undefined ? null : integer(values['expected-count'], '--expected-count', 0, 10000);
  }
} catch (error) { console.error(`${error.message}\n\n${usage}`); process.exit(2); }
if (values.help) { console.log(usage); }
else {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.on('SIGINT', cancel);
  let session;
  let backend;
  let ocr;
  try {
    session = await createInventorySession(resolve(root, 'data/sessions'), { config: { mode: values.image ? 'image-diagnostic' : values.capture ? 'capture-only' : 'scan' } });
    if (!values.capture && !values.image) ocr = await createOcrSession({ languages: 'eng', cachePath: resolve(root, '.cache/models'), offline: !values['download-model'] });
    let image;
    if (values.image) {
      image = await readImage(values.image);
      await mkdir(join(session.directory, 'captures'));
      const path = join(session.directory, 'captures', 'diagnostic.png');
      await writeFile(path, image.buffer, { flag: 'wx' });
      image = await readImage(path);
    } else {
      backend = await openWindowsGame({ outputRoot: session.directory });
      const window = await backend.attach(values.pid ? { pid: values.pid } : {});
      session.manifest.config.window = window;
      await saveSession(session);
      console.log(`Prepare Weapons / Quality decrescente / topo. Ativando Genshin em ${values.delay}s; F8 para interromper.`);
      await wait(values.delay * 1000, controller.signal);
      await backend.activate();
      await backend.arm();
      if (values.capture) {
        await mkdir(join(session.directory, 'captures'));
        const path = join(session.directory, 'captures', 'client.png');
        await backend.capture(path);
        image = await readImage(path);
      }
    }
    if (values.capture || values.image) {
      session.manifest.initialCapture = image.source.path;
      session.manifest.initialSource = image.source;
      let analysis;
      try { analysis = await inspectInventory(image.buffer); }
      catch (error) { session.manifest.diagnosticError = error.message; }
      if (analysis) {
        session.manifest.diagnostic = { ...analysis, rarity: await readRarity(image.buffer, analysis.panel) };
        const rectangles = [...analysis.slots.map(slot => slot.rectangle), analysis.panel].map(box => `<rect x="${box.left}" y="${box.top}" width="${box.width}" height="${box.height}" fill="none" stroke="#22c55e" stroke-width="2"/>`).join('');
        const overlay = Buffer.from(`<svg width="1440" height="900">${rectangles}</svg>`);
        const preview = join(session.directory, 'preview.png');
        await sharp(image.buffer).composite([{ input: overlay }]).png().toFile(preview);
        session.manifest.preview = preview;
        console.log(`Previa: ${preview}`);
      }
      await finishSession(session, { reason: 'capture-only', error: session.manifest.diagnosticError ?? null });
      await writeSessionReview(session);
      if (!analysis) process.exitCode = 1;
    } else {
      const outcome = await runInventoryScan({ backend, session, ocrSession: ocr, signal: controller.signal,
        options: { full: values.full, limit: values.limit, maxItems: values.maxItems, maxPages: values.maxPages,
          expectedCount: values.expectedCount, startAtTopDeclared: values['at-top'] },
        onProgress: ({ observation, included }) => console.log(`${observation.ordinal}: ${observation.status}; incluidos=${included}; ${observation.fields?.name?.value ?? '(pendente)'}`),
      });
      if (outcome.error) { console.error(outcome.error); process.exitCode = outcome.reason === 'cancelled' ? 130 : 1; }
    }
  } catch (error) {
    console.error(`Erro: ${error.message}`);
    process.exitCode = controller.signal.aborted ? 130 : 1;
    if (session && session.manifest.status === 'running') {
      await finishSession(session, { reason: controller.signal.aborted ? 'cancelled' : typeof error.code === 'string' ? error.code : 'startup-failed', error: error.message });
      await writeSessionReview(session);
    }
  } finally {
    process.removeListener('SIGINT', cancel);
    await backend?.close().catch(error => console.error(`Falha ao encerrar helper: ${error.message}`));
    if (ocr) {
      try { await bounded(() => ocr.close(), 5000, 'encerrar OCR'); }
      catch (error) { console.error(`Falha ao encerrar OCR: ${error.message}`); process.exitCode = 1; }
    }
    if (session) {
      console.log(`Inventario: ${join(session.directory, 'inventory.json')}`);
      console.log(`Revisao: ${join(session.directory, 'review.html')}`);
      console.log(`Captura completa: ${session.manifest.captureComplete}; cobertura: ${session.manifest.coverage.status}; revisao humana: pendente.`);
    }
  }
}

// A failed OCR initialization can leave a library worker alive. Persist and flush before exiting.
if (process.exitCode) {
  await Promise.all([
    new Promise(resolve => process.stdout.write('', resolve)),
    new Promise(resolve => process.stderr.write('', resolve)),
  ]);
  process.exit(process.exitCode);
}
