import sharp from 'sharp';

function completeRows(grid) {
  const groups = new Map();
  for (const slot of grid.slots ?? []) {
    if (!groups.has(slot.row)) groups.set(slot.row, []);
    groups.get(slot.row).push(slot);
  }
  const rows = [...groups.entries()].sort(([a], [b]) => a - b).map(([, slots]) => slots.sort((a, b) => a.column - b.column));
  if (rows.length < 2 || rows.some(row => row.length !== 8 || row.some((slot, column) => slot.column !== column))) {
    throw new Error('scroll-grid-incomplete');
  }
  return rows;
}

async function interiors(image, rows) {
  return Promise.all(rows.map(row => Promise.all(row.map(async slot => {
    const r = slot.rectangle;
    // Avoid the selection outline, equipped portrait, lock, refinement and level.
    const rectangle = { left: r.left + 13, top: r.top + 23, width: 54, height: 54 };
    return sharp(image.buffer).extract(rectangle).greyscale().blur(1).raw().toBuffer();
  }))));
}

function distance(a, b, dx = 0, dy = 0) {
  let sum = 0;
  for (let y = 3; y < 51; y += 2) for (let x = 3; x < 51; x += 2) {
    sum += Math.abs(a[y * 54 + x] - b[(y + dy) * 54 + x + dx]);
  }
  return sum / (24 * 24);
}

// Match the viewport, not item identities. Ambiguous or repetitive rows stop the scan.
export async function matchGenshin1280Scroll(before, beforeGrid, after, afterGrid, { previousSelection, previousCandidates, currentSelection, currentCandidates } = {}) {
  const previous = completeRows(beforeGrid);
  const next = completeRows(afterGrid);
  const excludedBefore = previousCandidates ?? (previousSelection ? [previousSelection] : []);
  const excludedAfter = currentCandidates ?? (currentSelection ? [currentSelection] : []);
  if (!Array.isArray(excludedBefore) || excludedBefore.length > 2 || !Array.isArray(excludedAfter) || excludedAfter.length > 2) {
    return { status: 'ambiguous', reason: 'too-many-selection-candidates' };
  }
  const [a, b] = await Promise.all([interiors(before, previous), interiors(after, next)]);
  const candidates = [];
  for (let offset = 0; offset < previous.length; offset += 1) {
    const overlap = Math.min(previous.length - offset, next.length);
    if (overlap < 2) continue;
    // A fixed viewport fade can change card pixels near the lower edge even
    // while the same row moves correctly. Never use that row as evidence.
    const evidenceRows = Array.from({ length: overlap }, (_, row) => row).filter(row =>
      previous[row + offset][0].rectangle.top + previous[row + offset][0].rectangle.height <= 610 &&
      next[row][0].rectangle.top + next[row][0].rectangle.height <= 610);
    if (evidenceRows.length < 2 || evidenceRows[0] !== 0 || evidenceRows.some((row, index) => row !== index)) continue;
    let best = null;
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
      const distances = [];
      let sufficient = true;
      const isSelected = (slot, selection) => selection && slot.row === selection.row && slot.column === selection.column;
      for (const row of evidenceRows) {
        let compared = 0;
        for (let column = 0; column < 8; column += 1) {
          if (excludedBefore.some(item => isSelected(previous[row + offset][column], item)) || excludedAfter.some(item => isSelected(next[row][column], item))) continue;
          distances.push(distance(a[row + offset][column], b[row][column], dx, dy));
          compared += 1;
        }
        if (compared < 6) sufficient = false;
      }
      if (!sufficient) continue;
      const mean = distances.reduce((sum, value) => sum + value, 0) / distances.length;
      if (!best || mean < best.mean) best = { mean, maximum: Math.max(...distances), dx, dy };
    }
    if (best && best.mean <= 3 && best.maximum <= 6) candidates.push({ offset, overlap, verifiedRows: evidenceRows.length, ...best });
  }
  if (candidates.length !== 1) return { status: candidates.length ? 'ambiguous' : 'unconfirmed', candidates };
  const match = candidates[0];
  match.displacement = previous[match.offset][0].rectangle.top - next[0][0].rectangle.top;
  const distinctness = a[match.offset].reduce((sum, card, column) => sum + distance(card, a[match.offset + 1][column]), 0) / 8;
  if (distinctness <= 8) return { status: 'ambiguous', reason: 'overlapping-rows-not-distinct', candidates, distinctness };
  if (match.offset === 0) return { status: 'no-new-complete-row', ...match, distinctness };
  if (next.length <= match.overlap) return { status: 'no-new-complete-row', ...match, distinctness };
  return { status: 'matched', ...match, distinctness, newRows: next.length - match.overlap };
}
