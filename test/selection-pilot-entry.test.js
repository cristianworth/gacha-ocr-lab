import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, unlinkSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { checkInstallation, chooseAndPrepare, pilotArgs, runChild, targets } from '../scripts/selection-pilot-entry.js';

const win = (pid = 42) => ({ pid, name: 'RealGame', title: "Game's window", handle: `${pid}00`, started: '123' });
const setup = async t => { const root = await mkdtemp(join(tmpdir(), "pilot entry's ")); t.after(() => rm(root, { recursive: true, force: true })); return root; };
const select = async (game, lists, answers) => chooseAndPrepare(game, { list: async () => lists.shift(), ask: async () => answers.shift() ?? null, print: () => {} });

test('selection requires explicit choice and confirmation and revalidates identity', async () => {
  assert.equal(await select('wuwa', [[]], []), null);
  assert.equal(await select('wuwa', [[win()]], []), null);
  assert.equal(await select('wuwa', [[win()]], ['1', '0']), null);
  assert.equal(await select('wuwa', [[win()],[win(43)]], ['1', 'SIM']), null);
  assert.deepEqual(await select('nte', [[win(),win(43)],[win(),win(43)]], ['2','SIM']), win(43));
  assert.equal(await select('nte', [[win()],[win(),win()]], ['1','SIM']), null);
});
test('arguments use exact selected process and bounded targets', () => {
  for (const game of ['wuwa','nte']) {
    assert.deepEqual(pilotArgs("C:/a b's", game, win()), [join("C:/a b's", 'scripts', `${game}-pilot.js`), '--prepared','--process','RealGame','--pid','42',...targets[game].flatMap(x => ['--target',x])]);
  }
});
test('check catches missing prerequisites without launching child', async t => {
  const root = await setup(t);
  await assert.rejects(checkInstallation(root, { nodeMajor: 21 }), /22/);
  await assert.rejects(checkInstallation(root), /Arquivo necessario ausente/);
});
test('pending cancellation waits for own child to save and log, ignoring old runs', async t => {
  const root = await setup(t), game = 'wuwa', id = randomUUID();
  const dir = join(root, '.cache', game, 'runs', `pilot-${id}`), old = join(root, '.cache', game, 'runs', `pilot-${randomUUID()}`);
  await mkdir(old, { recursive: true }); await writeFile(join(old, 'session.json'), '{"reason":"pilot-limit"}');
  const stub = join(root, 'stub.cjs');
  await writeFile(stub, `const fs=require('fs'); const path=require('path'); const d=process.env.STUB_DIR; console.log('PILOT_SESSION_DIR='+d); console.log('progress'); setTimeout(()=>{fs.mkdirSync(d); let n=setInterval(()=>{if(fs.existsSync(path.join(d,'stop.request'))){clearInterval(n);fs.writeFileSync(path.join(d,'session.json'),JSON.stringify({reason:'cancelled'}));console.error('saved');}},20)},150);`);
  let observedArgs;
  const result = await runChild({ root, game, window: win(), print: () => {}, spawnChild: (node, args, options) => { observedArgs = args; return spawn(node, [stub], {...options, env: {...process.env, STUB_DIR: dir}}); }, onReady: ({ requestCancel }) => requestCancel() });
  assert.deepEqual(observedArgs, pilotArgs(root,game,win()));
  assert.equal(result.directory, dir); assert.equal(result.code, 1); assert.equal(result.report.reason, 'cancelled');
  assert.match(await readFile(result.log, 'utf8'), /progress[\s\S]*saved/);
});
for (const failurePoint of ['before-marker', 'after-marker']) {
  test(`log write failure ${failurePoint} requests stop and waits for child close`, { timeout: 5000 }, async t => {
    const root = await setup(t), game = 'wuwa';
    const dir = join(root, '.cache', game, 'runs', `pilot-${randomUUID()}`);
    const stub = join(root, 'stub.cjs');
    await writeFile(stub, `const fs=require('fs'),p=require('path'),d=process.env.STUB_DIR;
      const announce=()=>{console.log('PILOT_SESSION_DIR='+d);setTimeout(()=>{fs.mkdirSync(d);const timer=setInterval(()=>{if(fs.existsSync(p.join(d,'stop.request'))){clearInterval(timer);fs.writeFileSync(p.join(d,'session.json'),JSON.stringify({reason:'pilot-limit'}));fs.writeFileSync(p.join(d,'child-closed.txt'),'closed');console.log('child cleaned up');}},20)},150)};
      if(process.env.BEFORE==='yes'){console.log('before marker');setTimeout(announce,300)}else announce();`);
    const messages = [];
    let child, childClosed = false;
    t.after(() => { if (child && child.exitCode === null) child.kill(); });
    const result = await runChild({
      root, game, window: win(),
      print: line => {
        messages.push(line);
        if (line.startsWith('Log desta abertura: ')) {
          const log = line.slice('Log desta abertura: '.length);
          unlinkSync(log); mkdirSync(log);
        }
      },
      spawnChild: (node, args, options) => {
        child = spawn(node, [stub], { ...options, env: { ...process.env, STUB_DIR: dir, BEFORE: failurePoint === 'before-marker' ? 'yes' : 'no' } });
        child.once('close', () => { childClosed = true; });
        return child;
      },
    });
    assert.equal(result.code, 1);
    assert.equal(result.report.reason, 'pilot-limit');
    assert.equal(await readFile(join(dir, 'stop.request'), 'utf8'), 'stop\n');
    assert.equal(await readFile(join(dir, 'child-closed.txt'), 'utf8'), 'closed');
    assert.equal(child.exitCode, 0);
    assert.equal(childClosed, true);
    assert.equal(messages.filter(line => line.startsWith('Falha ao gravar o log ')).length, 1);
    assert.ok(messages.some(line => line.startsWith('Parada solicitada')));
    const failure = messages.findIndex(line => line.startsWith('Falha ao gravar o log '));
    const marker = messages.findIndex(line => line.startsWith('PILOT_SESSION_DIR='));
    assert.ok(failurePoint === 'before-marker' ? failure < marker : failure > marker);
    assert.ok(!messages.some(line => line.startsWith('Limite do piloto atingido')));
  });
}
test('failed startup cannot select an unrelated existing result', async t => {
  const root = await setup(t), game = 'nte';
  const old = join(root,'.cache',game,'runs',`pilot-${randomUUID()}`); await mkdir(old, { recursive: true });
  await writeFile(join(old,'session.json'), '{"reason":"pilot-limit"}');
  const result = await runChild({root,game,window:win(),print:()=>{},spawnChild: (node, args, options) => spawn(node, ['-e', 'process.exitCode=1'], options)});
  assert.equal(result.code,1); assert.equal(result.session,undefined);
});

test('check reports missing model and dependencies separately', async t => {
  const root = await setup(t);
  const files = ['package.json','scripts/windows-game.ps1','scripts/selection-pilot-windows.ps1','scripts/wuwa-pilot.js','scripts/nte-pilot.js','src/windows-game.js','src/ocr.js','src/wuwa-pilot.js','src/wuwa-selection.js','src/wuwa-offline.js','src/nte-pilot.js','src/nte-offline.js','src/image.js','src/regions.js','src/scan-control.js'];
  for (const path of files) { const full = join(root,path); await mkdir(join(full,'..'), {recursive:true}); await writeFile(full,'{}'); }
  await assert.rejects(checkInstallation(root, {load: async () => {}}), /eng\.traineddata/);
  await mkdir(join(root,'.cache','models'), {recursive:true}); await writeFile(join(root,'.cache','models','eng.traineddata'),'model');
  await assert.rejects(checkInstallation(root, {load: async () => {throw new Error('missing');}}), /Dependencia sharp/);
  await checkInstallation(root, {load: async () => {}});
});

test('reads final manifest only after child close', async t => {
  const root = await setup(t), game = 'nte', dir = join(root,'.cache',game,'runs',`pilot-${randomUUID()}`), stub = join(root,'stub.cjs');
  await writeFile(stub, `const fs=require('fs'),p=require('path'),d=process.env.STUB_DIR; fs.mkdirSync(d); console.log('PILOT_SESSION_DIR='+d); fs.writeFileSync(p.join(d,'session.json'),JSON.stringify({reason:'running'})); setTimeout(()=>fs.writeFileSync(p.join(d,'session.json'),JSON.stringify({reason:'pilot-limit'})),200);`);
  const result = await runChild({root,game,window:win(),print:()=>{},spawnChild:(node,args,options)=>spawn(node,[stub],{...options,env:{...process.env,STUB_DIR:dir}})});
  assert.equal(result.code,0); assert.equal(result.report.reason,'pilot-limit'); assert.equal(result.session,join(dir,'session.json'));
});

test('rejects old and conflicting markers without reading old result', async t => {
  const root = await setup(t), game = 'nte', runs = join(root,'.cache',game,'runs'), old = join(runs,`pilot-${randomUUID()}`);
  await mkdir(old,{recursive:true}); await writeFile(join(old,'session.json'),'{"reason":"pilot-limit"}');
  const result = await runChild({root,game,window:win(),print:()=>{},spawnChild:(node,args,options)=>spawn(node,['-e',`console.log('PILOT_SESSION_DIR='+process.env.OLD)`],{...options,env:{...process.env,OLD:old}})});
  assert.equal(result.code,1); assert.equal(result.session,undefined);
});

test('Windows wrapper reports missing Node without UAC', { skip: process.platform !== 'win32' }, async t => {
  const { spawnSync } = await import('node:child_process');
  const { resolve } = await import('node:path');
  const root = resolve(import.meta.dirname,'..'), cwd = await setup(t), ps = join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe'), script = join(root,'scripts','start-selection-pilot.ps1');
  const args = ['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',script,'-Game','wuwa','-Check'];
  const missing = spawnSync(ps,args,{cwd,env:{...process.env,Path:''},encoding:'utf8'});
  assert.equal(missing.status,1); assert.match(missing.stdout,/Node\.js 22/);
});

test('conflicting markers fail even when a valid session exists', async t => {
  const root=await setup(t), game='wuwa', runs=join(root,'.cache',game,'runs'), first=join(runs,`pilot-${randomUUID()}`), second=join(runs,`pilot-${randomUUID()}`), stub=join(root,'stub.cjs');
  await writeFile(stub, `const fs=require('fs'),p=require('path'); let a=process.env.A,b=process.env.B; fs.mkdirSync(a);fs.writeFileSync(p.join(a,'session.json'),'{"reason":"pilot-limit"}');console.log('PILOT_SESSION_DIR='+a);console.log('PILOT_SESSION_DIR='+b);`);
  const result=await runChild({root,game,window:win(),print:()=>{},spawnChild:(node,args,options)=>spawn(node,[stub],{...options,env:{...process.env,A:first,B:second}})});
  assert.equal(result.code,1); assert.equal(result.session,undefined);
});

test('a new junction to an older session cannot receive stop or become the result', { skip: process.platform !== 'win32' }, async t => {
  const root=await setup(t), game='wuwa', runs=join(root,'.cache',game,'runs');
  const old=join(runs,`pilot-${randomUUID()}`), fresh=join(runs,`pilot-${randomUUID()}`);
  await mkdir(old,{recursive:true});await writeFile(join(old,'session.json'),'{"reason":"pilot-limit"}');
  const result=await runChild({root,game,window:win(),print:()=>{},onReady:({requestCancel})=>requestCancel(),
    spawnChild:(node,args,options)=>spawn(node,['-e',`const fs=require('fs');fs.symlinkSync(process.env.OLD,process.env.FRESH,'junction');console.log('PILOT_SESSION_DIR='+process.env.FRESH);setTimeout(()=>{},200)`],
      {...options,env:{...process.env,OLD:old,FRESH:fresh}})});
  assert.equal(result.code,1);assert.equal(result.directory,undefined);assert.equal(result.session,undefined);
  await assert.rejects(readFile(join(old,'stop.request')),{code:'ENOENT'});
});

test('pilot CLIs announce their own ASCII session markers without live access', async t => {
  const { copyFile } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  const root=await setup(t), source=join(import.meta.dirname,'..');
  await mkdir(join(root,'scripts')); await mkdir(join(root,'src')); await writeFile(join(root,'package.json'),'{"type":"module"}');
  for (const game of ['wuwa','nte']) await copyFile(join(source,'scripts',`${game}-pilot.js`),join(root,'scripts',`${game}-pilot.js`));
  const modules = {
    'windows-game.js': 'export async function openWindowsGame(){throw Error("unexpected backend")} ',
    'ocr.js': 'export async function createOcrSession(){throw Error("unexpected OCR")} ',
    'regions.js': 'export function parseRectangle(){return {}}',
    'wuwa-selection.js': 'export function validateWuwaTargets(){}',
    'wuwa-pilot.js': 'export async function runWuwaPilot(){return {reason:"pilot-limit"}}',
    'nte-pilot.js': 'export function validateTargets(){}; export async function runNtePilot(){throw Error("unexpected pilot")}',
    'scan-control.js': 'export async function wait(){}',
  };
  for (const [name,content] of Object.entries(modules)) await writeFile(join(root,'src',name),content);
  for (const game of ['wuwa','nte']) {
    const result=spawnSync(process.execPath,[join(root,'scripts',`${game}-pilot.js`),'--prepared','--process','Unused','--target','1,1,1,1'],{cwd:tmpdir(),encoding:'utf8'});
    const matches=[...result.stdout.matchAll(/^PILOT_SESSION_DIR=(.+)$/gmu)];
    assert.equal(matches.length,1); assert.equal(join(root,'.cache',game,'runs'), (await import('node:path')).dirname(matches[0][1].trim()));
    assert.equal(result.status,game==='wuwa'?0:1);
  }
});

test('Windows check resolves a copied repository with spaces and apostrophes from another cwd', { skip: process.platform !== 'win32' }, async t => {
  const { cp } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  const source=join(import.meta.dirname,'..'), root=await setup(t);
  for (const item of ['scripts','src','package.json']) {
    const dest=join(root,item); await mkdir(join(dest,'..'),{recursive:true}); await cp(join(source,item),dest,{recursive:true});
  }
  for (const name of ['sharp','tesseract.js']) {
    const dir=join(root,'node_modules',name); await mkdir(dir,{recursive:true});
    await writeFile(join(dir,'package.json'),'{"main":"index.js"}'); await writeFile(join(dir,'index.js'),'module.exports = {};');
  }
  await mkdir(join(root,'.cache','models'),{recursive:true}); await writeFile(join(root,'.cache','models','eng.traineddata'),'stub');
  const ps=join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
  const result=spawnSync(ps,['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'scripts','start-selection-pilot.ps1'),'-Game','nte','-Check'],{cwd:tmpdir(),encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr); assert.ok(result.stdout.includes(root));
});
