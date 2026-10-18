import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { inspectInventory, inspectSelection, readRarity, matchRows } from '../src/genshin-inventory.js';

const panel = { left: 980, top: 90, width: 370, height: 722 };
const point = (x, y) => `${x.toFixed(2)},${y.toFixed(2)}`;
function star(cx, cy, radius = 10) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const distance = index % 2 ? radius * 0.45 : radius;
    return point(cx + Math.cos(angle) * distance, cy + Math.sin(angle) * distance);
  }).join(' ');
}
const encode = (svg) => sharp(Buffer.from(svg)).png().toBuffer();
async function scene({ columns = 6, selected = 0, omit = null, level = 90, partial = true, scrollbar = 'top', identicalArt = false, pitch = 110, yOffset = 0, faintTrack = false } = {}) {
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900"><defs><clipPath id="grid"><rect x="70" y="80" width="888" height="730"/></clipPath></defs><rect width="1440" height="900" fill="#30303a"/><g clip-path="url(#grid)">';
  for (let row = 0; row < (partial ? 6 : 5); row += 1) for (let column = 0; column < columns; column += 1) {
    if (omit?.row === row && omit?.column === column) continue;
    const x = 87 + column * pitch; const y = 90 + row * 131 + yOffset;
    const id = row * columns + column;
    if (selected === id) svg += `<rect x="${x - 4}" y="${y - 4}" width="100" height="123" rx="4" fill="none" stroke="white" stroke-width="3"/>`;
    svg += `<rect x="${x}" y="${y}" width="92" height="115" rx="3" fill="#9268a4"/><path d="M${x + 16} ${y + 78} L${x + 57} ${y + 22} L${x + (identicalArt ? 75 : 65 + (id % 17))} ${y + 69} Z" fill="#493963"/><path d="M${x + 20} ${y + 70} L${x + 72} ${y + 26}" stroke="#d9c998" stroke-width="6"/><rect x="${x}" y="${y + 95}" width="92" height="20" fill="#ebe6d8"/><text x="${x + 22}" y="${y + 111}" font-family="Arial" font-size="14" fill="#30303a">Lv. ${level}</text>`;
  }
  svg += '</g>';
  svg += `<rect x="980" y="90" width="370" height="722" fill="#b96b35"/><rect x="980" y="302" width="370" height="510" fill="#ece5d5"/>`;
  for (let index = 0; index < 5; index += 1) svg += `<polygon points="${star(1012 + index * 26, 280)}" fill="#ffcc32"/>`;
  if (scrollbar) {
    const top = scrollbar === 'top' ? 90 : scrollbar === 'bottom' ? 674 : 300;
    svg += `<rect x="964" y="90" width="3" height="710" fill="${faintTrack ? '#2b2b35' : '#17171c'}"/><rect x="963" y="${top}" width="5" height="126" rx="1" fill="#c8c1b6"/>`;
  }
  return encode(`${svg}</svg>`);
}
async function card(count, { malformed = false, shifted = false } = {}) {
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="370" height="722"><rect width="370" height="722" fill="#9665b3"/>';
  for (let index = 0; index < count; index += 1) svg += `<polygon points="${star(32 + index * 26 + (shifted ? 26 : 0), 190)}" fill="#ffcc32"/>`;
  if (malformed) svg += '<rect x="18" y="180" width="140" height="15" fill="#ffcc32"/>';
  return encode(`${svg}</svg>`);
}

test('inventory rejects non-client images, corrupt input and layouts without observed cards', async () => {
  const small = await sharp({ create: { width: 1444, height: 932, channels: 3, background: '#30303a' } }).png().toBuffer();
  await assert.rejects(inspectInventory(small), (error) => error.code === 'GENSHIN_UNSUPPORTED_SIZE');
  await assert.rejects(inspectInventory(Buffer.from('not an image')), /decodificar/u);
  const blank = await sharp({ create: { width: 1440, height: 900, channels: 3, background: 'white' } }).png().toBuffer();
  await assert.rejects(inspectInventory(blank), /insuficientes/u);
});

test('measures six columns rather than assuming eight, and excludes clipped bottom cards from click positions', async () => {
  const image = await scene();
  const copy = Buffer.from(image);
  const analysis = await inspectInventory(image);
  assert.equal(analysis.profile, 'genshin-inventory-1440x900-v1');
  assert.deepEqual(analysis.size, { width: 1440, height: 900 });
  assert.equal(analysis.geometry.columns, 6);
  assert.equal(analysis.slots.length, 30);
  assert.ok(new Set(analysis.slots.map((slot) => slot.signature)).size > 3);
  assert.equal(analysis.rows.filter((row) => row.complete).length, 5);
  const partial = analysis.rows.at(-1);
  assert.equal(partial.complete, false);
  assert.equal(partial.signature, null);
  assert.equal(partial.slots.length, 0);
  assert.ok(analysis.slots.every((slot) => slot.center.x > slot.rectangle.left && slot.center.x < slot.rectangle.left + slot.rectangle.width));
  assert.ok(analysis.slots.every((slot) => slot.center.y > slot.rectangle.top && slot.center.y < slot.rectangle.top + slot.rectangle.height));
  assert.equal(analysis.evidence.signaturesAreItemIdentity, false);
  assert.deepEqual(image, copy);
});

test('never fills a missing middle card or accepts spacing outside the measured profile', async () => {
  await assert.rejects(inspectInventory(await scene({ omit: { row: 2, column: 3 } })), /lacunas/u);
  await assert.rejects(inspectInventory(await scene({ pitch: 98 })), (error) => error.code === 'GENSHIN_INVENTORY_GEOMETRY');
});

test('selection requires a bright outline on all four sides and does not use names', async () => {
  const image = await scene({ selected: 2 });
  const analysis = await inspectInventory(image);
  const selected = await inspectSelection(image, analysis.slots[2]);
  assert.equal(selected.selected, true);
  assert.equal(selected.status, 'recognized');
  assert.equal(selected.evidence.expectedSignatureMatches, true);
  const other = await inspectSelection(image, analysis.slots[1]);
  assert.equal(other.selected, false);
  assert.equal(other.status, 'uncertain');
});

test('signatures omit selection border and level text; identical copies remain separate slots', async () => {
  const first = await inspectInventory(await scene({ selected: 0, level: 90, identicalArt: true }));
  const second = await inspectInventory(await scene({ selected: 12, level: 20, identicalArt: true }));
  assert.equal(first.gridSignature, second.gridSignature);
  assert.equal(first.slots[0].signature, first.slots[1].signature);
  assert.equal(first.slots.length, 30);
});

test('local scrollbar contrast distinguishes top, middle and bottom; missing track stays unknown', async () => {
  for (const state of ['top', 'middle', 'bottom']) {
    const { scrollbar } = await inspectInventory(await scene({ scrollbar: state }));
    assert.equal(scrollbar.status, 'recognized', state);
    assert.equal(scrollbar.atTop, state === 'top', state);
    assert.equal(scrollbar.atBottom, state === 'bottom', state);
    assert.ok(scrollbar.thumb.height >= 120 && scrollbar.track.height >= 700);
  }
  const absent = (await inspectInventory(await scene({ scrollbar: null }))).scrollbar;
  assert.equal(absent.status, 'uncertain');
  assert.equal(absent.atTop, null);
  assert.equal(absent.atBottom, null);
});

test('a faint complete track confirms top or middle while a thumb without a track stays uncertain', async () => {
  for (const position of ['top', 'middle']) {
    const { scrollbar } = await inspectInventory(await scene({ scrollbar: position, faintTrack: true }));
    assert.equal(scrollbar.status, 'recognized', position);
    assert.equal(scrollbar.atTop, position === 'top');
    assert.equal(scrollbar.atBottom, false);
  }
  const withoutTrack = await scene({ scrollbar: null });
  const thumbOnly = await sharp(withoutTrack).composite([{ input: Buffer.from('<svg width="1440" height="900"><rect x="963" y="90" width="5" height="126" fill="#c8c1b6"/></svg>') }]).png().toBuffer();
  const unknown = (await inspectInventory(thumbOnly)).scrollbar;
  assert.equal(unknown.status, 'uncertain');
  assert.equal(unknown.atTop, null);
});

test('rarity counts complete aligned gold star shapes independently of text and supports 1 through 5', async () => {
  for (let count = 1; count <= 5; count += 1) {
    const result = await readRarity(await card(count), { left: 0, top: 0, width: 370, height: 722 });
    assert.equal(result.status, 'recognized', String(count));
    assert.equal(result.value, count);
    assert.equal(result.evidence.ocrConfidenceUsed, false);
  }
});

test('missing, merged or shifted star evidence remains uncertain instead of guessed', async () => {
  for (const [count, options] of [[0, {}], [4, { malformed: true }], [4, { shifted: true }]]) {
    const result = await readRarity(await card(count, options), { left: 0, top: 0, width: 370, height: 722 });
    assert.equal(result.status, 'uncertain');
    assert.equal(result.value, null);
  }
  await assert.rejects(readRarity(await card(4), { left: 350, top: 0, width: 370, height: 722 }), /fora/u);
});

test('row overlap reports removed top rows and rejects repeated, too short or absent evidence', () => {
  const rows = (signatures) => signatures.map((signature, index) => ({ index, signature, complete: true }));
  assert.deepEqual(matchRows(rows(['a', 'b', 'c', 'd', 'e']), rows(['c', 'd', 'e', 'f', 'g'])), { status: 'matched', offset: 2, overlap: 3 });
  assert.deepEqual(matchRows(rows(['a', 'b', 'c']), rows(['a', 'b', 'c'])), { status: 'matched', offset: 0, overlap: 3 });
  assert.deepEqual(matchRows(rows(['a', 'a', 'b']), rows(['a', 'b', 'c'])), { status: 'ambiguous' });
  assert.deepEqual(matchRows(rows(['a', 'b', 'c']), rows(['c', 'd', 'e'])), { status: 'ambiguous' });
  assert.deepEqual(matchRows(rows(['a', 'b']), rows(['d', 'e'])), { status: 'none' });
  assert.deepEqual(matchRows([...rows(['a', 'b', 'c']), { complete: false, signature: null }], rows(['b', 'c', 'd'])), { status: 'matched', offset: 1, overlap: 2 });
  assert.deepEqual(matchRows(null, []), { status: 'ambiguous' });
});


test('partially scrolled top cards remain unclickable while complete row signatures establish overlap', async () => {
  const before = await inspectInventory(await scene());
  const after = await inspectInventory(await scene({ yOffset: -52 }));
  assert.equal(after.rows[0].complete, false);
  assert.equal(after.rows[0].signature, null);
  assert.equal(after.rows[0].slots.length, 0);
  assert.equal(after.slots.length, 30);
  assert.ok(after.slots.every((slot) => slot.rectangle.top >= after.geometry.viewport.top));
  assert.deepEqual(matchRows(before.rows, after.rows), { status: 'matched', offset: 1, overlap: 4 });
});
