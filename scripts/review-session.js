import { parseArgs } from 'node:util';
import { readFile, mkdir, realpath, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFeedback } from '../src/feedback.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function diagnosticPath(directory, value) {
  if (typeof value !== 'string' || !value) throw new Error('Observacao sem JSON diagnostico; nao pode ser aprovada.');
  const path = await realpath(resolve(directory, value));
  const local = relative(await realpath(directory), path);
  if (isAbsolute(local) || local === '..' || local.startsWith(`..${sep}`)) throw new Error('JSON diagnostico fora da sessao.');
  return path;
}

async function reviewItem(directory, observation, options) {
  const path = await diagnosticPath(directory, observation.resultPath);
  const bytes = await readFile(path);
  if (observation.resultSha256 && sha256(bytes) !== observation.resultSha256) throw new Error('Hash do diagnostico diverge; resultado alterado.');
  const result = JSON.parse(bytes);
  if (result.game !== 'genshin' || result.source?.sha256 !== observation.capture?.sha256) throw new Error('Origem do resultado nao corresponde a captura da observacao.');
  const capturePath = await diagnosticPath(directory, observation.capture?.path);
  if (sha256(await readFile(capturePath)) !== observation.capture?.sha256) throw new Error('Hash da captura diverge; imagem alterada.');
  const feedback = createFeedback(bytes, options);
  return { id: observation.id, resultPath: relative(directory, path), ...feedback };
}

try {
  const { values, positionals } = parseArgs({ options: {
    reviewer: { type: 'string' }, 'confirm-all': { type: 'boolean', default: false }, item: { type: 'string' },
    name: { type: 'string' }, level: { type: 'string' }, refinement: { type: 'string' }, rarity: { type: 'string' },
  }, allowPositionals: true, strict: true });
  if (positionals.length !== 1 || !values.reviewer?.trim()) throw new Error('Informe inventory.json e --reviewer com quem conferiu as imagens.');
  const inventoryPath = resolve(positionals[0]);
  const bytes = await readFile(inventoryPath);
  const manifest = JSON.parse(bytes);
  if (manifest.schemaVersion !== 1 || manifest.game !== 'genshin' || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/iu.test(manifest.id)
      || !Array.isArray(manifest.observations) || !Array.isArray(manifest.items)) throw new Error('Sessao Genshin v1 invalida.');
  const directory = dirname(inventoryPath);
  let items;
  if (values['confirm-all']) {
    if ([values.item, values.name, values.level, values.refinement, values.rarity].some((value) => value !== undefined)) throw new Error('Use --confirm-all ou correcao por --item; nao misture os modos.');
    const included = manifest.observations.filter((observation) => observation.status === 'included');
    if (manifest.captureComplete !== true || manifest.coverage?.status !== 'verified' || manifest.processingComplete !== true
        || manifest.observations.some((observation) => !['included', 'excluded'].includes(observation.status) || observation.error || observation.rarity?.status !== 'recognized')
        || included.some((observation) => ![4, 5].includes(observation.rarity.value))
        || included.length === 0 || manifest.items.length !== included.length
        || manifest.items.some((item) => !included.some((observation) => observation.id === item.id))
        || included.some((observation) => ['name', 'level', 'refinement'].some((key) => observation.fields?.[key]?.status !== 'recognized'))) {
      throw new Error('Confirmacao total exige captura/processamento completos, cobertura verificada e todos os itens reconhecidos, sem pendencias ou falhas.');
    }
    items = await Promise.all(included.map((observation) => reviewItem(directory, observation, { confirmAll: true, reviewer: values.reviewer })));
  } else {
    if (!values.item) throw new Error('Use --item <id> com os tres valores conferidos, ou --confirm-all.');
    const observation = manifest.observations.find((item) => item.id === values.item && ['included', 'scope-uncertain'].includes(item.status));
    if (!observation) throw new Error('Item incluido ou com escopo incerto nao encontrado nesta sessao.');
    if (values.rarity !== undefined && !/^[1-5]$/u.test(values.rarity)) throw new Error('--rarity deve ser 1–5, conferida na imagem.');
    if (observation.status === 'scope-uncertain' && values.rarity === undefined) throw new Error('Raridade incerta exige --rarity conferida e os tres campos.');
    const reviewed = await reviewItem(directory, observation, values);
    if (values.rarity !== undefined) reviewed.scopeReview = { rarity: Number(values.rarity), included: [4, 5].includes(Number(values.rarity)), basis: 'human-visual-review' };
    items = [reviewed];
  }
  const feedback = {
    schemaVersion: 1, sessionId: manifest.id, sessionSha256: sha256(bytes), inventoryPath,
    reviewedAt: new Date().toISOString(), reviewer: values.reviewer.trim(),
    decision: values['confirm-all'] ? 'confirmed-all' : 'item-reviewed', items, appliedToAccount: false,
  };
  const outputDirectory = join(root, 'data', 'feedback', manifest.id, 'reviews');
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = join(outputDirectory, `${randomUUID()}.json`);
  await writeFile(outputPath, `${JSON.stringify(feedback, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`Revisao da sessao registrada separadamente: ${outputPath}`);
} catch (error) { console.error(`Erro: ${error.message}`); process.exitCode = 1; }
