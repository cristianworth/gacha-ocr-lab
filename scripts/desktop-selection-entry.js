import { existsSync } from 'node:fs';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { checkInstallation, listWindows, revalidateWindow, repository, runChild, targets } from './selection-pilot-entry.js';

export function validatePilotReport(game, report) {
  const schema = game === 'wuwa' ? report?.schemaVersion === 1 && report.game === 'wuwa' && report.mode === 'visible-pilot'
    : game === 'nte' && report?.schema === 'nte-arc-pilot-v1' && (report.game === undefined || report.game === 'nte');
  const acceptance = game === 'wuwa' ? report?.inventoryAccepted : report?.humanApproved;
  if (!schema || report.status !== 'partial' || report.coverageConfirmed !== false || acceptance !== false ||
      !Array.isArray(report.observations) || typeof report.reason !== 'string') throw new Error('Manifesto do piloto com formato/jogo/estado invalido.');
  // NTE can fail before entering its executor, which writes a preparation-only report.
  if (game === 'nte' && report.scope === undefined && report.error?.stage === 'preparation' &&
      report.reason !== 'pilot-limit' && report.observations.length === 0) return report;
  const expected = targets[game].map(t => t.split(',').map(Number));
  const scope = report.scope;
  if (!scope || scope.filter !== 'none' || scope.order !== 'declared-targets' || scope.scroll !== false ||
      !Array.isArray(scope.targets) || scope.targets.length !== expected.length ||
      !scope.targets.every((rect, i) => ['left', 'top', 'width', 'height'].every((k, j) => rect?.[k] === expected[i][j]))) {
    throw new Error('Manifesto fora do recorte fixo deste piloto.');
  }
  return report;
}

export async function runDesktopSelection({ root, game, action, entry, check = checkInstallation,
  list = () => listWindows(root), run = runChild, print = console.log }) {
  if (!Object.hasOwn(targets, game) || !['list', 'run'].includes(action)) throw new Error('Acao ou jogo invalido.');
  const actualRoot = await realpath(root), actualEntry = await realpath(entry);
  if (dirname(actualEntry).toLowerCase() !== join(actualRoot, '.cache', 'desktop-pilot').toLowerCase() ||
      actualEntry.toLowerCase() !== resolve(entry).toLowerCase()) throw new Error('Controle deve ficar nesta instalacao, sem redirecionamento.');
  const receipt = { game, action, result: 'error', directory: null };
  try {
    await check(root);
    if (action === 'list') {
      receipt.windows = await list();
      receipt.result = 'ready';
      print('Escolha explicitamente nome, PID e titulo; confirme a preparacao para iniciar.');
      return receipt;
    }
    const selected = JSON.parse((await readFile(join(entry, 'window.json'), 'utf8')).replace(/^\uFEFF/u, ''));
    let timer;
    let result;
    try {
      result = await run({ root, game, window: selected, print, windowsHide: true,
        beforeSpawn: async () => {
          if (!(await revalidateWindow(selected, { list }))) throw new Error('Janela fechada, alterada ou ambigua; atualize a lista e confirme novamente.');
        },
        onReady: ({ requestCancel }) => {
          let requested = false;
          const observe = () => {
            if (!requested && existsSync(join(entry, 'stop.request'))) { requested = true; requestCancel(); }
          };
          observe(); timer = setInterval(observe, 100);
        },
      });
    } finally { clearInterval(timer); }
    // runChild consumes the child's marker and verifies ownership, freshness and realpath.
    // It returns only after close, including drained stdout/stderr and pending log writes.
    receipt.directory = result.directory ?? null;
    receipt.childExitCode = result.exitCode ?? null;
    if (result.logError) throw new Error(`Falha ao gravar log do filho: ${result.logError}`);
    if (result.report) {
      const report = validatePilotReport(game, result.report);
      receipt.result = 'partial';
      receipt.reason = report.reason;
      receipt.pendingOcr = report.observations.filter(o => o.status === 'captured-pending-ocr').length;
      // The pilot CLIs use exit 1 for an expected cooperative/F8 stop as well.
      // A nonzero exit after pilot-limit is a failure even with a valid manifest.
      const expectedStop = result.exitCode === 1 && ['cancelled', 'emergency-f8'].includes(report.reason);
      receipt.failed = result.code !== 0 && !expectedStop;
      if (receipt.failed) receipt.error = `Falha ao encerrar o filho (codigo ${receipt.childExitCode ?? 'indisponivel'}; motivo ${report.reason}).`;
      print(`Encerramento do filho: codigo ${receipt.childExitCode ?? 'indisponivel'}; ${receipt.failed ? 'falha' : expectedStop ? 'parada esperada' : 'normal'}.`);
      print(`Resultado parcial: ${report.reason}; sem cobertura ou aceite do inventario.`);
    } else receipt.error = 'Nenhuma sessao propria com manifesto final legivel foi confirmada. Consulte o log desta abertura.';
    return receipt;
  } catch (error) {
    receipt.error = error.message;
    print(`Falha no piloto: ${error.message}`);
    return receipt;
  } finally {
    await writeFile(join(entry, 'result.json'), `${JSON.stringify(receipt)}\n`, 'utf8');
  }
}

async function main() {
  const { values } = parseArgs({ options: { game: { type: 'string' }, action: { type: 'string' }, 'entry-directory': { type: 'string' } }, strict: true });
  const receipt = await runDesktopSelection({ root: repository, game: values.game, action: values.action, entry: values['entry-directory'] });
  process.exitCode = receipt.result === 'error' || receipt.failed ? 1 : 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
