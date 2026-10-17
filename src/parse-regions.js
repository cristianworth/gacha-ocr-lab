export function normalizeName(text) {
  return text.normalize('NFC').replace(/[“”]/gu, '"').replace(/[‘’]/gu, "'").replace(/\s+/gu, ' ').trim();
}

function parseValue(field, rawText) {
  const text = normalizeName(rawText);
  if (!text) return null;
  if (field === 'name') {
    return text.length <= 120 && /\p{L}/u.test(text) && /^[\p{L}\p{M}\d '\-",.!?:]+$/u.test(text)
      ? text : null;
  }
  if (field === 'weaponType') {
    return /^(?:sword|claymore|polearm|bow|catalyst|espada|espad[aã]o|lan[cç]a|arco|catalisador)$/iu.test(text) ? text : null;
  }
  if (field === 'level') {
    const match = text.match(/^(?:lv\.?|level|n[ií]vel|n[ií]?v\.?)\s*[:.]?\s*(\d{1,2})(?:\s*\/\s*(\d{1,2}))?$/iu);
    if (!match) return null;
    const current = Number(match[1]);
    const max = match[2] === undefined ? null : Number(match[2]);
    return current >= 1 && current <= 90 && (max === null || (max >= current && max <= 90)) ? { current, max } : null;
  }
  const match = text.match(/^(?:refinement\s+rank|(?:rank|grau)\s+de\s+refinamento|refinamento)\s*:?\s*([1-5])$/iu);
  return match ? Number(match[1]) : null;
}

export function interpretRegion(field, region, layoutVerified = true) {
  const candidates = region.attempts.map((attempt) => {
    const value = parseValue(field, attempt.rawText);
    return { value, valid: value !== null, method: 'field-region', evidence: [{ region: field, attempt: attempt.id, rawText: attempt.rawText, rectangle: region.rectangle }] };
  });
  const values = new Map();
  for (const item of candidates.filter((item) => item.valid)) {
    const key = JSON.stringify(item.value);
    values.set(key, (values.get(key) ?? 0) + 1);
  }
  const nonempty = region.attempts.some((attempt) => attempt.rawText.trim());
  const recognized = layoutVerified && values.size === 1 && Math.max(...values.values()) >= 2;
  return {
    status: !nonempty ? 'absent' : recognized ? 'recognized' : 'uncertain',
    value: recognized ? candidates.find((item) => item.valid).value : null,
    candidates,
    reason: !nonempty ? 'Nenhum texto na regiao selecionada.'
      : !layoutVerified ? 'Tipo de arma nao confirmado; confira se o painel/perfil esta correto.'
        : recognized ? 'Duas leituras de tratamentos fixos concordam; ainda exige revisao humana.'
          : 'Leituras conflitantes, invalidas ou sem concordancia suficiente; confira a imagem.',
  };
}

export function interpretRegions(regions) {
  const layoutVerified = regions.weaponType.attempts.some((attempt) => parseValue('weaponType', attempt.rawText) !== null);
  return { layoutVerified, fields: Object.fromEntries(['name', 'level', 'refinement'].map((field) => [field, interpretRegion(field, regions[field], layoutVerified)])) };
}
