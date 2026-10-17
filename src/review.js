import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareRegion, fieldVariants } from './regions.js';

export const fieldLabels = { name: 'Nome', level: 'Nível', refinement: 'Refinamento' };
export function markdownCell(value) {
  return String(value ?? '—').replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;').replace(/\|/gu, '&#124;').replace(/[\r\n]+/gu, ' ');
}

export async function writeVisualReview(result, original, directory) {
  await mkdir(directory, { recursive: true });
  const paths = { reviewMarkdown: join(directory, 'review.md') };
  const lines = ['# Conferência da leitura', '', 'Status: **aguarda revisão humana**. Este documento não aprova nem importa dados.', '',
    `Origem: ${markdownCell(result.source.path)}`, `SHA-256 da imagem: ${result.source.sha256}`, '',
    '| Campo | Valor interpretado | Estado |', '|---|---|---|'];
  for (const field of ['name', 'level', 'refinement']) {
    lines.push(`| ${fieldLabels[field]} | ${markdownCell(JSON.stringify(result.fields[field].value))} | ${result.fields[field].status} |`);
  }
  if (result.processing.method === 'field-regions') {
    paths.panelImage = join(directory, 'panel.png');
    paths.overviewImage = join(directory, 'overview.png');
    const panel = result.processing.panel;
    await sharp(original).extract(panel).png().toFile(paths.panelImage);
    const bottom = Math.min(panel.height, Math.max(...Object.values(result.processing.regions).map((box) => box.top - panel.top + box.height)) + 12);
    const scale = 2;
    const width = panel.width * scale;
    const height = bottom * scale + 54;
    const image = await sharp(original).extract({ ...panel, height: bottom }).resize({ width }).png().toBuffer();
    const colors = { name: '#22c55e', level: '#38bdf8', refinement: '#f97316' };
    const rectangles = Object.entries(colors).map(([field, color]) => {
      const box = result.processing.regions[field];
      return `<rect x="${(box.left - panel.left) * scale}" y="${(box.top - panel.top) * scale + 54}" width="${box.width * scale}" height="${box.height * scale}" fill="none" stroke="${color}" stroke-width="3"/>`;
    }).join('');
    const svg = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="54" fill="#101827"/><text x="12" y="34" font-family="Arial" font-size="22"><tspan fill="#22c55e">Nome</tspan><tspan dx="35" fill="#38bdf8">Nivel</tspan><tspan dx="35" fill="#f97316">Refinamento</tspan></text>${rectangles}</svg>`);
    await sharp({ create: { width, height, channels: 3, background: '#101827' } }).composite([{ input: image, top: 54, left: 0 }, { input: svg, top: 0, left: 0 }]).png().toFile(paths.overviewImage);
    lines.push('', '![Regiões selecionadas](overview.png)', '', 'As caixas mostram o que foi lido; o conteúdo original não foi corrigido ou redesenhado.', '');
    paths.regions = {};
    const diagnosticFields = ['name', 'level', 'refinement'];
    if (result.ocr.regions.weaponType) diagnosticFields.push('weaponType');
    for (const field of diagnosticFields) {
      const region = result.ocr.regions[field];
      const originalPath = join(directory, `${field}-original.png`);
      const processedPath = join(directory, `${field}-processed.png`);
      await sharp(original).extract(region.rectangle).png().toFile(originalPath);
      const prepared = await prepareRegion(original, region.rectangle, fieldVariants[field][0]);
      await writeFile(processedPath, prepared.buffer, { flag: 'wx' });
      paths.regions[field] = { originalImage: originalPath, processedImage: processedPath };
      lines.push(`## ${fieldLabels[field] ?? 'Tipo de arma (diagnóstico do perfil)'}`, '', `![Texto original](${field}-original.png)`, '', `![Primeiro tratamento](${field}-processed.png)`, '', '| Tentativa | Texto bruto | Confiança OCR |', '|---|---|---|');
      for (const attempt of region.attempts) lines.push(`| ${attempt.id} | ${markdownCell(attempt.rawText)} | ${attempt.confidence ?? '—'} |`);
      lines.push('', field === 'weaponType'
        ? 'Este rótulo identifica o cartão de arma e condiciona a aceitação dos três campos. Não é um quarto campo do resultado nem uma aprovação humana.'
        : result.fields[field].reason, '');
    }
  } else {
    lines.push('', 'OCR geral: não foi selecionado um cartão. Para a tela de inventário, use um painel explícito.', '', '## Texto bruto', '', '```text', result.ocr.rawText.replace(/```/gu, "'''"), '```');
  }
  lines.push('', '## Como responder', '', 'Confira os três campos na imagem e informe "os três conferem" ou a correção de cada campo. Se não der para ler, diga "ilegível". Não confirme pela confiança do OCR.', '',
    'A confirmação será salva em arquivo separado, vinculado ao hash deste resultado, sem modificar o diagnóstico original. Não há atualização automática do Advisor.', '');
  await writeFile(paths.reviewMarkdown, lines.join('\n'), { encoding: 'utf8', flag: 'wx' });
  return paths;
}
