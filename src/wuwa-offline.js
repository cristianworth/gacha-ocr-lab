import { inspectImage, validateRectangle, prepareRegion } from './regions.js';
import { createOcrSession } from './ocr.js';

// Coordinates measured against the supplied English weapon panels, relative to the client.
const boxes = {
  name: { left: 883, top: 80, width: 345, height: 28 },
  type: { left: 884, top: 130, width: 100, height: 26 },
  level: { left: 884, top: 157, width: 150, height: 29 },
  rank: { left: 884, top: 381, width: 112, height: 29 },
};
const variants = [{ id: 'threshold-140', threshold: 140 }, { id: 'threshold-110', threshold: 110 }];
// The name region includes distant artwork; 120 suppresses observed low-intensity artifacts.
const nameVariants = [{ id: 'threshold-140', threshold: 140 }, { id: 'threshold-120', threshold: 120 }];

export function interpretWuwaRegions(regions) {
  const values = (key, parse) => (regions[key]?.attempts ?? []).map(a => parse(a.rawText)).filter(v => v !== null);
  const field = (candidates, reason) => {
    const unique = [...new Set(candidates.map(v => JSON.stringify(v)))].map(v => JSON.parse(v));
    return { status: candidates.length >= 2 && unique.length === 1 ? 'recognized' : 'uncertain',
      value: candidates.length >= 2 && unique.length === 1 ? unique[0] : null, candidates: unique,
      ...(candidates.length >= 2 && unique.length === 1 ? {} : { reason }) };
  };
  const text = raw => { const s = raw.trim().replace(/\s+/gu, ' '); return /^[\p{L}][\p{L}\p{N}'’ .!:-]{1,80}$/u.test(s) ? s : null; };
  const type = field(values('type', raw => { const s = raw.trim(); return /^(Sword|Broadblade|Pistols|Gauntlets|Rectifier)$/iu.test(s) ? s.toLowerCase() : null; }), 'weapon-type-unconfirmed');
  const name = field(values('name', text), 'name-attempts-disagree-or-unreadable');
  const level = field(values('level', raw => { const m = raw.match(/\bLevel\s*(\d{1,3})\s*\/\s*(\d{1,3})\b/iu); if (!m) return null; const current = Number(m[1]), max = Number(m[2]); return current > 0 && current <= max && max <= 999 ? { current, max } : null; }), 'level-attempts-disagree-or-unreadable');
  const rank = field(values('rank', raw => { const m = raw.match(/\bRank\s*(\d{1,2})\b/iu); return m && Number(m[1]) > 0 ? Number(m[1]) : null; }), 'rank-attempts-disagree-or-unreadable');
  if (type.status !== 'recognized') for (const f of [name, level, rank]) { f.value = null; f.status = 'uncertain'; f.reason = 'weapon-type-unconfirmed'; }
  return { name, type, level, rank, rarity: { status: 'uncertain', value: null, candidates: [], reason: 'rarity-not-qualified' } };
}

export async function readWuwaOffline(image, { client: requested, cachePath, ocrSession } = {}) {
  const size = await inspectImage(image.buffer);
  const client = requested ?? { left: 0, top: 0, width: 1280, height: 720 };
  validateRectangle(client, size);
  if (client.width < 1270 || client.width > 1280 || client.height < 714 || client.height > 720 || Math.abs(client.width / client.height - 16 / 9) > 0.01) throw new Error('Perfil offline exige cliente aproximadamente 1280x720 (16:9).');
  if (!requested && (size.width !== 1280 || size.height !== 720)) throw new Error('Informe --client para imagem com moldura.');
  const session = ocrSession ?? await createOcrSession({ languages: 'eng', cachePath, offline: true });
  const regions = {};
  try {
    for (const [key, box] of Object.entries(boxes)) {
      const rectangle = { left: client.left + Math.round(box.left * client.width / 1280), top: client.top + Math.round(box.top * client.height / 720), width: Math.round(box.width * client.width / 1280), height: Math.round(box.height * client.height / 720) };
      validateRectangle(rectangle, size);
      const attempts = [];
      for (const variant of key === 'name' ? nameVariants : variants) {
        const prepared = await prepareRegion(image.buffer, rectangle, variant);
        attempts.push({ id: variant.id, ...await session.recognize(prepared.buffer, 'SINGLE_LINE'), processing: prepared.processing });
      }
      regions[key] = { rectangle, coordinates: 'original-image', attempts };
    }
  } finally { if (!ocrSession) await session.close(); }
  return { schemaVersion: 1, createdAt: new Date().toISOString(), game: 'wuwa', itemType: 'weapon', requiresManualReview: true,
    source: { ...image.source, imageSize: size }, processing: { profile: 'wuwa-weapons-english-offline-experimental', client, clientCoordinates: 'original-image', offlineOnly: true, geometryAutomaticallyVerified: false },
    ocr: { regions }, fields: interpretWuwaRegions(regions), coverageConfirmed: false };
}
