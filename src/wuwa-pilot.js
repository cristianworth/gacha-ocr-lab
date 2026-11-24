import { mkdir, rename, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { readImage } from './image.js';
import { readWuwaOffline } from './wuwa-offline.js';
import { inspectWuwaSelection, validateWuwaTargets } from './wuwa-selection.js';
import { prepareRegion } from './regions.js';
import { checkScanControl, pixelDistance, wait } from './scan-control.js';

async function save(output, report) {
  const temp = join(output, `.session-${randomUUID()}.tmp`);
  await writeFile(temp, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await rename(temp, join(output, 'session.json'));
}
function summary(report) {
  const lines = ['# WuWa — piloto parcial', '', `Parada: ${report.reason}`, `Observações: ${report.observations.length}`, '', '| Alvo | Estado | Nome | Tipo | Nível | Rank | Evidência |', '|---|---|---|---|---|---|---|'];
  for (const o of report.observations) {
    const f = o.reading?.fields ?? {}; const clean = v => String(v ?? '?').replace(/[|\r\n]/gu, ' ');
    const state = o.status === 'read' ? 'Leitura retornada' : o.status === 'captured-pending-ocr' ? 'Capturada, OCR pendente' : clean(o.status);
    const capture = o.capture?.path ? `[captura](${encodeURIComponent(basename(o.capture.path))})` : '?';
    lines.push(`| ${o.index + 1} | ${state} | ${clean(f.name?.value)} | ${clean(f.type?.value)} | ${f.level?.value ? `${f.level.value.current}/${f.level.value.max}` : '?'} | ${clean(f.rank?.value)} | ${capture} |`);
  }
  return `${lines.join('\n')}\n\nRaridade não qualificada. Leitura retornada não é aprovação humana. Sessão parcial, sem cobertura ou aceite do inventário. Bruto e tentativas em [session.json](session.json).\n`;
}
async function fingerprint(buffer) {
  const rectangles = [{left:883,top:80,width:345,height:28},{left:884,top:130,width:150,height:56},{left:884,top:381,width:112,height:29}];
  const pieces = [];
  for (const rect of rectangles) pieces.push(await sharp(buffer).extract(rect).greyscale().resize(100,12,{fit:'fill'}).raw().toBuffer());
  return Buffer.concat(pieces);
}

// English header in the initial 1280x720 client, independent of weapon name.
export async function inspectWuwaPreparation(image, ocrSession) {
  const rectangle = { left: 72, top: 34, width: 82, height: 27 };
  const prepared = await prepareRegion(image.buffer, rectangle, { threshold: 140 });
  const ocr = await ocrSession.recognize(prepared.buffer, 'SINGLE_LINE');
  return { rectangle, processing: prepared.processing, ocr, verified: /^Weapons$/iu.test(ocr.rawText.trim()) };
}

// The injected inspector and reader exist for simulations; the CLI never overrides them.
export async function runWuwaPilot({ output, targets, setup, signal, ocrSession, dependencies = {} }) {
  validateWuwaTargets(targets);
  await mkdir(output); // Fail if an earlier run exists, even when empty.
  const report = { schemaVersion: 1, game: 'wuwa', mode: 'visible-pilot', scope: { targets, filter: 'none', order: 'declared-targets', scroll: false }, startedAt: new Date().toISOString(), status: 'running', coverageConfirmed: false, inventoryAccepted: false, observations: [], attempts: [] };
  await save(output, report);
  let backend; let frameNumber = 0;
  const inspect = dependencies.inspect ?? inspectWuwaSelection;
  const read = dependencies.read ?? readWuwaOffline;
  const prepare = dependencies.prepare ?? inspectWuwaPreparation;
  const pause = dependencies.wait ?? wait;
  const signature = dependencies.fingerprint ?? fingerprint;
  async function guard() {
    const state = await checkScanControl(backend, signal);
    if (signal?.aborted) throw new Error('cancelled');
    if (state.window?.width !== 1280 || state.window?.height !== 720 || state.window?.dpi !== 96) throw new Error('client-or-dpi-unverified');
  }
  async function capture(attempt) {
    await guard();
    const path = join(output, `frame-${String(frameNumber++).padStart(4, '0')}.png`);
    await backend.capture(path);
    const image = await readImage(path);
    attempt.frames.push(image.source);
    await save(output, report);
    await guard();
    return image;
  }
  try {
    report.stage = 'setup'; await save(output, report);
    backend = await setup(output, signal);
    await guard();
    const preflight = { stage: 'preflight', frames: [] }; report.attempts.push(preflight); await save(output, report);
    const initial = await capture(preflight);
    preflight.preparation = await prepare(initial, ocrSession); await save(output, report);
    await guard();
    if (!preflight.preparation.verified) throw new Error('weapons-screen-unverified');
    preflight.selection = await inspect(initial, { target: targets[0] }); await save(output, report);
    await guard();
    // This conservative viewport gate is deliberately before the first click.
    if (preflight.selection.status !== 'confirmed') throw new Error(preflight.selection.status);
    preflight.stage = 'complete';
    for (const [index, target] of targets.entries()) {
      const attempt = { index, target, stage: 'before-click', frames: [] }; report.attempts.push(attempt); await save(output, report);
      attempt.stage = 'click-in-progress'; await save(output, report);
      await guard();
      await backend.click({ x: target.left + Math.floor(target.width / 2), y: target.top + Math.floor(target.height / 2) });
      await guard(); attempt.stage = 'waiting'; await save(output, report);
      let previous; let stable;
      for (let i = 0; i < 8; i++) {
        await pause(250, signal); await guard();
        const frame = await capture(attempt);
        const selection = await inspect(frame, { target }); await guard();
        attempt.lastSelection = selection; await save(output, report);
        if (selection.status !== 'confirmed') { previous = null; continue; }
        const fp = await signature(frame.buffer); await guard();
        const distance = previous ? pixelDistance(previous.fp, fp) : Infinity;
        if (distance <= 2) { stable = { frame, selection, distance, previous: previous.source }; break; }
        previous = { fp, source: frame.source };
      }
      if (!stable) throw new Error('selection-or-panel-stability-unconfirmed');
      const observation = { index, target, selection: stable.selection, stability: { consecutiveFrames: 2, meanPixelDistance: stable.distance, previous: stable.previous }, capture: stable.frame.source, status: 'captured-pending-ocr' };
      report.observations.push(observation); attempt.stage = 'reading'; await save(output, report);
      await guard();
      observation.reading = await read(stable.frame, { client: {left:0,top:0,width:1280,height:720}, ocrSession });
      observation.status = 'read'; await save(output, report); await guard();
      attempt.stage = 'complete'; await save(output, report);
    }
    report.reason = 'pilot-limit';
  } catch (error) { report.reason = signal?.aborted ? 'cancelled' : (error.reason ?? error.code ?? error.message); report.error = error.message; }
  finally { report.stage = report.attempts.at(-1)?.stage ?? report.stage; report.status = 'partial'; report.endedAt = new Date().toISOString(); await save(output, report); await writeFile(join(output, 'summary.md'), summary(report), 'utf8'); }
  return report;
}
