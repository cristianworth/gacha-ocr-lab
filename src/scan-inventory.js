import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { readImage } from './image.js';
import { readWeapon } from './read-weapon.js';
import { inspectInventory, inspectSelection, readRarity, matchRows } from './genshin-inventory.js';
import { appendObservation, finishSession, saveSession } from './inventory-session.js';
import { writeSessionReview } from './inventory-review.js';
import { bounded, checkScanControl, fieldFingerprint, inspectPreparation, pixelDistance, ScanStopped, wait } from './scan-control.js';

export function assessCoverage({ reason, topVerified, expectedCount, observations }) {
  const included = observations.filter(item => item.status === 'included').length;
  const scopePending = observations.filter(item => ['scope-uncertain', 'failed'].includes(item.status)).length;
  const traversalComplete = topVerified && ['rarity-cutoff', 'list-end', 'empty-inventory'].includes(reason);
  const countMatches = Number.isInteger(expectedCount) && expectedCount === included;
  return {
    status: traversalComplete && scopePending === 0 && countMatches ? 'verified' : 'unconfirmed',
    reason: !traversalComplete ? 'Percurso incompleto ou inicio/fim nao confirmado.'
      : scopePending ? 'Ha observacoes com elegibilidade incerta ou falha.'
        : !Number.isInteger(expectedCount) ? 'Informe/confronte uma contagem independente de armas 4/5 estrelas; o total da tela inclui outras raridades.'
          : !countMatches ? 'A quantidade incluida difere da contagem independente informada.'
            : 'Percurso e contagem do escopo concordam; a revisao humana dos campos permanece pendente.',
    traversalComplete, expectedCount: expectedCount ?? null, included, scopePending,
  };
}

// Dependencies form the public boundary for simulated navigation tests; no live backend is created here.
export async function runInventoryScan({ backend, session, ocrSession, options = {}, signal, onProgress = () => {}, dependencies = {} }) {
  const inspect = dependencies.inspectInventory ?? inspectInventory;
  const selection = dependencies.inspectSelection ?? inspectSelection;
  const rarityReader = dependencies.readRarity ?? readRarity;
  const align = dependencies.matchRows ?? matchRows;
  const fingerprint = dependencies.fieldFingerprint ?? fieldFingerprint;
  const preparation = dependencies.inspectPreparation ?? inspectPreparation;
  const reader = dependencies.readWeapon ?? readWeapon;
  const pause = dependencies.wait ?? wait;
  const config = { full: false, limit: 10, maxItems: 2000, maxPages: 100, maxScrollSteps: 24,
    expectedCount: null, startAtTopDeclared: false, settleMs: 180, selectionTimeoutMs: 5000, ocrTimeoutMs: 30_000, ...options };
  const directory = session.directory;
  await mkdir(join(directory, 'captures'), { recursive: true });
  await mkdir(join(directory, 'results'), { recursive: true });
  let reason = 'not-started';
  let error = null;
  let topVerified = false;
  let current;
  let page = 0;
  let rowBase = 0;
  let lastKnownRarity = null;
  const visited = new Set();
  session.manifest.config = { ...session.manifest.config, ...config, expectedPreparation: 'Weapons / Quality decrescente / inicio da lista / sem filtros ocultando armas 4/5 estrelas' };
  await saveSession(session);

  async function capture(label) {
    await checkScanControl(backend, signal);
    const path = join(directory, 'captures', `${label}-${randomUUID()}.png`);
    await backend.capture(path);
    const image = await readImage(path);
    if (signal?.aborted) throw new ScanStopped('cancelled');
    return { ...image, path };
  }
  async function discard(frame) {
    if (frame) await unlink(frame.path).catch(() => {});
  }
  async function selectedFrame(slot, panel) {
    await checkScanControl(backend, signal);
    await backend.click(slot.center);
    await pause(config.settleMs, signal);
    const started = Date.now();
    const until = started + config.selectionTimeoutMs;
    let previousFingerprint;
    const retained = [];
    const attempts = [];
    try {
      while (Date.now() < until) {
        const frame = await capture('selected');
        retained.push(frame);
        if (retained.length > 8) await discard(retained.shift());
        const selected = await selection(frame.buffer, slot);
        const attempt = { ordinal: attempts.length + 1, elapsedMs: Date.now() - started, path: frame.path,
          sha256: frame.source.sha256, selection: selected, stable: false, fingerprintDistance: null };
        attempts.push(attempt);
        if (selected.evidence?.expectedSignatureMatches === false) {
          throw new ScanStopped('grid-changed', 'A arte do item mudou em relacao a grade-base; selecao/posicao nao sera reaproveitada.');
        }
        const pixels = selected.selected === true ? await fingerprint(frame.buffer, panel) : null;
        attempt.fingerprintDistance = pixels && previousFingerprint ? pixelDistance(pixels, previousFingerprint) : null;
        attempt.stable = attempt.fingerprintDistance !== null && attempt.fingerprintDistance <= 2;
        if (attempt.stable) {
          frame.selectionEvidence = { ...selected, attempts: attempts.length, elapsedMs: attempt.elapsedMs,
            stability: { consecutiveSelectedFrames: 2, meanPixelDistance: attempt.fingerprintDistance, threshold: 2 } };
          await Promise.all(retained.filter(item => item.path !== frame.path).map(discard));
          return frame;
        }
        previousFingerprint = pixels;
        await pause(config.settleMs, signal);
      }
      const hadSelection = attempts.some(attempt => attempt.selection.selected);
      throw new ScanStopped('selection-timeout', hadSelection
        ? 'A borda foi observada, mas duas capturas consecutivas nao confirmaram selecao/painel estavel. Veja as tentativas no diagnostico.'
        : 'A borda de selecao nao foi confirmada. Veja as tentativas no diagnostico; nenhum item anterior sera reaproveitado.');
    } catch (failure) {
      const paths = new Set(retained.map(item => item.path));
      session.manifest.lastDiagnostic = { path: retained.at(-1)?.path ?? null, reason: failure.reason ?? 'selection-failed',
        target: slot, retainedCaptures: retained.map(item => ({ path: item.path, sha256: item.source.sha256 })),
        attempts: attempts.map(attempt => ({ ...attempt, path: paths.has(attempt.path) ? attempt.path : null })) };
      throw failure;
    }
  }
  async function nextPage(previous) {
    const previousRows = previous.rows.filter(row => row.complete);
    let candidate;
    let unchangedAtBottom = 0;
    for (let step = 0; step < config.maxScrollSteps; step += 1) {
      await checkScanControl(backend, signal);
      await backend.scroll({ x: 520, y: 450, delta: -1 });
      await pause(config.settleMs, signal);
      const frame = await capture('scroll');
      let analysis;
      try { analysis = await inspect(frame.buffer); }
      catch (failure) { session.manifest.lastDiagnostic = { path: frame.path, reason: 'grid-after-scroll' }; throw failure; }
      await discard(candidate?.frame);
      candidate = { frame, analysis };
      if (analysis.gridSignature === previous.gridSignature && analysis.scrollbar?.status === 'recognized' && analysis.scrollbar.atBottom === true) {
        unchangedAtBottom += 1;
        if (unchangedAtBottom >= 3) { session.manifest.lastPageCapture = frame.path; return { end: true, analysis }; }
      } else { unchangedAtBottom = 0; }
      const nextRows = analysis.rows.filter(row => row.complete);
      const match = align(previousRows, nextRows);
      if (match.status === 'ambiguous') {
        session.manifest.lastDiagnostic = { path: frame.path, reason: 'ambiguous-row-overlap' };
        throw new ScanStopped('ambiguous-row-overlap', 'A sobreposicao de linhas e ambigua; copias iguais nao serao fundidas ou ignoradas.');
      }
      if (match.status === 'matched' && match.offset > 0 && nextRows.length > match.overlap) {
        session.manifest.lastPageCapture = frame.path;
        return { analysis, offset: match.offset };
      }
    }
    if (candidate) session.manifest.lastDiagnostic = { path: candidate.frame.path, reason: 'scroll-unconfirmed' };
    throw new ScanStopped('scroll-unconfirmed', 'Nao foi possivel confirmar avanco/fim da lista dentro do limite de rolagem.');
  }

  try {
    const initial = await capture('start');
    session.manifest.initialCapture = initial.path;
    session.manifest.initialSource = initial.source;
    const prepared = await bounded(() => preparation(initial.buffer, ocrSession), config.ocrTimeoutMs, 'preparacao');
    session.manifest.preparation = prepared;
    await saveSession(session);
    if (!prepared.verified) throw new ScanStopped('preparation-unverified', 'Aba Weapons e ordenacao Quality nao confirmadas. Confira a captura inicial.');
    if (prepared.observedTotal === 0) {
      topVerified = true;
      reason = 'empty-inventory';
    } else {
      current = await inspect(initial.buffer);
      session.manifest.config.panel = current.panel;
      session.manifest.config.profile = current.profile;
      session.manifest.initialInspection = { profile: current.profile, geometry: current.geometry, scrollbar: current.scrollbar,
        completeRows: current.rows.filter(row => row.complete).length, partialRows: current.rows.filter(row => !row.complete).length };
      topVerified = current.scrollbar?.status === 'recognized' && current.scrollbar.atTop === true;
      if (current.scrollbar?.status === 'recognized' && current.scrollbar.atTop === false) throw new ScanStopped('start-unverified', 'A barra indica que a lista nao esta no topo; --at-top nao pode contradizer a imagem.');
      if (!topVerified && prepared.observedTotal !== null && prepared.observedTotal === current.slots.length && current.rows.every(row => row.complete)) topVerified = true;
      if (!topVerified && config.startAtTopDeclared) { topVerified = true; session.manifest.startEvidence = { method: 'user-declared', note: 'Usuario declarou inicio da lista; nao e deteccao automatica do topo.' }; }
      else if (topVerified) session.manifest.startEvidence = { method: 'image-evidence', scrollbar: current.scrollbar ?? null };
      if (!topVerified) throw new ScanStopped('start-unverified', 'A barra nao confirmou o inicio da lista. Confira a captura inicial; se estiver no topo, --at-top registra sua confirmacao explicita.');
      await saveSession(session);
      while (page < config.maxPages) {
        const rows = current.rows.filter(row => row.complete);
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
          for (const slot of rows[rowIndex].slots) {
            const position = { page, row: rowBase + rowIndex, column: slot.column };
            const identity = `${position.row}:${position.column}`;
            if (visited.has(identity)) continue;
            if (session.manifest.observations.length >= (config.full ? config.maxItems : config.limit)) {
              reason = config.full ? 'item-limit' : 'pilot-limit'; break;
            }
            let frame;
            let observation;
            try {
              frame = await selectedFrame(slot, current.panel);
              const rarity = await rarityReader(frame.buffer, current.panel);
              const recognizedRarity = rarity.status === 'recognized' && Number.isInteger(rarity.value) && rarity.value >= 1 && rarity.value <= 5;
              if (recognizedRarity && lastKnownRarity !== null && rarity.value > lastKnownRarity) throw new ScanStopped('sorting-changed', 'A ordem observada nao e Quality decrescente.');
              const status = !recognizedRarity ? 'scope-uncertain' : [4, 5].includes(rarity.value) ? 'included' : 'excluded';
              observation = await appendObservation(session, { status, position,
                capture: { path: frame.path, sha256: frame.source.sha256, panel: current.panel }, selection: frame.selectionEvidence, rarity, fields: null, resultPath: null });
              visited.add(identity);
              if (recognizedRarity) lastKnownRarity = rarity.value;
              if (status !== 'excluded') {
                const result = await bounded(() => reader(frame, { game: 'genshin', languages: 'eng', offline: true,
                  layout: 'screenshot', panel: current.panel, ocrSession, signal }), config.ocrTimeoutMs, 'OCR da arma');
                const resultPath = join(directory, 'results', `${observation.id}-${randomUUID()}.json`);
                const resultBytes = Buffer.from(`${JSON.stringify(result, null, 2)}\n`);
                await writeFile(resultPath, resultBytes, { flag: 'wx' });
                observation.resultSha256 = createHash('sha256').update(resultBytes).digest('hex');
                observation.resultPath = resultPath;
                observation.fields = result.fields;
                await saveSession(session);
              }
              onProgress({ observation, visited: visited.size, included: session.manifest.items.length });
              if (status === 'excluded') {
                if (session.manifest.items.length === 0) throw new ScanStopped('scope-order-unverified', 'Nenhuma arma 4/5 estrelas foi observada antes de raridade inferior. Confira Quality decrescente; nao sera presumido inventario elegivel vazio.');
                reason = 'rarity-cutoff'; break;
              }
            } catch (failure) {
              if (observation) { observation.error = failure.message; await saveSession(session); }
              else if (frame) await appendObservation(session, { status: 'failed', position, capture: { path: frame.path, sha256: frame.source.sha256, panel: current.panel }, error: failure.message });
              throw failure;
            }
          }
          if (reason !== 'not-started') break;
        }
        if (reason !== 'not-started') break;
        if (Number.isInteger(prepared.observedTotal) && visited.size === prepared.observedTotal) { reason = 'list-end'; break; }
        if (Number.isInteger(prepared.observedTotal) && visited.size > prepared.observedTotal) throw new ScanStopped('count-inconsistent', 'Numero de posicoes visitadas ultrapassou o total observado.');
        if (!config.full) { reason = 'pilot-page-end'; break; }
        if (page + 1 >= config.maxPages) { reason = 'page-limit'; break; }
        const next = await nextPage(current);
        if (next.end) { reason = 'list-end'; break; }
        rowBase += next.offset;
        page += 1;
        current = next.analysis;
        await saveSession(session);
      }
      if (reason === 'not-started') reason = 'page-limit';
    }
  } catch (failure) {
    reason = signal?.aborted ? 'cancelled' : typeof failure.reason === 'string' ? failure.reason : typeof failure.code === 'string' ? failure.code : 'scan-failed';
    error = failure.message;
  } finally {
    const coverage = assessCoverage({ reason, topVerified, expectedCount: config.expectedCount, observations: session.manifest.observations });
    const processingComplete = (reason === 'empty-inventory' || session.manifest.observations.length > 0)
      && session.manifest.observations.every(item => item.status === 'excluded' || (item.resultPath && !item.error));
    await finishSession(session, { reason, captureComplete: coverage.traversalComplete, coverage, processingComplete, error });
    await writeSessionReview(session);
  }
  return { session, reason, error };
}
