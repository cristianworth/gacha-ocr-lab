import sharp from 'sharp';
import { selectLayout, prepareRegion } from './regions.js';

export class ScanStopped extends Error {
  constructor(reason, message = reason) { super(message); this.name = 'ScanStopped'; this.reason = reason; }
}

export async function checkScanControl(backend, signal) {
  if (signal?.aborted) throw new ScanStopped('cancelled', 'Coleta cancelada.');
  const state = await backend.status();
  if (state.stopped || !state.armed) throw new ScanStopped(state.stopReason || 'not-armed', 'Coleta interrompida pelo controle da janela.');
  return state;
}

export function wait(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new ScanStopped('cancelled')); return; }
    const done = () => { signal?.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(done, milliseconds);
    function abort() { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(new ScanStopped('cancelled')); }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export async function bounded(operation, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([operation(), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new ScanStopped('timeout', `Tempo limite: ${label}.`)), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export async function fieldFingerprint(buffer, panel) {
  const regions = selectLayout({ width: 1440, height: 900 }, { panel }).regions;
  const pieces = [];
  for (const field of ['name', 'level', 'refinement', 'weaponType']) {
    pieces.push(await sharp(buffer).extract(regions[field]).greyscale().resize(80, 12, { fit: 'fill' }).blur(0.5).raw().toBuffer());
  }
  return Buffer.concat(pieces);
}

export function pixelDistance(left, right) {
  if (!left || !right || left.length !== right.length || !left.length) return Infinity;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) difference += Math.abs(left[i] - right[i]);
  return difference / left.length;
}

async function ocrCrop(buffer, rectangle, session, variant = { gray: true }) {
  const crop = await prepareRegion(buffer, rectangle, variant);
  const result = await session.recognize(crop.buffer, 'SINGLE_LINE');
  return { rawText: result.rawText, confidence: result.confidence, rectangle };
}

export async function inspectPreparation(buffer, ocrSession) {
  const header = await ocrCrop(buffer, { left: 95, top: 18, width: 170, height: 36 }, ocrSession, { threshold: 140 });
  const sorting = await ocrCrop(buffer, { left: 114, top: 835, width: 170, height: 36 }, ocrSession);
  const count = await ocrCrop(buffer, { left: 1120, top: 10, width: 240, height: 48 }, ocrSession);
  const corroboratingCount = await ocrCrop(buffer, { left: 1120, top: 10, width: 240, height: 48 }, ocrSession, { threshold: 140 });
  const clean = text => text.replace(/\s+/gu, ' ').trim();
  const countMatch = clean(count.rawText).match(/^Weapons\s*(\d+)\s*\/\s*(\d+)$/iu);
  const corroboratingMatch = clean(corroboratingCount.rawText).match(/^Weapons\s*(\d+)\s*\/\s*(\d+)$/iu);
  const validCount = countMatch && corroboratingMatch && countMatch[1] === corroboratingMatch[1] && countMatch[2] === corroboratingMatch[2]
    && Number(countMatch[1]) <= Number(countMatch[2]) && Number(countMatch[2]) > 0;
  return {
    verified: /^Weapons$/iu.test(clean(header.rawText)) && /^Quality$/iu.test(clean(sorting.rawText)),
    verifiedParts: ['weapons-tab-label', 'quality-sort-label'],
    userPreparationRequired: ['quality-descending-order', 'no-filters-hiding-4-or-5-stars'],
    expectedPreparation: 'Aba Weapons, Quality decrescente, inicio da lista, sem filtros que ocultem armas 4/5 estrelas.',
    observedTotal: validCount ? Number(countMatch[1]) : null,
    totalIncludesOtherRarities: true,
    evidence: { header, sorting, count, corroboratingCount },
  };
}
