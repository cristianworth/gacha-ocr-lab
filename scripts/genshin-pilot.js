import { mkdir, access, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWindowsGame } from '../src/windows-game.js';
import { createOcrSession } from '../src/ocr.js';
import { runGenshinPilot1280 } from '../src/genshin-pilot-1280.js';
import { wait } from '../src/scan-control.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runs = join(root, '.cache', 'genshin', 'runs');
const controller = new AbortController();
const cancel = () => controller.abort();
let backend;
let ocr;
let stopTimer;
try {
  const { values } = parseArgs({ options: { prepared: { type: 'boolean' }, 'run-directory': { type: 'string' }, 'scroll-probe': { type: 'boolean' } }, strict: true });
  if (!values.prepared) {
    throw new Error('Prepare Weapons no topo, Level decrescente, sem filtro de raridade, primeira arma selecionada; use --prepared para declarar a preparacao.');
  }
  const output = values['run-directory'] ? resolve(values['run-directory']) : join(runs, `pilot-${randomUUID()}`);
  if (dirname(output).toLowerCase() !== runs.toLowerCase()) throw new Error('Pasta do piloto deve ser filha direta de .cache/genshin/runs.');
  process.on('SIGINT', cancel);
  if (values['run-directory']) {
    await access(output);
    const entries = await readdir(output);
    if (entries.some(name => !['console.log', 'stop.request'].includes(name))) {
      throw new Error('A pasta ja contem arquivos da sessao; nao sera sobrescrita.');
    }
  } else {
    await mkdir(runs, { recursive: true });
    await mkdir(output);
  }
  stopTimer = setInterval(() => { if (existsSync(join(output, 'stop.request'))) controller.abort(); }, 100);
  console.log(`Pasta do piloto: ${output}`);
  ocr = await createOcrSession({ languages: 'eng', cachePath: join(root, '.cache', 'models'), offline: true });
  if (controller.signal.aborted) throw new Error('parada solicitada antes de iniciar');
  backend = await openWindowsGame({ outputRoot: output, expectedSize: { width: 1280, height: 720 } });
  const window = await backend.attach();
  if (window.dpi !== 96) throw new Error('O piloto exige escala Windows 100% (96 DPI).');
  const inputAccess = await backend.checkInputAccess();
  if (!inputAccess.allowed) throw new Error('Integridade do helper inferior a do jogo; execute ambos no mesmo nivel.');
  console.log('Em cinco segundos o jogo sera ativado. Mantenha os controles livres; F8 interrompe.');
  await wait(5000, controller.signal);
  if (controller.signal.aborted) throw new Error('parada solicitada antes de iniciar');
  await backend.activate();
  await backend.arm();
  const scrollProbe = values['scroll-probe'] === true;
  const report = await runGenshinPilot1280({ backend, ocrSession: ocr, output, signal: controller.signal, scrollProbe, limit: scrollProbe ? 40 : 10,
    onProgress: (item, count) => console.log(`${count}: ${item.reading.fields.name.value ?? '(nome pendente)'}`) });
  console.log(`Piloto encerrado: ${report.reason}. Resumo: ${join(output, 'summary.md')}`);
  if (!['pilot-limit', 'scroll-probe-limit', 'position-limit', 'level-cutoff-reached'].includes(report.reason)) process.exitCode = 1;
} catch (error) {
  console.error(`Piloto nao iniciado ou interrompido: ${error.message}`);
  process.exitCode = 1;
} finally {
  clearInterval(stopTimer);
  process.removeListener('SIGINT', cancel);
  await backend?.close().catch(error => console.error(`Falha ao encerrar helper: ${error.message}`));
  await ocr?.close().catch(error => console.error(`Falha ao encerrar OCR: ${error.message}`));
}
