import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { validateRectangle } from './regions.js';

export const profile = 'genshin-inventory-1440x900-v1';
const viewport = { left: 70, top: 80, width: 888, height: 730 };
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const digest = (value) => createHash('sha256').update(value).digest('hex');
function geometryError(message, code = 'GENSHIN_INVENTORY_GEOMETRY') {
  const error = new Error(message);
  error.code = code;
  throw error;
}
async function pixels(buffer, requireClient = true) {
  let result;
  try { result = await sharp(buffer).flatten({ background: 'black' }).removeAlpha().raw().toBuffer({ resolveWithObject: true }); }
  catch (cause) { throw new Error('Nao foi possivel decodificar a imagem do inventario.', { cause }); }
  if (requireClient && (result.info.width !== 1440 || result.info.height !== 900)) {
    geometryError('O perfil exige a area cliente 1440x900, sem bordas; nao recorta nem redimensiona automaticamente.', 'GENSHIN_UNSUPPORTED_SIZE');
  }
  return result;
}
function rgb(data, info, x, y) {
  const offset = (y * info.width + x) * info.channels;
  return [data[offset], data[offset + 1], data[offset + 2]];
}
const pale = ([r, g, b]) => r > 182 && g > 182 && b > 165 && Math.max(r, g, b) - Math.min(r, g, b) < 42;
const bright = ([r, g, b]) => Math.min(r, g, b) > 230 && Math.max(r, g, b) - Math.min(r, g, b) < 32;
function runs(mask, minWidth, maxWidth, maxHole = 8) {
  const output = [];
  for (let start = 0; start < mask.length;) {
    if (!mask[start]) { start += 1; continue; }
    let cursor = start + 1;
    let end = cursor;
    while (cursor < mask.length) {
      if (mask[cursor]) { end = ++cursor; continue; }
      let next = cursor;
      while (next < mask.length && !mask[next] && next - cursor <= maxHole) next += 1;
      if (next < mask.length && next - cursor <= maxHole) cursor = next;
      else break;
    }
    if (end - start >= minWidth && end - start <= maxWidth) output.push({ start, end });
    start = Math.max(cursor + 1, start + 1);
  }
  return output;
}
function levelStrips(data, info) {
  const groups = [];
  for (let y = viewport.top; y < viewport.top + viewport.height; y += 1) {
    const mask = Array.from({ length: viewport.width }, (_, dx) => pale(rgb(data, info, viewport.left + dx, y)));
    for (const run of runs(mask, 72, 110)) {
      const left = run.start + viewport.left;
      const width = run.end - run.start;
      let group = groups.find((item) => Math.abs(item.left - left) < 6 && y - item.bottom < 5 && Math.abs(item.width - width) < 9);
      if (!group) { group = { left, width, top: y, bottom: y, samples: [] }; groups.push(group); }
      group.bottom = y;
      group.samples.push({ left, width });
    }
  }
  return groups.filter((group) => group.bottom - group.top >= 9 && group.bottom - group.top <= 30)
    .map((group) => ({ ...group, center: median(group.samples.map((sample) => sample.left + sample.width / 2)) }));
}
function cluster(values, tolerance) {
  const groups = [];
  for (const value of [...values].sort((a, b) => a - b)) {
    const last = groups.at(-1);
    if (last && Math.abs(median(last) - value) <= tolerance) last.push(value);
    else groups.push([value]);
  }
  return groups.map((group) => median(group));
}
function regularSpacing(values, min, max) {
  const differences = values.slice(1).map((value, index) => value - values[index]);
  if (!differences.length) return null;
  const pitch = median(differences);
  if (pitch < min || pitch > max || differences.some((difference) => Math.abs(difference - pitch) > 4)) return null;
  return pitch;
}
function bodyHasEdges(data, info, rectangle) {
  let sides = 0;
  for (const side of ['left', 'right']) {
    let contrasted = 0;
    for (const ratio of [0.23, 0.42, 0.61]) {
      const y = Math.round(rectangle.top + rectangle.height * ratio);
      const x = side === 'left' ? rectangle.left + 2 : rectangle.left + rectangle.width - 3;
      const outside = side === 'left' ? rectangle.left - 6 : rectangle.left + rectangle.width + 5;
      if (outside < 0 || outside >= info.width || y < viewport.top || y >= viewport.top + viewport.height) continue;
      const a = rgb(data, info, x, y); const b = rgb(data, info, outside, y);
      if (a.reduce((sum, channel, index) => sum + Math.abs(channel - b[index]), 0) > 45) contrasted += 1;
    }
    if (contrasted >= 2) sides += 1;
  }
  return sides >= 1;
}
function findScrollbar(data, info) {
  const candidates = [];
  for (let center = 961; center <= 970; center += 1) {
    const contrasts = [];
    for (let y = 85; y < 810; y += 1) {
      const luma = (x) => { const c = rgb(data, info, x, y); return (c[0] + c[1] + c[2]) / 3; };
      const middle = (luma(center - 1) + luma(center) + luma(center + 1)) / 3;
      const outside = (luma(center - 5) + luma(center - 4) + luma(center + 4) + luma(center + 5)) / 4;
      contrasts.push(middle - outside);
    }
    const tracks = runs(contrasts.map((value) => Math.abs(value) > 7), 660, 725, 1);
    for (const run of tracks) {
      if (run.start + 85 > 110 || run.end + 85 < 780 || run.end + 85 > 810) continue;
      const thumbs = runs(contrasts.slice(run.start, run.end).map((value) => value > 18), 20, 640, 3);
      if (thumbs.length !== 1) continue;
      const thumb = thumbs[0];
      const top = run.start + 85;
      const bottom = run.end + 85;
      const thumbTop = top + thumb.start;
      const thumbBottom = top + thumb.end;
      const score = contrasts.slice(run.start, run.end).reduce((sum, value) => sum + Math.abs(value), 0) / (run.end - run.start);
      candidates.push({ score, track: { left: center - 1, top, width: 3, height: bottom - top }, thumb: { left: center - 2, top: thumbTop, width: 5, height: thumbBottom - thumbTop },
        atTop: thumbTop - top <= 4, atBottom: bottom - thumbBottom <= 4 });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  if (!candidates.length) return { status: 'uncertain', atTop: null, atBottom: null, thumb: null, track: null,
    evidence: { method: 'narrow-track-local-contrast', reason: 'No complete track and unique thumb were verified.' } };
  const best = candidates[0];
  if (candidates.some((candidate) => Math.abs(candidate.score - best.score) < 2 && Math.abs(candidate.thumb.top - best.thumb.top) > 5)) {
    return { status: 'uncertain', atTop: null, atBottom: null, thumb: null, track: null, evidence: { reason: 'Conflicting scrollbar candidates.' } };
  }
  return { status: 'recognized', atTop: best.atTop, atBottom: best.atBottom, thumb: best.thumb, track: best.track,
    evidence: { method: 'narrow-track-local-contrast', localContrast: best.score, endpointTolerance: 4 } };
}
function findPanel(data, info) {
  for (let y = 80; y <= 112; y += 1) {
    const mask = Array.from({ length: 420 }, (_, dx) => {
      const c = rgb(data, info, 960 + dx, y);
      return Math.max(...c) > 90 && Math.max(...c) - Math.min(...c) > 18 && !pale(c);
    });
    const candidates = runs(mask, 350, 395, 5);
    if (candidates.length !== 1) continue;
    let candidate = candidates[0];
    const seed = rgb(data, info, 960 + candidate.start + 3, y);
    const sameColor = Array.from({ length: 420 }, (_, dx) => rgb(data, info, 960 + dx, y).reduce((sum, channel, index) => sum + Math.abs(channel - seed[index]), 0) < 65);
    const refined = runs(sameColor, 350, 380, 2).filter((run) => Math.abs(run.start - candidate.start) <= 3);
    if (refined.length !== 1) continue;
    [candidate] = refined;
    const rectangle = { left: 960 + candidate.start, top: y, width: candidate.end - candidate.start, height: Math.round((candidate.end - candidate.start) * 722 / 370) };
    if (rectangle.left < 972 || rectangle.left > 990 || rectangle.left + rectangle.width > info.width || rectangle.top + rectangle.height > info.height) continue;
    // The pale text body corroborates the right-hand item panel; a colored background alone is insufficient.
    let corroboration = 0;
    for (const dx of [0.12, 0.48, 0.85]) for (const dy of [0.58, 0.72]) {
      if (pale(rgb(data, info, Math.round(rectangle.left + dx * rectangle.width), Math.round(rectangle.top + dy * rectangle.height)))) corroboration += 1;
    }
    if (corroboration >= 4) return rectangle;
  }
  geometryError('Nao foi possivel localizar o painel direito do item com evidencia visual suficiente.');
}
async function artSignature(buffer, rectangle) {
  const interior = { left: rectangle.left + Math.round(rectangle.width * 0.19), top: rectangle.top + Math.round(rectangle.height * 0.27),
    width: Math.round(rectangle.width * 0.61), height: Math.round(rectangle.height * 0.43) };
  const data = await sharp(buffer).extract(interior).resize(9, 8, { fit: 'fill' }).removeAlpha().greyscale().raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits = (bits << 1n) | (data[y * 9 + x] > data[y * 9 + x + 1] ? 1n : 0n);
  return `art-dhash-v1:${bits.toString(16).padStart(16, '0')}`;
}

// The caller must separately verify the Weapons/Quality OCR anchors before using these click positions.
export async function inspectInventory(buffer) {
  const { data, info } = await pixels(buffer);
  const strips = levelStrips(data, info);
  if (strips.length < 6) geometryError('Faixas de nivel insuficientes para confirmar a grade do inventario.');
  const columns = cluster(strips.map((strip) => strip.center), 8);
  const baselines = cluster(strips.map((strip) => strip.bottom), 8);
  const columnPitch = regularSpacing(columns, 104, 116);
  const rowPitch = regularSpacing(baselines, 124, 138);
  const width = Math.round(median(strips.map((strip) => strip.width)));
  const height = Math.round(width * 1.25);
  if (columns.length < 3 || columns.length > 9 || baselines.length < 2 || baselines.length > 7 || !columnPitch || !rowPitch || width < 86 || width > 99) {
    geometryError('A grade observada nao corresponde ao perfil medido 1440x900.');
  }
  const panel = findPanel(data, info);
  const rows = [];
  const slots = [];
  for (const [rowIndex, baseline] of baselines.entries()) {
    const top = Math.round(baseline + 1 - height);
    const bottom = top + height;
    if (top < viewport.top || bottom > viewport.top + viewport.height) {
      rows.push({ index: rowIndex, slots: [], signature: null, top, bottom, complete: false, evidence: { reason: 'partially-clipped-card-row' } });
      continue;
    }
    const rowSlots = [];
    for (const [column, center] of columns.entries()) {
      const candidates = strips.filter((strip) => Math.abs(strip.center - center) <= 8 && Math.abs(strip.bottom - baseline) <= 8);
      if (candidates.length > 1) geometryError('Faixas sobrepostas deixam uma posicao ambigua.');
      if (!candidates.length) continue;
      const rectangle = { left: Math.round(center - width / 2), top, width, height };
      if (!bodyHasEdges(data, info, rectangle)) geometryError('Um cartao candidato nao possui arestas visuais verificaveis.');
      rowSlots.push({ row: rowIndex, column, center: { x: Math.round(rectangle.left + width / 2), y: Math.round(top + height / 2) }, rectangle });
    }
    // Missing middle positions may be occlusion or failed detection, never an inferred empty inventory slot.
    if (!rowSlots.length || rowSlots.some((slot, index) => slot.column !== index) || (rowIndex !== baselines.length - 1 && rowSlots.length !== columns.length)) {
      geometryError('A grade possui lacunas; nao e seguro gerar uma sequencia de cliques.');
    }
    await Promise.all(rowSlots.map(async (slot) => { slot.signature = await artSignature(buffer, slot.rectangle); }));
    const signature = rowSlots.map((slot) => slot.signature).join('|');
    rows.push({ index: rowIndex, slots: rowSlots, signature, top, bottom, complete: true });
    slots.push(...rowSlots);
  }
  const complete = rows.filter((row) => row.complete);
  if (complete.length < 2) geometryError('Linhas completas insuficientes para confirmar a grade.');
  const nextTop = Math.round(complete.at(-1).top + rowPitch);
  const visibleBottom = viewport.top + viewport.height;
  if (nextTop < visibleBottom - 20 && nextTop + height > visibleBottom) {
    const edgeCount = columns.filter((center) => bodyHasEdges(data, info, { left: Math.round(center - width / 2), top: nextTop, width, height })).length;
    if (edgeCount >= Math.ceil(columns.length * 0.7)) rows.push({ index: rows.length, slots: [], signature: null, top: nextTop, bottom: nextTop + height, complete: false,
      evidence: { reason: 'bottom-row-partially-visible', corroboratingColumns: edgeCount, visibleBottom } });
  }
  return { profile, size: { width: info.width, height: info.height }, panel, slots, rows,
    gridSignature: digest(complete.map((row) => row.signature).join('\n')),
    geometry: { columns: columns.length, columnPitch, rowPitch, viewport, source: 'observed-level-strips-and-card-edges' },
    scrollbar: findScrollbar(data, info),
    scrollEvidence: { status: 'uncertain', atBottom: null, reason: 'This frame alone does not prove scroll progress; require unique row overlap after navigation.' },
    evidence: { anchorValidationRequired: ['Weapons', 'Quality'], signaturesAreItemIdentity: false, partialRowsAreClickable: false } };
}

export async function inspectSelection(buffer, slot) {
  const { data, info } = await pixels(buffer);
  const rectangle = validateRectangle(slot?.rectangle, { width: info.width, height: info.height });
  const horizontal = (y) => {
    let count = 0; const length = rectangle.width - 12;
    for (let dx = 6; dx < rectangle.width - 6; dx += 1) if (bright(rgb(data, info, rectangle.left + dx, y))) count += 1;
    return count / length;
  };
  const vertical = (x) => {
    let count = 0; const length = rectangle.height - 20;
    for (let dy = 10; dy < rectangle.height - 10; dy += 1) if (bright(rgb(data, info, x, rectangle.top + dy))) count += 1;
    return count / length;
  };
  if (rectangle.width < 70 || rectangle.height < 90 || rectangle.left < 8 || rectangle.top < 8
      || rectangle.left + rectangle.width + 8 >= info.width || rectangle.top + rectangle.height + 8 >= info.height) {
    return { status: 'uncertain', selected: false, evidence: { reason: 'selection-border-outside-supported-card-geometry' } };
  }
  const maximum = (values) => Math.max(...values);
  const scores = {
    top: maximum(Array.from({ length: 10 }, (_, index) => horizontal(rectangle.top - 6 + index))),
    bottom: maximum(Array.from({ length: 10 }, (_, index) => horizontal(rectangle.top + rectangle.height - 3 + index))),
    left: maximum(Array.from({ length: 10 }, (_, index) => vertical(rectangle.left - 7 + index))),
    right: maximum(Array.from({ length: 10 }, (_, index) => vertical(rectangle.left + rectangle.width - 3 + index))),
  };
  const selected = Object.values(scores).every((score) => score >= 0.72);
  const signature = await artSignature(buffer, rectangle);
  return { status: selected ? 'recognized' : 'uncertain', selected, signature,
    evidence: { method: 'four-sided-bright-selection-outline', rectangle, sideCoverage: scores, expectedSignatureMatches: typeof slot.signature === 'string' ? signature === slot.signature : null } };
}

function goldComponents(data, info) {
  const mask = new Uint8Array(info.width * info.height);
  for (let index = 0; index < mask.length; index += 1) {
    const [r, g, b] = data.subarray(index * info.channels, index * info.channels + 3);
    if (r > 235 && g > 170 && g < r * 0.9 && b < 130) mask[index] = 1;
  }
  const components = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start]) continue;
    const queue = [start]; mask[start] = 0;
    let minX = info.width; let minY = info.height; let maxX = 0; let maxY = 0;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const item = queue[cursor]; const x = item % info.width; const y = Math.floor(item / info.width);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nx = x + dx; const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= info.width || ny >= info.height) continue;
        const neighbor = ny * info.width + nx;
        if (mask[neighbor]) { mask[neighbor] = 0; queue.push(neighbor); }
      }
    }
    if (queue.length >= 4) components.push({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixels: queue.length });
  }
  return components.sort((a, b) => a.left - b.left);
}

export async function readRarity(buffer, panel) {
  const { info } = await pixels(buffer, false);
  validateRectangle(panel, { width: info.width, height: info.height });
  const ratio = panel.width / panel.height;
  if (ratio < 0.48 || ratio > 0.55) return { status: 'uncertain', value: null, evidence: { reason: 'unsupported-panel-aspect', panel } };
  // Counting individual star components preserves independent evidence; the name never determines rarity.
  const rectangle = { left: panel.left + Math.round(panel.width * 18 / 370), top: panel.top + Math.round(panel.height * 176 / 722),
    width: Math.round(panel.width * 145 / 370), height: Math.round(panel.height * 30 / 722) };
  const { data, info: normalized } = await sharp(buffer).extract(rectangle).resize(145, 30, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const components = goldComponents(data, normalized);
  const candidates = components.filter((component) => component.width >= 12 && component.width <= 24 && component.height >= 12 && component.height <= 24 && component.pixels >= 60 && component.pixels <= 280 && component.pixels / (component.width * component.height) >= 0.25 && component.pixels / (component.width * component.height) <= 0.72);
  const count = candidates.length;
  let regular = count >= 1 && count <= 5 && components.length === count;
  if (regular) {
    const centers = candidates.map((component) => component.left + component.width / 2);
    const tops = candidates.map((component) => component.top);
    regular = centers[0] >= 8 && centers[0] <= 22 && Math.max(...tops) - Math.min(...tops) <= 3
      && centers.slice(1).every((center, index) => center - centers[index] >= 22 && center - centers[index] <= 30)
      && candidates.every((component) => component.top > 0 && component.top + component.height < normalized.height);
  }
  return { status: regular ? 'recognized' : 'uncertain', value: regular ? count : null,
    evidence: { method: 'gold-star-components-v1', panel, rectangle, normalizedSize: { width: 145, height: 30 }, components, componentCount: count,
      reason: regular ? 'aligned-complete-star-components' : 'missing-incomplete-or-ambiguous-star-components', ocrConfidenceUsed: false } };
}

export function matchRows(previousRows, nextRows) {
  const complete = (rows) => rows.filter((row) => row?.complete !== false).map((row) => typeof row === 'string' ? row : row?.signature);
  if (!Array.isArray(previousRows) || !Array.isArray(nextRows)) return { status: 'ambiguous' };
  const previous = complete(previousRows); const next = complete(nextRows);
  if (!previous.length || !next.length || [...previous, ...next].some((signature) => typeof signature !== 'string' || !signature)) return { status: 'ambiguous' };
  if (new Set(previous).size !== previous.length || new Set(next).size !== next.length) return { status: 'ambiguous' };
  const candidates = [];
  for (let offset = 0; offset < previous.length; offset += 1) {
    const overlap = Math.min(previous.length - offset, next.length);
    if (previous.slice(offset, offset + overlap).every((signature, index) => signature === next[index])) candidates.push({ offset, overlap });
  }
  if (!candidates.length) return { status: 'none' };
  const longest = Math.max(...candidates.map((candidate) => candidate.overlap));
  const best = candidates.filter((candidate) => candidate.overlap === longest);
  if (best.length !== 1 || longest < 2) return { status: 'ambiguous' };
  return { status: 'matched', ...best[0] };
}
