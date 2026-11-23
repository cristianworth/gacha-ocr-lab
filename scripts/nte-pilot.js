import { access, mkdir, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve, join } from 'node:path';
import { parseArgs } from 'node:util';
import { parseRectangle } from '../src/regions.js';
import { openWindowsGame } from '../src/windows-game.js';
import { wait } from '../src/scan-control.js';
import { runNtePilot, validateTargets } from '../src/nte-pilot.js';

const root = resolve('.cache/nte/runs');
const controller = new AbortController();
let backend, timer, output, started = false;
const cancel = () => controller.abort();
try {
  const { values } = parseArgs({ options: { prepared: { type: 'boolean' }, process: { type: 'string' }, pid: { type: 'string' }, target: { type: 'string', multiple: true }, models: { type: 'string', default: '.cache/models' } }, strict: true });
  if (!values.prepared || !values.process || !values.target) throw new Error('Uso: node scripts/nte-pilot.js --prepared --process NOME_SEM_EXE --target left,top,105,105 [--target ...] [--pid PID] [--models pasta]');
  if (!/^[A-Za-z0-9_-]+$/u.test(values.process)) throw new Error('Informe nome de processo sem caminho ou extensao.');
  const pid = values.pid === undefined ? undefined : Number(values.pid);
  if (pid !== undefined && (!/^\d+$/u.test(values.pid) || !Number.isSafeInteger(pid) || pid <= 0)) throw new Error('PID invalido.');
  const targets = values.target.map(parseRectangle); validateTargets(targets);
  await mkdir(root, { recursive: true });
  output = join(root, `pilot-${randomUUID()}`); await mkdir(output);
  console.log(`Sessao: ${output}`);
  process.on('SIGINT', cancel);
  timer = setInterval(() => { if (existsSync(join(output, 'stop.request'))) controller.abort(); }, 100);
  try { await access(join(resolve(values.models), 'eng.traineddata')); }
  catch { throw new Error('Modelo eng.traineddata ausente; prepare o cache antes de iniciar.'); }
  if (controller.signal.aborted) throw new Error('cancelled');
  backend = await openWindowsGame({ outputRoot: output, expectedSize: { width: 1280, height: 720 }, processNames: [values.process] });
  const window = await backend.attach({ pid });
  if (window.width !== 1280 || window.height !== 720 || window.dpi !== 96) throw new Error('Cliente deve medir 1280x720 e usar 96 DPI.');
  if (!(await backend.checkInputAccess()).allowed) throw new Error('Integridade do helper inferior a do jogo.');
  console.log('Em cinco segundos a janela sera ativada; mantenha controles livres. F8 interrompe.');
  await wait(5000, controller.signal);
  if (controller.signal.aborted) throw new Error('cancelled');
  await backend.activate();
  if (controller.signal.aborted) throw new Error('cancelled');
  await backend.arm();
  started = true;
  const result = await runNtePilot({ backend, output, targets, cachePath: resolve(values.models), signal: controller.signal });
  console.log(`Parada: ${result.reason}. Resumo: ${join(output, 'summary.md')}`);
  if (result.reason !== 'pilot-limit') process.exitCode = 1;
} catch (error) {
  console.error(`Piloto nao iniciado ou interrompido: ${error.message}`); process.exitCode = 1;
  if (output && !started) {
    const report = { schema: 'nte-arc-pilot-v1', status: 'partial', reason: controller.signal.aborted ? 'cancelled' : error.code ?? error.message, error: { stage: 'preparation', message: error.message }, coverageConfirmed: false, humanApproved: false, observations: [], endedAt: new Date().toISOString() };
    const temporary = join(output, `.session-${randomUUID()}.tmp`);
    await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, join(output, 'session.json'));
    await writeFile(join(output, 'summary.md'), `# NTE Arc - piloto parcial\n\nFalha na preparacao: ${error.message}. Nenhuma observacao.\n`, 'utf8');
  }
}
finally { clearInterval(timer); process.removeListener('SIGINT', cancel); await backend?.close().catch(error => { console.error(error.message); process.exitCode = 1; }); }
