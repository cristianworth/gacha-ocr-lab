import { parseArgs } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readImage } from '../src/image.js';
import { readGenshin1280, inspectGenshin1280Selection, inspectGenshin1280Selected } from '../src/genshin-1280.js';
import { parseRectangle } from '../src/regions.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { values, positionals } = parseArgs({ options: { client: { type: 'string' }, slot: { type: 'string' }, grid: { type: 'boolean', default: false } }, allowPositionals: true, strict: true });
  if (positionals.length !== 1) throw new Error('Uso: node scripts/genshin-offline.js imagem.png [--client left,top,1280,720] [--slot left,top,width,height]');
  const image = await readImage(positionals[0]);
  const client = values.client ? parseRectangle(values.client) : undefined;
  const result = await readGenshin1280(image, { client, cachePath: resolve(root, '.cache/models'), offline: true });
  if (values.slot) result.selection = await inspectGenshin1280Selection(image, { client, rectangle: parseRectangle(values.slot) });
  if (values.grid) result.gridInspection = await inspectGenshin1280Selected(image, { client });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(`Erro: ${error.message}`);
  process.exitCode = 1;
}
