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
    scope: review.scope, reason: review.reason, levelScopeComplete: review.levelScopeComplete,
    coverageConfirmed: review.coverageConfirmed, inventoryAccepted: review.inventoryAccepted, observations, advisorRows: rows };
}

const escape = value => String(value).replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/\r?\n/g, ' ');
const display = value => {
  if (value == null) return '—';
  if (typeof value === 'object' && 'current' in value && 'max' in value) return `${value.current}/${value.max}`;
  return String(value);
};
function fieldText(field, format = display) {
  const observed = field.observed;
  let automatic = 'Automático: sem leitura';
  if (observed) {
    if (observed.status === 'recognized') automatic = `Automático: ${format(observed.value)}`;
    else {
      const candidates = [...new Set((observed.candidates ?? []).map(candidate => format(candidate.value)).filter(value => value !== '—'))];
      automatic = `Incerto${observed.value != null ? `: ${format(observed.value)}` : ''}${candidates.length ? ` (candidatos: ${candidates.join(', ')})` : ''}`;
    }
  }
  const reviewed = field.humanReview;
  return escape(reviewed ? `${automatic}; confirmado por ${reviewed.reviewer} em ${reviewed.date}: ${format(reviewed.value)}` : automatic);
}

export function renderGenshinAdvisorPreview(preview, { structuredPath = null } = {}) {
  const lines = ['# Prévia local Genshin para revisão', '',
    'Correspondências por nome são somente candidatas; cópias não têm identidade compartilhada. Ausência não remove fatos. Leitura automática não é aprovação humana.', '',
    '## Escopo e indicadores originais', '',
    `- Nível mínimo: ${escape(preview.scope.minLevel)}; raridades: ${escape(preview.scope.rarities.join(', '))}.`,
    `- Motivo de parada: ${escape(preview.reason ?? 'não informado')}.`,
    `- Término por nível: ${preview.levelScopeComplete ? 'sim' : 'não'}; cobertura confirmada: ${preview.coverageConfirmed ? 'sim' : 'não'}; inventário aprovado: ${preview.inventoryAccepted ? 'sim' : 'não'}.`,
    '- Esses indicadores reproduzem a saída estruturada e não estabelecem cobertura adicional.', '',
    `Dados completos, OCR bruto e recortes: ${structuredPath ? `[JSON estruturado](<${structuredPath.replaceAll('\\', '/').replaceAll('>', '%3E')}>)` : 'JSON estruturado informado ao comando'} (SHA-256 na proveniência).`, '',
    '## Observações da sessão', '',
    'A elegibilidade é a classificação original da sessão; confirmações são específicas de cada campo.', '',
    '| Posição | Elegibilidade | Nome | Nível | Refinamento | Raridade | Advisor |',
    '|---|---|---|---|---|---|---|'];
  const labels = { 'eligible-level': 'dentro do corte', 'below-level': 'abaixo do corte' };
  for (const item of preview.observations) {
    const f = item.fields;
    lines.push(`| ${item.number} | ${escape(labels[item.levelEligibilityFromSession] ?? item.levelEligibilityFromSession ?? 'pendente')} | ${fieldText(f.name)} | ${fieldText(f.level)} | ${fieldText(f.refinement, value => value == null ? '—' : `R${value}`)} | ${fieldText(f.rarity, value => value == null ? '—' : `${value}★`)} | ${item.candidateRows.length ? `${item.candidateRows.length} linha(s) candidata(s)` : 'Sem linha candidata'} |`);
  }
  lines.push('', '## Linhas candidatas do Advisor', '', 'Uma linha pode ser candidata para mais de uma observação; nenhuma identifica uma cópia.', '');
  for (const item of preview.observations.filter(item => item.candidateRows.length)) {
    lines.push(`- Posição ${item.number}:`);
    for (const row of item.candidateRows) lines.push(`  - ${escape(row.section)}: ${escape(row.line)}`);
  }
  lines.push('', '## Linhas existentes consultadas', '', 'Todas as linhas abaixo são preservadas, inclusive as sem observação correspondente.', '');
  for (const row of preview.advisorRows) lines.push(`- ${escape(row.section)}: ${escape(row.line)}`);
  lines.push('', '## Proveniência', '', 'Os hashes das capturas foram conferidos; cada número identifica somente uma observação desta sessão.', '');
  for (const [name, hash] of Object.entries(preview.source)) lines.push(`- ${name}: ${hash ?? 'não informado'}`);
  lines.push('', '| Posição | Captura SHA-256 |', '|---|---|');
  for (const item of preview.observations) lines.push(`| ${item.number} | ${item.capture.sha256} |`);
  return lines.join('\n') + '\n';
}
