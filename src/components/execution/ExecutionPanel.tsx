'use client';

/**
 * Panneau d'exécution — niveau 1, jamais replié.
 * Un seul composant paramétrable pour tous les timeframes réels:
 * BTC en M15 (scalping), ETH/SOL/alts en H1/H4 (swing).
 * Évite la duplication checklist/journal (règles de risk différentes
 * par nature, mais un seul code source).
 */
import Top5ScoreEngine from '@/components/Top5ScoreEngine';
import TradingChecklist from '@/components/TradingChecklist';
import TradeJournal from '@/components/TradeJournal';
import M15ScalpingSignals from '@/components/M15ScalpingSignals';
import H1H4PriceStrip from './H1H4PriceStrip';

export type ExecutionTimeframe = 'M15' | 'H1H4';

export default function ExecutionPanel({ timeframe }: { timeframe: ExecutionTimeframe }) {
  const isM15 = timeframe === 'M15';

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[0.72rem] text-[var(--text)] tracking-[3px] uppercase font-bold">
          {isM15 ? 'Exécution BTC · M15' : 'Exécution ETH / SOL / alts · H1–H4'}
        </span>
        <span className="font-mono text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase">
          {isM15 ? 'ton outil quotidien — scalping' : 'swing — SL/TP et sessions distincts du M15'}
        </span>
      </div>

      {isM15 ? (
        <>
          <Top5ScoreEngine />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
            <TradingChecklist variant="M15" />
            <TradeJournal scopeLabel="M15" />
          </div>
          <M15ScalpingSignals />
        </>
      ) : (
        <>
          <H1H4PriceStrip />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
            <TradingChecklist variant="H1H4" />
            <TradeJournal
              storageKey="hermes_trade_journal_h1h4"
              scopeLabel="H1/H4"
            />
          </div>
        </>
      )}
    </section>
  );
}
