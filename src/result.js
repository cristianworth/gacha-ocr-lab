import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export async function saveResult(result, directory) {
  await mkdir(directory, { recursive: true });
  const stamp = result.createdAt.replace(/[:.]/gu, '-');
  const path = join(directory, `${stamp}-${randomUUID()}.json`);
  await writeFile(path, `${JSON.stringify(result, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  return path;
}

export function formatReview(result) {
  const labels = { name: 'Nome', level: 'Nivel', refinement: 'Refinamento' };
  const states = { recognized: 'reconhecido', absent: 'ausente', uncertain: 'incerto' };
  const lines = ['--- Texto bruto do OCR ---', result.ocr.rawText || '(nenhum texto)', '--- Campos interpretados ---'];
  if (result.ocr.imageSize) lines.unshift(`Imagem: ${result.ocr.imageSize.width}x${result.ocr.imageSize.height} pixels.`);
  for (const [key, field] of Object.entries(result.fields)) {
    lines.push(`${labels[key]} [${states[field.status]}]: ${JSON.stringify(field.value)}`);
    for (const item of field.candidates) {
      const evidence = item.evidence.map((entry) => entry.region ? `${entry.region}/${entry.attempt}: ${entry.rawText.trim()}` : `linha ${entry.line}: ${entry.text}`).join(' / ');
      lines.push(`  Candidato: ${JSON.stringify(item.value)} | evidencia: ${evidence}`);
    }
    lines.push(`  ${field.reason}`);
  }
  lines.push(result.ocr.regions ? 'Confianca por tentativa fica no JSON; nao mede a correcao dos campos.'
    : `Confianca global do OCR: ${result.ocr.confidence ?? 'indisponivel'} / 100 (nao mede a correcao dos campos).`);
  lines.push('Conferencia manual obrigatoria. Nenhum snapshot de conta foi atualizado.');
  return lines.join('\n');
}
