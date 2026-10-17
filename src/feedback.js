import { createHash } from 'node:crypto';

function validateFields(fields) {
  const level = fields.level;
  if (typeof fields.name !== 'string' || !/\p{L}/u.test(fields.name)) throw new Error('Informe --name com o nome conferido.');
  if (!level || !Number.isInteger(level.current) || level.current < 1 || level.current > 90
      || (level.max !== null && (!Number.isInteger(level.max) || level.max < level.current || level.max > 90))) {
    throw new Error('--level deve ser nivel ou nivel/limite conferido (1–90).');
  }
  if (!Number.isInteger(fields.refinement) || fields.refinement < 1 || fields.refinement > 5) throw new Error('--refinement deve ser 1–5, conferido na imagem.');
}

export function createFeedback(resultBytes, { confirmAll = false, name, level, refinement, reviewer }) {
  const result = JSON.parse(resultBytes.toString('utf8'));
  if (result.schemaVersion !== 2 || result.game !== 'genshin' || !result.source?.sha256) throw new Error('Resultado Genshin v2 com origem verificavel requerido.');
  if (!reviewer?.trim()) throw new Error('Informe --reviewer com quem conferiu a imagem.');
  if (confirmAll && [name, level, refinement].some((value) => value !== undefined)) throw new Error('Use --confirm-all ou valores explicitos, nao ambos.');
  let fields;
  if (confirmAll) {
    if (['name', 'level', 'refinement'].some((key) => result.fields[key]?.status !== 'recognized')) throw new Error('Campos ausentes/incertos exigem correcao explicita; --confirm-all nao pode aprova-los.');
    fields = Object.fromEntries(['name', 'level', 'refinement'].map((key) => [key, result.fields[key].value]));
  } else {
    const numbers = String(level ?? '').match(/^(\d{1,2})(?:\/(\d{1,2}))?$/u);
    if (!numbers) throw new Error('Informe --level com o nivel conferido, por exemplo 80/90.');
    fields = { name: name?.trim(), level: { current: Number(numbers[1]), max: numbers[2] === undefined ? null : Number(numbers[2]) },
      refinement: /^[1-5]$/u.test(String(refinement)) ? Number(refinement) : null };
  }
  validateFields(fields);
  return {
    schemaVersion: 1, reviewedAt: new Date().toISOString(), reviewer: reviewer.trim(),
    resultSha256: createHash('sha256').update(resultBytes).digest('hex'), sourceImageSha256: result.source.sha256,
    fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, decision: JSON.stringify(value) === JSON.stringify(result.fields[key].value) ? 'confirmed' : 'corrected' }])),
    appliedToAccount: false,
  };
}
