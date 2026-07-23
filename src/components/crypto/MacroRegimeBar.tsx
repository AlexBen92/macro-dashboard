'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';

import { useVolResearch } from '@/hooks/api/useVolResearch';
import { useCorrMatrix } from '@/hooks/api/useCorrMatrix';

interface FearGreed {
  value: number;
  valueClassification: string;
}

function fetchFearGreed(): Promise<FearGreed | null> {
  return fetch('https://api.alternative.me/fng/?limit=1')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const v = d?.data?.[0];
      if (!v) return null;
      return { value: parseInt(v.value, 10), valueClassification: v.value_classification };
    })
    .catch(() => null);
}

function pillClass(kind: 'green' | 'gray' | 'red' | 'blue' | 'purple'): string {
  switch (kind) {
    case 'green':
      return 'border-[var(--bull)] text-[var(--bull)]';
    case 'red':
      return 'border-[var(--caution)] text-[var(--caution)]';
    case 'blue':
      return 'border-[var(--info)] text-[var(--info)]';
    case 'purple':
      return 'border-[var(--purple)] text-[var(--purple)]';
    default:
      return 'border-[var(--border)] text-[var(--muted)]';
  }
}

function vrpKind(regime: string | undefined): 'green' | 'red' | 'gray' {
  if (regime === 'LOW_VRP') return 'green';
  if (regime === 'HIGH_VRP') return 'red';
  return 'gray';
}

function fundingKind(f: number | null): 'green' | 'red' | 'gray' {
  if (f === null) return 'gray';
  if (f > 0.0003) return 'red';
  if (f < -0.00005) return 'green';
  return 'gray';
}

function fmtPct(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${x.toFixed(digits)}%`;
}

function fetchFunding(): Promise<number | null> {
  return fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'meta' }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const btc = d?.universe?.find((x: { name: string }) => x.name === 'BTC');
      if (!btc?.maxLeverage) return null;
      return null;
    })
    .catch(() => null);
}

function fetchDominance(): Promise<{ btc: number | null; total3: number | null }> {
  return fetch('https://api.coingecko.com/api/v3/global')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      const mcap = d?.data?.total_market_cap?.usd;
      const btcMcap = d?.data?.market_cap_percentage?.btc;
      const ethMcap = d?.data?.market_cap_percentage?.eth;
      if (btcMcap == null) return { btc: null, total3: null };
      const total3 = mcap != null && ethMcap != null ? ((100 - btcMcap - ethMcap) / 100) * mcap : null;
      return { btc: btcMcap, total3 };
    })
    .catch(() => ({ btc: null, total3: null }));
}

export default function MacroRegimeBar() {
  const { payload } = useVolResearch();
  const { cells } = useCorrMatrix(['30d']);

  const [fg, setFg] = useState<FearGreed | null>(null);
  const [dom, setDom] = useState<{ btc: number | null; total3: number | null }>({
    btc: null,
    total3: null,
  });
  const [funding, setFunding] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchFearGreed().then((v) => {
      if (active) setFg(v);
    });
    fetchDominance().then((v) => {
      if (active) setDom(v);
    });
    fetchFunding().then((v) => {
      if (active) setFunding(v);
    });
    const id = setInterval(() => {
      fetchFearGreed().then(setFg);
      fetchDominance().then(setDom);
    }, 300_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const vrpRegime = payload?.vrp?.BTC?.regime;
  const corr30 = cells.find((c) => c.a === 'BTC' && c.b === 'DXY' && c.window === '30d');
  const corrPrev = corr30 ? corr30.r : null;
  const corrSign = corrPrev !== null && corrPrev > 0;

  return (
    <div className="sticky top-0 z-50 bg-[var(--bg)] border-b border-[var(--border)]">
      <div className="v4-container py-2 flex items-center gap-3 overflow-x-auto whitespace-nowrap font-mono text-[0.62rem]">
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--label)] uppercase tracking-[2px]">BTC.D</span>
          <span className="text-[var(--fg)]">{fmtPct(dom.btc, 1)}</span>
        </div>
        <span className="text-[var(--border)]">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--label)] uppercase tracking-[2px]">TOTAL3</span>
          <span className="text-[var(--fg)]">
            {dom.total3 != null ? `$${(dom.total3 / 1e9).toFixed(0)}B` : '—'}
          </span>
        </div>
        <span className="text-[var(--border)]">|</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[var(--label)] uppercase tracking-[2px]">F&amp;G</span>
          <span className="text-[var(--fg)]">{fg ? `${fg.value} ${fg.valueClassification}` : '—'}</span>
        </div>
        <span className="text-[var(--border)]">|</span>
        <div
          className={`px-2 py-0.5 rounded border ${pillClass(
            vrpKind(vrpRegime),
          )} uppercase tracking-[1.5px]`}
        >
          VRP {vrpRegime ?? 'NA'}
        </div>
        <div
          className={`px-2 py-0.5 rounded border ${pillClass(
            fundingKind(funding),
          )} uppercase tracking-[1.5px]`}
        >
          FUND {funding !== null ? `${(funding * 100).toFixed(3)}%` : 'NA'}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[var(--label)] uppercase tracking-[2px]">BTC·DXY 30d</span>
          <span className="text-[var(--fg)]">{corrPrev !== null ? corrPrev.toFixed(2) : '—'}</span>
          {corrPrev !== null &&
            (corrSign ? (
              <ArrowUp size={11} color="var(--caution)" strokeWidth={2} />
            ) : (
              <ArrowDown size={11} color="var(--bull)" strokeWidth={2} />
            ))}
        </div>
      </div>
    </div>
  );
}
