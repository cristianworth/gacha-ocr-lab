import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { buildGenshinAdvisorPreview, renderGenshinAdvisorPreview } from '../src/genshin-advisor-preview.js';

const { values } = parseArgs({ options: Object.fromEntries(['session', 'review', 'rarity', 'structured', 'advisor'].map(name => [name, { type: 'string' }])), strict: true });
if (['session', 'structured', 'advisor'].some(name => !values[name])) throw new Error('Informe --session, --structured e --advisor; --review e --rarity são opcionais.');
const [sessionBytes, reviewBytes, rarityBytes, structuredBytes, advisorBytes] = await Promise.all(['session', 'review', 'rarity', 'structured', 'advisor'].map(name => values[name] ? readFile(values[name]) : null));
const preview = await buildGenshinAdvisorPreview({ sessionBytes, reviewBytes, rarityBytes, structuredBytes, advisorBytes, readCapture: readFile });
console.log(renderGenshinAdvisorPreview(preview, { structuredPath: values.structured }));
