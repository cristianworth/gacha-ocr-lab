import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { inspectImage, validateRectangle, prepareRegion } from './regions.js';
import { createOcrSession } from './ocr.js';

// Fixed pixels relative to the supplied Arc panel, measured on the three examples.
export const regions = {
  category: { left: 72, top: 8, width: 80, height: 29 },
  name: { left: 136, top: 53, width: 205, height: 29 },
  level: { left: 140, top: 86, width: 63, height: 28 },
  element: { left: 240, top: 86, width: 90, height: 28 },
  attribute1: { left: 35, top: 211, width: 300, height: 29 },
  attribute2: { left: 35, top: 242, width: 300, height: 29 },
  tier: { left: 39, top: 278, width: 296, height: 29 },
};

export function panelRegions(panel, size) {
  validateRectangle(panel, size);
  if (panel.width !== 348 || panel.height !== 496) throw new Error('O perfil exige painel 348x496 sem redimensionamento.');
  return Object.fromEntries(Object.entries(regions).map(([key, box]) => {
    const absolute = { ...box, left: box.left + panel.left, top: box.top + panel.top };
    validateRectangle(absolute, size);
    return [key, absolute];
  }));
}

export async function readNteOffline(image, { panel, cachePath, outputDir, createSession = createOcrSession }) {
  const size = await inspectImage(image.buffer);
  const boxes = panelRegions(panel, size);
  const directory = resolve(outputDir);
  await mkdir(directory, { recursive: true });
  const session = await createSession({ languages: 'eng', cachePath, offline: true });
  const fields = {};
  let failure;
  try {
    for (const [field, rectangle] of Object.entries(boxes)) {
      const crop = await sharp(image.buffer).extract(rectangle).png().toBuffer();
      const cropPath = join(directory, `${field}.png`);
      await writeFile(cropPath, crop);
      const variant = ['category', 'element'].includes(field) ? { threshold: 120 } : { gray: true };
      const prepared = await prepareRegion(image.buffer, rectangle, variant);
      const ocr = await session.recognize(prepared.buffer, 'SINGLE_LINE');
      fields[field] = { status: 'review-required', candidate: ocr.rawText.trim() || null,
        crop: { path: cropPath, sha256: createHash('sha256').update(crop).digest('hex'), rectangle },
        processing: prepared.processing, ocr };
    }
  } catch (error) { failure = error; throw error; }
  finally {
    try { await session.close(); }
    catch (error) {
      if (!failure) throw error;
      failure.finalizationError = error;
    }
  }
  return { schema: 'nte-arc-offline-v1', source: image.source, imageSize: size, panel,
    fields, review: { humanApproved: false, notes: ['OCR candidates require human review.', 'Icons, stars and scroll-hidden content are not extracted.', 'No navigation, ordering or coverage is established.'] } };
}
