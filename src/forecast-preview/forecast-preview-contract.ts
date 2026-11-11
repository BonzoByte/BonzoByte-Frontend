export interface PreviewPlayer {
  canonicalPlayerId: number;
  name: string;
  countryISO2: string;
  countryISO3: string;
  country: string;
  probability: number; // Explicit fraction, never a heuristic percentage.
}
export interface PreviewMatch {
  canonicalMatchId: number;
  sourceMatchId: number;
  sourceDay: string;
  tour: 'ATP' | 'WTA';
  tournament: string;
  surface: string;
  round: string;
  players: [PreviewPlayer, PreviewPlayer];
}
export interface ForecastPreview {
  schema: string;
  previewOnly: boolean;
  productionEligible: boolean;
  calculatedAt: string;
  sourceCapturedAt: string;
  sourceReceiptSha256: string;
  candidateCount: number;
  heldCount: number;
  featureCount: number;
  models: Record<'ATP' | 'WTA', { rows: number; features: number; model_sha256: string }>;
  rows: PreviewMatch[];
}
function need(condition: unknown): asserts condition {
  if (!condition) throw new Error('Invalid isolated forecast archive');
}
const hashPattern = /^[a-f0-9]{64}$/;
const positiveId = (n: number) => Number.isSafeInteger(n) && n > 0;
const text = (s: string) => typeof s === 'string' && s.length <= 240;
const timestamp = (s: string) => typeof s === 'string' && /(?:Z|\+00:00)$/.test(s) && Number.isFinite(Date.parse(s));

export function localPreviewAllowed(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1';
}
export function validateForecastPreview(value: unknown): ForecastPreview {
  need(value && typeof value === 'object');
  const p = value as ForecastPreview;
  need(p.schema === 'bonzobyte.frozen-forecast-preview.v1' && p.previewOnly === true && p.productionEligible === false);
  need(timestamp(p.calculatedAt) && timestamp(p.sourceCapturedAt));
  need(Date.parse(p.sourceCapturedAt) <= Date.parse(p.calculatedAt));
  need(p.sourceReceiptSha256 === '2ede8f8dd0dbbec866a231b4c8c6f30d0ebf3f217ff2bb2be253a1b04de76de2');
  need(p.featureCount === 161 && Array.isArray(p.rows) && p.rows.length > 0 && p.rows.length <= 100);
  need(Number.isInteger(p.heldCount) && p.heldCount >= 0 && p.candidateCount === p.rows.length + p.heldCount);
  const ids = new Set<number>(), sourceIds = new Set<number>();
  for (const row of p.rows) {
    need(positiveId(row.canonicalMatchId) && positiveId(row.sourceMatchId));
    need(!ids.has(row.canonicalMatchId) && !sourceIds.has(row.sourceMatchId));
    ids.add(row.canonicalMatchId); sourceIds.add(row.sourceMatchId);
    need(row.tour === 'ATP' || row.tour === 'WTA');
    need(/^\d{4}-\d{2}-\d{2}$/.test(row.sourceDay) && Number.isFinite(Date.parse(row.sourceDay)));
    need(text(row.tournament) && text(row.surface) && text(row.round));
    need(Array.isArray(row.players) && row.players.length === 2);
    need(row.players[0].canonicalPlayerId !== row.players[1].canonicalPlayerId);
    for (const player of row.players) {
      need(positiveId(player.canonicalPlayerId) && text(player.name) && player.name.length > 0);
      need(text(player.country) && /^(?:[A-Za-z]{2}|)$/.test(player.countryISO2) && /^(?:[A-Za-z]{3}|)$/.test(player.countryISO3));
      need(Number.isFinite(player.probability) && player.probability >= 0 && player.probability <= 1);
    }
    need(Math.abs(row.players[0].probability + row.players[1].probability - 1) < 1e-9);
  }
  for (const tour of ['ATP', 'WTA'] as const) {
    need(p.models[tour].features === 161 && hashPattern.test(p.models[tour].model_sha256));
    need(p.models[tour].rows === p.rows.filter(r => r.tour === tour).length);
  }
  return p;
}
export async function verifyPreviewBytes(bytes: ArrayBuffer, expected: string): Promise<ForecastPreview> {
  need(hashPattern.test(expected));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  need(Array.from(digest, b => b.toString(16).padStart(2, '0')).join('') === expected);
  return validateForecastPreview(JSON.parse(new TextDecoder().decode(bytes)));
}
