import { normalizeName } from './parse-regions.js';

function parseValue(field, rawText) {
  const text = normalizeName(rawText);
  if (!text) return null;
  if (field === 'name') {
    return text.length <= 120 && /\p{L}/u.test(text) && /^[\p{L}\p{M}\d '\-",.!?:]+$/u.test(text) ? text : null;
  }
  if (field === 'path') {
    return /^The following effects only work on characters of the Path of [A-Za-z]+(?:[ -][A-Za-z]+)*\.$/iu.test(text) ? text : null;
  }
  if (field === 'level') {
    const match = text.match(/^Lv\.?\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?$/iu);
    if (!match) return null;
    const current = Number(match[1]);
    const max = match[2] === undefined ? null : Number(match[2]);
    return current >= 1 && current <= 80 && (max === null || (max >= current && max <= 80)) ? { current, max } : null;
  }
  const match = text.match(/^Superimposition\s+([1-5])$/iu);
  return match ? Number(match[1]) : null;
}

function interpretField(field, region, layoutVerified) {
  const attempts = region?.attempts ?? [];
  const candidates = attempts.map((attempt) => {
    const value = parseValue(field, attempt.rawText);
    return {
      value, valid: value !== null, method: 'field-region',
      evidence: [{ region: field, attempt: attempt.id, rawText: attempt.rawText, rectangle: region.rectangle }],
    };
  });
  const counts = new Map();
  for (const candidate of candidates.filter((item) => item.valid)) {
    const key = JSON.stringify(candidate.value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const nonempty = attempts.some((attempt) => attempt.rawText.trim());
  const recognized = layoutVerified && counts.size === 1 && Math.max(...counts.values()) >= 2;
  return {
    status: !nonempty ? 'absent' : recognized ? 'recognized' : 'uncertain',
    value: recognized ? candidates.find((item) => item.valid).value : null,
    candidates,
    reason: !nonempty ? 'Nenhum texto na regiao selecionada.'
      : !layoutVerified ? 'Frase de restricao de Caminho nao confirmada; confira o painel/perfil de Cone de Luz.'
        : recognized ? 'Duas leituras de tratamentos fixos concordam; ainda exige revisao humana.'
          : 'Leituras conflitantes, invalidas ou sem concordancia suficiente; confira a imagem.',
  };
}

export function interpretHsrRegions(regions) {
  // The complete path restriction is an anchor, not an additional inventory field.
  const layoutVerified = (regions.path?.attempts ?? []).some((attempt) => parseValue('path', attempt.rawText) !== null);
  return {
    layoutVerified,
    fields: Object.fromEntries(['name', 'level', 'superimposition'].map((field) => [field, interpretField(field, regions[field], layoutVerified)])),
  };
}
