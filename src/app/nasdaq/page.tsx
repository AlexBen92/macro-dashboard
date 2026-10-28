'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  BADGE_UNVALIDATED,
  breakLabel,
  isStale,
  sampleBadge,
  type NasdaqContext,
  type NasdaqStats,
  type NasdaqStatus,
} from '@/lib/nasdaq';

interface Payload {
  status?: NasdaqStatus;
  context?: NasdaqContext;
  stats?: NasdaqStats;
  stale?: Record<string, boolean>;
}

function Num({ v, unit = '' }: { v: number | null | undefined; unit?: string }) {
  if (v === null || v === undefined || Number.isNaN(v)) return <span>—</span>;
  return (
    <span>
      {v.toLocaleString('fr-FR')}
      {unit}
    </span>
  );
}

function Card({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {badge ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            {badge}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export default function NasdaqPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/nasdaq', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Payload);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const { status, context, stats, stale } = data ?? {};
  const score = context?.score;
  const classe = status?.range?.classe;
  const ag = stats?.aggregats;

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      {/* §6.3 badge honnêteté permanent */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        ⚠️ {BADGE_UNVALIDATED} · Backtest NQ 2010+ Databento : NO-GO (t=−4.3 dev,
        WF bruit, OOS non ouvert). Descriptif = {ag?.n_days ?? 0} jours
        (Databento M1 2010-06→2026-10).
      </div>
      {err ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          Erreur API : {err}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Range du jour (09:30-09:45 ET)" badge={sampleBadge(ag?.n_days)}>
          {status?.range ? (
            <ul className="space-y-1 text-sm">
              <li>
                Haut / Bas : <Num v={status.range.hi} /> / <Num v={status.range.lo} />
              </li>
              <li>
                Largeur : <Num v={status.range.pts} unit=" pts" /> ·{' '}
                <Num v={status.range.pct_em ? status.range.pct_em * 100 : null} unit=" % EM" />
              </li>
              <li>
                Classe : <b>{classe}</b> (règle §2 : pas de trade si large &gt; 0,5 EM)
              </li>
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">Données indisponibles</p>
          )}
          {stale?.status ? (
            <p className="mt-2 text-xs text-red-600">⚠️ status périmé</p>
          ) : null}
        </Card>

        <Card title="État de cassure (clôture M5 hors range)">
          <p className="text-sm">
            {breakLabel(status?.break ?? null)}
            {status?.break?.px ? (
              <>
                {' '}
                @ <Num v={status.break.px} />
              </>
            ) : null}
          </p>
          {status?.theo ? (
            <ul className="mt-2 space-y-1 text-sm text-neutral-600 dark:text-neutral-400">
              <li>
                Théorique {status.theo.dir} : entry <Num v={status.theo.entry} /> / stop{' '}
                <Num v={status.theo.stop} /> ({status.theo.regle_stop})
              </li>
              <li>
                P&amp;L : <Num v={status.theo.pnl_pts} unit=" pts" /> (
                <Num v={status.theo.pnl_R} unit=" R" />) · MFE <Num v={status.theo.mfe_pts} /> ·
                MAE <Num v={status.theo.mae_pts} />
              </li>
            </ul>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">Aucune entrée théorique</p>
          )}
        </Card>

        <Card title="Volatilité (VXN, FRED VXNCLS)">
          {context?.vxn ? (
            <ul className="space-y-1 text-sm">
              <li>
                VXN : <Num v={context.vxn.level} /> ({context.vxn.date}) · percentile 1 an :{' '}
                <Num v={context.vxn.pct_1y} unit=" %" />
              </li>
              <li>
                Expected move jour : <Num v={context.em_pts} unit=" pts" /> (open × VXN/√252)
              </li>
              <li>
                Multiplicateur confiance : <Num v={context.vol_mult} />
              </li>
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">—</p>
          )}
        </Card>

        <Card title="Score de contexte (§5, poids fixes)" badge="breadth/macro absents">
          <div className="flex items-center gap-3">
            <div className="text-3xl font-bold">{score !== undefined ? score : '—'}</div>
            <div className="flex-1">
              <div className="h-2 w-full rounded bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-2 rounded bg-blue-500"
                  style={{ width: `${Math.min(100, Math.abs(score ?? 0))}%` }}
                />
              </div>
            </div>
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {context
              ? Object.entries(context.composantes).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span>{k}</span>
                    <span>
                      {v.v === null || v.v === undefined ? 'absent' : v.v.toFixed(2)} × {v.w}
                    </span>
                  </li>
                ))
              : null}
          </ul>
        </Card>

        <Card title="Corrélations glissantes ^NDX (20/60 j)" badge="display only">
          {context?.corr ? (
            <ul className="space-y-1 text-sm">
              {Object.entries(context.corr.correlations).map(([k, v]) => (
                <li key={k} className="flex justify-between">
                  <span>{k}</span>
                  <span>
                    {v.c20} / {v.c60}
                    {v.c20 * v.c60 < 0 ? ' ⚠️ signe' : ''}
                  </span>
                </li>
              ))}
              {context.corr.changement_signe.length ? (
                <li className="text-xs text-amber-600">
                  Changement de signe : {context.corr.changement_signe.join(', ')}
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">—</p>
          )}
        </Card>

        <Card title="Jours semblables (descriptif 28 j)" badge={sampleBadge(ag?.n_days)}>
          {ag ? (
            <ul className="space-y-1 text-sm">
              <li>
                Break : <Num v={ag.break_pct} unit=" %" /> · doubles :{' '}
                <Num v={ag.double_break_pct} unit=" %" /> ({ag.n_days} j)
              </li>
              {Object.entries(ag.par_classe).map(([k, v]) => {
                const c = v as Record<string, number | null>;
                return (
                  <li key={k} className="text-xs text-neutral-600 dark:text-neutral-400">
                    {k} (n={c.n}) : continuation <Num v={c.continuation_pct} unit=" %" /> · MFE{' '}
                    <Num v={c.mfe_median_pts} /> / MAE <Num v={c.mae_median_pts} /> pts
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">—</p>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            Source : Yahoo NQ=F M1 (rétention ~28 j) — pas d&apos;inférence avant données
            2010+ (Databento/FirstRate).
          </p>
        </Card>
      </div>

      <p className="text-xs text-neutral-500">
        as_of : {status?.as_of_et ?? '—'} · phases collecteurs : premarket 09:25 / range 09:45 /
        tick 2 min / close 16:15 ET (timers systemd, fériés US exclus) · horloge source UTC.
      </p>
    </main>
  );
}
