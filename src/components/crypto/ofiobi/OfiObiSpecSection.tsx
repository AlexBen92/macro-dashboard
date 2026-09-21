'use client';

import { useOfiObiStatus } from '@/hooks/api/useOfiObiStatus';

/**
 * Bloc 4b — Spec technique complète OFI/OBI (méthodo, définitions, backfill,
 * décision). Lecture seule: les registres edge_discovery (results/) restent
 * la source de vérité; ce panneau n'expose que la spécification figée.
 */
export default function OfiObiSpecSection() {
  const { data } = useOfiObiStatus();
  const spec = data?.spec;
  const backfill = data?.backfill ?? {};
  const incr = data?.incremental_ic as
    | Record<string, Record<string, Record<string, number | undefined>>>
    | undefined;
  const pbo = data?.pbo_lot ?? {};

  if (!spec || !spec.data) return null;

  const rows: Array<[string, string | undefined]> = [
    ['Barres', spec.data.bars],
    ['Zone HF', spec.data.hf_zone],
    ['Fenêtre', spec.data.window],
    ['Grille', spec.grid],
    ['Usage A', spec.usage_a_def],
    ['Usage B', spec.usage_b_def],
    ['Combinaison', spec.combination_def],
  ];

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="ofi-obi-spec">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          OFI/OBI — SPEC TECHNIQUE COMPLÈTE
        </span>
        <span className="font-mono text-[0.45rem] text-[var(--dim)]">
          spec figée 2026-09-21 · {data?.config_hash ? 'config ' + data.config_hash.slice(0, 10) : '—'}
        </span>
      </div>

      {/* Définitions */}
      <dl className="flex flex-col gap-1 mb-3">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="grid grid-cols-[64px_1fr] gap-2">
            <dt className="font-mono text-[0.5rem] uppercase tracking-[1px] text-[var(--label)] pt-0.5">{k}</dt>
            <dd className="font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">{v}</dd>
          </div>
        ))}
      </dl>

      {/* Signaux */}
      <div className="mb-3">
        <span className="font-mono text-[0.45rem] uppercase tracking-[2px] text-[var(--dim)]">Signaux</span>
        <div className="mt-1 flex flex-col gap-0.5">
          {Object.entries(spec.signals ?? {}).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="font-mono text-[0.5rem] text-[var(--label)] w-20 shrink-0">{k}</span>
              <span className="font-mono text-[0.5rem] text-[var(--muted)]">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Validation */}
      <div className="mb-3">
        <span className="font-mono text-[0.45rem] uppercase tracking-[2px] text-[var(--dim)]">Validation</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {(spec.validation ?? []).map((v) => (
            <span key={v} className="font-mono text-[0.45rem] px-1.5 py-0.5 rounded-[2px] border border-[var(--border)] text-[var(--muted)]">
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Backfill par coin */}
      {Object.keys(backfill).length > 0 && (
        <div className="mb-3">
          <span className="font-mono text-[0.45rem] uppercase tracking-[2px] text-[var(--dim)]">Backfill 30 j</span>
          <table className="mt-1 w-full border-collapse font-mono text-[0.5rem]">
            <thead>
              <tr className="text-[var(--label)] text-[0.42rem] uppercase tracking-[1px]">
                {['Coin', 'Barres', 'Barres/j', 'Spread bps (méd)', 'Corr OBI5↔imb5'].map((h) => (
                  <th key={h} className="text-left py-0.5 pr-2 border-b border-[var(--border)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(backfill).map(([coin, b]) => (
                <tr key={coin} className="border-b border-[var(--border)]/50">
                  <td className="py-1 pr-2 font-bold text-[var(--label)]">{coin}</td>
                  <td className="py-1 pr-2 text-[var(--muted)]">{b.bars?.toLocaleString('fr-FR') ?? '—'}</td>
                  <td className="py-1 pr-2 text-[var(--muted)]">{b.bars_per_day?.toLocaleString('fr-FR') ?? '—'}</td>
                  <td className="py-1 pr-2 text-[var(--muted)]">{b.spread_bps_median ?? '—'}</td>
                  <td className="py-1 text-[var(--muted)]">{b.obi5_vs_imbalance5_corr?.toFixed(3) ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* IC incrémental */}
      {incr && Object.keys(incr).length > 0 && (
        <div className="mb-3">
          <span className="font-mono text-[0.45rem] uppercase tracking-[2px] text-[var(--dim)]">
            IC incrémental (info propre au-delà d&apos;OFI-MO)
          </span>
          <table className="mt-1 w-full border-collapse font-mono text-[0.5rem]">
            <thead>
              <tr className="text-[var(--label)] text-[0.42rem] uppercase tracking-[1px]">
                {['Coin', 'H', 'OBI-10', 'incr OBI-10', 'incr OFI-book'].map((h) => (
                  <th key={h} className="text-left py-0.5 pr-2 border-b border-[var(--border)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(incr).flatMap(([coin, byH]) =>
                Object.entries(byH).map(([h, v]) => (
                  <tr key={coin + '-' + h} className="border-b border-[var(--border)]/50">
                    <td className="py-1 pr-2 font-bold text-[var(--label)]">{coin}</td>
                    <td className="py-1 pr-2 text-[var(--dim)]">H{h}</td>
                    <td className="py-1 pr-2 text-[var(--muted)]">{v.ic_obi_10?.toFixed(3) ?? '—'}</td>
                    <td className="py-1 pr-2 text-[var(--muted)]">{v.ic_obi10_incr?.toFixed(3) ?? '—'}</td>
                    <td className="py-1 text-[var(--muted)]">{v.ic_ofi_book_incr?.toFixed(3) ?? '—'}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PBO lot */}
      {Object.keys(pbo).length > 0 && (
        <div className="mb-3 flex gap-2 flex-wrap">
          {Object.entries(pbo).map(([coin, v]) => (
            <span
              key={coin}
              className="font-mono text-[0.45rem] px-1.5 py-0.5 rounded-[2px]"
              style={{
                border: '1px solid',
                color: (v.PBO ?? 0.5) >= 0.5 ? 'var(--caution)' : 'var(--muted)',
                borderColor: (v.PBO ?? 0.5) >= 0.5 ? 'var(--caution)' : 'var(--border)',
              }}
            >
              PBO {coin}: {v.PBO?.toFixed(2) ?? '—'} · {v.interpretation ?? '—'}
            </span>
          ))}
        </div>
      )}

      {/* Décision */}
      <div className="mb-2">
        <span className="font-mono text-[0.45rem] uppercase tracking-[2px] text-[var(--dim)]">Décision</span>
        <ul className="mt-1 flex flex-col gap-1 list-disc pl-4">
          {(spec.decision ?? []).map((d) => (
            <li key={d.slice(0, 32)} className="font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">{d}</li>
          ))}
        </ul>
      </div>

      {spec.reactivation && (
        <div className="rounded-[2px] border border-dashed border-[var(--caution)]/40 px-2 py-1 font-mono text-[0.45rem] leading-relaxed text-[var(--caution)]">
          Réactivation: {spec.reactivation}
        </div>
      )}

      <div className="mt-1.5 font-mono text-[0.4rem] text-[var(--dim)]">
        Coûts: {data?.costs || '—'} · Fenêtre: {data?.data_window_days} j · As of: {data?.as_of ?? '—'}
      </div>
    </div>
  );
}
