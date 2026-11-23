import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { buildGenshinAdvisorPreview, renderGenshinAdvisorPreview } from '../src/genshin-advisor-preview.js';

const { values } = parseArgs({ options: Object.fromEntries(['session', 'review', 'rarity', 'structured', 'advisor'].map(name => [name, { type: 'string' }])), strict: true });
if (['session', 'review', 'rarity', 'structured', 'advisor'].some(name => !values[name])) throw new Error('Informe --session, --review, --rarity, --structured e --advisor.');
const [sessionBytes, reviewBytes, rarityBytes, structuredBytes, advisorBytes] = await Promise.all(['session', 'review', 'rarity', 'structured', 'advisor'].map(name => readFile(values[name])));
const preview = await buildGenshinAdvisorPreview({ sessionBytes, reviewBytes, rarityBytes, structuredBytes, advisorBytes, readCapture: readFile });
console.log(renderGenshinAdvisorPreview(preview));
