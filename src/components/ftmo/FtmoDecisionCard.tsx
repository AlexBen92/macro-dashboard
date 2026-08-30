'use client';

import type { McResult } from '@/lib/ftmo-pricer/monte-carlo';
import type { KellyResult } from '@/lib/ftmo-pricer/kelly-sizing';

function FunnelBar({ label, p, sub }: { label: string; p: number; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between font-mono text-[0.55rem]">
        <span className="text-[var(--label)] uppercase tracking-[1px]">{label}</span>
        <span className="text-[var(--text)]">{(p * 100).toFixed(1)}%</span>
      </div>
      <div className="h-[6px] w-full bg-[var(--border)] rounded-[2px] overflow-hidden">
        <div className="h-full bg-[var(--purple)]/70" style={{ width: `${Math.min(100, p * 100)}%` }} />
      </div>
      {sub ? <div className="font-mono text-[0.45rem] text-[var(--dim)]">{sub}</div> : null}
    </div>
  );
}

export default function FtmoDecisionCard({
  mc,
  kelly,
  fee,
  feeUsd,
  frictionAnnual,
  sensitivity,
  measureLabel,
  label,
}: {
  mc: McResult;
  kelly: KellyResult;
  fee: number;
  feeUsd: number;
  frictionAnnual: number;
  sensitivity: { costBps: number; erp: number; edge: number }[] | null;
  measureLabel: string;
  label: string;
}) {
  const edge = mc.fairValue - feeUsd;
  const edgeCI: [number, number] = [mc.fairValueCI95[0] - feeUsd, mc.fairValueCI95[1] - feeUsd];
  const ciContainsZero = edgeCI[0] <= 0 && edgeCI[1] >= 0;
  const verdict = ciContainsZero ? 'UNCERTAIN' : edge > 0 ? 'TAKE' : 'PASS';
  const verdictColor = verdict === 'TAKE' ? 'var(--green)' : verdict === 'PASS' ? 'var(--red)' : 'var(--orange)';
  const erpList = sensitivity ? [...new Set(sensitivity.map((s) => s.erp))].sort((a, b) => a - b) : [];
  const costList = sensitivity ? [...new Set(sensitivity.map((s) => s.costBps))].sort((a, b) => a - b) : [];

  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Décision — valorisation d'UN challenge ({label}) · {measureLabel}
        </div>
        <div
          className="rounded-[2px] border px-3 py-1 font-mono text-[0.7rem] tracking-[3px]"
          style={{ borderColor: verdictColor, color: verdictColor }}
        >
          {verdict}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Funnel de passage — {measureLabel}
          </div>
          <FunnelBar label="Passe phase 1" p={mc.pPassPhase1} />
          <FunnelBar label="Passe phase 2" p={mc.pPassPhase1 > 0 ? mc.pPassPhase2 / mc.pPassPhase1 : 0} sub="conditionnelle au passage phase 1" />
          <FunnelBar label="Atteint funded" p={mc.pReachFunded} />
          <FunnelBar label="Funded vivant à l'horizon" p={mc.pFundedAliveEnd} sub="252j funded, profit résiduel payé" />
          <FunnelBar label="KO funded (0 payout)" p={mc.pKoFunded} />
          <FunnelBar label="KO après ≥1 payout" p={mc.pKoAfterPayout} />
          <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed mt-0.5">
            Échec P1 {(mc.pFailP1 * 100).toFixed(1)}% (daily {(mc.pFailDailyP1 * 100).toFixed(1)}% · total{' '}
            {(mc.pFailTotalP1 * 100).toFixed(1)}%) · timeout P1 {(mc.pTimeoutP1 * 100).toFixed(1)}% · échec P2{' '}
            {(mc.pFailP2 * 100).toFixed(1)}% · timeout P2 {(mc.pTimeoutP2 * 100).toFixed(1)}%
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Décomposition de l'edge (par challenge)
          </div>
          <div className="flex flex-col gap-1 font-mono text-[0.55rem]">
            <div className="flex justify-between">
              <span className="text-[var(--label)]">E[payouts actualisés] (V0 juste)</span>
              <span className="text-[var(--text)]">
                ${mc.fairValue.toFixed(0)} ± ${(1.96 * mc.fairValueSe).toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--label)]">dont frictions estimées/an</span>
              <span className="text-[var(--text)]">${frictionAnnual.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--label)]">fee challenge</span>
              <span className="text-[var(--red)]">
                −€{fee.toFixed(0)} (−${feeUsd.toFixed(0)})
              </span>
            </div>
            <div className="h-[1px] bg-[var(--border)]" />
            <div className="flex justify-between text-[0.65rem]">
              <span className="text-[var(--label)] uppercase tracking-[1px]">Edge net ± IC95</span>
              <span style={{ color: verdictColor }}>
                ${edge.toFixed(0)} [${edgeCI[0].toFixed(0)}, ${edgeCI[1].toFixed(0)}]
              </span>
            </div>
          </div>
          <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed">
            L'edge mesure l'écart entre le prix facturé par la firme et la valeur juste du même payoff sous la densité
            du marché d'options — pas une prédiction de compétence de trading. UNCERTAIN = l'IC 95% contient 0.
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Kelly sizing (rachat en boucle)
          </div>
          <div className="flex flex-col gap-1 font-mono text-[0.55rem]">
            <div className="flex justify-between">
              <span className="text-[var(--label)]">Kelly pleine</span>
              <span className="text-[var(--text)]">{(kelly.fullKelly * 100).toFixed(1)}% de bankroll</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--label)]">Demi-Kelly (prudence)</span>
              <span className="text-[var(--green)]">{(kelly.halfKelly * 100).toFixed(1)}%</span>
            </div>
            {kelly.discreteKelly !== null ? (
              <div className="flex justify-between">
                <span className="text-[var(--label)]">Kelly discret (p−q/b)</span>
                <span className="text-[var(--text)]">{(kelly.discreteKelly * 100).toFixed(1)}%</span>
              </div>
            ) : null}
          </div>
          <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed">
            {kelly.interpretation}. Jamais un sizing de conviction directionnelle.
          </div>
          <div className="mt-1 font-mono text-[0.45rem] text-[var(--orange)] leading-relaxed">
            Le verdict porte sur un seul challenge: l'analyse de ruine (onglet bankroll) doit l'accompagner — jamais
            de TAKE sur la seule valeur juste sans viabilité du capital de rachat.
          </div>
        </div>
      </div>

      {sensitivity && erpList.length > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Sensibilité de l'edge — coûts (bps/j) × prime de risque (ERP)
          </div>
          <div className="grid gap-[1px]" style={{ gridTemplateColumns: `70px repeat(${costList.length}, 1fr)` }}>
            <div />
            {costList.map((c) => (
              <div key={c} className="text-center font-mono text-[0.5rem] text-[var(--dim)]">
                {c.toFixed(1)} bps
              </div>
            ))}
            {erpList.map((erp) => (
              <div key={erp} className="contents">
                <div className="flex items-center justify-end pr-1 font-mono text-[0.5rem] text-[var(--dim)]">
                  ERP {(erp * 100).toFixed(1)}%
                </div>
                {costList.map((c) => {
                  const cell = sensitivity.find((s) => s.costBps === c && s.erp === erp)!;
                  return (
                    <div
                      key={`${c}-${erp}`}
                      className="h-[18px] rounded-[1px] flex items-center justify-center font-mono text-[0.55rem]"
                      style={{
                        background:
                          cell.edge >= 0 ? `rgba(80,220,140,${0.12 + 0.4 * Math.min(1, cell.edge / 4000)})` : `rgba(235,90,90,${0.12 + 0.4 * Math.min(1, -cell.edge / 2000)})`,
                      }}
                    >
                      ${cell.edge.toFixed(0)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="font-mono text-[0.45rem] text-[var(--dim)]">
            Si la ligne Q vire au rouge à 3.3 bps/j, l'edge n'est pas robuste aux coûts — vérifier le swap US500 réel
            (MT5) avant tout TAKE.
          </div>
        </div>
      ) : null}
    </section>
  );
}
