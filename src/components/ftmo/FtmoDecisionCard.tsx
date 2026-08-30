'use client';

import type { McResult, Outcome } from '@/lib/ftmo-pricer/monte-carlo';
import type { KellyResult } from '@/lib/ftmo-pricer/kelly-sizing';

export interface LadderRow {
  lambdaEval: number;
  riskDayPct: number;
  pPass1: number;
  pFunded: number;
  edgeNet: number;
  isStar: boolean;
}

const FUNDED_OUTCOMES: Outcome[] = ['ko_funded', 'ko_after_payout', 'funded_alive_end'];

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

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--label)]">{label}</span>
      <span style={color ? { color } : undefined} className="text-[var(--text)]">
        {value}
      </span>
    </div>
  );
}

export default function FtmoDecisionCard({
  mc,
  kelly,
  fee,
  feeUsd,
  feeRefundable,
  frictionAnnual,
  sensitivity,
  ladder,
  measureLabel,
  label,
}: {
  mc: McResult;
  kelly: KellyResult;
  fee: number;
  feeUsd: number;
  feeRefundable: boolean;
  frictionAnnual: number;
  sensitivity: { costBps: number; erp: number; edge: number }[] | null;
  ladder: LadderRow[] | null;
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

  // résistance du challenge + économie réelle
  const pFunded = mc.pReachFunded;
  const attempts = pFunded > 0 ? 1 / pFunded : Number.POSITIVE_INFINITY;
  const resets = Number.isFinite(attempts) ? Math.max(0, attempts - 1) : Number.POSITIVE_INFINITY;
  const ruinChallenge = mc.pFailP1 + mc.pFailP2;
  const cashIfFunded = mc.payoutsCash.filter((_, i) => FUNDED_OUTCOMES.includes(mc.outcomes[i]));
  const eCashGivenFunded =
    cashIfFunded.length > 0 ? cashIfFunded.reduce((s, x) => s + x, 0) / cashIfFunded.length : 0;
  const refundIfFunded = feeRefundable ? feeUsd : 0;
  const feesGrossExpected = Number.isFinite(attempts) ? attempts * feeUsd : Number.POSITIVE_INFINITY;
  const evCashToFunded = Number.isFinite(attempts)
    ? pFunded * (eCashGivenFunded + refundIfFunded) - feesGrossExpected
    : Number.NaN;
  const fmtInf = (v: number, fmt: (x: number) => string) => (Number.isFinite(v) ? fmt(v) : '—');

  // feu tricolore meta-setup: autorisation d'engagement, pas un signal de marché
  const traffic = (() => {
    if (pFunded >= 0.7 && resets < 2) return { level: 'GO', color: 'var(--green)' } as const;
    if (pFunded < 0.4 || resets >= 3) return { level: 'STOP', color: 'var(--red)' } as const;
    return { level: 'ATTENTION', color: 'var(--orange)' } as const;
  })();

  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Décision — valorisation d'UN challenge ({label}) · {measureLabel}
        </div>
        <div className="flex gap-1">
          <div
            className="rounded-[2px] border px-3 py-1 font-mono text-[0.7rem] tracking-[3px]"
            style={{ borderColor: verdictColor, color: verdictColor }}
          >
            {verdict}
          </div>
          <div
            className="rounded-[2px] border px-3 py-1 font-mono text-[0.7rem] tracking-[3px]"
            style={{ borderColor: traffic.color, color: traffic.color }}
            title="Meta-setup: autorisation d'engagement (pReachFunded ≥ 70% et resets < 2 → GO; < 40% ou ≥ 3 → STOP)"
          >
            ◉ {traffic.level}
          </div>
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
          <div className="mt-1 flex flex-col gap-0.5 rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-2 py-1.5 font-mono text-[0.55rem]">
            <Row label="Tentatives moyennes jusqu'au funded" value={fmtInf(attempts, (x) => x.toFixed(1))} />
            <Row label="Resets moyens" value={fmtInf(resets, (x) => x.toFixed(1))} color="var(--caution)" />
            <Row label="Risk-of-ruin du challenge (échec P1+P2)" value={`${(ruinChallenge * 100).toFixed(1)}%`} color="var(--red)" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Décomposition de l'edge (par challenge)
          </div>
          <div className="flex flex-col gap-1 font-mono text-[0.55rem]">
            <Row label="E[payouts actualisés] (V0 juste)" value={`$${mc.fairValue.toFixed(0)} ± ${(1.96 * mc.fairValueSe).toFixed(0)}`} />
            <Row label="dont frictions estimées/an" value={`$${frictionAnnual.toFixed(0)}`} />
            <Row label="fee challenge" value={`−€${fee.toFixed(0)} (−$${feeUsd.toFixed(0)})`} color="var(--red)" />
            <div className="h-[1px] bg-[var(--border)]" />
            <div className="flex justify-between text-[0.65rem]">
              <span className="text-[var(--label)] uppercase tracking-[1px]">Edge net ± IC95</span>
              <span style={{ color: verdictColor }}>
                ${edge.toFixed(0)} [${edgeCI[0].toFixed(0)}, ${edgeCI[1].toFixed(0)}]
              </span>
            </div>
          </div>

          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px] mt-1">
            Économie réelle — boucle de rachat
          </div>
          <div className="flex flex-col gap-1 font-mono text-[0.55rem]">
            <Row label="Fees brutes attendues (fee × tentatives)" value={fmtInf(feesGrossExpected, (x) => `−$${x.toFixed(0)}`)} color="var(--red)" />
            <Row label={`Refund au funded${feeRefundable ? '' : ' (non-remboursable)'}`} value={feeRefundable ? `+$${refundIfFunded.toFixed(0)}` : '$0'} color={feeRefundable ? 'var(--green)' : undefined} />
            <Row label="E[cash payouts | funded]" value={`$${eCashGivenFunded.toFixed(0)}`} />
            <div className="h-[1px] bg-[var(--border)]" />
            <Row label="EV cash net jusqu'au 1er funded" value={fmtInf(evCashToFunded, (x) => `${x >= 0 ? '+' : ''}$${x.toFixed(0)}`)} color={Number.isFinite(evCashToFunded) ? (evCashToFunded >= 0 ? 'var(--green)' : 'var(--red)') : undefined} />
          </div>
          <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed">
            Cash non actualisé, fees d'achat en boucle incluses (géométrique: E[tentatives] = 1/pFunded). La référence
            pricer reste la V0 juste actualisée ci-dessus.
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Kelly sizing (rachat en boucle)
          </div>
          <div className="flex flex-col gap-1 font-mono text-[0.55rem]">
            <Row label="Kelly pleine" value={`${(kelly.fullKelly * 100).toFixed(1)}% de bankroll`} />
            <Row label="Demi-Kelly (prudence)" value={`${(kelly.halfKelly * 100).toFixed(1)}%`} color="var(--green)" />
            {kelly.discreteKelly !== null ? (
              <Row label="Kelly discret (p−q/b)" value={`${(kelly.discreteKelly * 100).toFixed(1)}%`} />
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

      {ladder && ladder.length > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Échelle de risque — violence (λ éval) vs probabilité de passage · λ* surligné
          </div>
          <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-[1px] font-mono text-[0.55rem]">
            <div className="text-[var(--dim)]">risk/jour</div>
            <div className="text-[var(--dim)]">λ éval</div>
            <div className="text-[var(--dim)]">P(pass P1)</div>
            <div className="text-[var(--dim)]">P(funded)</div>
            <div className="text-[var(--dim)]">edge net / tentative</div>
            {ladder.map((r) => (
              <div key={r.lambdaEval} className="contents">
                <div className={r.isStar ? 'text-[var(--purple)]' : 'text-[var(--text)]'}>
                  {r.riskDayPct.toFixed(1)}%
                </div>
                <div className={r.isStar ? 'text-[var(--purple)]' : 'text-[var(--text)]'}>
                  {r.lambdaEval.toFixed(2)}{r.isStar ? ' ←λ*' : ''}
                </div>
                <div className={r.pPass1 >= 0.7 ? 'text-[var(--green)]' : r.pPass1 >= 0.4 ? 'text-[var(--orange)]' : 'text-[var(--red)]'}>
                  {(r.pPass1 * 100).toFixed(1)}%
                </div>
                <div className={r.pFunded >= 0.7 ? 'text-[var(--green)]' : r.pFunded >= 0.4 ? 'text-[var(--orange)]' : 'text-[var(--red)]'}>
                  {(r.pFunded * 100).toFixed(1)}%
                </div>
                <div className={r.edgeNet >= 0 ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                  {r.edgeNet >= 0 ? '+' : ''}${r.edgeNet.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
          <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed">
            risk/jour = λ × σ_daily calibrée Bates (√(V0/252)) — proxy MC du risk/trade. Baisser λ ↑ probPass ↓
            resets: le dosage de violence passe avant l'EV brut (cible 10% élevée).
          </div>
        </div>
      ) : null}

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
              <div className="contents" key={erp}>
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
