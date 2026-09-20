export interface CorrCellColor {
  bg: string;
  text: string;
}

// Seuils établis cockpit: |ρ|<0.20 diversifiant · 0.20-0.60 à pondérer · >0.60 même cluster
export function corrCellColor(r: number): CorrCellColor {
  const abs = Math.abs(r);
  if (abs < 0.2) return { bg: 'rgba(74,222,128,0.18)', text: 'var(--bull)' };
  if (abs <= 0.6) return { bg: 'rgba(140,140,160,0.12)', text: 'var(--muted)' };
  return { bg: 'rgba(255,51,85,0.18)', text: 'var(--caution)' };
}
