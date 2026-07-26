export function compactUSD(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function compactOI(contracts: number | null | undefined): string {
  if (contracts == null || !Number.isFinite(contracts)) return 'n/a';
  const abs = Math.abs(contracts);
  const sign = contracts < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function fmtStrike(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(digits)}%`;
}

export function fmtPrice(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return 'n/a';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
