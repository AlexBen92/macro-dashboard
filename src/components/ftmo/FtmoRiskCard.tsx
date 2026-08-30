'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import type { McResult } from '@/lib/ftmo-pricer/monte-carlo';
import { analyzePayoffs } from '@/lib/ftmo-pricer/payoff-distribution';

const OUTCOME_LABEL: Record<string, string> = {
  fail_phase1: 'échec P1',
  timeout_phase1: 'timeout P1',
  fail_phase2: 'échec P2',
  timeout_phase2: 'timeout P2',
  ko_funded: 'KO funded',
  ko_after_payout: 'KO post-payout',
  funded_alive_end: 'funded vivant',
};

const OUTCOME_COLOR: Record<string, string> = {
  fail_phase1: 'var(--red)',
  timeout_phase1: 'var(--orange)',
  fail_phase2: '#c56a6a',
  timeout_phase2: '#c58a4a',
  ko_funded: 'var(--red)',
  ko_after_payout: 'var(--orange)',
  funded_alive_end: 'var(--green)',
};

export default function FtmoRiskCard({ mc, accountSize, measureLabel }: { mc: McResult; accountSize: number; measureLabel?: string }) {
  const dist = useMemo(() => analyzePayoffs(mc.payoffs), [mc.payoffs]);
  const pathData = useMemo(() => {
    const entries = Object.entries(mc.representativePaths).slice(0, 7);
    const maxLen = Math.max(20, ...entries.map(([, p]) => p.length));
    const rows: Record<string, number>[] = [];
    for (let d = 0; d < Math.min(maxLen, 120); d++) {
      const row: Record<string, number> = { d };
      for (const [key, path] of entries) {
        row[key] = d < path.length ? +(path[d] / accountSize).toFixed(4) : undefined as unknown as number;
      }
      rows.push(row);
    }
    return { rows, keys: entries.map(([k]) => k) };
  }, [mc.representativePaths, accountSize]);

  return (
    <section className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 flex flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--purple)] uppercase tracking-[2px]">
          Risque — trajectoires & distribution{measureLabel ? ` (${measureLabel})` : ''}
        </div>
        <div className="font-mono text-[0.55rem] text-[var(--dim)]">
          {mc.nSims.toLocaleString('fr-FR')} chemins · équité en fraction du solde initial · knock-out = barrière
          (intraday pont brownien)
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Trajectoires d'équité stratifiées par issue
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pathData.rows}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
                <XAxis dataKey="d" tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" domain={[0.85, 1.15]} />
                <Tooltip contentStyle={{ fontSize: 9, background: 'var(--bg)', border: '1px solid var(--border)' }} />
                <ReferenceLine y={0.9} stroke="var(--red)" strokeDasharray="4 2" label={{ value: 'floor max loss 10%', position: 'insideBottomLeft', fontSize: 8, fill: 'var(--red)' }} />
                <ReferenceLine y={0.95} stroke="var(--orange)" strokeDasharray="4 2" label={{ value: 'daily −5% (rel. veille)', position: 'insideTopLeft', fontSize: 8, fill: 'var(--orange)' }} />
                <Line type="monotone" dataKey="1.1" stroke="var(--dim)" strokeDasharray="3 3" dot={false} strokeWidth={0.5} />
                {pathData.keys.map((k) => (
                  <Line key={k} type="monotone" dataKey={k} name={OUTCOME_LABEL[k] ?? k} stroke={OUTCOME_COLOR[k] ?? 'var(--purple)'} dot={false} strokeWidth={1.2} connectNulls={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[0.45rem] text-[var(--dim)]">
            {pathData.keys.map((k) => (
              <span key={k} style={{ color: OUTCOME_COLOR[k] ?? 'var(--purple)' }}>
                ■ {OUTCOME_LABEL[k] ?? k}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
            Distribution des payoffs nets de fee (échelle log)
          </div>
          <div className="h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist.bins.map((b) => ({ x: +b.x.toFixed(0), c: b.count }))}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
                <XAxis dataKey="x" tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" />
                <YAxis tick={{ fontSize: 8, fill: 'var(--dim)' }} stroke="var(--border)" />
                <Tooltip contentStyle={{ fontSize: 9, background: 'var(--bg)', border: '1px solid var(--border)' }} />
                <Bar dataKey="c" radius={[1, 1, 0, 0]}>
                  {dist.bins.map((b, i) => (
                    <Cell key={i} fill={b.x >= 0 ? 'rgba(80,220,140,0.75)' : 'rgba(235,90,90,0.75)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 font-mono text-[0.5rem]">
            <div className="flex justify-between">
              <span className="text-[var(--label)]">VaR95</span>
              <span className="text-[var(--red)]">${dist.var95.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--label)]">CVaR95</span>
              <span className="text-[var(--red)]">${dist.cvar95.toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--label)]">P(gain)</span>
              <span className="text-[var(--text)]">{(dist.pGain * 100).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--label)]">gain médian si gain</span>
              <span className="text-[var(--green)]">{dist.medianGain !== null ? `$${dist.medianGain.toFixed(0)}` : '—'}</span>
            </div>
          </div>
          <div className="font-mono text-[0.45rem] text-[var(--dim)]">
            Axe X en échelle log de part et d'autre de 0 — la queue des gains rares reste lisible face au pic perdant.
          </div>
        </div>
      </div>
    </section>
  );
}
