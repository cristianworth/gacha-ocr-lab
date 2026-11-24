import sharp from 'sharp';
import { inspectImage, validateRectangle } from './regions.js';

// Nominal card rectangles in 1280x720 client coordinates; row four is faded/clipped.
export const wuwaCards = Array.from({ length: 18 }, (_, i) => ({ left: 119 + 118 * (i % 6), top: 95 + 141 * Math.floor(i / 6), width: 95, height: 118 }));
export function validateWuwaTargets(targets) {
  if (!Array.isArray(targets) || targets.length < 1 || targets.length > 3) throw new Error('Informe de um a tres alvos.');
  const indices = targets.map(t => wuwaCards.findIndex(c => Object.keys(c).every(k => t[k] === c[k])));
  if (indices.includes(-1) || new Set(indices).size !== indices.length) throw new Error('Alvos devem corresponder a cartoes completos distintos do perfil.');
  return indices;
}

export async function inspectWuwaSelection(image, { client = { left: 0, top: 0, width: 1280, height: 720 }, target } = {}) {
  const size = await inspectImage(image.buffer); validateRectangle(client, size);
  if (client.width < 1270 || client.width > 1280 || client.height < 714 || client.height > 720) throw new Error('Cliente fora do perfil WuWa.');
  const targetIndex = validateWuwaTargets([target])[0];
  const { data, info } = await sharp(image.buffer).flatten({background:'black'}).toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => { x = client.left + Math.round(x * client.width / 1280); y = client.top + Math.round(y * client.height / 720); const p = (y * info.width + x) * info.channels; const [r,g,b] = data.subarray(p,p+3); return r > 180 && g > 160 && b < 200 && r > b + 25 && g > b + 10; };
  const side = (c, vertical, edge, length) => { let hits = 0; for (let i = 4; i < length - 4; i++) { let found = false; for (let d = -5; d <= 5; d++) found ||= vertical ? pixel(edge+d,c.top+i) : pixel(c.left+i,edge+d); if (found) hits++; } return hits / (length-8); };
  const scores = wuwaCards.map(c => [side(c,true,c.left,c.height), side(c,true,c.left+c.width-1,c.height), side(c,false,c.top,c.width), side(c,false,c.top+c.height-1,c.width)]);
  const candidates = scores.flatMap((s, i) => s.every(v => v >= 0.70) ? [i] : []);
  const completeAmbiguous = scores.some((s,i) => !candidates.includes(i) && s.filter(v => v >= 0.50).length >= 3) || candidates.length > 1;
  // Only the upper 76 pixels of row four were measured; a weak score is not absence.
  const partial = Array.from({length: 6}, (_, i) => {
    const c = {left: 119 + 118*i, top: 518, width:95};
    const sides = [side(c,true,c.left,76), side(c,true,c.left+94,76), side(c,false,c.top,95)];
    return { column: i, scores: sides, mark: sides.filter(v => v >= 0.35).length >= 2 ? 'partial-candidate' : sides.some(v => v >= 0.20) ? 'partial-uncertain' : 'unqualified' };
  });
  const ambiguous = completeAmbiguous || partial.some(p => p.mark !== 'unqualified');
  return { status: 'selection-viewport-unqualified', targetIndex, completeCandidates: candidates, ambiguous, scores, partial, client, coordinates: 'client-pixels', note: 'Selecao parcial real detectada, mas sinal abaixo do limiar nao prova ausencia de contorno fraco.' };
}
