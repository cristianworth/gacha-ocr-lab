import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { card } from '../test-support/genshin-scene.js';

const exec = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const script = resolve('scripts/genshin-rarity-evaluate.js');

test('rarity evaluation validates sources and reports mismatched visual labels', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'genshin-rarity-evaluation-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const panel = await sharp(await card(4)).resize(327, 638).png().toBuffer();
  const image = await sharp({ create: { width: 1280, height: 720, channels: 3, background: 'black' } })
    .composite([{ input: panel, left: 873, top: 79 }]).png().toBuffer();
  const imagePath = join(dir, 'frame.png'), sessionPath = join(dir, 'session.json'), labelsPath = join(dir, 'labels.json');
  await writeFile(imagePath, image);
  const session = Buffer.from(JSON.stringify({ game: 'genshin', observations: [{ capture: { path: imagePath, sha256: hash(image) } }] }));
  await writeFile(sessionPath, session);
  const labels = { sessionSha256: hash(session), samples: [{ position: 1, captureSha256: hash(image), expectedRarity: 4 }] };
  await writeFile(labelsPath, JSON.stringify(labels));
  const run = () => exec(process.execPath, [script, '--session', sessionPath, '--labels', labelsPath]);
  assert.equal(JSON.parse((await run()).stdout).matched, 1);
  labels.samples[0].expectedRarity = 3;
  await writeFile(labelsPath, JSON.stringify(labels));
  await assert.rejects(run(), error => error.code === 1 && JSON.parse(error.stdout).matched === 0);
  await writeFile(imagePath, Buffer.from('different image'));
  await assert.rejects(run(), error => /Imagem alterada/.test(error.stderr));
  assert.equal((await readFile(sessionPath)).equals(session), true);
});
