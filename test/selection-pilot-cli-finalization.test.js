import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

// Run the actual CLI/finally with fake dependencies. No helper, OCR engine or game
// is opened; events record attempts separately from successful resource closes.
async function fixture(t) {
  const root = await mkdtemp(join(resolve(import.meta.dirname, '..'), '.cache', 'cli-final-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts')); await mkdir(join(root, 'src'));
  await mkdir(join(root, '.cache', 'models'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await writeFile(join(root, '.cache', 'models', 'eng.traineddata'), 'fixture, not a model');
  for (const game of ['wuwa', 'nte']) await copyFile(join(import.meta.dirname, '..', 'scripts', `${game}-pilot.js`), join(root, 'scripts', `${game}-pilot.js`));
  const modules = {
    'fixture.js': `import fs from 'node:fs';import {join} from 'node:path';
      export const config=JSON.parse(process.env.PILOT_FIXTURE),events=[];
      export function event(value){events.push(value);fs.writeFileSync(join(import.meta.dirname,'..','.cache','events.json'),JSON.stringify(events))}
      export function resource(name){return {close(){event(name+'.close-attempt');if(config.fail.includes(name))throw Error('fixture '+name+' close failed');event(name+'.close-success')}}}
      export async function save(output,targets,game,reason,error){
        const report={...(game==='wuwa'?{schemaVersion:1,game,mode:'visible-pilot',inventoryAccepted:false}:{schema:'nte-arc-pilot-v1',humanApproved:false}),
        status:'partial',reason,coverageConfirmed:false,scope:{targets,filter:'none',order:'declared-targets',scroll:false},observations:[{status:'captured-pending-ocr'}],...(error?{error}: {})};
        fs.writeFileSync(join(output,'session.json'),JSON.stringify(report));fs.writeFileSync(join(output,'summary.md'),'partial fixture');return report;
      }`,
    'windows-game.js': `import {resource,config} from './fixture.js';import {mkdir} from 'node:fs/promises';import {join} from 'node:path';
      export async function openWindowsGame({outputRoot}){return {...resource('helper'),attach:async()=>{
        if(config.failPreparationSave){await mkdir(join(outputRoot,'session.json'));throw Error('fixture original attach cause')}
        return {width:1280,height:720,dpi:96}},checkInputAccess:async()=>({allowed:true}),activate:async()=>{},arm:async()=>{}}}`,
    'ocr.js': `import {resource} from './fixture.js';export async function createOcrSession(){return {...resource('OCR'),recognize:async()=>({rawText:'Arc'})}}`,
    'regions.js': `export function parseRectangle(text){return Object.fromEntries(text.split(',').map((v,i)=>[['left','top','width','height'][i],Number(v)]))}`,
    'wuwa-selection.js': 'export function validateWuwaTargets(){}',
    'scan-control.js': 'export async function wait(){}',
    'wuwa-pilot.js': `import {mkdir} from 'node:fs/promises';import {config,save} from './fixture.js';
      export async function runWuwaPilot({output,targets,setup,signal}){await mkdir(output);await setup(output,signal);return save(output,targets,'wuwa',config.bodyError?'fixture operation failed':config.reason,config.bodyError?'fixture original cause':undefined)}`,
    'nte-pilot.js': `import {config,save} from './fixture.js';export function validateTargets(){}
      export async function runNtePilot({output,targets,createSession}){
        let reason=config.bodyError?'fixture operation failed':config.reason,error=config.bodyError?'fixture original cause':undefined;
        const session=await createSession({});try{await session.close()}catch(closeError){error??=closeError.message;if(reason==='pilot-limit')reason=closeError.message}
        return save(output,targets,'nte',reason,error)
      }`,
  };
  for (const [name, content] of Object.entries(modules)) await writeFile(join(root, 'src', name), content);
  return root;
}

for (const game of ['wuwa', 'nte']) for (const reason of ['pilot-limit', 'cancelled', 'emergency-f8']) {
  for (const fail of [[], ['helper'], ['OCR'], ['helper', 'OCR']]) {
    test(`${game} real CLI ${reason}, close failures: ${fail.join('+') || 'none'}`, async t => {
      const root = await fixture(t);
      const result = spawnSync(process.execPath, [join(root, 'scripts', `${game}-pilot.js`), '--prepared', '--process', 'FixtureGame', '--target', game === 'wuwa' ? '119,95,95,118' : '73,107,105,105'],
        { cwd: root, encoding: 'utf8', windowsHide: true, env: { ...process.env, PILOT_FIXTURE: JSON.stringify({ reason, fail }) } });
      assert.equal(result.status, fail.length ? 2 : reason === 'pilot-limit' ? 0 : 1, result.stderr);
      const directory = result.stdout.match(/^PILOT_SESSION_DIR=(.+)$/mu)?.[1].trim();
      assert.ok(directory, result.stdout);
      const report = JSON.parse(await readFile(join(directory, 'session.json'), 'utf8'));
      assert.equal(report.reason, game === 'nte' && reason === 'pilot-limit' && fail.includes('OCR') ? 'fixture OCR close failed' : reason);
      assert.equal(report.status, 'partial'); assert.equal(report.coverageConfirmed, false);
      assert.equal(report.observations[0].status, 'captured-pending-ocr');
      assert.equal(await readFile(join(directory, 'summary.md'), 'utf8'), 'partial fixture');
      const events = JSON.parse(await readFile(join(root, '.cache', 'events.json'), 'utf8'));
      assert.ok(events.includes('helper.close-attempt')); assert.ok(events.includes('OCR.close-attempt'));
      for (const name of fail) {
        assert.match(result.stderr, new RegExp(`fixture ${name} close failed`));
        assert.match(result.stderr, /encerramento nao confirmado/);
        assert.ok(!events.includes(`${name}.close-success`));
      }
    });
  }
}
for (const game of ['wuwa', 'nte']) {
  test(`${game} original operation cause survives both close failures`, async t => {
    const root = await fixture(t);
    const result = spawnSync(process.execPath, [join(root, 'scripts', `${game}-pilot.js`), '--prepared', '--process', 'FixtureGame', '--target', '73,107,105,105'],
      { cwd: root, encoding: 'utf8', windowsHide: true, env: { ...process.env, PILOT_FIXTURE: JSON.stringify({ reason: 'cancelled', fail: ['helper', 'OCR'], bodyError: true }) } });
    assert.equal(result.status, 2, result.stderr);
    const directory = result.stdout.match(/^PILOT_SESSION_DIR=(.+)$/mu)?.[1].trim();
    const report = JSON.parse(await readFile(join(directory, 'session.json'), 'utf8'));
    assert.equal(report.reason, 'fixture operation failed'); assert.equal(report.error, 'fixture original cause');
    assert.match(result.stderr, /fixture helper close failed/); assert.match(result.stderr, /fixture OCR close failed/);
  });
}

for (const fail of [[], ['helper']]) {
  test(`NTE preparation save error cannot override finalization code: ${fail.join() || 'none'}`, async t => {
    const root = await fixture(t);
    const result = spawnSync(process.execPath, [join(root, 'scripts', 'nte-pilot.js'), '--prepared', '--process', 'FixtureGame', '--target', '73,107,105,105'],
      { cwd: root, encoding: 'utf8', windowsHide: true, env: { ...process.env, PILOT_FIXTURE: JSON.stringify({ fail, failPreparationSave: true }) } });
    assert.equal(result.status, fail.length ? 2 : 1, result.stderr);
    assert.match(result.stderr, /fixture original attach cause/);
    assert.match(result.stderr, /Falha ao salvar parcial da preparacao/);
    if (fail.length) assert.match(result.stderr, /fixture helper close failed/);
    const events = JSON.parse(await readFile(join(root, '.cache', 'events.json'), 'utf8'));
    assert.ok(events.includes('helper.close-attempt'));
  });
}
