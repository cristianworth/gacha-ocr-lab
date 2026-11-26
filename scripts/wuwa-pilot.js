import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openWindowsGame } from '../src/windows-game.js';
import { createOcrSession } from '../src/ocr.js';
import { parseRectangle } from '../src/regions.js';
import { validateWuwaTargets } from '../src/wuwa-selection.js';
import { runWuwaPilot } from '../src/wuwa-pilot.js';
import { wait } from '../src/scan-control.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runs = join(root,'.cache','wuwa','runs');
const controller = new AbortController();
const cancel = () => controller.abort();
let backend; let ocr; let timer;
try {
  const { values } = parseArgs({ options: { prepared: {type:'boolean'}, process: {type:'string'}, pid: {type:'string'}, target: {type:'string',multiple:true}, models: {type:'string'} }, strict:true });
  if (!values.prepared || !values.process || !/^[A-Za-z0-9_-]+$/u.test(values.process)) throw new Error('Informe --prepared e --process com nome do processo sem extensao.');
  const targets = (values.target ?? []).map(parseRectangle); validateWuwaTargets(targets);
  const pid = values.pid === undefined ? undefined : Number(values.pid);
  if (values.pid !== undefined && (!/^\d+$/u.test(values.pid) || !Number.isSafeInteger(pid) || pid <= 0)) throw new Error('PID invalido.');
  await mkdir(runs,{recursive:true});
  const output = join(runs,`pilot-${randomUUID()}`);
  process.on('SIGINT', cancel);
  timer = setInterval(() => { if (existsSync(join(output,'stop.request'))) controller.abort(); },100);
  console.log(`Pasta da sessão: ${output}`);
  console.log(`PILOT_SESSION_DIR=${output}`);
  const report = await runWuwaPilot({ output, targets, signal: controller.signal,
    setup: async (directory, signal) => {
      ocr = await createOcrSession({languages:'eng',cachePath:resolve(values.models ?? join(root,'.cache','models')),offline:true});
      if (signal.aborted) throw new Error('cancelled');
      backend = await openWindowsGame({outputRoot:directory, expectedSize:{width:1280,height:720}, processNames:[values.process]});
      const window = await backend.attach(pid === undefined ? {} : {pid});
      if (window.width !== 1280 || window.height !== 720 || window.dpi !== 96) throw new Error('client-or-dpi-unverified');
      if (!(await backend.checkInputAccess()).allowed) throw new Error('input-integrity-unverified');
      console.log('Controles livres; o jogo será ativado em cinco segundos. F8 interrompe após armar; Ctrl+C cancela.');
      await wait(5000,signal);
      await backend.activate();
      if (signal.aborted) throw new Error('cancelled');
      await backend.arm();
      return backend;
    },
    // The session is initialized during setup, before a read can run.
    ocrSession: { recognize: (...args) => ocr.recognize(...args) },
  });
  console.log(`Parada: ${report.reason}. Resumo: ${join(output,'summary.md')}`);
  if (report.reason !== 'pilot-limit') process.exitCode = 1;
} catch (error) { console.error(`Piloto não iniciado: ${error.message}`); process.exitCode = 1; }
finally {
  clearInterval(timer); process.removeListener('SIGINT', cancel);
  // Exit 1 already represents an interrupted/partial pilot. Keep finalization
  // failure distinct, and attempt OCR cleanup even if the helper close fails.
  for (const [name, resource] of [['helper', backend], ['OCR', ocr]]) {
    try { await resource?.close(); }
    catch (error) {
      console.error(`Falha na finalizacao de ${name}; encerramento nao confirmado: ${error.message}`);
      process.exitCode = 2;
    }
  }
}
