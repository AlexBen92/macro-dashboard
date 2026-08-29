'use client';

import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

import { simulateFtmoRisk, type FtmoSpec } from '@/lib/ftmo';

const INPUT_CLASS =
  'w-[64px] rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] px-1.5 py-0.5 font-mono text-[0.6rem] text-[var(--text)] tabular-nums outline-none focus:border-[var(--purple)]';

function num(v: string, fallback: number): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function ProbBar({ label, p, color }: { label: string; p: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between font-mono text-[0.55rem]">
        <span className="text-[var(--label)] uppercase tracking-[1.5px]">{label}</span>
        <span className="tabular-nums" style={{ color }}>
          {(p * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-[3px] w-full bg-[var(--border)] rounded-[2px] overflow-hidden">
        <div
          className="h-full rounded-[2px] transition-[width]"
          style={{ width: `${Math.min(100, p * 100)}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function FtmoRiskPanel({ spec }: { spec: FtmoSpec }) {
  const [winRate, setWinRate] = useState('55');
  const [avgWin, setAvgWin] = useState('1.2');
  const [avgLoss, setAvgLoss] = useState('0.8');
  const [strategyVol, setStrategyVol] = useState('2.5');
  const [tradesPerDay, setTradesPerDay] = useState('3');
  const [daysPlanned, setDaysPlanned] = useState('30');

  const sim = useMemo(
    () =>
      simulateFtmoRisk({
        spec,
        strategyVol: num(strategyVol, 2.5) / 100,
        avgWin: num(avgWin, 1.2) / 100,
        avgLoss: num(avgLoss, 0.8) / 100,
        winRate: Math.min(1, num(winRate, 55) / 100),
        tradesPerDay: num(tradesPerDay, 3),
        daysPlanned: Math.min(120, Math.max(5, Math.round(num(daysPlanned, 30)))),
        nSims: 2000,
        seed: 42,
      }),
    [spec, winRate, avgWin, avgLoss, strategyVol, tradesPerDay, daysPlanned]
  );

  const targetPct =
    (spec.model === 'two_step' ? spec.profitTargetPhase1 : spec.profitTarget) * 100;
  const totalLossPct = spec.maxTotalLoss * 100;

  const pathData = sim.pnlPath.map((v, i) => ({ day: i + 1, pnl: v * 100 }));
  const usageData = sim.dailyLossUsage.map((u, i) => ({
    day: i + 1,
    daily: Math.min(u, 1.5),
    dd: Math.min(sim.maxDrawdownUsage[i] ?? 0, 1.5),
  }));

  const worstDailyUsage = sim.dailyLossUsage.length
    ? Math.max(...sim.dailyLossUsage)
    : 0;
  const worstDdUsage = sim.maxDrawdownUsage.length ? Math.max(...sim.maxDrawdownUsage) : 0;
  const nearBreachDaily = worstDailyUsage >= 0.7;
  const nearBreachTotal = worstDdUsage >= 0.7;

  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Risk panel prop-firm · Monte Carlo 2000 runs (seedé)
        </div>
        <div className="flex flex-wrap gap-1.5 font-mono text-[0.55rem] text-[var(--dim)]">
          {(
            [
              ['win %', winRate, setWinRate],
              ['avgW %', avgWin, setAvgWin],
              ['avgL %', avgLoss, setAvgLoss],
              ['vol j %', strategyVol, setStrategyVol],
              ['trades/j', tradesPerDay, setTradesPerDay],
              ['jours', daysPlanned, setDaysPlanned],
            ] as Array<[string, string, (v: string) => void]>
          ).map(([label, val, set]) => (
            <label key={label} className="flex items-center gap-1">
              <span className="uppercase tracking-[1px]">{label}</span>
              <input className={INPUT_CLASS} value={val} onChange={(e) => set(e.target.value)} />
            </label>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <ProbBar label="P(pass Challenge)" p={sim.probPassChallenge} color="var(--purple)" />
          <ProbBar
            label="P(pass Verification | Challenge)"
            p={sim.probPassVerification}
            color="var(--info-soft)"
          />
          <ProbBar label="P(reach funded)" p={sim.probReachFunded} color="var(--bull)" />
          <ProbBar label="P(breach daily 5%)" p={sim.probBreachDaily} color="var(--bear)" />
          <ProbBar label="P(breach total 10%)" p={sim.probBreachTotal} color="var(--bear)" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div
            className={`rounded-[2px] border px-2 py-1.5 font-mono text-[0.55rem] leading-relaxed ${
              nearBreachDaily
                ? 'border-[var(--bear)]/50 text-[var(--bear)] bg-[var(--bear)]/5'
                : 'border-[var(--border)] text-[var(--dim)] bg-[var(--bg3)]'
            }`}
          >
            <div className="uppercase tracking-[1.5px] text-[var(--label)]">Near-breach daily</div>
            pic usage médian: {(worstDailyUsage * 100).toFixed(0)}% de la limite
            {nearBreachDaily ? ' · ⚠ réduire taille/per trade' : ''}
          </div>
          <div
            className={`rounded-[2px] border px-2 py-1.5 font-mono text-[0.55rem] leading-relaxed ${
              nearBreachTotal
                ? 'border-[var(--bear)]/50 text-[var(--bear)] bg-[var(--bear)]/5'
                : 'border-[var(--border)] text-[var(--dim)] bg-[var(--bg3)]'
            }`}
          >
            <div className="uppercase tracking-[1.5px] text-[var(--label)]">Near-breach total</div>
            pic DD usage médian: {(worstDdUsage * 100).toFixed(0)}% de la limite
            {nearBreachTotal ? ' · ⚠ stop quotidien conseillé' : ''}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] p-2">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px] mb-1">
            Trajectoire PnL médiane (% compte) — target +{targetPct.toFixed(0)}% / solde −
            {totalLossPct.toFixed(0)}%
          </div>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pathData} margin={{ top: 4, right: 8, bottom: 2, left: -18 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
                <XAxis dataKey="day" tick={{ fontSize: 8, fill: 'var(--muted)' }} stroke="var(--border)" />
                <YAxis
                  tick={{ fontSize: 8, fill: 'var(--muted)' }}
                  stroke="var(--border)"
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    fontSize: 10,
                    fontFamily: 'monospace',
                  }}
                  formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`, 'PnL cumulé']}
                />
                <ReferenceLine y={targetPct} stroke="var(--purple)" strokeDasharray="4 2" />
                <ReferenceLine y={-totalLossPct} stroke="var(--bear)" strokeDasharray="4 2" />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Line type="monotone" dataKey="pnl" stroke="var(--purple)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-[2px] border border-[var(--border)] bg-[var(--bg3)] p-2">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px] mb-1">
            Usage limites — barres = daily loss, ligne = drawdown total (1.0 = breach)
          </div>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={usageData} margin={{ top: 4, right: 8, bottom: 2, left: -18 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
                <XAxis dataKey="day" tick={{ fontSize: 8, fill: 'var(--muted)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 8, fill: 'var(--muted)' }} stroke="var(--border)" />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    fontSize: 10,
                    fontFamily: 'monospace',
                  }}
                  formatter={(v: unknown, name: unknown) => [
                    `${(Number(v) * 100).toFixed(0)}%`,
                    name === 'daily' ? 'usage daily' : 'usage DD total',
                  ]}
                />
                <ReferenceLine y={1} stroke="var(--bear)" strokeDasharray="4 2" />
                <Bar dataKey="daily" fill="var(--purple)" radius={[1, 1, 0, 0]} />
                <Line type="monotone" dataKey="dd" stroke="var(--caution)" strokeWidth={1} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">
        Sim indépendante par phase (P2 redémarre à 0). Breach journalier = pire jour ≥{' '}
        {(spec.maxDailyLoss * 100).toFixed(0)}%; breach total = équity ≤ −
        {(spec.maxTotalLoss * 100).toFixed(0)}%. Vol cible scalée sur avgWin/avgLoss/winRate.
        Éducatif — pas un conseil d'investissement.
      </div>
    </section>
  );
}
