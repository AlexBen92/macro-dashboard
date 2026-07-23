'use client';

import { useMemo } from 'react';

import sectors from '@/config/crypto-sectors.json';
import { pricesToLogReturns } from '@/lib/engines/correlation';
import { useYahooCloses } from '@/hooks/api/useYahooCloses';

interface SectorRow {
  level: 'L1' | 'L2' | 'L3';
  perf7d: number | null;
  perf30d: number | null;
  beta30: number | null;
  rsRank: number;
}

const BTC_Y = 'BTC=F';
const ALL_SYMBOLS: string[] = Array.from(
  new Set(
    [...sectors.L1, ...sectors.L2, ...sectors.L3, 'BTC'].map((s) =>
      s === 'BTC' ? BTC_Y : `${s}-USD`,
    ),
  ),
);

function perfWindow(closes: number[], days: number): number | null {
  if (closes.length < days + 1) return null;
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 1 - days];
  if (!prev) return null;
  return ((last - prev) / prev) * 100;
}

function betaToBtc(tokenCloses: number[], btcCloses: number[]): number | null {
  const n = Math.min(tokenCloses.length, btcCloses.length, 30);
  if (n < 5) return null;
  const tr = pricesToLogReturns(tokenCloses.slice(tokenCloses.length - n));
  const br = pricesToLogReturns(btcCloses.slice(btcCloses.length - n));
  const m = Math.min(tr.length, br.length);
  const a = tr.slice(tr.length - m);
  const b = br.slice(br.length - m);
  const ma = a.reduce((s, x) => s + x, 0) / m;
  const mb = b.reduce((s, x) => s + x, 0) / m;
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < m; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    varB += (b[i] - mb) ** 2;
  }
  if (varB === 0) return null;
  return cov / varB;
}

function aggregate(
  level: 'L1' | 'L2' | 'L3',
  data: Record<string, number[]>,
  btcCloses: number[],
): SectorRow {
  const tokens = sectors[level];
  const perfs7: number[] = [];
  const perfs30: number[] = [];
  const betas: number[] = [];
  for (const t of tokens) {
    const yahoo = t === 'BTC' ? BTC_Y : `${t}-USD`;
    const closes = data[yahoo];
    if (!closes || closes.length < 5) continue;
    const p7 = perfWindow(closes, 7);
    const p30 = perfWindow(closes, 30);
    const beta = betaToBtc(closes, btcCloses);
    if (p7 !== null) perfs7.push(p7);
    if (p30 !== null) perfs30.push(p30);
    if (beta !== null) betas.push(beta);
  }
  const mean = (xs: number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
  return {
    level,
    perf7d: mean(perfs7),
    perf30d: mean(perfs30),
    beta30: mean(betas),
    rsRank: 0,
  };
}

function fmt(x: number | null, digits = 2): string {
  if (x === null || !Number.isFinite(x)) return '—';
  const sign = x > 0 ? '+' : '';
  return `${sign}${x.toFixed(digits)}`;
}

function rsRankColor(rank: number, total: number): string {
  if (total === 0) return 'var(--muted)';
  const f = rank / total;
  if (f <= 0.33) return 'var(--bull)';
  if (f >= 0.67) return 'var(--caution)';
  return 'var(--muted)';
}

export default function SectorRotationTable() {
  const { data, loading } = useYahooCloses(ALL_SYMBOLS, '1d', '40d');
  const btcCloses = data[BTC_Y] ?? [];

  const rows: SectorRow[] = useMemo(() => {
    const r: SectorRow[] = (['L1', 'L2', 'L3'] as const).map((l) => aggregate(l, data, btcCloses));
    const ranked = [...r].sort((a, b) => (b.perf30d ?? -Infinity) - (a.perf30d ?? -Infinity));
    ranked.forEach((row, i) => {
      row.rsRank = i + 1;
    });
    return r;
  }, [data, btcCloses]);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-4 py-2 border-b border-[var(--border)] font-mono text-[0.62rem] text-[var(--label)] uppercase tracking-[2px]">
        ROTATION SECTORIELLE · L1 / L2 / L3
      </div>
      <table className="w-full font-mono text-[0.65rem]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--muted)] uppercase tracking-[1.5px]">
            <th className="text-left px-3 py-1.5">Level</th>
            <th className="text-right px-3 py-1.5">Perf 7j</th>
            <th className="text-right px-3 py-1.5">Perf 30j</th>
            <th className="text-right px-3 py-1.5">Beta BTC 30j</th>
            <th className="text-right px-3 py-1.5">RS Rank</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.level} className="border-b border-[var(--border)] last:border-0">
              <td className="px-3 py-2 text-[var(--fg)] uppercase tracking-[1.5px]">{row.level}</td>
              <td className="px-3 py-2 text-right" style={{ color: (row.perf7d ?? 0) >= 0 ? 'var(--bull)' : 'var(--caution)' }}>
                {loading ? '…' : fmt(row.perf7d)}
              </td>
              <td className="px-3 py-2 text-right" style={{ color: (row.perf30d ?? 0) >= 0 ? 'var(--bull)' : 'var(--caution)' }}>
                {loading ? '…' : fmt(row.perf30d)}
              </td>
              <td className="px-3 py-2 text-right text-[var(--fg)]">
                {loading ? '…' : fmt(row.beta30)}
              </td>
              <td className="px-3 py-2 text-right" style={{ color: rsRankColor(row.rsRank, 3) }}>
                {loading ? '…' : `${row.rsRank}/3`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
