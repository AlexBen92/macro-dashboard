'use client';

import { useState } from 'react';

import OptionsTopBar from '@/components/crypto/options/OptionsTopBar';
import VolSurfaceDrawer from '@/components/crypto/options/VolSurfaceDrawer';
import OptionsGuideDrawer from '@/components/crypto/options/OptionsGuideDrawer';
import DiagnosticsDrawer from '@/components/crypto/options/DiagnosticsDrawer';

import RegimeSummaryCard from '@/components/crypto/m15/RegimeSummaryCard';
import MacroSentimentCard from '@/components/crypto/m15/MacroSentimentCard';
import EdgeM15GlobalCard from '@/components/crypto/m15/EdgeM15GlobalCard';
import RegimeStrategyMatrix from '@/components/crypto/m15/RegimeStrategyMatrix';
import DailyBriefBar from '@/components/crypto/m15/DailyBriefBar';
import PriceLevelsM15Chart from '@/components/crypto/m15/PriceLevelsM15Chart';
import EdgeM15BTCCard from '@/components/crypto/m15/EdgeM15BTCCard';
import VolHeatmapM15 from '@/components/crypto/m15/VolHeatmapM15';
import DecisionEnginePanel from '@/components/crypto/decision/DecisionEnginePanel';
import CorrelationTable from '@/components/crypto/m15/CorrelationTable';
import SessionPlanCard from '@/components/crypto/m15/SessionPlanCard';
import SetupsPanel from '@/components/crypto/m15/SetupsPanel';
import OrderFlowImbalanceWidget from '@/components/crypto/orderflow/OrderFlowImbalanceWidget';
import AlphaTermStructureChart from '@/components/crypto/orderflow/AlphaTermStructureChart';
import OfiSetupsPanel from '@/components/crypto/orderflow/OfiSetupsPanel';
import Top50CryptoTable from '@/components/crypto/Top50CryptoTable';
import ResearchProgramStatus from '@/components/ResearchProgramStatus';

import { useOptionsExposure } from '@/hooks/api/useOptionsExposure';
import type { ExpiryBucket, SupportedCurrency, Timeframe } from '@/lib/options/types';

export default function CryptoPage() {
  const [symbol, setSymbol] = useState<SupportedCurrency>('BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('M15');
  const [expiryBucket, setExpiryBucket] = useState<ExpiryBucket>('all');
  const [volOpen, setVolOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);

  const { data, mutate, error, isLoading } = useOptionsExposure(symbol, expiryBucket);

  return (
    <div className="min-h-screen flex flex-col">
      <OptionsTopBar
        symbol={symbol}
        onSymbolChange={(s) => setSymbol(s)}
        timeframe={timeframe}
        onTimeframeChange={(t) => setTimeframe(t)}
        spot={data?.spot ?? null}
        spotChgPct={null}
        gammaRegime={data?.regime.gamma ?? 'unknown'}
        dealerDelta={data?.regime.dealerDelta ?? 'unknown'}
        freshness={data?.freshness.status ?? 'unavailable'}
        freshnessTs={data?.freshness.sourceTs ?? null}
        onRefresh={() => mutate()}
        onOpenVolSurface={() => setVolOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenDiagnostics={() => setDiagOpen(true)}
      />

      <main className="flex-1 px-4 py-3 flex flex-col gap-3">
        <DailyBriefBar />

        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px] col-span-full">
            Bloc 1 · Synthèse — Régime · Macro · Edge M15
          </div>
          <RegimeSummaryCard />
          <MacroSentimentCard />
          <EdgeM15GlobalCard />
        </section>

        <section className="grid grid-cols-1 gap-3">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">
            Bloc 1b · Régime × Stratégie — Heatmap perf
          </div>
          <RegimeStrategyMatrix />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px] col-span-full">
            Bloc 2 · Cockpit BTC M15 — Prix · Verdict · Vol Heatmap
          </div>
          <div className="lg:col-span-8 space-y-3">
            <PriceLevelsM15Chart />
          </div>
          <div className="lg:col-span-4 space-y-3">
            <EdgeM15BTCCard />
            <VolHeatmapM15 />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">
            Bloc 2b · Decision Engine — BTC + ETH terminal verdict (M15)
          </div>
          <DecisionEnginePanel />
        </section>

        <section className="flex flex-col gap-3">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">
            Bloc 2c · Top 50 — market cap · performance · funding perp
          </div>
          <Top50CryptoTable />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px] col-span-full">
            Bloc 3 · Corrélation · Session Plan · Setups
          </div>
          <div className="lg:col-span-3">
            <CorrelationTable />
          </div>
          <div className="lg:col-span-1">
            <SessionPlanCard />
          </div>
          <div className="lg:col-span-2">
            <SetupsPanel />
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px] col-span-full">
            Bloc 4 · Order Flow · OFI live · Alpha Term Structure · Setups microstructure
          </div>
          <div className="lg:col-span-4">
            <OrderFlowImbalanceWidget />
          </div>
          <div className="lg:col-span-8">
            <AlphaTermStructureChart />
          </div>
          <div className="lg:col-span-12">
            <OfiSetupsPanel />
          </div>
        </section>

        {error && (
          <div className="bg-[var(--bg2)] border border-[var(--caution)]/30 rounded-[3px] px-3 py-2 font-mono text-[0.55rem] text-[var(--muted)]">
            Options snapshot secondaire indisponible (cron GEX/DEX 4h17/16h17). Cockpit M15
            reste opérationnel via Hyperliquid live.
          </div>
        )}

        <ResearchProgramStatus variant="crypto" />

        {!error && !data && !isLoading && (
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[3px] px-3 py-2 font-mono text-[0.55rem] text-[var(--muted)]">
            GEX/DEX en cours de configuration — visible via Diagnostics quand snapshot disponible.
          </div>
        )}
      </main>

      <footer className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px]">
        <span>
          Source M15: Hyperliquid · Régime WF: yf_BTC 3130j · Cron export: */15min
        </span>
        <span>
          As of: {data?.asOf ?? '—'}
        </span>
        <span>M15 cockpit — verdict-driven</span>
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
