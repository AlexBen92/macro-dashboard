'use client';

import type { RuinAnalysisResult } from '@/lib/ftmo-pricer/ruin-analysis';

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 font-mono text-[0.55rem]">
      <span className="text-[var(--label)] uppercase tracking-[1px]">{label}</span>
      <span className="text-[var(--text)]" title={hint}>
        {value}
      </span>
    </div>
  );
}

export default function FtmoBankrollCard({
  result,
  loading,
  onRun,
  years,
  nScen,
}: {
  result: RuinAnalysisResult | null;
  loading: boolean;
  onRun: () => void;
  years: number;
  nScen: number;
}) {
  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Bankroll — backtest synthétique du rachat en boucle
        </div>
        <button
          onClick={onRun}
          disabled={loading}
          className="rounded-[2px] border border-[var(--border)] px-2 py-0.5 font-mono text-[0.5rem] uppercase tracking-[1px] text-[var(--dim)] hover:text-[var(--text)] disabled:opacity-50"
        >
          {loading ? 'simulation…' : `lancer ${nScen} scénarios × ${years} ans`}
        </button>
      </header>

      <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed">
        Simulation risque-neutre (Q) sur forwards — backtest synthétique, pas de données historiques. Le capital de
        départ sert à racheter systématiquement le challenge en boucle.
      </div>

      {result ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="rounded-[2px] border px-3 py-1 font-mono text-[0.65rem] tracking-[2px]"
              style={{
                borderColor: result.edgeRealise ? 'var(--green)' : 'var(--red)',
                color: result.edgeRealise ? 'var(--green)' : 'var(--red)',
              }}
            >
              {result.edgeRealise ? 'EDGE RÉALISÉ' : "PAS D'EDGE RÉALISÉ"}
            </div>
            <div className="font-mono text-[0.5rem] text-[var(--dim)]">
              {result.minimalCapital !== null
                ? `capital initial minimal viable: $${result.minimalCapital.toLocaleString('fr-FR')} (P(ruine)≤5% ET NAV médiane finale > capital)`
                : 'aucun capital de la grille ne satisfait les deux critères simultanément'}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {result.scenarios.map((s) => (
              <div key={s.initialCapital} className="rounded-[3px] border border-[var(--border)] p-2 flex flex-col gap-1">
                <div className="font-mono text-[0.6rem] text-[var(--purple)]">
                  Capital ${s.initialCapital.toLocaleString('fr-FR')}
                </div>
                <Row label="P(ruine)" value={`${(s.pRuin * 100).toFixed(1)}%`} />
                <Row label="NAV médiane finale" value={`$${s.medianFinalNav.toFixed(0)}`} />
                <Row label="CAGR médian" value={`${(s.medianCagr * 100).toFixed(1)}%`} />
                <Row label="Calmar médian" value={s.medianCalmar.toFixed(2)} />
                <Row label="Sharpe(NAV)" value={s.sharpeNav.toFixed(2)} />
                <Row label="P(breakeven)" value={`${(s.pBreakeven * 100).toFixed(0)}%`} />
                <Row label="Breakeven médian" value={s.medianBreakevenDays !== null ? `${s.medianBreakevenDays.toFixed(0)}j` : '—'} />
                <Row label="Max DD médian (NAV)" value={`${(s.medianMaxDd * 100).toFixed(1)}%`} />
                <Row label="Max DD P95 (NAV)" value={`${(s.p95MaxDd * 100).toFixed(1)}%`} />
                <Row label="Challenges lancés (moy.)" value={s.avgChallenges.toFixed(1)} />
                <Row label="Funded atteints (moy.)" value={s.avgFunded.toFixed(1)} />
                <Row label="P(≥1 funded)" value={`${(s.pAtLeastOneFunded * 100).toFixed(0)}%`} />
                <Row label="Payouts−fees (moy.)" value={`$${s.avgPayoutsMinusFees.toFixed(0)}`} />
              </div>
            ))}
          </div>

          <div className="font-mono text-[0.45rem] text-[var(--orange)]">
            Le badge EDGE RÉALISÉ n'apparaît que si P(ruine) ≤ 5% et NAV médiane finale &gt; capital initial tiennent
            simultanément — jamais l'un sans l'autre.
          </div>
        </>
      ) : (
        <div className="h-[100px] flex items-center justify-center font-mono text-[0.5rem] text-[var(--dim)]">
          {loading ? 'simulation multi-années en cours…' : 'cliquer pour lancer la simulation de rachat en boucle'}
        </div>
      )}
    </section>
  );
}
