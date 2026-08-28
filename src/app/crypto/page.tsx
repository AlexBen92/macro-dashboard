'use client';

import { useState } from 'react';

import OptionsTopBar from '@/components/crypto/options/OptionsTopBar';
import VolSurfaceDrawer from '@/components/crypto/options/VolSurfaceDrawer';
import OptionsGuideDrawer from '@/components/crypto/options/OptionsGuideDrawer';
import DiagnosticsDrawer from '@/components/crypto/options/DiagnosticsDrawer';

import GlobalSystemGateBar from '@/components/crypto/cockpit/GlobalSystemGateBar';
import VolSurfaceRegimeCard from '@/components/crypto/cockpit/VolSurfaceRegimeCard';
import RoughVsMarkovCard from '@/components/crypto/cockpit/RoughVsMarkovCard';
import CarryBasisHealthPanel from '@/components/crypto/cockpit/CarryBasisHealthPanel';
import PnlAttributionPanel from '@/components/crypto/cockpit/PnlAttributionPanel';
import StrategyContractsTable from '@/components/crypto/cockpit/StrategyContractsTable';
import AgentSkillsDashboard from '@/components/crypto/cockpit/AgentSkillsDashboard';
import LawsOfTheGameCard from '@/components/crypto/cockpit/LawsOfTheGameCard';
import M15SignalsGrid from '@/components/crypto/cockpit/M15SignalsGrid';
import M15StrategiesBankCard from '@/components/crypto/cockpit/M15StrategiesBankCard';
import PathFeaturesCard from '@/components/crypto/cockpit/PathFeaturesCard';
import M15StationarityCard from '@/components/crypto/cockpit/M15StationarityCard';
import JournalTimeline from '@/components/crypto/cockpit/JournalTimeline';

import RegimeSummaryCard from '@/components/crypto/m15/RegimeSummaryCard';
import EdgeM15GlobalCard from '@/components/crypto/m15/EdgeM15GlobalCard';
import RegimeStrategyMatrix from '@/components/crypto/m15/RegimeStrategyMatrix';
import DailyBriefBar from '@/components/crypto/m15/DailyBriefBar';
import PriceLevelsM15Chart from '@/components/crypto/m15/PriceLevelsM15Chart';
import EdgeM15BTCCard from '@/components/crypto/m15/EdgeM15BTCCard';
import VolHeatmapM15 from '@/components/crypto/m15/VolHeatmapM15';
import CorrelationTable from '@/components/crypto/m15/CorrelationTable';
import SessionPlanCard from '@/components/crypto/m15/SessionPlanCard';
import SetupsPanel from '@/components/crypto/m15/SetupsPanel';
import OrderFlowImbalanceWidget from '@/components/crypto/orderflow/OrderFlowImbalanceWidget';
import AlphaTermStructureChart from '@/components/crypto/orderflow/AlphaTermStructureChart';
import OfiSetupsPanel from '@/components/crypto/orderflow/OfiSetupsPanel';
import Top50CryptoTable from '@/components/crypto/Top50CryptoTable';
import FundingCarryPanel from '@/components/crypto/FundingCarryPanel';
import ExploratorySection from '@/components/ui/ExploratorySection';
import ResearchProgramStatus from '@/components/ResearchProgramStatus';
import ResearchCatalog from '@/components/ResearchCatalog';
import ExecutionPanel from '@/components/execution/ExecutionPanel';
import { useTelegramAlerts } from '@/components/TelegramAlerts';

import { useOptionsExposure } from '@/hooks/api/useOptionsExposure';
import { useRegimeStatus } from '@/hooks/api/useRegimeStatus';
import type { ExpiryBucket, SupportedCurrency, Timeframe } from '@/lib/options/types';

function TierLabel({ children }: { children: string }) {
  return (
    <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">
      {children}
    </div>
  );
}

export default function CryptoPage() {
  useTelegramAlerts();
  const [symbol, setSymbol] = useState<SupportedCurrency>('BTC');
  const [timeframe, setTimeframe] = useState<Timeframe>('M15');
  const [expiryBucket, setExpiryBucket] = useState<ExpiryBucket>('all');
  const [volOpen, setVolOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);

  const { data, mutate, error, isLoading } = useOptionsExposure(symbol, expiryBucket);
  const regimeStatus = useRegimeStatus();

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
        regime={{
          label: regimeStatus.data?.current_regime ?? null,
          daysInRegime: regimeStatus.data?.days_in_regime ?? null,
          asOf: regimeStatus.data?.as_of ?? null,
          loading: regimeStatus.isLoading,
        }}
        onRefresh={() => mutate()}
        onOpenVolSurface={() => setVolOpen(true)}
        onOpenGuide={() => setGuideOpen(true)}
        onOpenDiagnostics={() => setDiagOpen(true)}
      />

      <main className="flex-1 px-4 py-3 flex flex-col gap-6">
        <DailyBriefBar />

        {/* TIER 1 — état global: gate principal, jamais replié */}
        <section className="flex flex-col gap-3">
          <TierLabel>Tier 1 · État global du système — gate principal (jamais trader si rouge)</TierLabel>
          <GlobalSystemGateBar />
        </section>

        {/* TIER 2 — vol & risk: surface, rough/markovien, path, carry, attribution, contrats */}
        <section className="flex flex-col gap-3">
          <TierLabel>Tier 2 · Volatilité & risque — surface · rough vs markovien · carry · attribution</TierLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <VolSurfaceRegimeCard />
            <RoughVsMarkovCard />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <PathFeaturesCard />
            <CarryBasisHealthPanel />
          </div>
          <M15StationarityCard />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <PnlAttributionPanel />
            <StrategyContractsTable />
          </div>
        </section>

        {/* Séparateur T2/T3 — anti association visuelle recherche → signal (audit §6) */}
        <div className="rounded-[3px] border border-dashed border-[var(--border)] bg-[var(--bg2)] px-3 py-1.5 font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">
          ⤓ Limite recherche / trading — ce qui précède (Tier 2) informe le pricing/hedging S1
          et le dimensionnement du risque. Aucun élément ci-dessus ne constitue un signal
          directionnel pour les setups M15 ci-dessous. Les seuls éléments tradable du Tier 3
          proviennent du statut VALIDATED du registre statistique.
        </div>

        {/* TIER 3 — signaux M15 + journal + skills */}
        <section className="flex flex-col gap-3">
          <TierLabel>Tier 3 · Signaux M15 · journal · skills agent</TierLabel>
          <M15SignalsGrid />
          <M15StrategiesBankCard />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <JournalTimeline />
            <AgentSkillsDashboard />
          </div>
          <LawsOfTheGameCard />
        </section>

        {error && (
          <div className="bg-[var(--bg2)] border border-[var(--caution)]/30 rounded-[3px] px-3 py-2 font-mono text-[0.55rem] text-[var(--muted)]">
            Options snapshot secondaire indisponible (cron GEX/DEX 4h17/16h17). Cockpit M15
            reste opérationnel via Hyperliquid live.
          </div>
        )}

        {/* NIVEAU 4 — contexte existant replié */}
        <ExploratorySection label="Bloc 1 · Synthèse — Régime · Macro · Edge M15">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <RegimeSummaryCard />
            <EdgeM15GlobalCard />
          </div>
        </ExploratorySection>

        <ExploratorySection label="Bloc 1b · Régime × Stratégie — heatmap perf">
          <RegimeStrategyMatrix />
        </ExploratorySection>

        <ExploratorySection label="Bloc 2 · Cockpit BTC M15 — prix + niveaux (directionnel NO_EDGE)">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-8 space-y-3">
              <PriceLevelsM15Chart />
            </div>
            <div className="lg:col-span-4 space-y-3">
              <EdgeM15BTCCard />
              <VolHeatmapM15 />
            </div>
          </div>
        </ExploratorySection>

        <ExploratorySection label="Bloc 3 · Corrélation · Session plan · Setups edge">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-3">
              <CorrelationTable />
            </div>
            <div className="lg:col-span-1">
              <SessionPlanCard />
            </div>
            <div className="lg:col-span-2">
              <SetupsPanel />
            </div>
          </div>
        </ExploratorySection>

        <ExploratorySection label="Bloc 4 · Order flow · OFI live · alpha term structure">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <OrderFlowImbalanceWidget />
            </div>
            <div className="lg:col-span-8">
              <AlphaTermStructureChart />
            </div>
            <div className="lg:col-span-12">
              <OfiSetupsPanel />
            </div>
          </div>
        </ExploratorySection>

        <ExploratorySection label="Bloc 5 · Carry D1 paper trader (état complet) · Execution H1H4">
          <div className="flex flex-col gap-3">
            <FundingCarryPanel />
            <ExecutionPanel timeframe="H1H4" />
          </div>
        </ExploratorySection>

        <ExploratorySection label="Bloc 6 · Top 50 — market cap · performance · funding perp">
          <Top50CryptoTable />
        </ExploratorySection>

        <ResearchProgramStatus variant="crypto" />

        <ExploratorySection label="Catalogue de recherche complet — 36 familles · 163 configs WF · filtrable par statut">
          <ResearchCatalog />
        </ExploratorySection>

        {!error && !data && !isLoading && (
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[3px] px-3 py-2 font-mono text-[0.55rem] text-[var(--muted)]">
            GEX/DEX en cours de configuration — visible via Diagnostics quand snapshot disponible.
          </div>
        )}
      </main>

      <footer className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px]">
        <span>
          Cockpit M15: gate VPS 2,17,32,47 · vol rough 23 */2 · Source M15: Hyperliquid
        </span>
        <span>
          As of: {data?.asOf ?? '—'}
        </span>
        <span className="text-[var(--dim)]">educational · not investment advice</span>
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
