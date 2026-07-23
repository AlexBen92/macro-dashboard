'use client';

import { useMemo } from 'react';

import { pricesToLogReturns, pearsonLogReturns } from '@/lib/engines/correlation';
import { useYahooCloses } from '@/hooks/api/useYahooCloses';

const ALTS = ['SOL', 'AVAX', 'LINK', 'ARB', 'OP', 'TON', 'DOGE'];
const BTC_Y = 'BTC-USD';
const ETH_Y = 'ETH-USD';

interface AltRow {
  token: string;
  betaBtc: number | null;
  corrBtc: number | null;
  corrEth: number | null;
}

function beta(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  const ar = pricesToLogReturns(a.slice(a.length - n));
  const br = pricesToLogReturns(b.slice(b.length - n));
  const m = Math.min(ar.length, br.length);
  const ax = ar.slice(ar.length - m);
  const bx = br.slice(br.length - m);
  const ma = ax.reduce((s, x) => s + x, 0) / m;
  const mb = bx.reduce((s, x) => s + x, 0) / m;
  let cov = 0;
  let varB = 0;
  for (let i = 0; i < m; i++) {
    cov += (ax[i] - ma) * (bx[i] - mb);
    varB += (bx[i] - mb) ** 2;
  }
  if (varB === 0) return null;
  return cov / varB;
}

function corr(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 5) return null;
  const ar = pricesToLogReturns(a.slice(a.length - n));
  const br = pricesToLogReturns(b.slice(b.length - n));
  const m = Math.min(ar.length, br.length);
  return pearsonLogReturns(ar.slice(ar.length - m), br.slice(br.length - m));
}

function diversificationColor(c: number | null): string {
  if (c === null) return 'var(--muted)';
  const abs = Math.abs(c);
  if (abs < 0.5) return 'var(--bull)';
  if (abs < 0.8) return 'var(--muted)';
  return 'var(--caution)';
}

function fmt(x: number | null, digits = 2): string {
  if (x === null || !Number.isFinite(x)) return '—';
  return x.toFixed(digits);
}

export default function AltExposureTable() {
  const symbols = useMemo(() => [BTC_Y, ETH_Y, ...ALTS.map((a) => `${a}-USD`)], []);
  const { data, loading } = useYahooCloses(symbols, '1d', '40d');
  const btc = data[BTC_Y] ?? [];
  const eth = data[ETH_Y] ?? [];

  const rows: AltRow[] = useMemo(
    () =>
      ALTS.map((t) => {
        const closes = data[`${t}-USD`] ?? [];
        return {
          token: t,
          betaBtc: beta(closes, btc),
          corrBtc: corr(closes, btc),
          corrEth: corr(closes, eth),
        };
      }),
    [data, btc, eth],
  );

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-4 py-2 border-b border-[var(--border)] font-mono text-[0.62rem] text-[var(--label)] uppercase tracking-[2px]">
        EXPOSITION ALTCOINS · BETA / CORR 30j
      </div>
      <table className="w-full font-mono text-[0.65rem]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--muted)] uppercase tracking-[1.5px]">
            <th className="text-left px-3 py-1.5">Token</th>
            <th className="text-right px-3 py-1.5">Beta BTC</th>
            <th className="text-right px-3 py-1.5">Corr BTC</th>
            <th className="text-right px-3 py-1.5">Corr ETH</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.token} className="border-b border-[var(--border)] last:border-0">
              <td className="px-3 py-2 text-[var(--fg)] uppercase tracking-[1.5px]">{row.token}</td>
              <td className="px-3 py-2 text-right text-[var(--fg)]">
                {loading ? '…' : fmt(row.betaBtc)}
              </td>
              <td
                className="px-3 py-2 text-right"
                style={{ color: diversificationColor(row.corrBtc) }}
              >
                {loading ? '…' : fmt(row.corrBtc)}
              </td>
              <td
                className="px-3 py-2 text-right"
                style={{ color: diversificationColor(row.corrEth) }}
              >
                {loading ? '…' : fmt(row.corrEth)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
