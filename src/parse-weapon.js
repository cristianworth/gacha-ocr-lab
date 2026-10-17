const levelLabel = /\b(?:lv\.?|level|n[ií]vel|n[ií]?v\.?)(?!\p{L})/giu;
const refinementLabel = /\b(?:refinement\s+rank|refinement|(?:grau|rank)\s+de\s+refinamento|refinamento)(?!\p{L})/giu;
const weaponType = /^(?:sword|claymore|polearm|bow|catalyst|espada|espad[aã]o|lan[cç]a|arco|catalisador)$/iu;
const nameLabel = /^(?:weapon\s+name|nome\s+da\s+arma)\s*:\s*(.*)$/iu;
const menuOrStat = /^(?:details|attributes|enhance|refine|switch|weapons?|detalhes|atributos|fortalecer|refinar|trocar|armas?|base\s+atk|atk\s+b[aá]sico|crit|taxa|dano|hp|def|equipped|equipad[ao])\b/iu;

function candidate(value, lines, method, valid = true) {
  return { value, evidence: lines.map(({ number, text }) => ({ line: number, text })), method, valid };
}

function decide(candidates, weak = false) {
  if (candidates.length === 0) {
    return { status: 'absent', value: null, candidates: [], reason: 'Nenhuma evidencia textual encontrada.' };
  }
  const values = new Set(candidates.filter((item) => item.valid).map((item) => JSON.stringify(item.value)));
  const recognized = !weak && values.size === 1 && candidates.every((item) => item.valid);
  return {
    status: recognized ? 'recognized' : 'uncertain',
    value: recognized ? candidates[0].value : null,
    candidates,
    reason: recognized
      ? 'Padrao textual explicito e sem conflito; confira na imagem.'
      : weak ? 'Nome sugerido pela linha anterior ao tipo de arma; posicao nao validada.'
        : 'Rotulo incompleto, valor ilegivel/invalido ou evidencias conflitantes.',
  };
}

function readLabeledNumbers(lines, label, field) {
  const candidates = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const match of line.text.matchAll(label)) {
      let suffix = line.text.slice(match.index + match[0].length).replace(/^\s*[:.]?\s*/, '');
      const evidence = [line];
      if (!suffix && lines[index + 1]) {
        suffix = lines[index + 1].text;
        evidence.push(lines[index + 1]);
      }
      const tokens = suffix.match(/^([^\s/]+)(?:\s*\/\s*([^\s]+))?/u);
      const currentToken = tokens?.[1];
      const maxToken = tokens?.[2];
      const numeric = /^\d{1,3}$/u.test(currentToken ?? '');
      if (field === 'level') {
        const value = numeric ? { current: Number(currentToken), max: maxToken && /^\d{1,3}$/u.test(maxToken) ? Number(maxToken) : null } : null;
        const slashPresent = suffix.includes('/');
        const valid = Boolean(value && value.current >= 1 && value.current <= 90
          && (!slashPresent || (value.max >= value.current && value.max <= 90)));
        candidates.push(candidate(value, evidence, 'level-label', valid));
      } else {
        const value = numeric ? Number(currentToken) : null;
        candidates.push(candidate(value, evidence, 'refinement-label', value >= 1 && value <= 5 && !suffix.includes('/')));
      }
    }
  }
  return decide(candidates);
}

export function parseWeapon(rawText) {
  const lines = rawText.split(/\r?\n/u).map((text, index) => ({ number: index + 1, text: text.trim() })).filter((line) => line.text);
  const explicitNames = [];
  const positionalNames = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const labeled = line.text.match(nameLabel);
    if (labeled) {
      explicitNames.push(candidate(labeled[1] || null, [line], 'name-label', /\p{L}/u.test(labeled[1])));
    }
    const previous = lines[index - 1];
    if (weaponType.test(line.text) && previous && /\p{L}/u.test(previous.text)
        && !/[\d:%/]/u.test(previous.text) && !menuOrStat.test(previous.text)
        && !weaponType.test(previous.text)) {
      positionalNames.push(candidate(previous.text, [previous, line], 'before-weapon-type'));
    }
  }
  return {
    name: explicitNames.length ? decide(explicitNames) : decide(positionalNames, true),
    level: readLabeledNumbers(lines, levelLabel, 'level'),
    refinement: readLabeledNumbers(lines, refinementLabel, 'refinement'),
  };
}
