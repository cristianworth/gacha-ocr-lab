import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readImage } from '../src/image.js';
import { inspectWuwaSelection, validateWuwaTargets, wuwaCards } from '../src/wuwa-selection.js';
const shape = (i, opacity=1) => { const c=wuwaCards[i]; return `<rect x="${c.left}" y="${c.top}" width="94" height="117" fill="none" stroke="#ffeb94" stroke-width="2" opacity="${opacity}"/>`; };
const scene = async extra => ({buffer:await sharp(Buffer.from(`<svg width="1280" height="720">${extra}</svg>`)).png().toBuffer()});
const inspect = async extra => inspectWuwaSelection(await scene(extra),{target:wuwaCards[0]});
test('unique target confirms; missing, wrong and duplicate targets reject', async () => {
 assert.equal((await inspect('')).status,'selection-not-detected');
 assert.equal((await inspect(shape(0))).status,'confirmed');
 assert.equal((await inspect(shape(1))).status,'selection-wrong-target');
 assert.equal((await inspect(shape(0)+shape(1))).status,'selection-ambiguous');
 assert.throws(()=>validateWuwaTargets([wuwaCards[0],wuwaCards[0]]));
 assert.throws(()=>validateWuwaTargets([{left:119,top:518,width:95,height:118}]));
});
test('strong and visible weakened competing contours reject', async () => {
 for (const opacity of [1,0.5,0.25]) {
  const full=await inspect(shape(0)+shape(1,opacity));
  assert.equal(full.status,'selection-ambiguous',`full ${opacity}`);
  const partial=`<path d="M119 590 V518 H213 V590" fill="none" stroke="#ffeb94" stroke-width="2" opacity="${opacity}"/>`;
  const result=await inspect(shape(0)+partial);
  assert.equal(result.status,'selection-ambiguous',`partial ${opacity}`);
 }
});
test('intermediate partial contour rejects and unsupported geometry throws', async () => {
 const result=await inspect(shape(0)+'<path d="M119 545 V518" fill="none" stroke="#ffeb94" stroke-width="2"/>');
 assert.equal(result.status,'selection-ambiguous'); assert.equal(result.partial[0].mark,'partial-uncertain');
 await assert.rejects(inspectWuwaSelection(await scene(shape(0)),{client:{left:0,top:0,width:1260,height:720},target:wuwaCards[0]}),/perfil/);
});
const root=process.env.WUWA_EXAMPLES;
const examples=[['Augment.png',{left:0,top:29,width:1280,height:720},12],['Blooming Jadehaven.png',{left:0,top:30,width:1276,height:718},0],['Emerald of Genesis.png',{left:1,top:34,width:1280,height:720},9]];
test('real development frames confirm matching target only', {skip:!root}, async()=>{
 for(const [file,client,index] of examples){ const image=await readImage(`${root}/${file}`);
  for(let target=0;target<18;target++){ const result=await inspectWuwaSelection(image,{client,target:wuwaCards[target]});
   assert.deepEqual(result.completeCandidates,[index]); assert.equal(result.status,target===index?'confirmed':'selection-wrong-target',`${file} ${target}`);
  }
 }
});
test('real partial selection rejects every full target', {skip:!root}, async()=>{
 const image=await readImage(`${root}/Novaburst.png`),client={left:1,top:29,width:1280,height:718};
 for(const target of wuwaCards){const result=await inspectWuwaSelection(image,{client,target}); assert.equal(result.status,'selection-ambiguous'); assert.equal(result.partial[0].mark,'partial-candidate');}
});

test('visible weak overlays on real development backgrounds reject', {skip:!root}, async()=>{
 for(const [file,client,index] of examples){
  const image=await readImage(`${root}/${file}`),meta=await sharp(image.buffer).metadata();
  for(const kind of ['full','partial']){
   const c=kind==='full'?wuwaCards[(index+1)%18]:{left:119,top:518};
   const x=client.left+Math.round(c.left*client.width/1280),y=client.top+Math.round(c.top*client.height/720);
   const w=Math.round(94*client.width/1280),h=Math.round((kind==='full'?117:72)*client.height/720);
   const d=kind==='full'?`M${x} ${y} h${w} v${h} h-${w} z`:`M${x} ${y+h} V${y} h${w} v${h}`;
   const svg=Buffer.from(`<svg width="${meta.width}" height="${meta.height}"><path d="${d}" fill="none" stroke="#ffeb94" stroke-width="2" opacity="0.25"/></svg>`);
   const buffer=await sharp(image.buffer).composite([{input:svg}]).png().toBuffer();
   const result=await inspectWuwaSelection({buffer},{client,target:wuwaCards[index]});
   assert.equal(result.status,'selection-ambiguous',`${file} ${kind}`);
  }
 }
});
