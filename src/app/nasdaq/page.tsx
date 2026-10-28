'use client';

import { useCallback, useEffect, useState } from 'react';

import OrbChart from '@/components/nasdaq/OrbChart';
import SessionBar from '@/components/nasdaq/SessionBar';
import TradePlan from '@/components/nasdaq/TradePlan';
import { WarnIcon } from '@/components/nasdaq/icons';
import {
  BADGE_UNVALIDATED,
  breakLabel,
  isStale,
  lookupBucket,
  sampleBadge,
  similarKeys,
  staleSinceMin,
  strategyTone,
  upcomingEvents,
  type NasdaqBars,
  type NasdaqEvents,
  type NasdaqEvent,
  type NasdaqContext,
  type NasdaqNightDay,
  type NasdaqSessionCal,
  type NasdaqStats,
  type NasdaqStatus,
  type NasdaqStrategies,
} from '@/lib/nasdaq';

interface Payload {
  status?: NasdaqStatus;
  context?: NasdaqContext;
  stats?: NasdaqStats;
  night_day?: NasdaqNightDay;
  events?: NasdaqEvents;
  strategies?: NasdaqStrategies;
  session?: NasdaqSessionCal;
  bars?: NasdaqBars;
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

function StaleNote({ label, asOf }: { label: string; asOf?: string }) {
  const m = staleSinceMin(asOf);
  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
      <WarnIcon className="h-3 w-3" />
      {label} périmé{m !== null ? ` depuis ${m} min` : ''}
    </p>
  );
}

function EventRow({ e }: { e: NasdaqEvent }) {
  const jour = e.date.slice(8, 10) + '/' + e.date.slice(5, 7);
  const estimé = e.source === 'estimé';
  return (
    <li className="flex items-baseline justify-between gap-2 text-sm">
      <span>
        <span className="font-mono text-xs">{jour}</span> · {e.label}
        {estimé ? (
          <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            estimé
          </span>
        ) : null}
      </span>
      <span className="whitespace-nowrap text-xs text-neutral-500">
        {e.heure_paris === 'après clôture' ? 'après clôture' : `${e.heure_paris} Paris`}
      </span>
    </li>
  );
}

function StrategyRow({ s }: { s: NonNullable<NasdaqStrategies['strategies']>[number] }) {
  const tone = strategyTone(s.statut);
  const cls =
    tone === 'no-go'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
      : tone === 'untested'
        ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
  return (
    <li className="flex items-baseline justify-between gap-2 text-sm">
      <span className="min-w-0">
        {s.famille ?? s.id}{' '}
        <span className={`rounded px-1 text-[10px] ${cls}`}>{s.statut}</span>
        {s.note ? (
          <span className="block text-xs text-neutral-500">{s.note}</span>
        ) : null}
      </span>
      <span className="whitespace-nowrap text-xs text-neutral-500">
        {s.essais} essai{s.essais > 1 ? 's' : ''}
        {s.verdict ? ` · ${s.verdict.slice(0, 10)}` : ''}
      </span>
    </li>
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

  const { status, context, stats, night_day, events, strategies, session: sessionCal, bars, stale } = data ?? {};
  const score = context?.score;
  const classe = status?.range?.classe;
  const ag = stats?.aggregats;
  const nextEv = upcomingEvents(events?.events, 8);
  const sim = lookupBucket(
    ag,
    similarKeys({
      vxnLevel: context?.vxn?.level,
      cuts: ag?.vxn_tercile_cuts,
      classe,
      trend: status?.trend_h1?.v,
      now: new Date(),
    })
  );

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <SessionBar
        status={status}
        sessionCal={sessionCal}
        events={events?.events}
        goBadge="Edge ORB non validé — NO-GO 2026-10-28"
      />
      {/* §6.3 badge honnêteté permanent */}
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        <span className="flex items-start gap-1">
          <WarnIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {BADGE_UNVALIDATED} · Backtest NQ 2010+ Databento : espérance dev
            2010-2019 <b>−0,158 R/trade</b> (t=−4,3) vs hasard <b>−0,150 R</b> ;
            walk-forward 2020-2023 = bruit ; OOS jamais ouvert. Descriptif ={' '}
            {ag?.n_days ?? 0} jours (Databento M1 2010-06→2026-10).
          </span>
        </span>
      </div>
      {err ? (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          Erreur API : {err}
        </div>
      ) : null}

      <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        {bars?.bars?.today_c?.length ? (
          <OrbChart bars={bars} status={status} emPts={context?.em_pts ?? undefined} trend={status?.trend_h1} />
        ) : (
          <p className="text-sm text-neutral-500">
            Barres intraday indisponibles — collecteur decision/tick écrit nasdaq_bars.json
            pendant la séance (15-60 s), dernières données : {bars?.as_of ?? 'jamais'}
            {bars?.as_of ? ` · périmé depuis ${staleSinceMin(bars.as_of)} min` : ''}.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card title="Plan de trade ORB 15 min (protocole pré-enregistré)" badge="edge non validé">
          <TradePlan status={status} events={events?.events} />
        </Card>

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
            <StaleNote label="status" asOf={status?.as_of} />
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
                    {v.c20 * v.c60 < 0 ? ' · signe inversé' : ''}
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

        <Card title="Jours semblables (Databento 2010-2026)" badge={sampleBadge(ag?.n_days)}>
          {ag ? (
            <ul className="space-y-1 text-sm">
              <li>
                Break : <Num v={ag.break_pct} unit=" %" /> · doubles :{' '}
                <Num v={ag.double_break_pct} unit=" %" /> ({ag.n_days} j
                {ag.periode ? `, ${ag.periode[0]}→${ag.periode[1]}` : ''})
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
              {sim ? (
                <li className="mt-2 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                  <b>
                    Aujourd&apos;hui ({sim.granularite === 'complete' ? 'classe incluse' : 'classe absente — range non figé'})
                  </b>
                  <ul className="mt-1 space-y-0.5 text-xs text-neutral-600 dark:text-neutral-400">
                    <li className="font-mono text-[10px]">{sim.key}</li>
                    <li>
                      n={sim.bucket.n} · trades={sim.bucket.n_trades} · continuation{' '}
                      <Num v={sim.bucket.continuation_pct} unit=" %" />
                    </li>
                    <li>
                      MFE <Num v={sim.bucket.mfe_median_pts} /> / MAE{' '}
                      <Num v={sim.bucket.mae_median_pts} /> pts
                    </li>
                    <li>
                      Espérance nette:{' '}
                      <b
                        className={
                          (sim.bucket.exp_net_R ?? 0) > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }
                      >
                        <Num v={sim.bucket.exp_net_R} unit=" R" />
                      </b>{' '}
                      · hasard global (dev 2010-2019) :{' '}
                      <Num v={ag.random_ref_R} unit=" R" />
                    </li>
                  </ul>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">
              Données indisponibles — généré par orb-close 16:15 ET (range_stats 2010-2026)
            </p>
          )}
          <p className="mt-2 text-xs text-neutral-500">
            Clés : tercile VXN ({ag?.vxn_tercile_cuts
              ? `P33 ${ag.vxn_tercile_cuts.p33} / P66 ${ag.vxn_tercile_cuts.p66}`
              : '—'}
            ) · classe de range · tendance H1 MA20/50 · jour de semaine. Espérance = R nets
            du moteur backtest (2 pts A/R). Descriptif, pas une promesse.
          </p>
        </Card>

        <Card title="Nuit vs journée (cumul net, 2 pts A/R par jambe)">
          {night_day ? (
            <>
              <ul className="space-y-1 text-sm">
                {Object.entries(night_day.cumuls.windows).map(([n, w]) => (
                  <li key={n} className="flex justify-between">
                    <span>{n} j (n={w.n})</span>
                    <span>
                      nuit{' '}
                      <b className={w.nuit_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {w.nuit_pct >= 0 ? '+' : ''}
                        {w.nuit_pct.toFixed(1)} %
                      </b>{' '}
                      · jour{' '}
                      <b className={w.jour_pct >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {w.jour_pct >= 0 ? '+' : ''}
                        {w.jour_pct.toFixed(1)} %
                      </b>{' '}
                      · B&amp;H {w.bh_pct >= 0 ? '+' : ''}
                      {w.bh_pct.toFixed(1)} %
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-neutral-500">
                Nuit = 18:00→09:30 ET, jour = 09:30→15:55, B&amp;H clôture→clôture
                (NQ continu ajusté, jusqu&apos;au {night_day.cumuls.last_day}). Descriptif
                — test 2.2 : NO-GO (prime de nuit &lt; coûts).
              </p>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Données indisponibles</p>
          )}
          {stale?.night_day ? (
            <StaleNote label="cumuls" asOf={night_day?.as_of} />
          ) : null}
        </Card>

        <Card title="Calendrier d'événements (45 j)">
          {nextEv.length ? (
            <>
              <ul className="space-y-1">
                {nextEv.map((e, i) => (
                  <EventRow key={`${e.date}-${e.type}-${i}`} e={e} />
                ))}
              </ul>
              <p className="mt-2 text-xs text-neutral-500">{events?.note}</p>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Aucun événement à venir listé</p>
          )}
          {stale?.events ? (
            <StaleNote label="calendrier" asOf={events?.as_of} />
          ) : null}
        </Card>

        <Card title="État des stratégies Nasdaq">
          {strategies?.strategies?.length ? (
            <>
              <ul className="space-y-1.5">
                {strategies.strategies.map((s) => (
                  <StrategyRow key={s.id} s={s} />
                ))}
              </ul>
              <p className="mt-2 text-xs text-neutral-500">{strategies.note}</p>
            </>
          ) : (
            <p className="text-sm text-neutral-500">Données indisponibles</p>
          )}
          {stale?.strategies ? (
            <StaleNote label="registre" asOf={strategies?.as_of} />
          ) : null}
        </Card>
      </div>

      <p className="text-xs text-neutral-500">
        as_of : {status?.as_of_et ?? '—'} · phases collecteurs : premarket 09:25 / range 09:45 /
        décision 15 s (09:25-10:30 ET) / tick 60 s ensuite / close 16:15 ET / VXN FRED 19:15 ET
        (timers systemd, fériés US exclus) · horloge source UTC.
      </p>
    </main>
  );
}
