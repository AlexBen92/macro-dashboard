'use client';

import { useMemo, useState } from 'react';
import { useCryptoTop50, type Top50Coin } from '@/hooks/api/useCryptoTop50';
import sectors from '@/config/crypto-sectors.json';

type SortKey =
  | 'rank'
  | 'name'
  | 'price'
  | 'chg_24h'
  | 'chg_7d'
  | 'volume_24h'
  | 'market_cap'
  | 'funding_apr';

type SectorFilter = 'all' | 'L1' | 'L2' | 'L3' | 'autres';

const SECTOR_MAP: Record<string, string> = {};
for (const [layer, syms] of Object.entries(sectors)) {
  for (const s of syms as string[]) SECTOR_MAP[s.toUpperCase()] = layer;
}

const COLUMNS: Array<{ key: SortKey; label: string; align: 'left' | 'right' }> = [
  { key: 'rank', label: '#', align: 'left' },
  { key: 'name', label: 'Actif', align: 'left' },
  { key: 'price', label: 'Prix', align: 'right' },
  { key: 'chg_24h', label: '24h', align: 'right' },
  { key: 'chg_7d', label: '7j', align: 'right' },
  { key: 'volume_24h', label: 'Vol 24h', align: 'right' },
  { key: 'market_cap', label: 'Mkt Cap', align: 'right' },
  { key: 'funding_apr', label: 'Funding APR', align: 'right' },
];

function fmtCompact(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toPrecision(3);
}

function fmtPct(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function pctColor(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return 'var(--dim)';
  if (n > 0) return 'var(--bull)';
  if (n < 0) return 'var(--bear)';
  return 'var(--muted)';
}

function fundingColor(apr: number | null): string {
  if (apr == null || !Number.isFinite(apr)) return 'var(--dim)';
  if (Math.abs(apr) >= 50) return 'var(--caution)';
  if (apr > 0) return 'var(--bull)';
  return 'var(--bear)';
}

export default function Top50CryptoTable() {
  const { data, error, isLoading } = useCryptoTop50();
  const [sortKey, setSortKey] = useState<SortKey>('market_cap');
  const [sortAsc, setSortAsc] = useState(false);
  const [sector, setSector] = useState<SectorFilter>('all');

  const rows = useMemo(() => {
    let coins: Top50Coin[] = data?.coins ?? [];
    if (sector !== 'all') {
      coins = coins.filter((c) =>
        sector === 'autres'
          ? !SECTOR_MAP[c.symbol]
          : SECTOR_MAP[c.symbol] === sector,
      );
    }
    const dir = sortAsc ? 1 : -1;
    return [...coins].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortKey === 'rank') return (a.rank - b.rank) * dir;
      const va = (a[sortKey] as number | null) ?? -Infinity;
      const vb = (b[sortKey] as number | null) ?? -Infinity;
      return (va - vb) * dir;
    });
  }, [data, sector, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(key === 'name' || key === 'rank');
    }
  };

  const asOf = data?.asOf
    ? new Date(data.asOf).toISOString().slice(14, 19) + 'Z'
    : null;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
          TOP 50 CRYPTO{' '}
          <span className="text-[0.58rem] text-[var(--muted)] ml-2">
            market cap · coingecko + funding perp hyperliquid
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(['all', 'L1', 'L2', 'L3', 'autres'] as SectorFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setSector(s)}
              className={`px-2 py-0.5 rounded-[3px] font-mono text-[0.55rem] uppercase tracking-[2px] border ${
                sector === s
                  ? 'bg-[var(--bg3)] text-[var(--label)] border-[var(--border)]'
                  : 'text-[var(--muted)] border-transparent hover:text-[var(--label)]'
              }`}
            >
              {s === 'all' ? `tous (${data?.coins.length ?? '—'})` : s}
            </button>
          ))}
          <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
            {asOf ?? '—'}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[0.62rem] min-w-[760px]">
          <thead>
            <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`py-2 px-2 cursor-pointer select-none hover:text-[var(--label)] ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  } ${c.key === 'rank' ? 'pr-1' : ''} ${c.key === 'name' ? 'pr-3' : ''}`}
                  onClick={() => toggleSort(c.key)}
                  title="Trier"
                >
                  {c.label}
                  {sortKey === c.key && (
                    <span className="ml-1">{sortAsc ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-[var(--bg3)]">
                <td className="py-1.5 pr-1 text-right text-[var(--muted)]">{c.rank}</td>
                <td className="py-1.5 pr-3">
                  <div className="text-[var(--label)]">{c.name}</div>
                  <div className="text-[var(--muted)] text-[0.52rem] uppercase tracking-[1px]">
                    {c.symbol}
                    {SECTOR_MAP[c.symbol] ? ` · ${SECTOR_MAP[c.symbol]}` : ''}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right text-[var(--dim)]">{fmtPrice(c.price)}</td>
                <td className="py-1.5 px-2 text-right" style={{ color: pctColor(c.chg_24h) }}>
                  {fmtPct(c.chg_24h)}
                </td>
                <td className="py-1.5 px-2 text-right" style={{ color: pctColor(c.chg_7d) }}>
                  {fmtPct(c.chg_7d)}
                </td>
                <td className="py-1.5 px-2 text-right text-[var(--dim)]">{fmtCompact(c.volume_24h)}</td>
                <td className="py-1.5 px-2 text-right text-[var(--dim)]">{fmtCompact(c.market_cap)}</td>
                <td
                  className="py-1.5 px-2 text-right"
                  style={{ color: fundingColor(c.funding_apr) }}
                  title="Funding perp annualisé (Hyperliquid) — |APR| ≥ 50% = extrême"
                >
                  {c.funding_apr != null ? `${c.funding_apr >= 0 ? '+' : ''}${c.funding_apr.toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="mt-2 font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
          chargement top 50 · coingecko...
        </div>
      )}
      {error && (
        <div className="mt-2 font-mono text-[0.55rem] text-[var(--bear)] uppercase tracking-[2px]">
          top 50 indisponible · {error.slice(0, 60)}
        </div>
      )}
      {!error && !isLoading && rows.length === 0 && (
        <div className="mt-2 font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
          aucun actif dans ce filtre
        </div>
      )}
      <div className="mt-2 font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
        rafraîchi 60s · secteurs L1/L2/L3 = classification rotation sectorielle · funding vide = perp absent d&apos;hyperliquid
      </div>
    </div>
  );
}
