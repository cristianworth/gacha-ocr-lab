import sharp from 'sharp';

// Measured on the development cards only. Bounds are relative to the selected panel.
export const profileId = 'genshin-16x10-v1';
const boxes = {
  name: { left: 18 / 370, top: 2 / 722, width: 348 / 370, height: 40 / 722 },
  level: { left: 23 / 370, top: 0.322, width: 94 / 370, height: 21 / 722 },
  refinement: { left: 54 / 370, top: 0.365, width: 225 / 370, height: 24 / 722 },
  weaponType: { left: 20 / 370, top: 0.071, width: 190 / 370, height: 27 / 722 },
};
export const fieldVariants = {
  name: [{ id: 'threshold-220', threshold: 220 }, { id: 'threshold-230', threshold: 230 }],
  level: [{ id: 'scale' }, { id: 'gray', gray: true }],
  refinement: [{ id: 'scale' }, { id: 'gray', gray: true }],
  weaponType: [{ id: 'threshold-200', threshold: 200 }],
};

export function validateRectangle(rectangle, size) {
  if (!rectangle || !['left', 'top', 'width', 'height'].every((key) => Number.isInteger(rectangle[key]))) {
    throw new Error('A regiao deve ter left, top, width e height inteiros.');
  }
  if (rectangle.left < 0 || rectangle.top < 0 || rectangle.width <= 0 || rectangle.height <= 0
      || rectangle.left + rectangle.width > size.width || rectangle.top + rectangle.height > size.height) {
    throw new Error('Regiao fora da imagem ou com dimensoes invalidas.');
  }
  return rectangle;
}

export function parseRectangle(value) {
  if (!/^\d+,\d+,\d+,\d+$/u.test(value)) throw new Error('Use --panel left,top,width,height (pixels inteiros).');
  const [left, top, width, height] = value.split(',').map(Number);
  return { left, top, width, height };
}

export async function inspectImage(buffer) {
  try {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) throw new Error('Dimensoes indisponiveis.');
    if (meta.orientation && meta.orientation !== 1) throw new Error('Rotacao EXIF nao suportada nesta etapa; exporte a imagem orientada em PNG.');
    return { width: meta.width, height: meta.height };
  } catch (error) { throw new Error(`Nao foi possivel decodificar a imagem: ${error.message}`, { cause: error }); }
}

export function selectLayout(size, { layout = 'auto', panel } = {}) {
  if (!['auto', 'card', 'screenshot', 'text'].includes(layout)) throw new Error('Use --layout auto, card, screenshot ou text.');
  if (panel && ['card', 'text'].includes(layout)) throw new Error('--panel nao pode ser combinado com --layout card/text.');
  const resolved = panel ? 'screenshot' : layout === 'auto'
    ? (size.width / size.height >= 0.4 && size.width / size.height <= 0.7 ? 'card' : 'text') : layout;
  if (resolved === 'screenshot' && !panel) throw new Error('--layout screenshot exige --panel left,top,width,height.');
  if (resolved === 'text') return { layout: resolved, profile: null, panel: null, regions: {} };
  const selected = panel ?? { left: 0, top: 0, width: size.width, height: size.height };
  validateRectangle(selected, size);
  const ratio = selected.width / selected.height;
  if (ratio < 0.4 || ratio > 0.7) throw new Error('O painel nao corresponde ao perfil de cartao 16:10 suportado. Selecione o cartao inteiro.');
  const regions = {};
  for (const [key, relative] of Object.entries(boxes)) {
    const region = {
      left: selected.left + Math.round(relative.left * selected.width),
      top: selected.top + Math.round(relative.top * selected.height),
      width: Math.max(1, Math.round(relative.width * selected.width)),
      height: Math.max(1, Math.round(relative.height * selected.height)),
    };
    validateRectangle(region, size);
    if (region.left + region.width > selected.left + selected.width || region.top + region.height > selected.top + selected.height) {
      throw new Error('Regiao de campo fora do painel.');
    }
    regions[key] = region;
  }
  return { layout: resolved, profile: profileId, panel: selected, regions };
}

export async function prepareRegion(buffer, rectangle, variant) {
  let pipeline = sharp(buffer).extract(rectangle).flatten({ background: 'white' }).resize({ width: rectangle.width * 3 });
  const operations = ['extract', 'flatten-white', 'scale-3x'];
  if (variant.threshold) {
    pipeline = pipeline.greyscale().threshold(variant.threshold).negate({ alpha: false });
    operations.push('grayscale', `threshold-${variant.threshold}`, 'invert');
  } else if (variant.gray) {
    pipeline = pipeline.greyscale().normalise();
    operations.push('grayscale', 'normalize');
  }
  // Materialize before padding: Sharp may reorder operations within a single pipeline.
  const treated = await pipeline.png().toBuffer();
  const prepared = await sharp(treated).extend({ top: 15, bottom: 15, left: 15, right: 15, background: 'white' }).png().toBuffer();
  return { buffer: prepared, processing: { scale: 3, padding: 15, operations: [...operations, 'pad-white'], coordinates: 'processed-image' } };
}
