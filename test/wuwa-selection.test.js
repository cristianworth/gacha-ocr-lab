import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readImage } from '../src/image.js';
import { inspectWuwaSelection, validateWuwaTargets, wuwaCards } from '../src/wuwa-selection.js';
const scene = async (indices = [], extra = '') => {
  const rects = indices.map(i => { const c=wuwaCards[i]; return `<rect x="${c.left}" y="${c.top}" width="${c.width-1}" height="${c.height-1}" fill="none" stroke="#ffeb94" stroke-width="2"/>`; }).join('');
  return { buffer: await sharp(Buffer.from(`<svg width="1280" height="720">${rects}${extra}</svg>`)).png().toBuffer() };
};
test('empty, duplicate and incomplete targets remain unqualified', async () => {
  const empty = await inspectWuwaSelection(await scene(),{target:wuwaCards[0]});
  assert.equal(empty.status,'selection-viewport-unqualified'); assert.deepEqual(empty.completeCandidates,[]);
  const two = await inspectWuwaSelection(await scene([0,1]),{target:wuwaCards[0]});
  assert.deepEqual(two.completeCandidates,[0,1]); assert.equal(two.ambiguous,true);
  assert.throws(() => validateWuwaTargets([wuwaCards[0],wuwaCards[0]]));
  assert.throws(() => validateWuwaTargets([{left:119,top:518,width:95,height:118}]));
});
test('partial fourth-row marks are recorded; weak or absent marks cannot clear the guard', async () => {
  for (const opacity of [1, 0.25]) {
    const shape = `<path d="M119 590 V518 H213 V590" fill="none" stroke="#ffeb94" stroke-width="2" opacity="${opacity}"/>`;
    const result = await inspectWuwaSelection(await scene([0],shape),{target:wuwaCards[0]});
    assert.equal(result.status,'selection-viewport-unqualified'); assert.equal(result.partial.length,6);
    if (opacity === 1) { assert.equal(result.partial[0].mark,'partial-candidate'); assert.equal(result.ambiguous,true); }
    else assert.equal(result.partial[0].mark,'unqualified');
  }
});
const root = process.env.WUWA_EXAMPLES;
const examples = [['Augment.png',{left:0,top:29,width:1280,height:720},12],['Blooming Jadehaven.png',{left:0,top:30,width:1276,height:718},0],['Emerald of Genesis.png',{left:1,top:34,width:1280,height:720},9]];
test('optional development frames: selected and neighbouring geometry plus partial overlays', {skip: !root}, async () => {
  for (const [file,client,index] of examples) {
    const image = await readImage(`${root}/${file}`);
    const selected = await inspectWuwaSelection(image,{client,target:wuwaCards[index]});
    assert.deepEqual(selected.completeCandidates,[index]); assert.equal(selected.status,'selection-viewport-unqualified');
    const neighbour = await inspectWuwaSelection(image,{client,target:wuwaCards[(index+1)%18]});
    assert.notEqual(neighbour.targetIndex,neighbour.completeCandidates[0]);
    for (const opacity of [1,0.25]) {
      const x=client.left+Math.round(119*client.width/1280), y=client.top+Math.round(518*client.height/720);
      const overlay=Buffer.from(`<svg width="${(await sharp(image.buffer).metadata()).width}" height="${(await sharp(image.buffer).metadata()).height}"><path d="M${x} ${y+70} V${y} H${x+94} V${y+70}" fill="none" stroke="#ffeb94" stroke-width="2" opacity="${opacity}"/></svg>`);
      const mixed={buffer:await sharp(image.buffer).composite([{input:overlay}]).png().toBuffer()};
      const result=await inspectWuwaSelection(mixed,{client,target:wuwaCards[index]});
      assert.equal(result.status,'selection-viewport-unqualified');
      if (opacity===1) assert.equal(result.partial[0].mark,'partial-candidate');
    }
  }
});

test('optional real partial selection is detected without confirmation', {skip: !root}, async () => {
 const image=await readImage(`${root}/Novaburst.png`);
 const result=await inspectWuwaSelection(image,{client:{left:1,top:29,width:1280,height:718},target:wuwaCards[0]});
 assert.deepEqual(result.completeCandidates,[]); assert.equal(result.partial[0].mark,'partial-candidate');
 assert.equal(result.ambiguous,true); assert.equal(result.status,'selection-viewport-unqualified');
});

test('an intermediate partial contour is ambiguous, never evidence of absence', async () => {
 const shape = '<path d="M119 545 V518" fill="none" stroke="#ffeb94" stroke-width="2"/>';
 const result=await inspectWuwaSelection(await scene([0],shape),{target:wuwaCards[0]});
 assert.equal(result.partial[0].mark,'partial-uncertain'); assert.equal(result.ambiguous,true);
 assert.equal(result.status,'selection-viewport-unqualified');
});
