export interface SectorScore {
  sector: string;
  daily: number | null;
}

export interface GlobalRotation {
  label: 'RISK-ON' | 'RISK-OFF' | 'ÉQUILIBRÉ';
  color: string;
  avg: number;
  nPos: number;
  nNeg: number;
  nNeutral: number;
  scored: Array<{ sector: string; daily: number }>;
}

/** Régime global agrégé des scores daily sectoriels.
 * Seuil ±10 sur la moyenne + majorité de secteurs du même côté. */
export function computeGlobalRotation(rows: SectorScore[]): GlobalRotation | null {
  const scored = rows
    .filter((r): r is { sector: string; daily: number } => r.daily != null)
    .map((r) => ({ sector: r.sector, daily: r.daily }));
  if (scored.length === 0) return null;
  const avg = scored.reduce((s, r) => s + r.daily, 0) / scored.length;
  const nPos = scored.filter((r) => r.daily > 0).length;
  const nNeg = scored.filter((r) => r.daily < 0).length;
  let label: GlobalRotation['label'] = 'ÉQUILIBRÉ';
  let color = 'var(--muted)';
  if (avg >= 10 && nPos > nNeg) {
    label = 'RISK-ON';
    color = 'var(--bull)';
  } else if (avg <= -10 && nNeg > nPos) {
    label = 'RISK-OFF';
    color = 'var(--bear)';
  }
  return { label, color, avg, nPos, nNeg, nNeutral: scored.length - nPos - nNeg, scored };
}
