import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import sharp from 'sharp';
import { runWuwaPilot } from '../src/wuwa-pilot.js';
import { wuwaCards } from '../src/wuwa-selection.js';

await mkdir('.cache/wuwa',{recursive:true});
async function fixture(fn) { const dir=await mkdtemp('.cache/wuwa/test-'); try { await fn(dir); } finally { await rm(dir,{recursive:true,force:true}); } }
const blank = await sharp({create:{width:1280,height:720,channels:3,background:'black'}}).png().toBuffer();
function fake({failAt, controller} = {}) {
  let clicks=0, statusCalls=0;
  return { get clicks(){return clicks}, async status(){ statusCalls++; if (statusCalls===failAt) return {armed:false,stopped:true,stopReason:'focus-lost'}; return {armed:true,stopped:false,window:{width:1280,height:720,dpi:96}}; }, async click(){ clicks++; if (controller) controller.abort(); }, async capture(path){await writeFile(path,blank,{flag:'wx'});} };
}
const ok = async () => ({status:'confirmed'});
const deps = {inspect:ok, wait:async()=>{}, read:async()=>({fields:{name:{value:'Same'},rarity:{status:'uncertain'}}})};
test('real selector blocks before first click and preserves preflight', async () => fixture(async dir => {
 const backend=fake(); const output=join(dir,'run'); const report=await runWuwaPilot({output,targets:[wuwaCards[0]],setup:async()=>backend});
 assert.equal(report.reason,'selection-viewport-unqualified'); assert.equal(backend.clicks,0); assert.equal(report.attempts[0].frames.length,1);
 assert.equal((JSON.parse(await readFile(join(output,'session.json')))).coverageConfirmed,false);
 await assert.rejects(runWuwaPilot({output,targets:[wuwaCards[0]],setup:async()=>backend}),/EEXIST/);
}));
test('simulates two stable frames, identical fields and ordered targets', async () => fixture(async dir => {
 const backend=fake(); const report=await runWuwaPilot({output:join(dir,'run'),targets:wuwaCards.slice(0,2),setup:async()=>backend,dependencies:deps});
 assert.equal(report.reason,'pilot-limit'); assert.equal(backend.clicks,2); assert.equal(report.observations.length,2); assert.deepEqual(report.observations.map(o=>o.index),[0,1]); assert.equal(report.inventoryAccepted,false);
}));
test('wrong selection and unstable panel stop without OCR', async () => fixture(async dir => {
 let count=0; const backend=fake();
 const report=await runWuwaPilot({output:join(dir,'wrong'),targets:[wuwaCards[0]],setup:async()=>backend,dependencies:{...deps,inspect:async()=>({status:count++===0?'confirmed':'unconfirmed'})}});
 assert.equal(report.reason,'selection-or-panel-stability-unconfirmed'); assert.equal(report.observations.length,0);
 let n=0; const unstable=await runWuwaPilot({output:join(dir,'unstable'),targets:[wuwaCards[0]],setup:async()=>fake(),dependencies:{...deps,fingerprint:async()=>Buffer.alloc(100,n++%2?255:0)}});
 assert.equal(unstable.reason,'selection-or-panel-stability-unconfirmed'); assert.equal(unstable.observations.length,0);
}));
test('focus failure and cancellation keep partial stage', async () => fixture(async dir => {
 const focused=await runWuwaPilot({output:join(dir,'focus'),targets:[wuwaCards[0]],setup:async()=>fake({failAt:2}),dependencies:deps}); assert.equal(focused.reason,'focus-lost'); assert.equal(focused.attempts[0].stage,'preflight');
 const controller=new AbortController(); const cancelled=await runWuwaPilot({output:join(dir,'cancel'),targets:[wuwaCards[0]],signal:controller.signal,setup:async()=>fake({controller}),dependencies:deps});
 assert.equal(cancelled.reason,'cancelled'); assert.equal(cancelled.attempts.at(-1).stage,'click-in-progress');
}));
test('cooperative cancellation after the click stage is saved prevents input', async () => fixture(async dir => {
 const output=join(dir,'cancel-after-save'); const controller=new AbortController(); const backend=fake(); const status=backend.status;
 backend.status=async()=>{ const report=JSON.parse(await readFile(join(output,'session.json'),'utf8')); if (report.attempts.at(-1)?.stage==='click-in-progress') controller.abort(); return status(); };
 const report=await runWuwaPilot({output,targets:[wuwaCards[0]],signal:controller.signal,setup:async()=>backend,dependencies:deps});
 assert.equal(report.reason,'cancelled'); assert.equal(report.attempts.at(-1).stage,'click-in-progress'); assert.equal(backend.clicks,0);
}));
test('OCR failure retains the prior observation and current captured attempt', async () => fixture(async dir => {
 let count=0; const output=join(dir,'partial'); const report=await runWuwaPilot({output,targets:wuwaCards.slice(0,2),setup:async()=>fake(),dependencies:{...deps,read:async()=>{if (++count===2) throw new Error('ocr-failed'); return {fields:{}};}}});
 assert.equal(report.reason,'ocr-failed'); assert.equal(report.observations.length,2); assert.equal(report.observations[0].status,'read'); assert.equal(report.observations[1].status,'captured-pending-ocr'); assert.equal(report.attempts.at(-1).stage,'reading');
 const summary=await readFile(join(output,'summary.md'),'utf8');
 const rows=summary.split('\n');
 assert.ok(rows.some(row=>row.includes('Leitura retornada') && row.includes(`[captura](${basename(report.observations[0].capture.path)})`)));
 assert.ok(rows.some(row=>row.includes('Capturada, OCR pendente') && row.includes(`[captura](${basename(report.observations[1].capture.path)})`)));
 assert.match(summary,/\[session\.json\]\(session\.json\)/); assert.match(summary,/não é aprovação humana/);
}));

test('client geometry guard stops before capturing or clicking', async () => fixture(async dir => {
 const backend=fake(); backend.status=async()=>({armed:true,stopped:false,window:{width:1279,height:720,dpi:96}});
 const report=await runWuwaPilot({output:join(dir,'geometry'),targets:[wuwaCards[0]],setup:async()=>backend,dependencies:deps});
 assert.equal(report.reason,'client-or-dpi-unverified'); assert.equal(backend.clicks,0); assert.equal(report.attempts.length,0);
}));
