import { createHash } from 'node:crypto';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const parse = bytes => JSON.parse(bytes.toString('utf8'));

// This local review document is not an Advisor import or a GOOD export.
export function buildGenshinReviewExport({ sessionBytes, reviewBytes = null, rarityBytes = null }) {
  const session = parse(sessionBytes);
  const sessionSha256 = hash(sessionBytes);
  if (session.game !== 'genshin' || !Array.isArray(session.observations) || !session.scope || !Array.isArray(session.scope.rarities)) {
    throw new Error('Sessão Genshin incompatível.');
  }
  const review = reviewBytes ? parse(reviewBytes) : null;
  const rarity = rarityBytes ? parse(rarityBytes) : null;
  if (review && (review.game !== 'genshin' || review.session?.sha256 !== sessionSha256 || !Array.isArray(review.observations))) {
    throw new Error('Revisão não corresponde à sessão.');
  }
  if (rarity && (rarity.game !== 'genshin' || rarity.source?.sessionSha256 !== sessionSha256 || !Array.isArray(rarity.results))) {
    throw new Error('Análise de raridade não corresponde à sessão.');
  }
  if (rarity?.source?.reviewSha256 && reviewBytes && rarity.source.reviewSha256 !== hash(reviewBytes)) {
    throw new Error('Análise de raridade vinculada a outra revisão.');
  }
  const revisions = new Map();
  for (const item of review?.observations ?? []) {
    const original = session.observations[item.number - 1];
    if (!Number.isInteger(item.number) || !original || revisions.has(item.number) || !item.capture?.sha256 || item.capture.sha256 !== original.capture?.sha256 ||
        item.position?.row !== original.position?.row || item.position?.column !== original.position?.column) throw new Error('Referência de revisão inválida.');
    revisions.set(item.number, item);
  }
  const rarityResults = new Map();
  for (const item of rarity?.results ?? []) {
    const original = session.observations[item.position - 1];
    if (!Number.isInteger(item.position) || !original || rarityResults.has(item.position) || !item.captureSha256 || item.captureSha256 !== original.capture?.sha256 || !item.rarity) {
      throw new Error('Referência de raridade inválida.');
    }
    rarityResults.set(item.position, item.rarity);
  }
  const observations = session.observations.map((item, index) => {
    const number = index + 1;
    const raw = item.reading?.fields ?? {};
    const reviewed = revisions.get(number);
    const fields = {};
    for (const name of ['name', 'level', 'refinement', 'rarity']) {
      const observed = name === 'rarity' && rarityResults.has(number) ? rarityResults.get(number) : raw[name] ?? null;
      const confirmed = reviewed && review.confirmedFields?.includes(name) && Object.hasOwn(reviewed, name);
      fields[name] = { observed, observedSource: observed ? (name === 'rarity' && rarityResults.has(number) ? 'rarity-replay' : 'session') : null,
        humanReview: confirmed ? { value: reviewed[name], reviewer: review.reviewer, date: review.date } : null };
    }
    return { number, position: item.position, capture: item.capture, levelEligibilityFromSession: item.levelEligibility ?? null, fields };
  });
  return { schemaVersion: 1, format: 'gacha-ocr-lab-genshin-review', game: 'genshin',
    source: { sessionSha256, reviewSha256: reviewBytes ? hash(reviewBytes) : null, rarityAnalysisSha256: rarityBytes ? hash(rarityBytes) : null,
      rarityReplayReviewSha256: rarity?.source?.reviewSha256 ?? null },
    scope: session.scope, reason: session.reason, levelScopeComplete: session.levelScopeComplete === true,
    coverageConfirmed: session.coverageConfirmed === true, inventoryAccepted: false,
    note: 'Documento local para revisão; ausências não removem dados e valores automáticos não são aprovação humana.', observations };
}
