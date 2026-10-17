import { normalizeName } from '../src/parse-regions.js';

export function equivalent(field, value, expected) {
  return field === 'name' && typeof value === 'string' && typeof expected === 'string'
    ? normalizeName(value) === normalizeName(expected) : JSON.stringify(value) === JSON.stringify(expected);
}

export function scoreField(field, output, expected) {
  if (expected === null) return output.status === 'absent' ? 'correct-absence' : output.status === 'recognized' ? 'wrong-accepted' : 'uncertain';
  if (output.status === 'recognized') return equivalent(field, output.value, expected) ? 'correct' : 'wrong-accepted';
  if (output.candidates.some((candidate) => candidate.valid && equivalent(field, candidate.value, expected))) return 'candidate-only';
  return output.status;
}

export function summarize(rows) {
  const fields = {};
  for (const field of ['name', 'level', 'refinement']) {
    const counts = {};
    for (const row of rows) counts[row.scores[field]] = (counts[row.scores[field]] ?? 0) + 1;
    fields[field] = { samples: rows.length, counts };
  }
  return fields;
}
