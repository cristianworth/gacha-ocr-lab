import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { readImage } from './image.js';
import { readWeapon } from './read-weapon.js';
import { saveResult, formatReview } from './result.js';
import { parseRectangle } from './regions.js';
import { writeVisualReview } from './review.js';
import { getGame } from './games.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `Uso: npm start -- "C:\\caminho\\arma.png" [--lang eng] [--offline]
  [--game genshin|hsr] [--layout auto|card|screenshot|text] [--panel left,top,width,height]

Uma imagem PNG/JPEG por execucao. O padrao e eng (ingles).
Jogos: genshin (padrao, armas) e hsr (Cones de Luz), ingles, perfil inicial 16:10.
Referencia inicial declarada: 1440x900 em ambos os jogos; PNG pode incluir bordas.
HSR exige --panel em capturas completas; modo text nao e suportado.
Auto: painel explicito => screenshot; imagem estreita => card; demais => OCR geral text.
Screenshot exige --panel do cartao inteiro, em pixels da imagem original.
Text preserva o OCR geral, sem prometer extrair a arma selecionada de uma lista.
Resultado JSON: data/results/; revisao visual: data/reviews/; modelos: .cache/models/.
Primeiro uso requer internet para modelos; --offline impede o download.
Codigos: 0 = resultado salvo, mesmo incompleto; 1 = falha; 2 = argumentos invalidos.`;
let parsed;
let panel;
try {
  parsed = parseArgs({ options: {
    game: { type: 'string', default: 'genshin' }, lang: { type: 'string', default: 'eng' }, offline: { type: 'boolean', default: false },
    layout: { type: 'string', default: 'auto' }, panel: { type: 'string' }, help: { type: 'boolean', short: 'h' },
  }, allowPositionals: true, strict: true });
  if (!parsed.values.help) {
    getGame(parsed.values.game);
    if (parsed.values.game === 'hsr' && parsed.values.lang !== 'eng') throw new Error('HSR e validado apenas em ingles; use --lang eng.');
    if (parsed.values.game === 'hsr' && parsed.values.layout === 'text') throw new Error('HSR nao suporta --layout text nesta etapa.');
    if (parsed.values.game === 'hsr' && ['auto', 'screenshot'].includes(parsed.values.layout) && !parsed.values.panel) throw new Error('HSR exige --panel para capturas; para painel ja recortado, use --layout card.');
    if (parsed.positionals.length !== 1 || !/^(?:por|eng)(?:\+(?:por|eng))?$/u.test(parsed.values.lang)) throw new Error('Informe exatamente uma imagem e use --lang por, eng ou por+eng.');
    if (!['auto', 'card', 'screenshot', 'text'].includes(parsed.values.layout)) throw new Error('--layout invalido.');
    panel = parsed.values.panel ? parseRectangle(parsed.values.panel) : undefined;
    if (panel && ['card', 'text'].includes(parsed.values.layout)) throw new Error('--panel nao combina com --layout card/text.');
    if (parsed.values.layout === 'screenshot' && !panel) throw new Error('--layout screenshot exige --panel.');
  }
} catch (error) { console.error(`${error.message}\n\n${usage}`); process.exit(2); }
if (parsed.values.help) console.log(usage);
else {
  try {
    const image = await readImage(parsed.positionals[0]);
    console.error('Executando OCR local...');
    const result = await readWeapon(image, { game: parsed.values.game, languages: [...new Set(parsed.values.lang.split('+'))].join('+'),
      cachePath: resolve(root, '.cache/models'), offline: parsed.values.offline, layout: parsed.values.layout, panel });
    const runId = `${new Date().toISOString().replace(/[:.]/gu, '-')}-${randomUUID()}`;
    result.artifacts = await writeVisualReview(result, image.buffer, resolve(root, 'data/reviews', runId));
    console.log(formatReview(result));
    const outputPath = await saveResult(result, resolve(root, 'data/results'));
    console.log(`\nResultado salvo em: ${outputPath}`);
    console.log(`Revisao visual: ${result.artifacts.reviewMarkdown}`);
    if (result.processing.method === 'whole-image') console.log('Para ler a arma selecionada da tela completa, informe --panel com o cartao inteiro.');
  } catch (error) { process.stderr.write(`Erro: ${error.message}\n`, () => process.exit(1)); }
}
