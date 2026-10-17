import { parseArgs } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createFeedback } from '../src/feedback.js';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { values, positionals } = parseArgs({ options: { 'confirm-all': { type: 'boolean', default: false }, name: { type: 'string' }, level: { type: 'string' }, refinement: { type: 'string' }, reviewer: { type: 'string' } }, allowPositionals: true });
  if (positionals.length !== 1) throw new Error('Informe o caminho de um resultado JSON.');
  const resultPath = resolve(positionals[0]);
  const feedback = createFeedback(await readFile(resultPath), { confirmAll: values['confirm-all'], ...values });
  const outputDir = resolve(root, 'data/feedback');
  await mkdir(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, `${randomUUID()}.json`);
  await writeFile(outputPath, `${JSON.stringify({ ...feedback, resultPath }, null, 2)}\n`, { flag: 'wx' });
  console.log(`Revisao registrada separadamente: ${outputPath}`);
} catch (error) { console.error(`Erro: ${error.message}`); process.exitCode = 1; }
