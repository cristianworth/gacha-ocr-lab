import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { buildGenshinReviewExport } from '../src/genshin-review-export.js';

const { values } = parseArgs({ options: { session: { type: 'string' }, review: { type: 'string' }, rarity: { type: 'string' } }, strict: true });
if (!values.session) throw new Error('Use --session session.json [--review revisão.json] [--rarity análise.json].');
const output = buildGenshinReviewExport({ sessionBytes: await readFile(values.session),
  reviewBytes: values.review ? await readFile(values.review) : null, rarityBytes: values.rarity ? await readFile(values.rarity) : null });
console.log(JSON.stringify(output, null, 2));
