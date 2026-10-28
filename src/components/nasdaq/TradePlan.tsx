'use client';

import { useEffect, useState } from 'react';

import {
  INSTRUMENTS,
  PROTOCOL,
  checklist,
  etMinutes,
  macroInWindow,
  newsGuard,
  positionSize,
  type NasdaqEvent,
  type NasdaqStatus,
} from '@/lib/nasdaq';

/**
 * Plan de trade §6 : règles (reprises du code backtest), checklist live,
 * calculateur de position, garde-fous. Le coût A/R en R est affiché en gros :
 * c'est lui qui a basculé le backtest dans le négatif (spec §6.3).
 */

const LS_KEY = 'nasdaq-plan-v1';

interface PlanPrefs {
  capital: number;
  riskPct: number;
  instrument: string;
  customPt: number;
  entryOverride: string;
  stopOverride: string;
  ftmoDailyUsd: number;
}

const DEFAULT_PREFS: PlanPrefs = {
  capital: 25000,
  riskPct: 0.5,
  instrument: 'nq',
  customPt: 20,
  entryOverride: '',
  stopOverride: '',
  ftmoDailyUsd: 1500,
};

function loadPrefs(): PlanPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<PlanPrefs>) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
}

const stateCls = (s: string) =>
  s === 'ok'
    ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
    : s === 'ko'
      ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
      : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400';

const stateGlyph = (s: string) => (s === 'ok' ? 'OK' : s === 'ko' ? 'NON' : '…');

export default function TradePlan({
  status,
  events,
}: {
  status?: NasdaqStatus;
  events?: NasdaqEvent[];
}) {
  const [prefs, setPrefs] = useState<PlanPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setPrefs(loadPrefs());
    setLoaded(true);
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (loaded) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(prefs));
      } catch {
        /* stockage indisponible : préfs non persistées */
      }
    }
  }, [prefs, loaded]);

  const items = now
    ? checklist({
        delayS: status?.feed?.delay_s ?? null,
        rangeFrozenMin: etMinutes(now),
        rangeOverEm: status?.range?.pct_em ?? null,
        breakState: status?.break?.state,
        theoDir: status?.theo?.dir,
        trendV: status?.trend_h1?.v,
        macroInWindow: macroInWindow(events, now).hit,
      })
    : [];

  const ptValue = prefs.instrument === 'custom' ? prefs.customPt : (INSTRUMENTS.find((i) => i.id === prefs.instrument)?.usdPerPoint ?? 20);
  const entry = Number(prefs.entryOverride) || status?.theo?.entry || 0;
  const stop = Number(prefs.stopOverride) || status?.theo?.stop || 0;
  const calc = positionSize({
    capitalUsd: prefs.capital,
    riskPct: prefs.riskPct,
    usdPerPoint: ptValue,
    entry,
    stop,
  });

  const news = now ? newsGuard(events, now) : null;

  const field = (k: keyof PlanPrefs) => ({
    value: String(prefs[k]),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setPrefs((p) => ({ ...p, [k]: e.target.value })),
    className:
      'w-24 rounded border border-neutral-300 bg-transparent px-1.5 py-0.5 text-right font-mono tabular-nums dark:border-neutral-700',
  });

  return (
    <div className="space-y-4">
      {/* §6.2 checklist live */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Checklist du protocole (live)</h3>
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2 text-sm">
              <span className={`mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${stateCls(it.state)}`}>
                {stateGlyph(it.state)}
              </span>
              <span className="min-w-0">
                {it.label}
                <span className="block text-xs text-neutral-500">{it.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* §6.3 calculateur */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Calculateur de position</h3>
        {news?.locked ? (
          <p className="mb-2 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800 dark:bg-red-900/40 dark:text-red-300">
            Exécution interdite ±2 min autour de {news.label} ({news.timeEt} ET)
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <label className="flex items-center gap-1">
            Capital $ <input type="number" min="0" {...field('capital')} />
          </label>
          <label className="flex items-center gap-1">
            Risque % <input type="number" min="0" step="0.1" {...field('riskPct')} />
          </label>
          <label className="flex items-center gap-1">
            Instrument{' '}
            <select
              value={prefs.instrument}
              onChange={(e) => setPrefs((p) => ({ ...p, instrument: e.target.value }))}
              className="rounded border border-neutral-300 bg-transparent px-1 py-0.5 dark:border-neutral-700"
            >
              {INSTRUMENTS.map((i) => (
                <option key={i.id} value={i.id}>{i.label}</option>
              ))}
              <option value="custom">CFD (valeur du point…)</option>
            </select>
          </label>
          {prefs.instrument === 'custom' ? (
            <label className="flex items-center gap-1">
              $/pt <input type="number" min="0" step="0.1" {...field('customPt')} />
            </label>
          ) : null}
          <label className="flex items-center gap-1">
            Entrée <input type="number" step="0.25" placeholder={status?.theo?.entry ? String(status.theo.entry) : 'théo'} {...field('entryOverride')} />
          </label>
          <label className="flex items-center gap-1">
            Stop <input type="number" step="0.25" placeholder={status?.theo?.stop ? String(status.theo.stop) : 'théo'} {...field('stopOverride')} />
          </label>
        </div>
        {calc ? (
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">
                {calc.rtCostR.toFixed(2)} R
              </span>
              <span className="text-xs text-neutral-500">
                = coût aller-retour 2 pts / distance de stop ({calc.distPts.toFixed(2)} pts)
              </span>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              C&apos;est ce coût qui a fait basculer le backtest dans le négatif (dev −0,158 R
              vs hasard −0,150 R). Un stop serré = coût en R énorme.
            </p>
            <ul className="mt-1 space-y-0.5 text-sm tabular-nums">
              <li>
                Entrée <b>{entry || '—'}</b> / stop <b>{stop || '—'}</b> · distance{' '}
                {calc.distPts.toFixed(2)} pts
              </li>
              <li>
                Taille : <b>{calc.size}</b> contrat{calc.size > 1 ? 's' : ''} (arrondi vers le
                bas) · perte au stop ≈ {calc.lossUsd.toFixed(0)} $ · {ptValue} $/pt
              </li>
              <li className="text-neutral-500">
                Objectifs indicatifs : 1R = {calc.target1R.toFixed(2)} · 2R ={' '}
                {calc.target2R.toFixed(2)}
              </li>
            </ul>
          </div>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            Entrée/stop indisponibles (pas de théorique) — saisir à la main ou attendre une
            cassure conforme.
          </p>
        )}
      </div>

      {/* §6.4 garde-fous */}
      <div>
        <h3 className="mb-1 text-sm font-semibold">Garde-fous (config, jamais pendant la séance)</h3>
        <ul className="space-y-1 text-sm">
          <li>Max 1 trade/jour, 1re cassure conforme (protocole).</li>
          <li>
            {news ? (
              <span className={news.locked ? 'font-semibold text-red-700 dark:text-red-400' : ''}>
                Prochaine publication : {news.label} à {news.timeEt} ET
                {news.locked
                  ? ' — EXÉCUTION INTERDITE'
                  : news.minUntil <= 30
                    ? ` — T-${news.minUntil} min`
                    : ''}
              </span>
            ) : (
              <span className="text-neutral-500">Aucune publication listée aujourd&apos;hui.</span>
            )}
          </li>
          <li className="flex items-center gap-1">
            Perte journalière max propre :{' '}
            <input type="number" min="0" {...field('ftmoDailyUsd')} /> $ (suivi réel : incr.
            journal)
          </li>
          <li className="text-xs text-neutral-500">
            Limites FTMO : perte journalière remise à zéro à minuit heure de Prague, perte
            maximale globale — règles à revérifier sur ftmo.com avant tout compte financé.
          </li>
          <li className="text-xs text-neutral-500">
            Tout écart (stop différent, entrée sur mèche, 2ᵉ trade) sera étiqueté « hors
            protocole » dans le journal (incr. journal).
          </li>
        </ul>
      </div>

      {/* §6.1 règles (reprises du code) */}
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Règles du protocole (code backtest)</summary>
        <ul className="mt-1 space-y-0.5 text-xs text-neutral-600 dark:text-neutral-400">
          {Object.entries(PROTOCOL).map(([k, v]) => (
            <li key={k}>
              <span className="font-mono">{k}</span> : {v}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
