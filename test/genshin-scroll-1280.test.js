import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { matchGenshin1280Scroll } from '../src/genshin-scroll-1280.js';

function grid(count = 4, tops = [80, 197, 314, 431]) {
  return { slots: Array.from({ length: count * 8 }, (_, index) => ({ row: Math.floor(index / 8), column: index % 8,
    rectangle: { left: Math.round(79 + index % 8 * 97.6), top: tops[Math.floor(index / 8)], width: 82, height: 103 } })) };
}

async function frame(rows, tops = [80, 197, 314, 431]) {
  const shapes = rows.flatMap((value, row) => Array.from({ length: 8 }, (_, column) =>
    `<rect x="${Math.round(79 + column * 97.6) + 16}" y="${tops[row] + 26}" width="48" height="48" fill="rgb(${value},${value},${value})"/>`)).join('');
  return { buffer: await sharp(Buffer.from(`<svg width="1280" height="720">${shapes}</svg>`)).png().toBuffer() };
}

test('one-row scroll matches three overlapping rows without merging observations', async () => {
  const result = await matchGenshin1280Scroll(await frame([20, 60, 100, 140]), grid(), await frame([60, 100, 140, 180]), grid());
  assert.equal(result.status, 'matched');
  assert.equal(result.offset, 1);
  assert.equal(result.overlap, 3);
  assert.equal(result.newRows, 1);
});

test('edge fade is not compared, but two stable full rows still prove viewport alignment', async () => {
  const oldTops = [185, 301, 418, 534];
  const newTops = [173, 289, 406, 522];
  const before = await frame([20, 60, 100, 140], oldTops);
  const after = await frame([20, 60, 100, 230], newTops);
  const result = await matchGenshin1280Scroll(before, grid(4, oldTops), after, grid(4, newTops));
  assert.equal(result.status, 'no-new-complete-row');
  assert.equal(result.displacement, 12);
  assert.equal(result.verifiedRows, 3);
  const mismatch = await frame([20, 60, 180, 230], newTops);
  assert.equal((await matchGenshin1280Scroll(before, grid(4, oldTops), mismatch, grid(4, newTops))).status, 'unconfirmed');
});

test('repeated rows and unchanged viewport cannot claim forward progress', async () => {
  const identical = await frame([80, 80, 80, 80]);
  assert.equal((await matchGenshin1280Scroll(identical, grid(), identical, grid())).status, 'ambiguous');
  const distinct = await frame([20, 60, 100, 140]);
  assert.equal((await matchGenshin1280Scroll(distinct, grid(), distinct, grid())).status, 'no-new-complete-row');
});

test('a mismatched row or incomplete grid cannot establish overlap', async () => {
  const result = await matchGenshin1280Scroll(await frame([20, 60, 100, 140]), grid(), await frame([60, 100, 170, 180]), grid());
  assert.equal(result.status, 'unconfirmed');
  const missing = grid(); missing.slots.pop();
  await assert.rejects(matchGenshin1280Scroll(await frame([20, 60, 100, 140]), grid(), await frame([60, 100, 140, 180]), missing), /scroll-grid-incomplete/);
});

test('selection effects are excluded only at explicitly selected positions', async () => {
  const original = await frame([20, 60, 100, 140]);
  const patch = Buffer.from('<svg width="48" height="48"><rect width="48" height="48" fill="white"/></svg>');
  const edited = { buffer: await sharp(original.buffer).composite([{ input: patch, left: 79 + 16, top: 80 + 26 }]).png().toBuffer() };
  assert.equal((await matchGenshin1280Scroll(original, grid(), edited, grid())).status, 'unconfirmed');
  const result = await matchGenshin1280Scroll(original, grid(), edited, grid(), { currentSelection: { row: 0, column: 0 } });
  assert.equal(result.status, 'no-new-complete-row');
  assert.equal(result.offset, 0);
});

test('two ambiguous highlight candidates are excluded without asserting which is selected', async () => {
  const original = await frame([20, 60, 100, 140]);
  const patch = Buffer.from('<svg width="48" height="48"><rect width="48" height="48" fill="white"/></svg>');
  const edited = { buffer: await sharp(original.buffer).composite([
    { input: patch, left: 79 + 16, top: 80 + 26 },
    { input: patch, left: 177 + 16, top: 80 + 26 },
  ]).png().toBuffer() };
  const currentCandidates = [{ row: 0, column: 0 }, { row: 0, column: 1 }];
  const result = await matchGenshin1280Scroll(original, grid(), edited, grid(), { currentCandidates });
  assert.equal(result.status, 'no-new-complete-row');
  assert.equal((await matchGenshin1280Scroll(original, grid(), edited, grid(), { currentCandidates: [...currentCandidates, { row: 0, column: 2 }] })).status, 'ambiguous');
});
