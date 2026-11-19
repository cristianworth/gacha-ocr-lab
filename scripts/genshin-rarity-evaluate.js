import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { readRarity } from '../src/genshin-inventory.js';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const { values } = parseArgs({ options: { session: { type: 'string' }, labels: { type: 'string' } }, strict: true });
if (!values.session || !values.labels) throw new Error('Use --session session.json --labels labels.json.');
const source = await readFile(values.session);
const session = JSON.parse(source);
const labels = JSON.parse(await readFile(values.labels, 'utf8'));
if (session.game !== 'genshin' || labels.sessionSha256 !== hash(source) || !Array.isArray(labels.samples) || !labels.samples.length) {
  throw new Error('Sessão ou referências da avaliação inválidas.');
}
const seen = new Set();
const results = [];
for (const sample of labels.samples) {
  const { position, expectedRarity, captureSha256 } = sample;
  if (!Number.isInteger(position) || position < 1 || seen.has(position) || !Number.isInteger(expectedRarity) || expectedRarity < 1 || expectedRarity > 5) {
    throw new Error('Posição ou raridade de referência inválida ou duplicada.');
  }
  seen.add(position);
  const capture = session.observations[position - 1]?.capture;
  if (!capture || capture.sha256 !== captureSha256) throw new Error(`Referência de imagem divergente: posição ${position}.`);
  const image = await readFile(capture.path);
  if (hash(image) !== captureSha256) throw new Error(`Imagem alterada: posição ${position}.`);
  const metadata = await sharp(image).metadata();
  if (metadata.width !== 1280 || metadata.height !== 720) throw new Error(`Imagem fora do perfil 1280x720: posição ${position}.`);
  const rarity = await readRarity(image, { left: 873, top: 79, width: 327, height: 638 });
  results.push({ position, expectedRarity, captureSha256, rarity, matches: rarity.status === 'recognized' && rarity.value === expectedRarity });
}
const report = { schemaVersion: 1, sessionSha256: hash(source), labelsSha256: hash(await readFile(values.labels)),
  samples: results.length, matched: results.filter(item => item.matches).length, results };
console.log(JSON.stringify(report, null, 2));
if (report.matched !== report.samples) process.exitCode = 1;
