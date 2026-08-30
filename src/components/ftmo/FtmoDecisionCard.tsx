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
  frictionAnnual,
  label,
}: {
  mc: McResult;
  kelly: KellyResult;
  fee: number;
  frictionAnnual: number;
  label: string;
}) {
  // décomposition de l'edge: V0 brut (payouts non actualisés) → frictions → V0 juste (actualisé) → fee → edge net
  const edge = mc.fairValue - fee;
  const verdict = edge > 0 ? 'TAKE' : 'PASS';
  const verdictColor = edge > 0 ? 'var(--green)' : 'var(--red)';
  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Décision — valorisation d'UN challenge ({label})
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
            Funnel de passage — mesure Q
          </div>
          <FunnelBar label="Passe phase 1" p={mc.pPassPhase1} sub="probabilité risque-neutre (Q), pas prédiction réelle" />
          <FunnelBar label="Passe phase 2" p={mc.pPassPhase1 > 0 ? mc.pPassPhase2 / mc.pPassPhase1 : 0} sub="conditionnelle au passage phase 1" />
          <FunnelBar label="Atteint funded" p={mc.pReachFunded} />
          <FunnelBar label="KO funded (0 payout)" p={mc.pKoFunded} />
          <FunnelBar label="KO après ≥1 payout" p={mc.pKoAfterPayout} />
          <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed mt-0.5">
            Échec P1 {(mc.pFailP1 * 100).toFixed(1)}% · timeout P1 {(mc.pTimeoutP1 * 100).toFixed(1)}% · échec P2{' '}
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
              <span className="text-[var(--text)]">${mc.fairValue.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--label)]">dont frictions estimées/an</span>
              <span className="text-[var(--text)]">${frictionAnnual.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--label)]">fee challenge</span>
              <span className="text-[var(--red)]">−${fee.toFixed(0)}</span>
            </div>
            <div className="h-[1px] bg-[var(--border)]" />
            <div className="flex justify-between text-[0.65rem]">
              <span className="text-[var(--label)] uppercase tracking-[1px]">Edge net</span>
              <span style={{ color: verdictColor }}>${edge.toFixed(0)}</span>
            </div>
          </div>
          <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed">
            L'edge mesure l'écart entre le prix facturé par la firme et la valeur juste du même payoff sous la densité
            risque-neutre du marché d'options — pas une prédiction de compétence de trading.
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
    </section>
  );
}
