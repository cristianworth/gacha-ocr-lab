import { validateRectangle } from './regions.js';

export const hsrProfileId = 'hsr-inventory-16x10-v1';
// Measured on the two development screenshots, relative to the selected right-hand panel.
const boxes = {
  name: { left: 5 / 345, top: 3 / 670, width: 335 / 345, height: 26 / 670 },
  level: { left: 5 / 345, top: 183 / 670, width: 130 / 345, height: 30 / 670 },
  superimposition: { left: 32 / 345, top: 294 / 670, width: 230 / 345, height: 30 / 670 },
  path: { left: 32 / 345, top: 215 / 670, width: 300 / 345, height: 76 / 670 },
};
export const hsrFieldVariants = {
  name: [{ id: 'threshold-130', threshold: 130 }, { id: 'threshold-140', threshold: 140 }],
  level: [{ id: 'gray', gray: true }, { id: 'threshold-140', threshold: 140 }],
  superimposition: [{ id: 'scale' }, { id: 'gray', gray: true }],
  path: [{ id: 'threshold-140', threshold: 140 }],
};

export function selectHsrLayout(size, { layout = 'auto', panel } = {}) {
  if (!['auto', 'card', 'screenshot'].includes(layout)) throw new Error('HSR suporta --layout auto, card ou screenshot; OCR geral text ainda nao foi validado.');
  if (panel && layout === 'card') throw new Error('--panel nao combina com --layout card.');
  const ratio = size.width / size.height;
  const resolved = panel ? 'screenshot' : layout === 'auto' && ratio >= 0.4 && ratio <= 0.7 ? 'card' : layout;
  if (!panel && resolved !== 'card') throw new Error('Captura HSR exige --panel left,top,width,height do painel direito.');
  const selected = panel ?? { left: 0, top: 0, width: size.width, height: size.height };
  validateRectangle(selected, size);
  if (selected.width / selected.height < 0.4 || selected.width / selected.height > 0.7) throw new Error('Selecione o painel direito inteiro do perfil HSR suportado.');
  const regions = {};
  for (const [field, box] of Object.entries(boxes)) {
    const rectangle = {
      left: selected.left + Math.round(box.left * selected.width), top: selected.top + Math.round(box.top * selected.height),
      width: Math.max(1, Math.round(box.width * selected.width)), height: Math.max(1, Math.round(box.height * selected.height)),
    };
    validateRectangle(rectangle, size);
    if (rectangle.left + rectangle.width > selected.left + selected.width || rectangle.top + rectangle.height > selected.top + selected.height) throw new Error('Regiao HSR fora do painel.');
    regions[field] = rectangle;
  }
  return { layout: resolved, profile: hsrProfileId, panel: selected, regions };
}