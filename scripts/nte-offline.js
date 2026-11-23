import { parseArgs } from 'node:util';
import { resolve, relative, isAbsolute } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { readImage } from '../src/image.js';
import { parseRectangle } from '../src/regions.js';
import { readNteOffline } from '../src/nte-offline.js';

try {
  const { values, positionals } = parseArgs({ options: { panel: { type: 'string' }, output: { type: 'string' }, models: { type: 'string', default: '.cache/models' } }, allowPositionals: true, strict: true });
  if (positionals.length !== 1 || !values.panel || !values.output) throw new Error('Uso: node scripts/nte-offline.js imagem.png --panel left,top,348,496 --output .cache/nte/nome [--models .cache/models]');
  const outputRoot = resolve('.cache/nte');
  const output = resolve(values.output);
  const relativeOutput = relative(outputRoot, output);
  if (!relativeOutput || relativeOutput.startsWith('..') || isAbsolute(relativeOutput)) throw new Error('Use uma pasta propria dentro de .cache/nte.');
  const result = await readNteOffline(await readImage(positionals[0]), { panel: parseRectangle(values.panel), cachePath: resolve(values.models), outputDir: output });
  await writeFile(resolve(values.output, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(`Erro: ${error.message}`); process.exitCode = 1; }
