'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  INSTRUMENTS,
  RANDOM_REF,
  calcTradeR,
  journalStats,
  sampleBadge,
  type JournalTrade,
} from '@/lib/nasdaq';

/**
 * Journal §10 : saisie 2 taps (préremplie depuis le théorique), stats R
 * (brut/net, DD, série de pertes, hors protocole), comparateur hasard et
 * ligne de référence permanente §10.3. Suppression = confirmation.
 */

const LS_KEY = 'nasdaq-plan-v1';

function todayEt(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function loadPointValue(): number {
  try {
    const p = JSON.parse(localStorage.getItem(LS_KEY) ?? '{}');
    if (p.instrument === 'mnq') return 2;
    if (p.instrument === 'custom') return Number(p.customPt) || 20;
    return 20;
  } catch {
    return 20;
  }
}

interface FormState {
  date: string;
  sens: 'long' | 'short';
  entree: string;
  stop: string;
  sortie: string;
  taille: string;
  usdPerPoint: string;
  frais: string;
  slippage: string;
  conforme: boolean;
  note: string;
}

function blankForm(): FormState {
  return {
    date: todayEt(),
    sens: 'long',
    entree: '',
    stop: '',
    sortie: '',
    taille: '1',
    usdPerPoint: String(loadPointValue()),
    frais: '4',
    slippage: '',
    conforme: true,
    note: '',
  };
}

export default function TradeJournal({
  theoEntry,
  theoStop,
  theoDir,
}: {
  theoEntry?: number;
  theoStop?: number;
  theoDir?: string;
}) {
  const [trades, setTrades] = useState<JournalTrade[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm());
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/nasdaq/journal', { cache: 'no-store' });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
      setTrades(b.trades as JournalTrade[]);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const prefill = () =>
    setForm((f) => ({
      ...f,
      date: todayEt(),
      sens: theoDir === 'basse' ? 'short' : 'long',
      entree: f.entree || (theoEntry ? String(theoEntry) : ''),
      stop: f.stop || (theoStop ? String(theoStop) : ''),
    }));

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const body: JournalTrade = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        date: form.date,
        sens: form.sens,
        entree: Number(form.entree),
        stop: Number(form.stop),
        sortie: Number(form.sortie),
        taille: Number(form.taille),
        usd_per_point: Number(form.usdPerPoint),
        frais_usd: Number(form.frais),
        slippage_entree_pts: form.slippage ? Number(form.slippage) : 0,
        conforme: form.conforme,
        note: form.note,
      };
      const r = await fetch('/api/nasdaq/journal', { method: 'POST', body: JSON.stringify(body) });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
      setMsg(`Trade enregistré (${b.n} au total)`);
      setForm(blankForm());
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer ce trade du journal ?')) return;
    setBusy(true);
    try {
      await fetch('/api/nasdaq/journal', { method: 'DELETE', body: JSON.stringify({ id }) });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const todayIso = todayEt();
  const st = useMemo(() => journalStats(trades ?? [], todayIso), [trades, todayIso]);
  const inp =
    'w-24 rounded border border-neutral-300 bg-transparent px-1.5 py-0.5 text-right font-mono tabular-nums dark:border-neutral-700';

  return (
    <div className="space-y-4">
      {/* §10.3 référence permanente */}
      <p className="rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800">
        Référence permanente — backtest dev 2010-2019 : <b>{RANDOM_REF.devR.toFixed(3)} R/trade</b>,
        hasard (1000 tirages) : <b>{RANDOM_REF.meanR.toFixed(3)} R</b>. C&apos;est ta ligne de
        comparaison, pas un objectif.
      </p>

      {/* §10.1 saisie */}
      <details open={!trades?.length}>
        <summary className="cursor-pointer text-sm font-semibold">
          Saisir un trade (prérempli depuis le théorique)
        </summary>
        <div className="mt-2 space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <label className="flex items-center gap-1">
              Date <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inp} />
            </label>
            <div className="flex overflow-hidden rounded border border-neutral-300 dark:border-neutral-700">
              {(['long', 'short'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, sens: s })}
                  className={`px-2 py-0.5 text-xs ${form.sens === s ? (s === 'long' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'text-neutral-500'}`}
                >
                  {s === 'long' ? 'Long' : 'Short'}
                </button>
              ))}
            </div>
            <button type="button" onClick={prefill} className="rounded bg-neutral-200 px-2 py-0.5 text-xs dark:bg-neutral-700">
              Préremplir théorique
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <label className="flex items-center gap-1">
              Entrée <input type="number" step="0.25" value={form.entree} onChange={(e) => setForm({ ...form, entree: e.target.value })} className={inp} />
            </label>
            <label className="flex items-center gap-1">
              Stop <input type="number" step="0.25" value={form.stop} onChange={(e) => setForm({ ...form, stop: e.target.value })} className={inp} />
            </label>
            <label className="flex items-center gap-1">
              Sortie <input type="number" step="0.25" value={form.sortie} onChange={(e) => setForm({ ...form, sortie: e.target.value })} className={inp} />
            </label>
            <label className="flex items-center gap-1">
              Taille <input type="number" step="1" min="1" value={form.taille} onChange={(e) => setForm({ ...form, taille: e.target.value })} className={inp} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <label className="flex items-center gap-1">
              $/pt <input type="number" step="0.5" value={form.usdPerPoint} onChange={(e) => setForm({ ...form, usdPerPoint: e.target.value })} className={inp} />
            </label>
            <label className="flex items-center gap-1">
              Frais réels $ <input type="number" step="0.5" value={form.frais} onChange={(e) => setForm({ ...form, frais: e.target.value })} className={inp} />
            </label>
            <label className="flex items-center gap-1">
              Slippage entrée (pts) <input type="number" step="0.25" value={form.slippage} onChange={(e) => setForm({ ...form, slippage: e.target.value })} className={inp} />
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={form.conforme} onChange={(e) => setForm({ ...form, conforme: e.target.checked })} />
              conforme au protocole
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex flex-1 items-center gap-1">
              Note{' '}
              <input
                type="text"
                value={form.note}
                maxLength={200}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="contexte, écart, ressenti…"
                className="flex-1 rounded border border-neutral-300 bg-transparent px-1.5 py-0.5 dark:border-neutral-700"
              />
            </label>
            <button
              type="button"
              disabled={busy || !form.entree || !form.stop || !form.sortie}
              onClick={submit}
              className="rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
            >
              Enregistrer
            </button>
          </div>
          {msg ? <p className="text-xs text-neutral-500">{msg}</p> : null}
          <p className="text-xs text-neutral-500">
            Import auto MT5/IB : quand le pont broker sera branché (incr. flux broker).
          </p>
        </div>
      </details>

      {err ? <p className="text-xs text-red-600 dark:text-red-400">Journal indisponible : {err}</p> : null}

      {/* §10.2 stats + comparateur */}
      {trades?.length ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">
              Résultats ({st.n} trades · {st.nConforme} conformes)
            </h3>
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {st.n < 30 ? sampleBadge(st.n) ?? 'échantillon faible' : ''}
              {st.n < 30 ? ' — trop peu de trades pour conclure' : ''}
            </span>
          </div>
          <ul className="space-y-0.5 text-sm tabular-nums">
            <li>
              R net total : <b className={st.rNetTotal >= 0 ? 'text-green-600' : 'text-red-600'}>{st.rNetTotal.toFixed(2)} R</b>{' '}
              · moyenne {st.rNetMoyen.toFixed(3)} R/trade (brut {st.rBrutMoyen.toFixed(3)})
            </li>
            <li>
              Drawdown max : {st.maxDD_R.toFixed(2)} R · série de pertes courante :{' '}
              {st.lossStreak} · slippage moyen : {st.slipMeanPts !== null ? `${st.slipMeanPts.toFixed(2)} pts` : '—'}
            </li>
            <li>
              Hors protocole : {st.offSharePct.toFixed(0)} % des trades
              {st.offRMean !== null ? `, R moyen ${st.offRMean.toFixed(2)} R` : ''} — tes écarts
              aident ou coûtent, ce chiffre le dit.
            </li>
            <li>
              Aujourd&apos;hui : {st.todayPnlUsd >= 0 ? '+' : ''}
              {st.todayPnlUsd.toFixed(0)} $
            </li>
          </ul>
          {/* courbe R cumulés (SVG minimal, chiffres tabulaires) */}
          <svg viewBox="0 0 600 120" className="h-24 w-full rounded bg-neutral-100 dark:bg-neutral-800" role="img" aria-label="courbe R cumulés">
            {(() => {
              if (st.curve.length < 2) return null;
              const min = Math.min(0, ...st.curve);
              const max = Math.max(0, ...st.curve);
              const x = (i: number) => (i / (st.curve.length - 1)) * 590 + 5;
              const y = (v: number) => 115 - ((v - min) / (max - min || 1)) * 110;
              return (
                <>
                  <line x1="5" x2="595" y1={y(0)} y2={y(0)} stroke="rgba(140,140,140,0.5)" strokeDasharray="4 4" />
                  <polyline
                    fill="none"
                    stroke={st.rNetTotal >= 0 ? '#16a34a' : '#dc2626'}
                    strokeWidth="2"
                    points={st.curve.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                  />
                </>
              );
            })()}
          </svg>
          {/* comparateur hasard §10.2 */}
          <div className="rounded bg-neutral-100 p-2 text-xs dark:bg-neutral-800">
            <b>Comparateur hasard</b> — {RANDOM_REF.nDraws} tirages aléatoires du backtest
            (mêmes horaires, mêmes stops, coûts 2 pts) :
            <ul className="mt-1 space-y-0.5">
              <li>
                Ta moyenne : <b>{st.rNetMoyen.toFixed(3)} R</b> vs hasard{' '}
                <b>{RANDOM_REF.meanR.toFixed(3)} R</b> (dev {RANDOM_REF.devR.toFixed(3)} R).
              </li>
              <li>
                Ton total : <b>{st.rNetTotal.toFixed(1)} R</b> — le <i>meilleur</i> tirage hasard
                du backtest finissait à <b>{RANDOM_REF.maxTotalR.toFixed(0)} R</b> sur{' '}
                {RANDOM_REF.nDevTrades} trades (p95 : {RANDOM_REF.p95TotalR.toFixed(0)} R). Tout
                résultat au-dessus de ce plafond est statistiquement suspect.
              </li>
              <li>
                {st.n < 30
                  ? 'Trop peu de trades pour conclure (N < 30).'
                  : 'Échantillon utilisable — reste comparé à un protocole NO-GO.'}
              </li>
            </ul>
          </div>
          {/* liste */}
          <ul className="space-y-1">
            {[...trades]
              .sort((a, b) => (b.date + (b.created_at ?? '')).localeCompare(a.date + (a.created_at ?? '')))
              .map((t) => {
                const r = calcTradeR(t);
                return (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-2 rounded bg-neutral-100 px-2 py-1 text-xs dark:bg-neutral-800"
                  >
                    <span className="min-w-0 font-mono tabular-nums">
                      {t.date} ·{' '}
                      <span className={t.sens === 'long' ? 'text-green-600' : 'text-red-600'}>
                        {t.sens === 'long' ? 'L' : 'S'}
                      </span>{' '}
                      {t.entree}→{t.sortie} (stop {t.stop}) ·{' '}
                      {r ? (
                        <b className={r.rNet >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {r.rNet >= 0 ? '+' : ''}
                          {r.rNet.toFixed(2)} R
                        </b>
                      ) : null}{' '}
                      {!t.conforme ? (
                        <span className="rounded bg-amber-100 px-1 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          hors protocole
                        </span>
                      ) : null}
                      {t.note ? <span className="text-neutral-500"> · {t.note}</span> : null}
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(t.id)}
                      disabled={busy}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                      suppr.
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      ) : trades !== null ? (
        <p className="text-sm text-neutral-500">
          Aucun trade enregistré — le journal se remplit depuis le formulaire (les chiffres
          affichés ailleurs restent descriptifs tant que N &lt; 30).
        </p>
      ) : null}

      {/* distance prop firm */}
      {st.todayPnlUsd < 0 ? (
        <p className="text-xs text-neutral-500">
          Rappel limites : la perte du jour ({st.todayPnlUsd.toFixed(0)} $) se cumule jusqu&apos;à
          minuit heure de Prague (règles FTMO à revérifier sur ftmo.com).
        </p>
      ) : null}
      <p className="text-xs text-neutral-500">
        {INSTRUMENTS.length} presets d&apos;instrument ; stockage VPS privé (token), jamais
        public.
      </p>
    </div>
  );
}
