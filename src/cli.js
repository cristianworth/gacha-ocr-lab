import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readImage } from './image.js';
import { recognizeImage } from './ocr.js';
import { parseWeapon } from './parse-weapon.js';
import { saveResult, formatReview } from './result.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = `Uso: npm start -- "C:\\caminho\\arma.png" [--lang eng] [--offline]

Uma imagem PNG/JPEG por execucao. O padrao e eng (ingles). Referencia atual: Genshin Impact em 1440x900.
Resultado JSON: data/results/; modelos: .cache/models/ (relativos ao projeto).
Primeiro uso requer internet para baixar modelos; a imagem e processada localmente.
--offline exige os modelos ja presentes e impede seu download.
Codigos de saida: 0 = resultado salvo, mesmo incompleto; 1 = falha; 2 = argumentos invalidos.`;

let parsed;
try {
  parsed = parseArgs({ options: { lang: { type: 'string', default: 'eng' }, offline: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h' } }, allowPositionals: true, strict: true });
  if (!parsed.values.help && (parsed.positionals.length !== 1 || !/^(?:por|eng)(?:\+(?:por|eng))?$/u.test(parsed.values.lang))) {
    throw new Error('Informe exatamente uma imagem e use --lang por, eng ou por+eng.');
  }
} catch (error) {
  console.error(`${error.message}\n\n${usage}`);
  process.exit(2);
}

if (parsed.values.help) {
  console.log(usage);
} else {
  try {
    const image = await readImage(parsed.positionals[0]);
    console.error('Executando OCR local. O primeiro uso pode baixar modelos de idioma...');
    const ocr = await recognizeImage(image.buffer, {
      languages: [...new Set(parsed.values.lang.split('+'))].join('+'),
      cachePath: resolve(root, '.cache/models'), offline: parsed.values.offline,
    });
    const result = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      source: image.source,
      ocr,
      fields: parseWeapon(ocr.rawText),
      requiresManualReview: true,
    };
    console.log(formatReview(result));
    const outputPath = await saveResult(result, resolve(root, 'data/results'));
    console.log(`\nResultado salvo em: ${outputPath}`);
  } catch (error) {
    // Initialization failures can leave a library worker pending; this one-shot CLI must exit.
    process.stderr.write(`Erro: ${error.message}\n`, () => process.exit(1));
  }
}
