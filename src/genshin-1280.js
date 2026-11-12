import { inspectImage, validateRectangle } from './regions.js';
import { readWeapon } from './read-weapon.js';
import sharp from 'sharp';
import { inspectSelection } from './genshin-inventory.js';

// Measured on the four supplied window screenshots; this is an offline profile.
const PANEL = { left: 873, top: 79, width: 327, height: 638 };

async function checkedClient(image, requested) {
  const size = await inspectImage(image.buffer);
  const client = requested ?? { left: 0, top: 0, width: 1280, height: 720 };
  validateRectangle(client, size);
  if (client.width !== 1280 || client.height !== 720) {
    throw new Error('O perfil exige cliente 1280x720 sem redimensionamento.');
  }
  if (!requested && (size.width !== 1280 || size.height !== 720)) {
    throw new Error('Informe o retangulo do cliente 1280x720 quando a imagem incluir moldura.');
  }
  return client;
}

export async function inspectGenshin1280Selection(image, { client: requested, rectangle } = {}) {
  const client = await checkedClient(image, requested);
  validateRectangle(rectangle, { width: 1280, height: 720 });
  // These are bounds for an offline candidate, not generated click coordinates.
  if (rectangle.left < 60 || rectangle.left + rectangle.width > 855 || rectangle.top < 70
      || rectangle.top + rectangle.height > 645 || rectangle.width < 70 || rectangle.width > 95
      || rectangle.height < 90 || rectangle.height > 120) {
    throw new Error('Candidato fora da area de cartoes completos do perfil experimental.');
  }
  const buffer = await sharp(image.buffer).extract(client).png().toBuffer();
  const selection = await inspectSelection(buffer, { rectangle }, { expectedSize: { width: 1280, height: 720 } });
  return { ...selection, client, candidateCoordinates: 'client', offlineOnly: true, confirmsMovement: false };
}

// This inspection proposes complete rows for offline review only; it never sends input.
export async function inspectGenshin1280Grid(image, { client: requested } = {}) {
  const client = await checkedClient(image, requested);
  const { data, info } = await sharp(image.buffer).extract(client).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rows = [];
  for (let y = 70; y < 645; y += 1) {
    const supported = [];
    for (let column = 0; column < 8; column += 1) {
      const left = Math.round(79 + column * 97.6);
      let pale = 0;
      for (let x = left + 4; x < left + 78; x += 1) {
        const p = (y * info.width + x) * info.channels;
        const [r, g, b] = data.subarray(p, p + 3);
        if (r > 182 && g > 182 && b > 165 && Math.max(r, g, b) - Math.min(r, g, b) < 42) pale += 1;
      }
      supported.push(pale >= 64);
    }
    if (supported.filter(Boolean).length < 7) continue;
    const last = rows.at(-1);
    if (last && y - last.end <= 15) {
      last.end = y;
      last.lines += 1;
      supported.forEach((value, column) => { if (value) last.columns[column] += 1; });
    } else rows.push({ start: y, end: y, lines: 1, columns: supported.map(Number) });
  }
  const bands = rows.filter(row => row.lines >= 3 && row.end - row.start >= 8 && row.end - row.start <= 24
    && row.columns.every(count => count >= 2));
  if (bands.length < 2 || bands.some((row, index) => index && Math.abs(row.end - bands[index - 1].end - 117) > 5)) {
    throw new Error('Grade 1280x720 inconclusiva: linhas completas e espacamento nao confirmados.');
  }
  const slots = [];
  for (const [row, band] of bands.entries()) {
    const top = band.end + 2 - 103;
    if (top < 70 || top + 103 > 645) continue;
    for (let column = 0; column < 8; column += 1) {
      const rectangle = { left: Math.round(79 + column * 97.6), top, width: 82, height: 103 };
      slots.push({ row, column, rectangle });
    }
  }
  if (slots.length < 16) throw new Error('Grade 1280x720 inconclusiva: menos de duas linhas completas.');
  return { client, profile: 'genshin-weapons-1280x720-grid-experimental', bands, slots,
    offlineOnly: true, clickTargetsVerified: false, topVerified: false, coverageVerified: false };
}

export async function inspectGenshin1280Selected(image, { client: requested } = {}) {
  const grid = await inspectGenshin1280Grid(image, { client: requested });
  const buffer = await sharp(image.buffer).extract(grid.client).png().toBuffer();
  const found = [];
  for (const slot of grid.slots) {
    const selection = await inspectSelection(buffer, slot, { expectedSize: { width: 1280, height: 720 } });
    if (selection.selected) found.push({ ...slot, selection });
  }
  return { grid, status: found.length === 1 ? 'recognized' : 'uncertain',
    selected: found.length === 1 ? found[0] : null, candidateCount: found.length, candidates: found,
    offlineOnly: true, confirmsMovement: false };
}

export async function readGenshin1280(image, options = {}) {
  const client = await checkedClient(image, options.client);
  const panel = { ...PANEL, left: client.left + PANEL.left, top: client.top + PANEL.top };
  const result = await readWeapon(image, { ...options, game: 'genshin', languages: 'eng', panel });
  result.processing.client = client;
  result.processing.clientProfile = 'genshin-weapons-1280x720-offline-v1';
  result.processing.clientProfileValidatedLive = false;
  return result;
}
