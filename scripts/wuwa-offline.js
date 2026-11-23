import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readImage } from '../src/image.js';
import { parseRectangle } from '../src/regions.js';
import { readWuwaOffline } from '../src/wuwa-offline.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { values, positionals } = parseArgs({ options: { client: { type: 'string' }, models: { type: 'string' } }, allowPositionals: true, strict: true });
  if (positionals.length !== 1) throw new Error('Uso: node scripts/wuwa-offline.js imagem.png [--client left,top,width,height] [--models pasta]');
  const image = await readImage(positionals[0]);
  const result = await readWuwaOffline(image, { client: values.client ? parseRectangle(values.client) : undefined, cachePath: resolve(values.models ?? resolve(root, '.cache/models')) });
  console.log(JSON.stringify(result, null, 2));
} catch (error) { console.error(`Erro: ${error.message}`); process.exitCode = 1; }
