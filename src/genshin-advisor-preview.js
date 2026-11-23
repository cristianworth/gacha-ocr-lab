import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { buildGenshinReviewExport } from './genshin-review-export.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sections = [
  ['Owned 5-star weapons', '| Weapon | Signature association | Copies recorded | Refinement per copy |'],
  ['Snezhnaya Battle Pass weapons', '| Weapon | Ownership |'],
];

// These are candidate rows, not persistent weapon identities.
export function advisorWeaponRows(markdown) {
  const genshin = markdown.split(/^## Genshin Impact\s*$/m)[1]?.split(/^## /m)[0];
  if (!genshin) throw new Error('Seção Genshin do Advisor não encontrada.');
  return sections.flatMap(([heading, header]) => {
    const section = genshin.split(`#### ${heading}`)[1]?.split(/^#### /m)[0];
    const lines = section?.split(/\r?\n/) ?? [];
    const start = lines.indexOf(header);
    if (start < 0 || !/^\|[\s:|-]+\|$/.test(lines[start + 1] ?? '')) throw new Error(`Tabela Advisor incompatível: ${heading}.`);
    const rows = [];
    for (let index = start + 2; index < lines.length && lines[index].startsWith('|'); index++) {
      const cells = lines[index].split('|').slice(1, -1).map(cell => cell.trim());
      if (cells.length !== (heading === 'Owned 5-star weapons' ? 4 : 2) || !cells[0]) throw new Error('Linha Advisor incompatível.');
      rows.push({ section: heading, line: lines[index], name: cells[0] });
    }
    if (!rows.length) throw new Error(`Tabela Advisor vazia: ${heading}.`);
    return rows;
  });
}

export async function buildGenshinAdvisorPreview({ sessionBytes, reviewBytes, rarityBytes, structuredBytes, advisorBytes, readCapture }) {
  const review = buildGenshinReviewExport({ sessionBytes, reviewBytes, rarityBytes });
  if (!isDeepStrictEqual(JSON.parse(structuredBytes.toString('utf8')), JSON.parse(JSON.stringify(review)))) throw new Error('Saída estruturada diverge das entradas vinculadas.');
  const rows = advisorWeaponRows(advisorBytes.toString('utf8'));
  const observations = [];
  for (const observation of review.observations) {
    const capture = observation.capture;
    if (!capture?.path || !capture.sha256 || sha256(await readCapture(capture.path)) !== capture.sha256) throw new Error(`Captura divergente na posição ${observation.number}.`);
    const name = observation.fields.name;
    const names = new Set();
    if (typeof name.humanReview?.value === 'string') names.add(name.humanReview.value);
    if (name.observed?.status === 'recognized' && typeof name.observed.value === 'string') names.add(name.observed.value);
    for (const candidate of name.observed?.candidates ?? []) if (typeof candidate.value === 'string') names.add(candidate.value);
    observations.push({ ...observation, candidateRows: rows.filter(row => names.has(row.name)) });
  }
  return { source: { ...review.source, structuredSha256: sha256(structuredBytes), advisorSha256: sha256(advisorBytes) },
    scope: review.scope, reason: review.reason, observations, advisorRows: rows };
}

const inline = value => JSON.stringify(value ?? null).replaceAll('|', '\\|');
export function renderGenshinAdvisorPreview(preview) {
  const lines = ['# Prévia local Genshin para revisão', '',
    'Nenhuma alteração proposta automaticamente. Correspondências por nome são somente candidatas; cópias não têm identidade compartilhada. Ausência não remove fatos. OCR reconhecido não é aprovação humana.', '',
    `Fontes SHA-256: ${inline(preview.source)}`, `Escopo da sessão: ${inline(preview.scope)}; parada: ${inline(preview.reason)}.`,
    'Os campos completos, candidatos, OCR bruto e recortes permanecem no JSON estruturado identificado acima; os hashes das capturas foram conferidos.', '',
    '## Observações da sessão', '',
    '| Posição | Captura SHA-256 | Elegibilidade original | Nome | Nível | Refinamento | Raridade | Linhas candidatas do Advisor |',
    '|---|---|---|---|---|---|---|---|'];
  const field = item => inline({ observed: item.observed && { status: item.observed.status, value: item.observed.value, candidates: item.observed.candidates?.map(candidate => candidate.value) }, humanReview: item.humanReview });
  for (const item of preview.observations) lines.push(`| ${item.number} | ${item.capture.sha256} | ${item.levelEligibilityFromSession ?? 'pendente'} | ${field(item.fields.name)} | ${field(item.fields.level)} | ${field(item.fields.refinement)} | ${field(item.fields.rarity)} | ${item.candidateRows.length ? item.candidateRows.map(row => `${row.section}: ${row.line.replaceAll('|', '\\|')}`).join('<br>') : 'Sem linha candidata nas duas tabelas; posse e correspondência pendentes'} |`);
  lines.push('', '## Linhas existentes consultadas', '', 'Todas as linhas abaixo são preservadas, inclusive as sem observação correspondente. O inventário não foi aprovado.', '');
  for (const row of preview.advisorRows) lines.push(`- ${row.section}: ${row.line}`);
  return lines.join('\n') + '\n';
}
