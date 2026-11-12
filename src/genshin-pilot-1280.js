import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readImage } from './image.js';
import { prepareRegion } from './regions.js';
import { readGenshin1280, inspectGenshin1280Selected, inspectGenshin1280Selection, inspectGenshin1280Grid } from './genshin-1280.js';
import { fieldFingerprint, pixelDistance, wait } from './scan-control.js';
import { matchGenshin1280Scroll } from './genshin-scroll-1280.js';

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
export async function runGenshinPilot1280({ backend, ocrSession, output, signal, limit = 10, scrollProbe = false, onProgress = () => {}, dependencies = {} }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > (scrollProbe ? 40 : 10)) throw new Error('Limite de posicoes invalido.');
  await mkdir(output, { recursive: true });
  const report = { schemaVersion: 1, game: 'genshin', mode: scrollProbe ? 'scroll-probe-1280x720' : 'pilot-1280x720', scope: { minLevel: 20, rarities: [3, 4, 5] },
    startedAt: new Date().toISOString(), status: 'running', captureComplete: false, coverageConfirmed: false,
    inventoryAccepted: false, preparation: { topAndDescendingLevel: 'user-declared', rarityFilter: 'user-declared' },
    eligibility: { levelCutoffApplied: scrollProbe, rarityExtracted: false, note: 'Raridade nao e extraida; nivel pendente nao comprova cobertura.' }, observations: [] };
  await save(output, report);
  const inspectHeader = dependencies.header ?? header;
  const inspectSelected = dependencies.inspectSelected ?? inspectGenshin1280Selected;
  const inspectGrid = dependencies.inspectGrid ?? inspectGenshin1280Grid;
  const inspectSlot = dependencies.inspectSlot ?? inspectGenshin1280Selection;
  const fingerprint = dependencies.fingerprint ?? fieldFingerprint;
  const read = dependencies.read ?? readGenshin1280;
  const pause = dependencies.wait ?? wait;
  const matchScroll = dependencies.matchScroll ?? matchGenshin1280Scroll;
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
    let original = first.grid;
    report.grid = { bands: original.bands, slotCount: original.slots.length };
    await save(output, report);
    let previous = null;
    let previousCandidates = null;
    let previousFrame = null;
    let pageBase = 0;
    let scrollCount = 0;
    const visited = new Set();
    let lastLevel = null;
    let pendingLevel = false;
    let done = false;
    while (!done) {
      const rowKeys = [...new Set(original.slots.map(slot => slot.row))].sort((a, b) => a - b);
      for (const slot of original.slots) {
        const rowIndex = rowKeys.indexOf(slot.row);
        if (report.observations.length >= limit) { done = true; break; }
        const position = { row: pageBase + rowIndex, column: slot.column };
        const key = `${position.row}:${position.column}`;
        if (visited.has(key)) continue;
        // The fade at the bottom can hide a selected card's lower outline.
        // Bring the whole target into view before sending a click.
        if (scrollProbe && slot.rectangle.top + slot.rectangle.height > 610) break;
        report.currentAttempt = { position, rectangle: slot.rectangle, stage: 'before-click', frames: 0 };
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
        const observation = { position, capture: stable.frame.source,
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
        if (scrollProbe) {
          const level = reading.fields.level;
          const current = level?.status === 'recognized' && Number.isInteger(level.value?.current) ? level.value.current : null;
          observation.levelEligibility = current === null ? 'pending-level' : current >= 20 ? 'eligible-level' : 'below-level';
          if (current === null) pendingLevel = true;
          else {
            if (lastLevel !== null && current > lastLevel) throw new Error('level-order-contradiction');
            lastLevel = current;
          }
          await save(output, report);
          if (current !== null && current < 20) {
            report.levelScopeComplete = !pendingLevel;
            report.reason = pendingLevel ? 'level-cutoff-with-unresolved-levels' : 'level-cutoff-reached';
            done = true;
          }
        }
        await guard();
        visited.add(key);
        previous = slot;
        previousCandidates = null;
        previousFrame = stable.frame;
        report.currentAttempt = null;
        onProgress(report.observations.at(-1), report.observations.length);
        if (done) break;
      }
      if (done || !scrollProbe || report.observations.length >= limit) break;
      if (scrollCount >= 4) { report.reason = 'scroll-probe-limit'; break; }
      if (!previousFrame || (!previous && !previousCandidates)) throw new Error('scroll-source-unavailable');
      report.currentAttempt = { stage: 'before-scroll', beforeFrame: previousFrame.source };
      await save(output, report);
      await guard();
      await backend.scroll({ x: 500, y: 430, delta: -1 });
      scrollCount += 1;
      report.currentAttempt.stage = 'after-scroll';
      await pause(750, signal);
      const after = await capture();
      let afterGrid = await inspectGrid(after);
      let selected = await inspectSelected(after);
      if (selected.candidateCount > 2) throw new Error('scroll-selection-ambiguous');
      const candidates = selected.candidates ?? (selected.selected ? [selected.selected] : []);
      const match = await matchScroll(previousFrame, original, after, afterGrid,
        { previousSelection: previous, previousCandidates, currentCandidates: candidates });
      report.scroll = { before: previousFrame.source, after: after.source, candidates: candidates.map(({ row, column }) => ({ row, column })), match };
      (report.scrollSteps ??= []).push(report.scroll);
      await save(output, report);
      if (!['matched', 'no-new-complete-row'].includes(match.status)) throw new Error(`scroll-${match.status}`);
      if (!Number.isFinite(match.displacement) || match.displacement < 4) throw new Error('scroll-progress-unconfirmed');
      await pause(250, signal);
      const confirmation = await capture();
      const confirmedGrid = await inspectGrid(confirmation);
      const confirmedSelection = await inspectSelected(confirmation);
      if (confirmedSelection.candidateCount > 2) throw new Error('scroll-selection-ambiguous');
      const confirmedCandidates = confirmedSelection.candidates ?? (confirmedSelection.selected ? [confirmedSelection.selected] : []);
      const confirmedMatch = await matchScroll(previousFrame, original, confirmation, confirmedGrid,
        { previousSelection: previous, previousCandidates, currentCandidates: confirmedCandidates });
      report.scroll.confirmation = { frame: confirmation.source, candidates: confirmedCandidates.map(({ row, column }) => ({ row, column })), match: confirmedMatch };
      await save(output, report);
      if (confirmedMatch.status !== match.status || confirmedMatch.offset !== match.offset || confirmedMatch.overlap !== match.overlap ||
          Math.abs(confirmedMatch.displacement - match.displacement) > 2 ||
          afterGrid.bands.length !== confirmedGrid.bands.length || afterGrid.bands.some((band, i) => Math.abs(band.end - confirmedGrid.bands[i].end) > 2)) {
        throw new Error('scroll-stability-unconfirmed');
      }
      afterGrid = confirmedGrid;
      selected = confirmedSelection;
      const nextRows = [...new Set(afterGrid.slots.map(slot => slot.row))].sort((a, b) => a - b);
      if (confirmedCandidates.some(candidate => {
        const row = nextRows.indexOf(candidate.row);
        return row < 0 || !visited.has(`${pageBase + match.offset + row}:${candidate.column}`);
      })) throw new Error('scroll-selection-shift-inconsistent');
      pageBase += match.offset;
      original = afterGrid;
      previous = null;
      previousCandidates = confirmedCandidates;
      previousFrame = confirmation;
      report.currentAttempt = null;
    }
    report.status = 'partial';
    report.reason ??= scrollProbe ? (scrollCount ? 'scroll-probe-limit' : 'position-limit') : 'pilot-limit';
  } catch (error) {
    report.status = 'partial';
    report.reason = signal?.aborted ? 'cancelled' : error.message;
  } finally {
    report.endedAt = new Date().toISOString();
    await save(output, report);
    const lines = ['# Genshin — percurso parcial', '', `Motivo: ${report.reason}`, `Posições registradas: ${report.observations.length}`, '', '| Posição | Nome | Nível | Refinamento |', '|---|---|---|---|'];
    for (const [index, item] of report.observations.entries()) {
      const fields = item.reading?.fields ?? { name: {}, level: {}, refinement: {} };
      const level = fields.level.value;
      lines.push(`| ${index + 1} | ${fields.name.value ?? '?'} | ${level ? `${level.current}/${level.max ?? '?'}` : '?'} | ${fields.refinement.value ?? '?'} |`);
    }
    lines.push('', 'Percurso limitado: raridade não é extraída; não comprova cobertura ou aprovação do inventário. OCR bruto e incertezas no session.json.');
    await writeFile(join(output, 'summary.md'), `${lines.join('\n')}\n`, 'utf8');
  }
  return report;
}
