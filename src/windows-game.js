import { spawn } from 'node:child_process';
import { mkdir, realpath } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

function backendError(message, code = 'backend-error') {
  return Object.assign(new Error(message), { code });
}

function inside(root, path) {
  const part = relative(root, path);
  return part !== '' && part !== '..' && !part.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) && !isAbsolute(part);
}

export async function resolveCapturePath(outputRoot, path) {
  if (typeof path !== 'string' || !path.trim()) throw backendError('Informe o caminho PNG de captura.', 'invalid-path');
  const root = await realpath(outputRoot);
  const target = resolve(root, path);
  if (!inside(root, target) || extname(target).toLowerCase() !== '.png') throw backendError('A captura PNG deve ficar dentro de outputRoot.', 'invalid-path');
  let existing = dirname(target);
  for (;;) {
    try {
      const actual = await realpath(existing);
      if (relative(root, actual) !== '' && !inside(root, actual)) throw backendError('A pasta de captura escapa de outputRoot por um link.', 'invalid-path');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = dirname(existing);
      if (parent === existing) throw backendError('Destino de captura indisponivel.', 'invalid-path');
      existing = parent;
    }
  }
  await mkdir(dirname(target), { recursive: true });
  const parent = await realpath(dirname(target));
  if (relative(root, parent) !== '' && !inside(root, parent)) throw backendError('A pasta de captura escapa de outputRoot por um link.', 'invalid-path');
  return resolve(parent, target.slice(dirname(target).length + 1));
}

// The child-process boundary is explicit so protocol/lifecycle tests need no real window.
export async function createWindowsGameClient(child, { outputRoot, expectedSize, timeoutMs = 10_000, readyTimeoutMs = 30_000 }) {
  let terminalError;
  let sequence = Promise.resolve();
  let nextId = 0;
  let closing = false;
  let closed = false;
  let readyResolve;
  let readyReject;
  let exitResolve;
  const ready = new Promise((resolveReady, rejectReady) => { readyResolve = resolveReady; readyReject = rejectReady; });
  const exited = new Promise((resolveExit) => { exitResolve = resolveExit; });
  const pending = new Map();
  const reader = createInterface({ input: child.stdout, crlfDelay: Infinity });
  let stderr = '';
  child.stderr?.on('data', (chunk) => { stderr = (stderr + chunk.toString()).slice(-16_384); });
  const readyTimer = setTimeout(() => fail(backendError('Tempo limite ao iniciar o helper Windows.', 'timeout')), readyTimeoutMs);

  function fail(error) {
    if (terminalError || closed) return;
    terminalError = error;
    clearTimeout(readyTimer);
    readyReject(error);
    for (const item of pending.values()) { clearTimeout(item.timer); item.reject(error); }
    pending.clear();
    child.kill();
  }

  reader.on('line', (line) => {
    if (terminalError || closed) return;
    let response;
    try {
      if (line.length > 1_048_576) throw new Error('Resposta excessiva.');
      response = JSON.parse(line.replace(/^\uFEFF/u, ''));
      if (response.event === 'ready' && response.protocol === 1) {
        clearTimeout(readyTimer);
        readyResolve();
        return;
      }
      const item = pending.get(response.id);
      if (!item || typeof response.ok !== 'boolean') throw new Error('Resposta sem pedido correspondente.');
      clearTimeout(item.timer);
      pending.delete(response.id);
      if (response.ok) item.resolve(response.result);
      else item.reject(backendError(response.error?.message ?? 'Falha no helper Windows.', response.error?.code ?? 'helper-error'));
    } catch (error) { fail(backendError(`Protocolo invalido do helper: ${error.message}`, 'protocol-error')); }
  });
  child.on('error', (error) => fail(backendError(`Nao foi possivel iniciar o helper: ${error.message}`, 'spawn-error')));
  child.stdin.on('error', (error) => fail(backendError(`Falha na entrada do helper: ${error.message}`, 'pipe-error')));
  child.on('exit', (code, signal) => {
    exitResolve();
    if (!closed && !(closing && pending.size === 0)) fail(backendError(`Helper Windows encerrou (${code ?? signal}). ${stderr}`.trim(), 'helper-exited'));
  });

  function rpc(op, args = {}) {
    if (terminalError) return Promise.reject(terminalError);
    if (closed) return Promise.reject(backendError('Cliente Windows encerrado.', 'closed'));
    return new Promise((resolveCall, rejectCall) => {
      const id = ++nextId;
      const timer = setTimeout(() => fail(backendError(`Tempo limite do helper em ${op}; sessao encerrada.`, 'timeout')), timeoutMs);
      pending.set(id, { resolve: resolveCall, reject: rejectCall, timer });
      child.stdin.write(`${JSON.stringify({ id, op, args })}\n`, (error) => {
        if (error) fail(backendError(`Falha ao enviar ${op}: ${error.message}`, 'pipe-error'));
      });
    });
  }

  function enqueue(action) {
    if (closing) return Promise.reject(backendError('Cliente Windows encerrando.', 'closed'));
    const call = sequence.then(action, action);
    sequence = call.catch(() => {});
    return call;
  }

  function point({ x, y } = {}) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= expectedSize.width || y >= expectedSize.height) {
      throw backendError('Coordenadas devem ser pixels inteiros dentro da area cliente.', 'invalid-coordinate');
    }
    return { x, y };
  }

  try { await ready; } catch (error) { reader.close(); throw error; }
  return {
    list: () => enqueue(() => rpc('list')),
    attach: ({ pid } = {}) => enqueue(() => {
      if (pid !== undefined && (!Number.isInteger(pid) || pid <= 0)) throw backendError('PID invalido.', 'invalid-pid');
      return rpc('attach', pid === undefined ? {} : { pid });
    }),
    activate: () => enqueue(() => rpc('activate')),
    arm: () => enqueue(() => rpc('arm')),
    status: () => enqueue(() => rpc('status')),
    capture: (path) => enqueue(async () => rpc('capture', { path: await resolveCapturePath(outputRoot, path) })),
    click: (coordinates) => enqueue(() => rpc('click', point(coordinates))),
    scroll: (coordinates = {}) => enqueue(() => {
      const { delta } = coordinates;
      if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 10) {
        throw backendError('delta deve ser um numero inteiro de notches entre -10 e 10, diferente de zero.', 'invalid-scroll');
      }
      return rpc('scroll', { ...point(coordinates), delta });
    }),
    close() {
      if (closing) return sequence;
      closing = true;
      const closeCall = sequence.then(async () => {
        try { if (!terminalError && !closed) await rpc('close'); }
        finally {
          closed = true;
          clearTimeout(readyTimer);
          child.stdin.end();
          reader.close();
          let timer;
          await Promise.race([exited, new Promise((resolveWait) => { timer = setTimeout(() => { child.kill(); resolveWait(); }, 1000); })]);
          clearTimeout(timer);
        }
      });
      sequence = closeCall;
      return closeCall;
    },
  };
}

export async function openWindowsGame({ outputRoot, expectedSize = { width: 1440, height: 900 }, processNames = ['GenshinImpact', 'YuanShen'] }) {
  if (process.platform !== 'win32') throw backendError('O controle de janela requer Windows.', 'unsupported-platform');
  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw backendError('outputRoot e obrigatorio.', 'invalid-path');
  if (!['width', 'height'].every((key) => Number.isInteger(expectedSize[key]) && expectedSize[key] > 0 && expectedSize[key] <= 16384)) {
    throw backendError('Dimensoes esperadas invalidas.', 'invalid-size');
  }
  if (!Array.isArray(processNames) || !processNames.length || !processNames.every((name) => typeof name === 'string' && /^[A-Za-z0-9_-]+$/u.test(name))) {
    throw backendError('Informe nomes de processo sem extensao ou caminho.', 'invalid-process');
  }
  await mkdir(resolve(outputRoot), { recursive: true });
  const root = await realpath(resolve(outputRoot));
  const script = fileURLToPath(new URL('../scripts/windows-game.ps1', import.meta.url));
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
    '-OutputRoot', root, '-ExpectedWidth', String(expectedSize.width), '-ExpectedHeight', String(expectedSize.height),
    '-ProcessNamesJson', JSON.stringify(processNames)], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], shell: false });
  return createWindowsGameClient(child, { outputRoot: root, expectedSize });
}
