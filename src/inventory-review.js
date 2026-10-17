import { writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

function escape(value) {
  return String(value ?? '').replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;').replace(/'/gu, '&#39;');
}

function localUrl(directory, target) {
  if (typeof target !== 'string' || !target || /[\u0000-\u001f]/u.test(target)
      || (!isAbsolute(target) && /^[a-z][\da-z+.-]*:/iu.test(target))) return null;
  const path = relative(directory, resolve(directory, target));
  if (!path || isAbsolute(path) || path === '..' || path.startsWith(`..${sep}`)) return null;
  return path.split(sep).map((segment) => encodeURIComponent(segment)).join('/');
}

function link(directory, path, label, image = false) {
  const url = localUrl(directory, path);
  if (!url) return `<span>${escape(label)} indisponível: caminho fora da sessão ou inválido.</span>`;
  return `<a href="${escape(url)}">${image ? `<img loading="lazy" src="${escape(url)}" alt="${escape(label)}">` : escape(label)}</a>`;
}

function json(value) { return `<pre>${escape(JSON.stringify(value ?? null, null, 2))}</pre>`; }

function fieldSummary(fields) {
  const rows = [['name', 'Nome'], ['level', 'Nível'], ['refinement', 'Refinamento']].map(([key, label]) => {
    const field = fields?.[key];
    let value = field?.value ?? '—';
    if (key === 'level' && Number.isInteger(value?.current)) {
      value = value.max === null ? String(value.current) : `${value.current}/${value.max}`;
    } else if (typeof value === 'object') value = JSON.stringify(value);
    return `<dt>${label}</dt><dd>${escape(value)} · ${escape(field?.status ?? 'ausente')}</dd>`;
  });
  return `<dl>${rows.join('')}</dl>`;
}

export async function writeSessionReview(session) {
  const { manifest, directory } = session;
  const observations = manifest.observations;
  const count = (status) => observations.filter((observation) => observation.status === status).length;
  const pendingOcr = observations.filter(observation => observation.status !== 'excluded' && ['name', 'level', 'refinement'].some(field => observation.fields?.[field]?.status !== 'recognized'));
  const failures = observations.filter((observation) => observation.status === 'failed' || observation.error).length;
  const lines = [
    '<!doctype html><html lang="pt-BR"><meta charset="utf-8">',
    '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src \'self\'; style-src \'unsafe-inline\'">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Revisão local do inventário</title>',
    '<style>body{font:16px system-ui;max-width:1100px;margin:2rem auto;padding:0 1rem;background:#121722;color:#e8edf5}a{color:#8bcaff}article{border:1px solid #536075;padding:1rem;margin:1rem 0}img{max-width:100%;max-height:600px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#202937;padding:1rem}dt{font-weight:bold}dd{margin-bottom:.5rem}</style>',
    '<body><h1>Conferência do inventário Genshin</h1>',
    '<p><strong>Revisão humana pendente.</strong> Reconhecimento e cobertura não são aprovação. Nenhum dado é aplicado à conta.</p>',
    `<p>Sessão: ${escape(manifest.id)}</p>`,
    `<p>Incluídos: ${count('included')} · Excluídos: ${count('excluded')} · Raridade incerta: ${count('scope-uncertain')} · Falhas: ${failures}</p>`,
    `<p>Pendências de OCR: ${pendingOcr.length}. ${pendingOcr.map(observation => `<a href="#item-${escape(observation.id)}">Observação ${escape(observation.ordinal)}</a>`).join(' · ')}</p>`,
    `<dl><dt>Estado</dt><dd>${escape(manifest.status)}</dd><dt>Cobertura</dt><dd>${escape(manifest.coverage?.status)} ${escape(manifest.coverage?.reason)}</dd>`,
    `<dt>Captura completa</dt><dd>${manifest.captureComplete === true ? 'Sim' : 'Não'}</dd><dt>Processamento completo</dt><dd>${manifest.processingComplete === true ? 'Sim' : 'Não'}</dd>`,
    `<dt>Término</dt><dd>${escape(manifest.termination?.reason ?? 'Sessão em andamento')}</dd><dt>Erro geral</dt><dd>${escape(manifest.termination?.error)}</dd></dl>`,
    '<p><a href="inventory.json">JSON diagnóstico da sessão</a>. Capturas e JSONs de cada observação estão abaixo, incluindo pendências e exclusões.</p>',
  ];
  for (const [label, path] of [
    ['Captura inicial', manifest.initialCapture], ['Prévia do diagnóstico', manifest.preview], ['Último diagnóstico', manifest.lastDiagnostic?.path],
  ]) {
    if (path) lines.push(`<figure><figcaption>${escape(label)}</figcaption>${link(directory, path, label, true)}</figure>`);
  }
  if (manifest.lastDiagnostic?.reason) lines.push(`<p>Diagnóstico: ${escape(manifest.lastDiagnostic.reason)}</p>`);
  for (const observation of observations) {
    lines.push(`<article id="item-${escape(observation.id)}"><h2>Observação ${escape(observation.ordinal)} · ${escape(observation.status)}</h2>`,
      `<p>Identificador: ${escape(observation.id)}</p>`, fieldSummary(observation.fields),
      `<p>${link(directory, observation.capture?.path, 'Captura original', true)}</p>`,
      `<p>${link(directory, observation.resultPath, 'JSON diagnóstico do OCR')}</p>`,
      '<details><summary>Evidências brutas, posição e raridade</summary>', json({ position: observation.position, rarity: observation.rarity, fields: observation.fields }), '</details>',
      `<p>Falha: ${escape(typeof observation.error === 'object' ? JSON.stringify(observation.error) : observation.error)}</p></article>`);
  }
  lines.push('<p>Confira cada imagem e os três campos. O comando de revisão registra confirmação/correção em arquivo separado; esta página não altera o inventário.</p></body></html>');
  const path = join(directory, 'review.html');
  await writeFile(path, lines.join('\n'), 'utf8');
  return path;
}
