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
  if (client.width < 1270 || client.width > 1280 || client.height < 714 || client.height > 720 || Math.abs(client.width / client.height - 16 / 9) > 0.01) throw new Error('Cliente fora do perfil WuWa.');
  const targetIndex = validateWuwaTargets([target])[0];
  const { data, info } = await sharp(image.buffer).flatten({background:'black'}).toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const rgb = (x, y) => { x = client.left + Math.round(x * client.width / 1280); y = client.top + Math.round(y * client.height / 720); const p = (y * info.width + x) * info.channels; return data.subarray(p,p+3); };
  const bright = (x, y) => { const [r,g,b] = rgb(x,y); return r > 180 && g > 160 && b < 200 && r > b + 25 && g > b + 10; };
  // Compare the yellow edge with both nearby background samples, retaining the larger contrast.
  const relative = (x, y, vertical) => {
    const a = rgb(x,y), b = rgb(x + (vertical ? 8 : 0), y + (vertical ? 0 : 8)), c = rgb(x - (vertical ? 8 : 0), y - (vertical ? 0 : 8));
    const light = p => (p[0] + p[1]) / 2;
    return a[0] - a[2] >= 6 && a[1] - a[2] >= 3 && light(a) - Math.min(light(b), light(c)) >= 8;
  };
  const side = (c, vertical, edge, length, predicate) => { let hits = 0; for (let i = 4; i < length - 4; i++) { let found = false; for (let d = -5; d <= 5; d++) { const x = vertical ? edge+d : c.left+i, y = vertical ? c.top+i : edge+d; found ||= predicate(x,y,vertical); } if (found) hits++; } return hits / (length-8); };
  const measure = (c, length, predicate, bottom) => [side(c,true,c.left,length,predicate),side(c,true,c.left+94,length,predicate),side(c,false,c.top,95,predicate),...(bottom ? [side(c,false,c.top+117,95,predicate)] : [])];
  const scores = wuwaCards.map(c => measure(c,118,bright,true));
  const relativeScores = wuwaCards.map(c => measure(c,118,relative,true));
  const candidates = scores.flatMap((s, i) => s.every(v => v >= 0.70) && relativeScores[i].every(v => v >= 0.70) ? [i] : []);
  // Real background art can occupy both sides and the top; the bottom distinguishes it in the measured samples.
  const uncertainComplete = scores.flatMap((s,i) => !candidates.includes(i) && ((s.filter(v => v >= 0.50).length >= 3) || (relativeScores[i][3] >= 0.65 && relativeScores[i].slice(0,3).filter(v => v >= 0.25).length >= 2)) ? [i] : []);
  const partial = Array.from({length: 6}, (_, i) => {
    const c = {left:119 + 118*i, top:518};
    const sides = measure(c,76,bright,false), relativeSides = measure(c,76,relative,false);
    const mark = sides.filter(v => v >= 0.35).length >= 2 ? 'partial-candidate' : sides.some(v => v >= 0.20) || relativeSides.some(v => v >= 0.25) ? 'partial-uncertain' : 'no-detected-contour';
    return { column:i, scores:sides, relativeScores:relativeSides, mark };
  });
  const ambiguous = candidates.length > 1 || uncertainComplete.length > 0 || partial.some(p => p.mark !== 'no-detected-contour');
  let status;
  if (ambiguous) status = 'selection-ambiguous';
  else if (!candidates.length) status = 'selection-not-detected';
  else if (candidates[0] !== targetIndex) status = 'selection-wrong-target';
  else status = 'confirmed';
  return { status, targetIndex, completeCandidates:candidates, uncertainComplete, ambiguous, scores, relativeScores, partial, client, coordinates:'client-pixels', evidence: { profile:'wuwa-visible-contours-v1', strongMinimum:0.70, relativeUncertainty:0.25, relativeBottomMinimum:0.65, relativeColorDelta:[6,3], relativeContrast:8, sampleOffset:8, note:'Geometric match under measured visible conditions; low signal is not proof of absence, internal selection, identity or coverage.' } };

}
