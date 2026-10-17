import { createHash } from 'node:crypto';
import { getGame } from './games.js';

function validateFields(fields, game) {
  const level = fields.level;
  if (typeof fields.name !== 'string' || !/\p{L}/u.test(fields.name)) throw new Error('Informe --name com o nome conferido.');
  if (!level || !Number.isInteger(level.current) || level.current < 1 || level.current > game.maxLevel
      || (level.max !== null && (!Number.isInteger(level.max) || level.max < level.current || level.max > game.maxLevel))) {
    throw new Error(`--level deve ser nivel ou nivel/limite conferido (1–${game.maxLevel}).`);
  }
  const rank = fields[game.progressionField];
  if (!Number.isInteger(rank) || rank < 1 || rank > 5) throw new Error(`--${game.progressionField} deve ser 1–5, conferido na imagem.`);
}

export function createFeedback(resultBytes, { confirmAll = false, name, level, refinement, superimposition, reviewer }) {
  const result = JSON.parse(resultBytes.toString('utf8'));
  if (result.schemaVersion !== 2 || !['genshin', 'hsr'].includes(result.game) || !result.source?.sha256) throw new Error('Resultado Genshin/HSR v2 com origem verificavel requerido.');
  const game = getGame(result.game);
  if (!reviewer?.trim()) throw new Error('Informe --reviewer com quem conferiu a imagem.');
  if (confirmAll && [name, level, refinement, superimposition].some((value) => value !== undefined)) throw new Error('Use --confirm-all ou valores explicitos, nao ambos.');
  if ((game.id === 'hsr' && refinement !== undefined) || (game.id === 'genshin' && superimposition !== undefined)) throw new Error(`Use --${game.progressionField} para ${game.id}; nao misture campos de jogos.`);
  let fields;
  if (confirmAll) {
    if (game.fieldNames.some((key) => result.fields[key]?.status !== 'recognized')) throw new Error('Campos ausentes/incertos exigem correcao explicita; --confirm-all nao pode aprova-los.');
    fields = Object.fromEntries(game.fieldNames.map((key) => [key, result.fields[key].value]));
  } else {
    const numbers = String(level ?? '').match(/^(\d{1,2})(?:\/(\d{1,2}))?$/u);
    if (!numbers) throw new Error('Informe --level com o nivel conferido, por exemplo 80/80.');
    const rank = game.id === 'hsr' ? superimposition : refinement;
    fields = { name: name?.trim(), level: { current: Number(numbers[1]), max: numbers[2] === undefined ? null : Number(numbers[2]) },
      [game.progressionField]: /^[1-5]$/u.test(String(rank)) ? Number(rank) : null };
  }
  validateFields(fields, game);
  return {
    schemaVersion: 1, game: game.id, itemType: game.itemType, reviewedAt: new Date().toISOString(), reviewer: reviewer.trim(),
    resultSha256: createHash('sha256').update(resultBytes).digest('hex'), sourceImageSha256: result.source.sha256,
    fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { value, decision: JSON.stringify(value) === JSON.stringify(result.fields[key].value) ? 'confirmed' : 'corrected' }])),
    appliedToAccount: false,
  };
}