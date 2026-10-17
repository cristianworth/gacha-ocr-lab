import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { readImage } from '../src/image.js';
import { readWeapon } from '../src/read-weapon.js';
import { getGame } from '../src/games.js';
import { scoreField, summarize } from './evaluation-utils.js';
import { verifyEvaluationFreeze, summarizeReferences, evaluationFiles } from './evaluation-provenance.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { values } = parseArgs({ options: {
    game: { type: 'string', default: 'genshin' },
    manifest: { type: 'string' },
    split: { type: 'string', default: 'development' },
    mode: { type: 'string', default: 'regions' },
    final: { type: 'boolean', default: false },
    freeze: { type: 'string' },
  } });
  if (!['development', 'evaluation', 'target'].includes(values.split) || !['regions', 'text'].includes(values.mode)) throw new Error('Split/modo invalido.');
  const game = getGame(values.game);
  if (game.id === 'hsr' && values.mode !== 'regions') throw new Error('HSR suporta somente --mode regions.');
  if (values.split === 'evaluation' && !values.final) throw new Error('Avaliacao reservada exige --final, apos congelar a configuracao.');
  const manifestPath = resolve(values.manifest ?? resolve(root, 'data/datasets', game.id === 'hsr' ? 'hsr-light-cones.json' : 'genshin-weapons.json'));
  const manifestBytes = await readFile(manifestPath);
  const manifest = JSON.parse(manifestBytes);
  if ((manifest.game ?? 'genshin') !== game.id) throw new Error('O jogo do manifesto difere de --game.');
  const sampleProfiles = [...new Set(manifest.samples.map((sample) => sample.profile).filter(Boolean))];
  const profile = manifest.profile ?? (sampleProfiles.length === 1 ? sampleProfiles[0] : undefined);
  const groups = new Map();
  for (const sample of manifest.samples) {
    if (!/^[A-Za-z0-9_-]+$/u.test(sample.id)) throw new Error('ID de amostra invalido.');
    const previous = groups.get(sample.group);
    if (previous && previous !== sample.split && ![previous, sample.split].includes('target')) throw new Error(`Grupo ${sample.group} atravessa desenvolvimento e avaliacao.`);
    if (sample.split !== 'target') groups.set(sample.group, sample.split);
  }
  const samples = manifest.samples.filter((sample) => sample.split === values.split);
  if (!samples.length) throw new Error('Nenhuma amostra selecionada.');
  const verifiedFreeze = values.split === 'evaluation'
    ? await verifyEvaluationFreeze({ root, freezePath: values.freeze ?? resolve(root, 'data/evaluation', game.id === 'hsr' ? 'hsr-profile-freeze.json' : 'profile-freeze.json'),
      samples, game: game.id, mode: values.mode, profile, manifestBytes }) : null;
  const output = resolve(root, 'data/evaluation', `${new Date().toISOString().replace(/[:.]/gu, '-')}-${game.id}-${values.mode}-${values.split}-${randomUUID()}`);
  await mkdir(output, { recursive: true });
  const sourceHash = createHash('sha256');
  for (const file of evaluationFiles(game.id)) sourceHash.update(await readFile(resolve(root, file)));
  const rows = [];
  for (const sample of samples) {
    if (sample.reference?.method !== 'visual-inspection') throw new Error(`Referencia ${sample.id} nao conferida.`);
    const image = await readImage(resolve(dirname(manifestPath), sample.path));
    if (image.source.sha256 !== sample.sha256) throw new Error(`A imagem ${sample.id} mudou desde a conferência.`);
    const result = await readWeapon(image, { game: game.id, languages: 'eng', cachePath: resolve(root, '.cache/models'), offline: true,
      layout: values.mode === 'text' ? 'text' : sample.layout, panel: values.mode === 'text' ? undefined : sample.panel });
    const scores = Object.fromEntries(game.fieldNames.map((field) => [field, scoreField(field, result.fields[field], sample.expected[field])]));
    const row = { id: sample.id, group: sample.group, reference: sample.reference, expected: sample.expected, scores, fields: result.fields };
    rows.push(row);
    await writeFile(resolve(output, `${sample.id}.json`), `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
    console.log(`${sample.id}: ${JSON.stringify(scores)}`);
  }
  const report = { createdAt: new Date().toISOString(), game: game.id, itemType: game.itemType, profile, split: values.split, mode: values.mode,
    manifestSha256: createHash('sha256').update(manifestBytes).digest('hex'), implementationSha256: sourceHash.digest('hex'),
    references: summarizeReferences(rows), verifiedFreeze,
    nameComparison: 'NFC, espacos e aspas tipograficas; caixa, acentos e palavras preservados',
    summary: summarize(rows, game.fieldNames), rows };
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  console.log(`Relatorio: ${output}`);
  console.log(JSON.stringify(report.summary));
} catch (error) { process.stderr.write(`Erro na avaliacao: ${error.message}\n`, () => process.exit(1)); }
