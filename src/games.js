const games = {
  genshin: {
    id: 'genshin', itemType: 'weapon', maxLevel: 90,
    progressionField: 'refinement', fieldNames: ['name', 'level', 'refinement'],
    labels: { name: 'Nome', level: 'Nível', refinement: 'Refinamento' },
  },
  hsr: {
    id: 'hsr', itemType: 'light-cone', maxLevel: 80,
    progressionField: 'superimposition', fieldNames: ['name', 'level', 'superimposition'],
    labels: { name: 'Nome', level: 'Nível', superimposition: 'Sobreposição' },
  },
};

export function getGame(id = 'genshin') {
  if (!Object.hasOwn(games, id)) throw new Error('Jogo desconhecido; use --game genshin ou hsr.');
  return games[id];
}