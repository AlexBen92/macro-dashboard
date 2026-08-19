'use client';

import { useEffect, useMemo, useState } from 'react';
import catalog from '@/config/research-catalog.json';
import {
  RESEARCH_STATUS_COLOR,
  RESEARCH_STATUS_LABEL,
  RESEARCH_STATUS_ORDER,
  type ResearchStatus,
} from '@/lib/researchStatus';

interface FamilyRow {
  category: string;
  family: string;
  status: ResearchStatus;
  tf: string;
  note: string;
  val_sharpe: number | null;
  hold_sharpe: number | null;
  val_pf: number | null;
  hold_pf: number | null;
  n_trades: number | null;
  permutation_p: number | null;
  dsr_prob: number | null;
}

interface M15Setup {
  setup: string;
  status: ResearchStatus;
  tradable: boolean;
  n_configs: number | null;
  n_trades: number | null;
  pf_range: [number, number] | null;
  permutation_p_upper: number | null;
  ref: string | null;
}

interface OrderflowRun {
  name: string;
  symbol: string;
  horizon: string;
  fee_scenario: string;
  status: string;
  verdict: string;
  alpha_decay_flag: boolean;
  metrics: { sh_oos: number; mc_p5_bps: number; n_trades: number };
}

interface OrderflowAgg {
  name: string;
  n_runs: number;
  n_on: number;
  n_borderline: number;
  n_alpha_decay: number;
  worst_real_sh: number;
  registry: ResearchStatus;
}

const CATEGORY_LABELS: Record<string, string> = {
  A_tendance: 'A · tendance',
  B_mean_reversion: 'B · mean reversion',
  C_volatilite_regime: 'C · volatilité / régime',
  D_cross_asset_macro: 'D · cross-asset macro',
  E_statistique_factoriel: 'E · statistique factoriel',
  F_derivees_lentes: 'F · dérivées lentes',
  G_ml_meta: 'G · ML / méta',
  H_onchain: 'H · on-chain',
  I_vol_structuree: 'I · vol structurelle',
  J_evenementiel: 'J · événementiel',
  K_relative_value: 'K · relative value',
  L_reseau_correlation: 'L · réseau corrélation',
  M_ensemble: 'M · ensemble',
  N_post_choc: 'N · post-choc',
};

function num(x: number | null, digits = 2): string {
  return x === null || x === undefined ? '—' : x.toFixed(digits);
}

function StatusPill({ status }: { status: ResearchStatus }) {
  const color = RESEARCH_STATUS_COLOR[status] ?? 'var(--dim)';
  const dead = status === 'NULL' || status === 'NO_EDGE' || status === 'UNTESTED' || status === 'BLOCKED';
  return (
    <span
      className="font-mono text-[0.55rem] uppercase tracking-[1px] px-1.5 py-px rounded-[2px] border"
      style={{ color, borderColor: color, opacity: dead ? 0.55 : 1 }}
    >
      {RESEARCH_STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function ResearchCatalog() {
  const families = catalog.families as FamilyRow[];
  const m15 = catalog.m15_setups as M15Setup[];

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [catFilter, setCatFilter] = useState<string>('ALL');
  const [tfFilter, setTfFilter] = useState<string>('ALL');
  const [hideNull, setHideNull] = useState(false);

  const [orderflow, setOrderflow] = useState<OrderflowAgg[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/agent/state')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { orderflow?: { strategies?: OrderflowRun[] } }) => {
        if (cancelled || !d.orderflow?.strategies) return;
        const byName = new Map<string, OrderflowRun[]>();
        for (const r of d.orderflow.strategies) {
          const list = byName.get(r.name) ?? [];
          list.push(r);
          byName.set(r.name, list);
        }
        const aggs: OrderflowAgg[] = [...byName.entries()].map(([name, runs]) => {
          const nOn = runs.filter((r) => r.status === 'ON').length;
          const nBorderline = runs.filter((r) => r.verdict === 'BORDERLINE').length;
          const nDecay = runs.filter((r) => r.alpha_decay_flag).length;
          const realRuns = runs.filter((r) => r.fee_scenario === 'alphax_real');
          const worstRealSh = realRuns.length
            ? Math.min(...realRuns.map((r) => r.metrics.sh_oos))
            : Math.min(...runs.map((r) => r.metrics.sh_oos));
          const registry: ResearchStatus =
            nOn > 0 && nDecay < runs.length && nBorderline > 0
              ? 'BORDERLINE'
              : 'NULL';
          return { name, n_runs: runs.length, n_on: nOn, n_borderline: nBorderline, n_alpha_decay: nDecay, worst_real_sh: worstRealSh, registry };
        });
        aggs.sort((a, b) => b.n_on - a.n_on || a.name.localeCompare(b.name));
        if (!cancelled) setOrderflow(aggs);
      })
      .catch(() => {
        if (!cancelled) setOrderflow([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statuses = useMemo(
    () =>
      RESEARCH_STATUS_ORDER.filter((s) =>
        families.some((f) => f.status === s) || m15.some((s2) => s2.status === s),
      ),
    [families, m15],
  );
  const cats = useMemo(
    () => Object.keys(CATEGORY_LABELS).filter((c) => families.some((f) => f.category === c)),
    [families],
  );
  const tfs = useMemo(
    () => Array.from(new Set(families.map((f) => f.tf).filter(Boolean))).sort(),
    [families],
  );

  const rows = useMemo(() => {
    const filtered = families.filter(
      (f) =>
        (statusFilter === 'ALL' || f.status === statusFilter) &&
        (catFilter === 'ALL' || f.category === catFilter) &&
        (tfFilter === 'ALL' || f.tf === tfFilter) &&
        (!hideNull || !['NULL', 'NO_EDGE', 'UNTESTED', 'BLOCKED', 'NOT_TESTABLE'].includes(f.status)),
    );
    return [...filtered].sort(
      (a, b) =>
        RESEARCH_STATUS_ORDER.indexOf(a.status) - RESEARCH_STATUS_ORDER.indexOf(b.status) ||
        a.category.localeCompare(b.category),
    );
  }, [families, statusFilter, catFilter, tfFilter, hideNull]);

  const selectCls =
    'bg-[var(--bg3)] border border-[var(--border)] rounded-[3px] font-mono text-[0.6rem] text-[var(--text)] px-2 py-1 uppercase tracking-[1px]';

  return (
    <div className="flex flex-col gap-4">
      {/* FILTRES */}
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectCls} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">statut · tous</option>
          {statuses.map((s) => (
            <option key={s} value={s}>
              {RESEARCH_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select className={selectCls} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="ALL">catégorie · toutes</option>
          {cats.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
        <select className={selectCls} value={tfFilter} onChange={(e) => setTfFilter(e.target.value)}>
          <option value="ALL">tf · tous</option>
          {tfs.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-[1px] cursor-pointer">
          <input type="checkbox" checked={hideNull} onChange={(e) => setHideNull(e.target.checked)} />
          masquer null/bloqués
        </label>
        <span className="font-mono text-[0.55rem] text-[var(--muted)] ml-auto">
          {rows.length}/{families.length} familles
        </span>
      </div>

      {/* TABLE FAMILLES */}
      <div className="overflow-x-auto bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
        <table className="w-full font-mono text-[0.62rem] min-w-[900px]">
          <thead>
            <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
              <th className="text-left py-2 pl-3 pr-2">famille</th>
              <th className="text-left py-2 px-2">catégorie</th>
              <th className="text-left py-2 px-2">tf</th>
              <th className="text-left py-2 px-2">statut</th>
              <th className="text-right py-2 px-2" title="Sharpe pooled validation (IS)">valSh</th>
              <th className="text-right py-2 px-2" title="Sharpe pooled holdout (OOS)">hoSh</th>
              <th className="text-right py-2 px-2" title="Profit factor validation">PF</th>
              <th className="text-right py-2 px-2" title="p-value test permutation (jambes)">perm p</th>
              <th className="text-right py-2 px-2" title="Deflated Sharpe Ratio probabilité">DSR</th>
              <th className="text-right py-2 px-2">trades</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((f) => {
              const dead = ['NULL', 'NO_EDGE', 'UNTESTED', 'BLOCKED', 'NOT_TESTABLE'].includes(f.status);
              return (
                <tr key={`${f.category}:${f.family}`} className="hover:bg-[var(--bg3)]" style={{ opacity: dead ? 0.5 : 1 }}>
                  <td className="py-1.5 pl-3 pr-2 text-[var(--label)]" title={f.note}>{f.family}</td>
                  <td className="py-1.5 px-2 text-[var(--dim)]">{CATEGORY_LABELS[f.category] ?? f.category}</td>
                  <td className="py-1.5 px-2 text-[var(--dim)]">{f.tf || '—'}</td>
                  <td className="py-1.5 px-2"><StatusPill status={f.status} /></td>
                  <td className="py-1.5 px-2 text-right text-[var(--text)]">{num(f.val_sharpe)}</td>
                  <td className="py-1.5 px-2 text-right" style={{ color: (f.hold_sharpe ?? 0) > 0 ? 'var(--bull)' : 'var(--dim)' }}>{num(f.hold_sharpe)}</td>
                  <td className="py-1.5 px-2 text-right text-[var(--text)]">{num(f.val_pf)}</td>
                  <td className="py-1.5 px-2 text-right text-[var(--text)]">{f.permutation_p === null ? '—' : f.permutation_p.toFixed(3)}</td>
                  <td className="py-1.5 px-2 text-right text-[var(--text)]">{num(f.dsr_prob)}</td>
                  <td className="py-1.5 px-2 text-right text-[var(--dim)]">{f.n_trades ?? '—'}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="py-6 text-center text-[var(--muted)]">aucune famille — ajuster les filtres</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* SETUPS M15 */}
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--label)] tracking-[3px] uppercase">
          setups m15 · decision engine
        </div>
        <div className="overflow-x-auto bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
          <table className="w-full font-mono text-[0.62rem] min-w-[700px]">
            <thead>
              <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
                <th className="text-left py-2 pl-3 pr-2">setup</th>
                <th className="text-left py-2 px-2">statut</th>
                <th className="text-left py-2 px-2">tradable</th>
                <th className="text-right py-2 px-2">configs</th>
                <th className="text-right py-2 px-2">trades</th>
                <th className="text-right py-2 px-2">pf range</th>
                <th className="text-right py-2 px-2 pr-3">perm p↑</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {m15.map((s) => (
                <tr key={s.setup} className="hover:bg-[var(--bg3)]">
                  <td className="py-1.5 pl-3 pr-2 text-[var(--label)]">{s.setup}</td>
                  <td className="py-1.5 px-2"><StatusPill status={s.status} /></td>
                  <td className="py-1.5 px-2" style={{ color: s.tradable ? 'var(--bull)' : 'var(--dim)' }}>
                    {s.tradable ? 'oui' : 'non'}
                  </td>
                  <td className="py-1.5 px-2 text-right text-[var(--text)]">{s.n_configs ?? '—'}</td>
                  <td className="py-1.5 px-2 text-right text-[var(--text)]">{s.n_trades ?? '—'}</td>
                  <td className="py-1.5 px-2 text-right text-[var(--dim)]">
                    {s.pf_range ? `${s.pf_range[0].toFixed(2)}–${s.pf_range[1].toFixed(2)}` : '—'}
                  </td>
                  <td className="py-1.5 px-2 pr-3 text-right text-[var(--text)]">
                    {s.permutation_p_upper === null ? '—' : s.permutation_p_upper.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ORDERFLOW INTRADAY — rattaché au même registre (source /api/agent/state, WF quotidien 06:23 UTC) */}
      <div className="flex flex-col gap-2">
        <div className="font-mono text-[0.65rem] text-[var(--label)] tracking-[3px] uppercase">
          orderflow intraday · 4 stratégies × 16 combos wf (1m–1h, frais zéro vs réels)
        </div>
        {orderflow === null ? (
          <div className="py-4 text-center font-mono text-[0.6rem] text-[var(--muted)]">chargement orderflow ···</div>
        ) : (
          <div className="overflow-x-auto bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
            <table className="w-full font-mono text-[0.62rem] min-w-[700px]">
              <thead>
                <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
                  <th className="text-left py-2 pl-3 pr-2">stratégie</th>
                  <th className="text-left py-2 px-2">statut registre</th>
                  <th className="text-right py-2 px-2">combos ON</th>
                  <th className="text-right py-2 px-2" title="Runs verdict BORDERLINE (16 combos)">borderline</th>
                  <th className="text-right py-2 px-2" title="Runs flaggés alpha decay par le moniteur CUSUM">α-decay</th>
                  <th className="text-right py-2 px-2 pr-3" title="Pire Sharpe OOS sous scénario frais réels (alphax)">pire Sh OOS réels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {orderflow.map((o) => (
                  <tr key={o.name} className="hover:bg-[var(--bg3)]" style={{ opacity: o.registry === 'NULL' ? 0.5 : 1 }}>
                    <td className="py-1.5 pl-3 pr-2 text-[var(--label)]">{o.name}</td>
                    <td className="py-1.5 px-2"><StatusPill status={o.registry} /></td>
                    <td className="py-1.5 px-2 text-right text-[var(--text)]">{o.n_on}/{o.n_runs}</td>
                    <td className="py-1.5 px-2 text-right text-[var(--text)]">{o.n_borderline}</td>
                    <td className="py-1.5 px-2 text-right text-[var(--dim)]">{o.n_alpha_decay}</td>
                    <td className="py-1.5 px-2 pr-3 text-right" style={{ color: o.worst_real_sh > 0 ? 'var(--bull)' : 'var(--dim)' }}>
                      {o.worst_real_sh.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {orderflow.length === 0 && (
                  <tr><td colSpan={6} className="py-6 text-center text-[var(--muted)]">orderflow indisponible — /api/agent/state injoignable</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <div className="font-mono text-[0.55rem] text-[var(--muted)]">
          0/64 gates de validation passés — aucune combo tradable. Mapping registre: BORDERLINE si ≥1 combo ON sans alpha decay, sinon NULL (INCONCLUSIVE). Fres réels détruisent la plupart des edges 1m–15m (ex. Alpha2Scalp BTC 1m: Sh −5.12 → −276).
        </div>
      </div>
    </div>
  );
}
