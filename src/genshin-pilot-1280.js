import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readImage } from './image.js';
import { prepareRegion } from './regions.js';
import { readGenshin1280, inspectGenshin1280Selected, inspectGenshin1280Selection, inspectGenshin1280Grid } from './genshin-1280.js';
import { fieldFingerprint, pixelDistance, wait } from './scan-control.js';

async function save(output, report) {
  const temporary = join(output, `.session-${randomUUID()}.tmp`);
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  await rename(temporary, join(output, 'session.json'));
}

async function header(buffer, ocr) {
  const values = {};
  for (const [name, rectangle] of Object.entries({ category: { left: 86, top: 14, width: 130, height: 45 }, sort: { left: 95, top: 661, width: 150, height: 37 } })) {
    const prepared = await prepareRegion(buffer, rectangle, { threshold: 140 });
    values[name] = (await ocr.recognize(prepared.buffer, 'SINGLE_LINE')).rawText;
  }
  return { ...values, verified: /^Weapons$/i.test(values.category.trim()) && /^Level$/i.test(values.sort.trim()) };
}

// A bounded pilot, not a full inventory scan. Backend must already be armed.
export async function runGenshinPilot1280({ backend, ocrSession, output, signal, limit = 10, onProgress = () => {}, dependencies = {} }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('O piloto aceita de 1 a 10 posicoes.');
  await mkdir(output, { recursive: true });
  const report = { schemaVersion: 1, game: 'genshin', mode: 'pilot-1280x720', scope: { minLevel: 20, rarities: [3, 4, 5] },
    startedAt: new Date().toISOString(), status: 'running', captureComplete: false, coverageConfirmed: false,
    inventoryAccepted: false, preparation: { topAndDescendingLevel: 'user-declared', rarityFilter: 'user-declared' },
    eligibility: { levelCutoffApplied: false, rarityExtracted: false, note: 'O piloto registra posicoes observadas sem classificacao de elegibilidade.' }, observations: [] };
  await save(output, report);
  const inspectHeader = dependencies.header ?? header;
  const inspectSelected = dependencies.inspectSelected ?? inspectGenshin1280Selected;
  const inspectGrid = dependencies.inspectGrid ?? inspectGenshin1280Grid;
  const inspectSlot = dependencies.inspectSlot ?? inspectGenshin1280Selection;
  const fingerprint = dependencies.fingerprint ?? fieldFingerprint;
  const read = dependencies.read ?? readGenshin1280;
  const pause = dependencies.wait ?? wait;
  let frameIndex = 0;
  async function guard() {
    if (signal?.aborted) throw new Error('cancelled');
    const state = await backend.status();
    if (signal?.aborted) throw new Error('cancelled');
    if (!state.armed || state.stopped) throw new Error(state.stopReason || 'not-armed');
    if (state.window?.dpi !== 96 || state.window?.width !== 1280 || state.window?.height !== 720) throw new Error('client-or-dpi-unverified');
  }
  async function capture() {
    await guard();
    const path = join(output, `frame-${String(frameIndex++).padStart(4, '0')}.png`);
    await backend.capture(path);
    const image = await readImage(path);
    report.lastCapture = image.source;
    await guard();
    return image;
  }
  try {
    const initial = await capture();
    report.initialFrame = initial.source;
    report.preparation.header = await inspectHeader(initial.buffer, ocrSession);
    if (!report.preparation.header.verified) throw new Error('weapons-or-level-label-unverified');
    const first = await inspectSelected(initial);
    if (first.status !== 'recognized' || first.selected.row !== 0 || first.selected.column !== 0) throw new Error('first-selection-unverified');
    const original = first.grid;
    report.grid = { bands: original.bands, slotCount: original.slots.length };
    await save(output, report);
    let previous = null;
    for (const slot of original.slots.slice(0, limit)) {
      report.currentAttempt = { position: { row: slot.row, column: slot.column }, rectangle: slot.rectangle, stage: 'before-click', frames: 0 };
      await guard();
      await backend.click({ x: Math.round(slot.rectangle.left + slot.rectangle.width / 2), y: Math.round(slot.rectangle.top + slot.rectangle.height / 2) });
      report.currentAttempt.stage = 'waiting-for-selection';
      let stable = null;
      let priorFingerprint = null;
      for (let attempt = 0; attempt < 8; attempt += 1) {
        await pause(250, signal);
        const frame = await capture();
        report.currentAttempt.frames = attempt + 1;
        const grid = await inspectGrid(frame);
        if (grid.bands.length !== original.bands.length || grid.bands.some((band, i) => Math.abs(band.end - original.bands[i].end) > 3)) throw new Error('grid-shifted');
        const selection = await inspectSlot(frame, { rectangle: slot.rectangle });
        const old = previous ? await inspectSlot(frame, { rectangle: previous.rectangle }) : null;
        if (!selection.selected || old?.selected) { priorFingerprint = null; continue; }
        const signature = await fingerprint(frame.buffer, { left: 873, top: 79, width: 327, height: 638 });
        const distance = priorFingerprint ? pixelDistance(priorFingerprint, signature) : Infinity;
        if (distance <= 2) { stable = { frame, selection, distance }; break; }
        priorFingerprint = signature;
      }
      if (!stable) throw new Error('selection-or-panel-stability-unconfirmed');
      const observation = { position: { row: slot.row, column: slot.column }, capture: stable.frame.source,
        selection: stable.selection, stability: { consecutiveFrames: 2, meanPixelDistance: stable.distance },
        status: 'captured-pending-ocr', reading: null };
      report.observations.push(observation);
      report.currentAttempt.stage = 'reading';
      await save(output, report);
      const reading = await read(stable.frame, { ocrSession });
      observation.reading = reading;
      observation.status = reading.processing.layoutVerified ? 'read' : 'layout-unverified';
      await save(output, report);
      if (!reading.processing.layoutVerified) throw new Error('weapon-type-unverified');
      await guard();
      previous = slot;
      report.currentAttempt = null;
      onProgress(report.observations.at(-1), report.observations.length);
    }
    report.status = 'partial';
    report.reason = 'pilot-limit';
  } catch (error) {
    report.status = 'partial';
    report.reason = signal?.aborted ? 'cancelled' : error.message;
  } finally {
    report.endedAt = new Date().toISOString();
    await save(output, report);
    const lines = ['# Genshin — piloto parcial', '', `Motivo: ${report.reason}`, `Posições registradas: ${report.observations.length}`, '', '| Posição | Nome | Nível | Refinamento |', '|---|---|---|---|'];
    for (const [index, item] of report.observations.entries()) {
      const fields = item.reading?.fields ?? { name: {}, level: {}, refinement: {} };
      const level = fields.level.value;
      lines.push(`| ${index + 1} | ${fields.name.value ?? '?'} | ${level ? `${level.current}/${level.max ?? '?'}` : '?'} | ${fields.refinement.value ?? '?'} |`);
    }
    lines.push('', 'Piloto limitado: não filtra elegibilidade nem comprova cobertura ou aprovação do inventário. OCR bruto e incertezas no session.json.');
    await writeFile(join(output, 'summary.md'), `${lines.join('\n')}\n`, 'utf8');
  }
  return report;
}
