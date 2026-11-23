import sharp from 'sharp';
import { mkdir, readdir, rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readImage } from './image.js';
import { readNteOffline, panelRegions } from './nte-offline.js';
import { prepareRegion } from './regions.js';
import { createOcrSession } from './ocr.js';
import { checkScanControl, pixelDistance, wait } from './scan-control.js';

export const panel = { left: 869, top: 113, width: 348, height: 496 };
export const slots = Array.from({ length: 28 }, (_, i) => ({ left: 73 + (i % 7) * 110, top: 107 + Math.floor(i / 7) * 130, width: 105, height: 105 }));
const sameRect = (a, b) => ['left', 'top', 'width', 'height'].every(k => a[k] === b[k]);
export function validateTargets(targets) {
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > 3) throw new Error('Informe de um a tres retangulos distintos do perfil de cartoes visiveis.');
  const indices = targets.map(t => t && slots.findIndex(s => sameRect(s, t)));
  if (indices.some(i => !Number.isInteger(i) || i < 0) || new Set(indices).size !== indices.length) throw new Error('Informe de um a tres retangulos distintos do perfil de cartoes visiveis.');
}

// Require the two vertical sides and bottom of the pink outline; the top can be shaded.
export async function inspectNteSelection(buffer) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1280 || info.height !== 720 || info.channels !== 3) throw new Error('client-size-unverified');
  const pink = (x, y) => { const i = (y * info.width + x) * 3; return data[i] > 200 && data[i + 1] < 120 && data[i + 2] > 100 && data[i] - data[i + 1] > 110; };
  const scores = slots.map(slot => {
    const sides = [0, 1, 2].map(side => {
      let best = 0;
      for (let d = -2; d <= 2; d++) {
        let count = 0;
        for (let i = 20; i < 80; i++) for (let j = 0; j < 3; j++) {
          const x = side === 0 ? slot.left + d + j : side === 1 ? slot.left + 104 + d + j : slot.left + i;
          const y = side === 2 ? slot.top + 104 + d + j : slot.top + i;
          if (pink(x, y)) count++;
        }
        best = Math.max(best, count / 180);
      }
      return best;
    });
    return { slot, sides, score: Math.min(...sides) };
  });
  const candidates = scores.filter(s => s.score >= 0.6);
  const uncertain = scores.filter(s => s.score < 0.6 && (s.score >= 0.2 || s.sides.filter(value => value >= 0.6).length >= 2));
  return { verified: candidates.length === 1 && !uncertain.length, selected: candidates[0]?.slot ?? null, candidates, uncertain };
}
async function fingerprint(buffer) { return sharp(buffer).extract(panel).greyscale().raw().toBuffer(); }
export async function inspectNtePreparation(image, cachePath, createSession = createOcrSession) {
  const rectangle = panelRegions(panel, { width: 1280, height: 720 }).category;
  const prepared = await prepareRegion(image.buffer, rectangle, { threshold: 120 });
  const session = await createSession({ languages: 'eng', cachePath, offline: true });
  try {
    const ocr = await session.recognize(prepared.buffer, 'SINGLE_LINE');
    return { rectangle, processing: prepared.processing, ocr, verified: /^Arc$/iu.test(ocr.rawText.trim()) };
  } finally { await session.close(); }
}
export function renderNteSummary(report, output) {
  const escape = value => String(value ?? '?').replace(/\|/gu, '\\|').replace(/\s+/gu, ' ').trim() || '?';
  const link = path => path ? relative(output, path).split(/[\\/]/u).map(encodeURIComponent).join('/') : null;
  const lines = ['# NTE Arc — piloto parcial', '', `Parada: ${escape(report.reason)}. Observações: ${report.observations.length}.`, '', '[Sessão e OCR bruto](session.json)', '', '| Alvo | Estado | Nome | Nível | Elemento | Atributos | Tier | Frame |', '|---|---|---|---|---|---|---|---|'];
  for (const item of report.observations) {
    const fields = item.reading?.fields ?? {};
    const candidate = key => escape(fields[key]?.candidate);
    const frame = link(item.frame?.path);
    lines.push(`| ${item.target.left},${item.target.top} | ${escape(item.status)} | ${candidate('name')} | ${candidate('level')} | ${candidate('element')} | ${candidate('attribute1')}; ${candidate('attribute2')} | ${candidate('tier')} | ${frame ? `[frame](${frame})` : '?'} |`);
  }
  lines.push('', 'Todos os campos são candidatos para revisão humana. Sem cobertura, identidade de cópias ou aprovação do inventário.');
  return `${lines.join('\n')}\n`;
}
async function save(output, report) {
  const temporary = join(output, `.session-${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, join(output, 'session.json'));
}
export async function runNtePilot({ backend, output, targets, cachePath, signal, dependencies = {} }) {
  validateTargets(targets);
  await mkdir(output, { recursive: true });
  if ((await readdir(output)).some(name => !['console.log', 'stop.request'].includes(name))) throw new Error('A pasta da sessao nao esta vazia.');
  const report = { schema: 'nte-arc-pilot-v1', startedAt: new Date().toISOString(), status: 'running', scope: { targets, filter: 'none', order: 'declared-targets', scroll: false }, coverageConfirmed: false, humanApproved: false, observations: [], frames: [], currentAttempt: null };
  const pause = dependencies.wait ?? wait, inspect = dependencies.inspect ?? inspectNteSelection, read = dependencies.read ?? readNteOffline, signature = dependencies.fingerprint ?? fingerprint, prepare = dependencies.prepare ?? inspectNtePreparation;
  let frameNumber = 0;
  async function guard() {
    const state = await checkScanControl(backend, signal);
    if (signal?.aborted) throw new Error('cancelled');
    if (state.window?.width !== 1280 || state.window?.height !== 720 || state.window?.dpi !== 96) throw new Error('client-or-dpi-unverified');
  }
  async function capture() {
    await guard();
    const path = join(output, `frame-${String(++frameNumber).padStart(3, '0')}.png`);
    await backend.capture(path);
    const image = await readImage(path);
    report.frames.push(image.source);
    await save(output, report);
    await guard();
    return image;
  }
  await save(output, report);
  try {
    report.currentAttempt = { stage: 'preparation' }; await save(output, report);
    const initial = await capture();
    report.preparation = { frame: initial.source, selection: await inspect(initial.buffer) };
    await save(output, report); await guard();
    if (!report.preparation.selection.verified) throw new Error('initial-selection-unverified');
    report.preparation.category = await prepare(initial, cachePath);
    await save(output, report); await guard();
    if (!report.preparation.category.verified) throw new Error('arc-category-unverified');
    for (const [index, target] of targets.entries()) {
      report.currentAttempt = { index, target, stage: 'before-click' }; await save(output, report);
      await guard();
      await backend.click({ x: target.left + 52, y: target.top + 52 });
      report.currentAttempt.stage = 'selection-and-stability'; await save(output, report);
      await guard();
      let previous = null, stable = null;
      for (let i = 0; i < 8; i++) {
        await pause(250, signal);
        const frame = await capture();
        const selection = await inspect(frame.buffer);
        await guard();
        if (!selection.verified || !sameRect(selection.selected, target)) { previous = null; continue; }
        const fp = await signature(frame.buffer);
        await guard();
        const distance = previous ? pixelDistance(previous.fp, fp) : Infinity;
        if (distance <= 1.5) { stable = { frame, previous: previous.frame.source, selection, distance }; break; }
        previous = { fp, frame };
      }
      if (!stable) throw new Error('selection-or-panel-stability-unconfirmed');
      const observation = { target, frame: stable.frame.source, priorFrame: stable.previous, selection: stable.selection, stability: { frames: 2, meanPixelDistance: stable.distance }, status: 'captured-pending-ocr', reading: null };
      report.observations.push(observation); report.currentAttempt.stage = 'ocr'; await save(output, report);
      await guard();
      observation.reading = await read(stable.frame, { panel, cachePath, outputDir: join(output, `observation-${index + 1}`) });
      observation.status = 'review-required'; await save(output, report);
      await guard();
      report.currentAttempt = null; await save(output, report);
    }
    report.reason = 'pilot-limit';
  } catch (error) { report.reason = signal?.aborted ? 'cancelled' : error.reason ?? error.code ?? error.message; report.error = { message: error.message, stage: report.currentAttempt?.stage ?? 'initial' }; }
  finally {
    report.status = 'partial'; report.endedAt = new Date().toISOString(); await save(output, report);
    await writeFile(join(output, 'summary.md'), renderNteSummary(report, output), 'utf8');
  }
  return report;
}
