import { inspectImage, selectLayout, prepareRegion, fieldVariants } from './regions.js';
import { selectHsrLayout, hsrFieldVariants } from './hsr-regions.js';
import { createOcrSession, recognizeImage, engineVersion } from './ocr.js';
import { parseWeapon } from './parse-weapon.js';
import { interpretRegions } from './parse-regions.js';
import { interpretHsrRegions } from './parse-hsr.js';
import { getGame } from './games.js';

export async function readWeapon(image, options = {}) {
  const game = getGame(options.game);
  const size = await inspectImage(image.buffer);
  const selection = game.id === 'hsr' ? selectHsrLayout(size, options) : selectLayout(size, options);
  const variants = game.id === 'hsr' ? hsrFieldVariants : fieldVariants;
  const source = { ...image.source, imageSize: size };
  const common = { schemaVersion: 2, createdAt: new Date().toISOString(), game: game.id, itemType: game.itemType, source, requiresManualReview: true };
  if (selection.layout === 'text') {
    const ocr = await recognizeImage(image.buffer, options);
    return { ...common, processing: { ...selection, method: 'whole-image', layoutVerified: false }, ocr, fields: parseWeapon(ocr.rawText) };
  }
  const session = await createOcrSession(options);
  const regions = {};
  try {
    for (const [field, rectangle] of Object.entries(selection.regions)) {
      const attempts = [];
      for (const variant of variants[field]) {
        const prepared = await prepareRegion(image.buffer, rectangle, variant);
        const ocr = await session.recognize(prepared.buffer, ['name', 'path'].includes(field) ? 'SINGLE_BLOCK' : 'SINGLE_LINE');
        attempts.push({ id: variant.id, ...ocr, processing: prepared.processing });
      }
      regions[field] = { rectangle, coordinates: 'original-image', attempts };
    }
  } finally { await session.close(); }
  const { fields, layoutVerified } = game.id === 'hsr' ? interpretHsrRegions(regions) : interpretRegions(regions);
  return {
    ...common,
    processing: { ...selection, method: 'field-regions', layoutVerified },
    ocr: {
      engine: 'tesseract.js', engineVersion, languages: options.languages,
      imageSize: size, confidence: null,
      rawText: Object.values(regions).flatMap((region) => region.attempts.map((attempt) => attempt.rawText)).join('\n\n'),
      rawTextDescription: 'Concatenacao dos textos das tentativas, sem rotulos sinteticos; consulte regions para origem e ordem.',
      regions,
    },
    fields,
  };
}