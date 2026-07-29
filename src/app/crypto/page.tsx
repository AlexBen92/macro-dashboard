'use client';

import { useMemo, useState } from 'react';

import OptionsTopBar from '@/components/crypto/options/OptionsTopBar';
import RegimeRibbon from '@/components/crypto/options/RegimeRibbon';
import PriceLevelsChart from '@/components/crypto/options/PriceLevelsChart';
import LevelsTable from '@/components/crypto/options/LevelsTable';
import GexByStrikeChart from '@/components/crypto/options/GexByStrikeChart';
import DexByStrikeChart from '@/components/crypto/options/DexByStrikeChart';
import ExpiryFilter from '@/components/crypto/options/ExpiryFilter';
import OptionsReadCard from '@/components/crypto/options/OptionsReadCard';
import ContextCorrelationPanel from '@/components/crypto/options/ContextCorrelationPanel';
import RegimeContextCard from '@/components/crypto/options/RegimeContextCard';
import SessionPlanCard from '@/components/crypto/options/SessionPlanCard';
import VolSurfaceDrawer from '@/components/crypto/options/VolSurfaceDrawer';
import OptionsGuideDrawer from '@/components/crypto/options/OptionsGuideDrawer';
import DiagnosticsDrawer from '@/components/crypto/options/DiagnosticsDrawer';
import MacroSentimentPanel from '@/components/crypto/options/MacroSentimentPanel';

import { useOptionsExposure } from '@/hooks/api/useOptionsExposure';
import { buildSessionPlan } from '@/lib/options/session-plan';
import { computeContextBadge } from '@/lib/options/context-badge';
import { useCorrMatrix } from '@/hooks/api/useCorrMatrix';
import type { ExpiryBucket, SupportedCurrency, Timeframe } from '@/lib/options/types';
import type { CorrWindowKey } from '@/hooks/api/useCorrMatrix';

export default function CryptoPage() {
  const [symbol, setSymbol] = useState<SupportedCurrency>('BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('M15');
  const [expiryBucket, setExpiryBucket] = useState<ExpiryBucket>('all');
  const [volOpen, setVolOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);

  const { data, error, isLoading, isStale, mutate } = useOptionsExposure(
    symbol,
    expiryBucket,
  );

  const { cells } = useCorrMatrix(['7d', '24h'] as CorrWindowKey[]);
  const ctx = useMemo(
    () => computeContextBadge(cells.map((c) => ({ ...c }))),
    [cells],
  );
  const plan = useMemo(
    () => (data ? buildSessionPlan(data, ctx) : null),
    [data, ctx],
  );

  const spotChgPct = useMemo(() => {
    if (!data?.spot) return null;
    const ref = data.strikes.length > 0 ? data.strikes[0] : null;
    if (!ref) return null;
    return null;
  }, [data]);

  return (
    <div className="min-h-screen flex flex-col">
      <OptionsTopBar
        symbol={symbol}
        onSymbolChange={(s) => setSymbol(s)}
        timeframe={timeframe}
        onTimeframeChange={(t) => setTimeframe(t)}
        spot={data?.spot ?? null}
        spotChgPct={spotChgPct}
        gammaRegime={data?.regime.gamma ?? 'unknown'}
        dealerDelta={data?.regime.dealerDelta ?? 'unknown'}
        freshness={data?.freshness.status ?? 'unavailable'}
        freshnessTs={data?.freshness.sourceTs ?? null}
        onRefresh={() => mutate()}
        onOpenVolSurface={() => setVolOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenDiagnostics={() => setDiagOpen(true)}
      />

      <RegimeRibbon
        gammaRegime={data?.regime.gamma ?? 'unknown'}
        dealerDelta={data?.regime.dealerDelta ?? 'unknown'}
        spot={data?.spot ?? null}
        zeroGamma={data?.levels.zeroGamma ?? null}
      />

      <main className="flex-1 px-4 py-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        <section className="lg:col-span-4 lg:order-1 order-2 space-y-3">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">
            A · Price & Levels
          </div>
          <PriceLevelsChart
            symbol={symbol}
            timeframe={timeframe}
            levels={data?.levels ?? { callWall: null, putWall: null, zeroGamma: null, hvl: null }}
            gammaRegime={data?.regime.gamma}
            spot={data?.spot}
          />
          <LevelsTable
            spot={data?.spot ?? null}
            levels={data?.levels ?? { callWall: null, putWall: null, zeroGamma: null, hvl: null }}
          />
        </section>

        <section className="lg:col-span-5 lg:order-2 order-1 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">
              B · GEX / DEX Profiles
            </div>
            <ExpiryFilter
              value={expiryBucket}
              onChange={setExpiryBucket}
              includedExpiries={data?.includedExpiries}
            />
          </div>

          {error && (
            <div className="bg-[var(--bg2)] border border-[var(--bear)]/40 rounded-[3px] p-3 font-mono text-[0.65rem] text-[var(--bear)] flex items-center justify-between">
              <span>Options data unavailable — {error}</span>
              <button
                type="button"
                onClick={() => mutate()}
                className="px-2 py-0.5 rounded-[2px] border border-[var(--bear)]/50 text-[var(--bear)] hover:bg-[var(--bear)]/10"
              >
                Retry
              </button>
            </div>
          )}

          {!error && !data && isLoading && (
            <div className="h-[420px] w-full animate-pulse bg-[var(--bg2)] rounded-[4px]" />
          )}

          {!error && !data && !isLoading && (
            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[3px] p-4 font-mono text-[0.65rem] text-[var(--muted)]">
              No options snapshot — check diagnostics.
            </div>
          )}

          {data && (
            <>
              {isStale && (
                <div className="bg-[var(--bg2)] border border-[var(--caution)]/40 rounded-[3px] p-2 font-mono text-[0.6rem] text-[var(--caution)] flex items-center justify-between">
                  <span>Stale snapshot — last valid data shown</span>
                  <button
                    type="button"
                    onClick={() => mutate()}
                    className="px-2 py-0.5 rounded-[2px] border border-[var(--caution)]/50 hover:bg-[var(--caution)]/10"
                  >
                    Retry
                  </button>
                </div>
              )}
              <GexByStrikeChart
                strikes={data.strikes}
                spot={data.spot}
                sourceTs={data.freshness.sourceTs}
                gammaRegime={data.regime.gamma}
              />
              <DexByStrikeChart
                strikes={data.strikes}
                spot={data.spot}
                dealerDelta={data.regime.dealerDelta}
              />
              <OptionsReadCard snapshot={data} />
            </>
          )}
        </section>

        <section className="lg:col-span-3 lg:order-3 order-3 space-y-3">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">
            C · Context & Plan
          </div>
          <RegimeContextCard />
          <SessionPlanCard plan={plan} isLoading={isLoading && !data} />
          <ContextCorrelationPanel />
        </section>

        <section className="lg:col-span-12 lg:order-4 order-4 space-y-2">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">
            D · Macro Sentiment · Bullish / Bearish verdict
          </div>
          <MacroSentimentPanel />
        </section>
      </main>

      <footer className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px]">
        <span>
          Source: {data?.source ?? '—'} · schema v{data?.schemaVersion ?? '1'}
        </span>
        <span>
          As of: {data?.asOf ?? '—'}
        </span>
        <span>H4 → H1 → M15 workflow</span>
      </footer>

      <VolSurfaceDrawer open={volOpen} onOpenChange={setVolOpen} />
      <OptionsGuideDrawer open={guideOpen} onOpenChange={setGuideOpen} />
      <DiagnosticsDrawer
        open={diagOpen}
        onOpenChange={setDiagOpen}
        snapshot={data}
        error={error}
      />
    </div>
  );
}
