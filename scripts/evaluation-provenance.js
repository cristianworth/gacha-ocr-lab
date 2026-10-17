import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const frozenFiles = [
  'package-lock.json', 'src/image.js', 'src/ocr.js', 'src/regions.js',
  'src/parse-regions.js', 'src/parse-weapon.js', 'src/read-weapon.js',
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function evaluationFiles(game = 'genshin') {
  if (!['genshin', 'hsr'].includes(game)) throw new Error('Jogo de avaliacao invalido.');
  return [
    'package-lock.json', 'src/image.js', 'src/ocr.js', 'src/regions.js', 'src/read-weapon.js',
    'src/games.js', 'src/parse-regions.js',
    ...(game === 'genshin' ? ['src/parse-weapon.js'] : ['src/hsr-regions.js', 'src/parse-hsr.js']),
    'scripts/evaluate.js', 'scripts/evaluation-provenance.js', 'scripts/evaluation-utils.js',
  ];
}

function validateContext({ game, mode, profile, manifestBytes }) {
  evaluationFiles(game);
  if (!['regions', 'text'].includes(mode) || (game === 'hsr' && mode !== 'regions')) throw new Error('Modo de avaliacao invalido para o jogo.');
  if (typeof profile !== 'string' || !profile.trim()) throw new Error('Informe o perfil do manifesto para o novo congelamento.');
  if (!Buffer.isBuffer(manifestBytes)) throw new Error('Os bytes originais do manifesto sao requeridos para o congelamento.');
}

function validateReserved(reserved, samples) {
  const ids = samples.map((sample) => sample.id);
  if (!Array.isArray(reserved) || !reserved.every((id) => typeof id === 'string')
      || new Set(reserved).size !== reserved.length || new Set(ids).size !== ids.length
      || !ids.length || !ids.every((id) => typeof id === 'string')
      || JSON.stringify([...reserved].sort()) !== JSON.stringify([...ids].sort())) {
    throw new Error('IDs reservados diferem do congelamento; nao executar a avaliacao.');
  }
}

export async function buildEvaluationFreeze({ root, game = 'genshin', mode = 'regions', profile, manifestBytes, samples }) {
  validateContext({ game, mode, profile, manifestBytes });
  const reserved = samples.map((sample) => sample.id);
  validateReserved(reserved, samples);
  const hashes = {};
  for (const file of evaluationFiles(game)) hashes[file] = sha256(await readFile(resolve(root, file)));
  return { schemaVersion: 2, frozenAt: new Date().toISOString(), game, mode, profile,
    manifestSha256: sha256(manifestBytes), reserved, hashes };
}

export async function verifyEvaluationFreeze({ root, freezePath, samples, game = 'genshin', mode = 'regions', profile, manifestBytes }) {
  const path = resolve(freezePath);
  const bytes = await readFile(path);
  const freeze = JSON.parse(bytes);
  const reserved = freeze.reserved;
  validateReserved(reserved, samples);
  const legacy = freeze.game === undefined && freeze.schemaVersion === undefined;
  let files = frozenFiles;
  if (legacy) {
    if (game !== 'genshin') throw new Error('Congelamento legado so pode ser usado com Genshin.');
  } else {
    validateContext({ game, mode, profile, manifestBytes });
    if (freeze.schemaVersion !== 2 || freeze.game !== game || freeze.mode !== mode || freeze.profile !== profile
        || freeze.manifestSha256 !== sha256(manifestBytes)) {
      throw new Error('Jogo, modo, perfil ou manifesto diferem do novo congelamento.');
    }
    files = evaluationFiles(game);
  }
  if (!freeze.hashes || JSON.stringify(Object.keys(freeze.hashes).sort()) !== JSON.stringify([...files].sort())) {
    throw new Error(legacy ? 'O congelamento deve conter os sete arquivos de nucleo/lock esperados.' : 'O congelamento deve conter exatamente os arquivos esperados para o jogo.');
  }
  const hashes = {};
  for (const file of files) {
    if (!/^[a-f0-9]{64}$/u.test(freeze.hashes[file])) throw new Error(`Hash invalido no congelamento: ${file}.`);
    hashes[file] = sha256(await readFile(resolve(root, file)));
    if (hashes[file] !== freeze.hashes[file]) throw new Error(`Arquivo difere do congelamento: ${file}. Nao executar a avaliacao.`);
  }
  return { path, sha256: sha256(bytes), schemaVersion: legacy ? 1 : 2,
    game: legacy ? 'genshin' : freeze.game, mode: legacy ? null : freeze.mode,
    manifestSha256: legacy ? null : freeze.manifestSha256,
    frozenAt: freeze.frozenAt ?? null, profile: freeze.profile ?? null, reserved: [...reserved], hashes };
}

export function summarizeReferences(rows) {
  const reviewers = new Map();
  const humanConfirmation = { confirmed: 0, unconfirmed: 0, unspecified: 0 };
  for (const row of rows) {
    const reference = row.reference ?? {};
    const reviewer = typeof reference.reviewer === 'string' && reference.reviewer.trim() ? reference.reviewer.trim() : null;
    reviewers.set(reviewer, (reviewers.get(reviewer) ?? 0) + 1);
    const state = reference.humanConfirmed === true ? 'confirmed' : reference.humanConfirmed === false ? 'unconfirmed' : 'unspecified';
    humanConfirmation[state] += 1;
  }
  return { samples: rows.length, reviewers: [...reviewers].map(([reviewer, samples]) => ({ reviewer, samples })), humanConfirmation };
}
