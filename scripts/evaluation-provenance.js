import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export const frozenFiles = [
  'package-lock.json', 'src/image.js', 'src/ocr.js', 'src/regions.js',
  'src/parse-regions.js', 'src/parse-weapon.js', 'src/read-weapon.js',
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function verifyEvaluationFreeze({ root, freezePath, samples }) {
  const path = resolve(freezePath);
  const bytes = await readFile(path);
  const freeze = JSON.parse(bytes);
  const reserved = freeze.reserved;
  const ids = samples.map((sample) => sample.id);
  if (!Array.isArray(reserved) || !reserved.every((id) => typeof id === 'string')
      || new Set(reserved).size !== reserved.length || new Set(ids).size !== ids.length
      || JSON.stringify([...reserved].sort()) !== JSON.stringify([...ids].sort())) {
    throw new Error('IDs reservados diferem do congelamento; nao executar a avaliacao.');
  }
  if (!freeze.hashes || JSON.stringify(Object.keys(freeze.hashes).sort()) !== JSON.stringify([...frozenFiles].sort())) {
    throw new Error('O congelamento deve conter os sete arquivos de nucleo/lock esperados.');
  }
  const hashes = {};
  for (const file of frozenFiles) {
    if (!/^[a-f0-9]{64}$/u.test(freeze.hashes[file])) throw new Error(`Hash invalido no congelamento: ${file}.`);
    hashes[file] = sha256(await readFile(resolve(root, file)));
    if (hashes[file] !== freeze.hashes[file]) throw new Error(`Arquivo difere do congelamento: ${file}. Nao executar a avaliacao.`);
  }
  return { path, sha256: sha256(bytes), frozenAt: freeze.frozenAt ?? null, profile: freeze.profile ?? null, reserved: [...reserved], hashes };
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
