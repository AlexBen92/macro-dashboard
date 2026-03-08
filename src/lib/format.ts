export function fU(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return 'N/A';
  const a = Math.abs(n);
  if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + n.toFixed(2);
}

export function fP(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n >= 1 ? '$' + n.toFixed(2) : '$' + n.toFixed(4);
}

export function fPct(f: number | null | undefined, d = 2): string {
  if (f == null || isNaN(f)) return 'N/A';
  return (f >= 0 ? '+' : '') + f.toFixed(d) + '%';
}

export function fF(f: number | null | undefined): string {
  if (f == null || isNaN(f)) return 'N/A';
  return (f >= 0 ? '+' : '') + f.toFixed(4) + '%';
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function shortAddr(addr: string): string {
  return addr.slice(0, 6) + '..' + addr.slice(-4);
}

export function fmtCD(ms: number): string {
  const h = Math.floor(ms / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  return h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : h + 'h ' + m + 'm';
}

export function colorForScore(score: number): string {
  if (score > 2) return '#4ade80';
  if (score < -2) return '#ff3355';
  return '#ffaa00';
}

export function colorForFng(v: number): string {
  if (v < 25) return '#ff3355';
  if (v < 45) return '#ff8800';
  if (v <= 55) return '#ffaa00';
  return '#4ade80';
}
