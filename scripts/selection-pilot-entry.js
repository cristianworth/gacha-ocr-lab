import { spawn, execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { access, appendFile, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const execFile = promisify(execFileCallback);
export const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const targets = {
  wuwa: ['119,95,95,118', '237,95,95,118'],
  nte: ['73,107,105,105', '183,107,105,105', '293,107,105,105'],
};
const required = ['package.json', 'scripts/windows-game.ps1', 'scripts/selection-pilot-windows.ps1', 'scripts/wuwa-pilot.js', 'scripts/nte-pilot.js', 'src/windows-game.js', 'src/ocr.js', 'src/wuwa-pilot.js', 'src/wuwa-selection.js', 'src/wuwa-offline.js', 'src/nte-pilot.js', 'src/nte-offline.js', 'src/image.js', 'src/regions.js', 'src/scan-control.js', '.cache/models/eng.traineddata'];

export async function checkInstallation(root, { nodeMajor = Number(process.versions.node.split('.')[0]), load } = {}) {
  if (nodeMajor < 22) throw new Error('Node.js 22 ou superior e necessario.');
  for (const file of required) {
    try {
      const info = await stat(join(root, file));
      if (!info.isFile() || info.size === 0) throw new Error('empty-or-not-file');
    } catch { throw new Error(`Arquivo necessario ausente ou vazio: ${join(root, file)}. Prepare o repositorio e o modelo local.`); }
  }
  const require = createRequire(join(root, 'package.json'));
  load ??= name => import(pathToFileURL(require.resolve(name)).href);
  for (const name of ['sharp', 'tesseract.js']) {
    try { await load(name); } catch { throw new Error(`Dependencia ${name} ausente ou nao carregavel; execute npm ci neste repositorio.`); }
  }
}

export async function listWindows(root) {
  const script = join(root, 'scripts', 'selection-pilot-windows.ps1');
  const { stdout } = await execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { windowsHide: true, maxBuffer: 1024 * 1024, encoding: 'utf8' });
  const value = JSON.parse(stdout.replace(/^\uFEFF/u, ''));
  if (!Array.isArray(value)) throw new Error('Lista de janelas invalida.');
  return value.filter(w => /^[A-Za-z0-9_-]+$/u.test(w.name) && Number.isSafeInteger(w.pid) && w.pid > 0 && w.handle && w.started);
}
export function pilotArgs(root, game, window) {
  return [join(root, 'scripts', `${game}-pilot.js`), '--prepared', '--process', window.name, '--pid', String(window.pid), ...targets[game].flatMap(t => ['--target', t])];
}

export async function chooseAndPrepare(game, { list, ask, print }) {
  const windows = await list();
  if (!windows.length) { print('Nenhuma janela visivel elegivel encontrada. Abra o jogo e tente novamente.'); return null; }
  windows.forEach((w, i) => print(`${i + 1}: ${w.name} PID ${w.pid} - ${w.title}`));
  const choice = await ask('Digite o numero da janela ou 0 para cancelar: ');
  if (choice === null || !/^[1-9]\d*$/u.test(choice.trim())) return null;
  const selected = windows[Number(choice.trim()) - 1];
  if (!selected) { print('Escolha invalida.'); return null; }
  print('Cliente 1280x720, Windows 100%/96 DPI, ingles, lista no topo, sem menus; controles livres.');
  if (game === 'wuwa') print('Weapons: primeiro cartao completo ja selecionado; nao selecione a quarta linha parcial.');
  else print('Arc: cartoes completos e uma selecao valida.');
  print(`Alvos na ordem: ${targets[game].join(' ; ')}. Sem filtro, corte ou rolagem; resultado sempre parcial.`);
  print('F8 interrompe depois de armar; Ctrl+C ou stop.request solicitam parada. Aguarde salvar.');
  const answer = await ask('Digite SIM para confirmar e iniciar, ou 0 para cancelar: ');
  if (answer === null || answer.trim() !== 'SIM') return null;
  const current = await list();
  const matches = current.filter(w => w.pid === selected.pid && w.name === selected.name && w.handle === selected.handle && w.started === selected.started);
  if (matches.length !== 1) { print('Janela fechada, alterada ou ambigua; nenhuma coleta iniciada.'); return null; }
  return selected;
}

export async function runChild({ root, game, window, spawnChild = spawn, print = console.log, onReady = () => {} }) {
  const runs = join(root, '.cache', game, 'runs');
  await mkdir(runs, { recursive: true });
  if ((await realpath(runs)).toLowerCase() !== join(await realpath(root), '.cache', game, 'runs').toLowerCase()) throw new Error('A raiz das sessoes deve ficar neste repositorio, sem redirecionamento.');
  const existing = new Set((await readdir(runs)).map(name => name.toLowerCase()));
  const logDir = join(root, '.cache', 'pilot-entry', randomUUID());
  await mkdir(logDir, { recursive: true });
  const log = join(logDir, 'console.log');
  await writeFile(log, '', { flag: 'wx' });
  print(`Log desta abertura: ${log}`);
  const child = spawnChild(process.execPath, pilotArgs(root, game, window), { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: false });
  let directory = null, invalid = false, cancelRequested = false, stopWritten = false, stopInFlight = false;
  let logQueue = Promise.resolve(), logError = null;
  const requestCancel = () => { cancelRequested = true; print('Parada solicitada; aguardando o processo salvar e encerrar.'); };
  const logLine = line => {
    print(line);
    logQueue = logQueue.then(async () => {
      if (logError) return;
      try { await appendFile(log, `${line}\n`, 'utf8'); }
      catch (error) {
        logError = error;
        print(`Falha ao gravar o log ${log}: ${error.message}`);
        requestCancel();
      }
    });
  };
  process.on('SIGINT', requestCancel);
  onReady({ requestCancel, child });
  async function stopIfReady() {
    if (!cancelRequested || !directory || stopWritten || invalid || stopInFlight) return;
    stopInFlight = true;
    try {
      const actualRoot = await realpath(runs), actualDir = await realpath(directory);
      if (dirname(actualDir).toLowerCase() !== actualRoot.toLowerCase()) { invalid = true; return; }
      await writeFile(join(actualDir, 'stop.request'), 'stop\n', { flag: 'a' }); stopWritten = true;
    }
    catch (error) { if (error.code !== 'ENOENT') logLine(`Nao foi possivel registrar parada: ${error.message}`); }
    finally { stopInFlight = false; }
  }
  let lastStatus = Date.now();
  const timer = setInterval(() => {
    void stopIfReady();
    if (cancelRequested && Date.now() - lastStatus >= 10_000) {
      print('Ainda aguardando o processo salvar e encerrar.');
      lastStatus = Date.now();
    }
  }, 100);
  function consume(stream, markerAllowed) {
    const reader = createInterface({ input: stream, crlfDelay: Infinity });
    reader.on('line', line => {
      logLine(line);
      if (!markerAllowed || !line.startsWith('PILOT_SESSION_DIR=')) return;
      const candidate = line.slice('PILOT_SESSION_DIR='.length);
      const name = basename(candidate);
      const valid = resolve(candidate) === candidate && dirname(candidate).toLowerCase() === resolve(runs).toLowerCase() && /^pilot-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(name) && !existing.has(name.toLowerCase());
      if (!valid || (directory && directory !== candidate)) { invalid = true; logLine('Marcador de sessao invalido ou inconsistente.'); return; }
      directory = candidate;
      void stopIfReady();
    });
  }
  consume(child.stdout, true); consume(child.stderr, false);
  let code;
  try {
    code = await new Promise((resolveExit, reject) => { child.once('error', reject); child.once('close', resolveExit); });
  } finally { clearInterval(timer); process.removeListener('SIGINT', requestCancel); }
  await logQueue;
  if (invalid || !directory) { print(`Nenhuma sessao propria confirmada. Log: ${log}`); return { code: 1, log }; }
  try {
    const actualRoot = await realpath(runs), actualDir = await realpath(directory);
    if (dirname(actualDir).toLowerCase() !== actualRoot.toLowerCase()) throw new Error('diretorio fora da raiz de sessoes');
    const session = join(actualDir, 'session.json');
    await access(session);
    print(`Apos solicitacao, envie somente: ${session}`);
    const report = JSON.parse(await readFile(session, 'utf8'));
    const success = !logError && code === 0 && report.reason === 'pilot-limit';
    print(success ? 'Limite do piloto atingido; resultado parcial, OCR sujeito a revisao.' : `Piloto parcial ou interrompido: ${report.reason ?? 'motivo indisponivel'}.`);
    print(`Resumo (abra manualmente): ${join(actualDir, 'summary.md')}`);
    return { code: success ? 0 : 1, log, directory: actualDir, session, report };
  } catch (error) { print(`Resultado indisponivel: ${error.message}. Pasta anunciada: ${directory}. Log: ${log}`); return { code: 1, log, directory }; }
}

export async function main(args = process.argv.slice(2)) {
  const match = args.length >= 2 && args[0] === '--game' && Object.hasOwn(targets, args[1]) && (args.length === 2 || (args.length === 3 && args[2] === '--check'));
  if (!match) throw new Error('Uso: --game wuwa|nte [--check]');
  const game = args[1];
  await checkInstallation(repository);
  console.log(`Ambiente ${game} encontrado em ${repository}; sem elevacao, captura ou input nesta verificacao.`);
  if (args.length === 3) return 0;
  const reader = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
  const lines = reader[Symbol.asyncIterator]();
  const ask = async text => { process.stdout.write(text); const next = await lines.next(); return next.done ? null : next.value; };
  try {
    const window = await chooseAndPrepare(game, { list: () => listWindows(repository), ask, print: console.log });
    if (!window) { console.log('Cancelado; nenhuma coleta iniciada.'); return 1; }
    reader.close();
    return (await runChild({ root: repository, game, window })).code;
  } finally { reader.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then(code => { process.exitCode = code; }).catch(error => { console.error(`Nao foi possivel iniciar: ${error.message}`); process.exitCode = 1; });
}
