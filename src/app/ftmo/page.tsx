'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

import FtmoSpecCard from '@/components/ftmo/FtmoSpecCard';
import FtmoFloorsCard from '@/components/ftmo/FtmoFloorsCard';
import FtmoCalibrationCard from '@/components/ftmo/FtmoCalibrationCard';
import FtmoOptimizationCard from '@/components/ftmo/FtmoOptimizationCard';
import FtmoDecisionCard, { type LadderRow } from '@/components/ftmo/FtmoDecisionCard';
import FtmoRiskCard from '@/components/ftmo/FtmoRiskCard';
import FtmoBankrollCard from '@/components/ftmo/FtmoBankrollCard';

import {
  getFtmoSpec,
  fetchFtmoCalib,
  type AccountKey,
  type FtmoModel,
  type FtmoAccountType,
  type FtmoCalibPayload,
} from '@/lib/ftmo';
import {
  optimizeLeverages,
  edgeSurface,
  sensitivityGrid,
  stressScenarios,
  type StressRow,
  type LeverageObjective,
} from '@/lib/ftmo-pricer/leverage-optimizer';
import { DEFAULT_COSTS, simulateChallenge, type MarketCalib, type McResult } from '@/lib/ftmo-pricer/monte-carlo';
import { kellyFromPayoffs } from '@/lib/ftmo-pricer/kelly-sizing';
import { analyzeRuin, type RuinAnalysisResult } from '@/lib/ftmo-pricer/ruin-analysis';

function TierLabel({ children }: { children: string }) {
  return (
    <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[3px]">{children}</div>
  );
}

const OBJECTIVE_LABEL: Record<LeverageObjective, string> = {
  pass_prob: 'P(pass éval)',
  pv_funded: 'E[valeur funded]',
  edge_sharpe: "Sharpe de l'edge",
};

const SIZE_MAP: Record<AccountKey, number> = {
  '10k': 10000,
  '25k': 25000,
  '50k': 50000,
  '100k': 100000,
  '200k': 200000,
};

const ERP_P = 0.035;

interface PersistedSettings {
  accountKey: AccountKey;
  model: FtmoModel;
  accountType: FtmoAccountType;
  objective: LeverageObjective;
  quality: 'standard' | 'deep';
  measure: 'q' | 'p';
  tab: 'pricer' | 'bankroll';
  riskPerTrade: number;
}

function readInitialSettings(): PersistedSettings {
  const defaults: PersistedSettings = DEFAULT_SETTINGS;
  try {
    const u = new URLSearchParams(window.location.search);
    const s = localStorage.getItem('ftmo-pricer-settings');
    const merged: Partial<PersistedSettings> = { ...(s ? JSON.parse(s) : {}) };
    const accountParam = u.get('account');
    if (accountParam && accountParam in SIZE_MAP) merged.accountKey = accountParam as AccountKey;
    if (u.get('model') === 'one_step' || u.get('model') === 'two_step') merged.model = u.get('model') as FtmoModel;
    if (u.get('type') === 'standard' || u.get('type') === 'swing') merged.accountType = u.get('type') as FtmoAccountType;
    if (u.get('tab') === 'bankroll' || u.get('tab') === 'pricer') merged.tab = u.get('tab') as 'pricer' | 'bankroll';
    if (u.get('measure') === 'p' || u.get('measure') === 'q') merged.measure = u.get('measure') as 'q' | 'p';
    return { ...defaults, ...merged };
  } catch {
    return defaults;
  }
}

const DEFAULT_SETTINGS: PersistedSettings = {
  accountKey: '100k',
  model: 'two_step',
  accountType: 'standard',
  objective: 'pv_funded',
  quality: 'standard',
  measure: 'q',
  tab: 'pricer',
  riskPerTrade: 0.005,
};

export default function FtmoPage() {
  // état initial = défauts des deux côtés (SSR + client): la restauration
  // localStorage/URL se fait en effet post-mount, sinon hydration mismatch (#418).
  const [settings, setSettings] = useState<PersistedSettings>(DEFAULT_SETTINGS);
  const { accountKey, model, accountType, objective, quality, measure, tab } = settings;
  const set = useCallback((patch: Partial<PersistedSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  useEffect(() => {
    setSettings((s) => ({ ...s, ...readInitialSettings() }));
  }, []);

  const [calib, setCalib] = useState<FtmoCalibPayload | null>(null);
  const [calibLoading, setCalibLoading] = useState(true);
  const [calibError, setCalibError] = useState<string | null>(null);
  const [opt, setOpt] = useState<ReturnType<typeof optimizeLeverages> | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [sens, setSens] = useState<{ costBps: number; erp: number; edge: number }[] | null>(null);
  const [stress, setStress] = useState<StressRow[] | null>(null);
  const [stressLoading, setStressLoading] = useState(false);
  const [ladder, setLadder] = useState<LadderRow[] | null>(null);
  const [surface, setSurface] = useState<{ lambdaEval: number; lambdaFunded: number; edge: number }[] | null>(null);
  const [surfaceLoading, setSurfaceLoading] = useState(false);
  const [ruin, setRuin] = useState<RuinAnalysisResult | null>(null);
  const [ruinLoading, setRuinLoading] = useState(false);

  const spec = getFtmoSpec(SIZE_MAP[accountKey], model, accountType);

  useEffect(() => {
    setCalibLoading(true);
    fetchFtmoCalib()
      .then((c) => {
        setCalib(c);
        setCalibError(null);
      })
      .catch((e: Error) => setCalibError(e.message))
      .finally(() => setCalibLoading(false));
  }, []);

  // persistence: localStorage + URL
  useEffect(() => {
    try {
      localStorage.setItem('ftmo-pricer-settings', JSON.stringify(settings));
      const u = new URLSearchParams({
        account: settings.accountKey,
        model: settings.model,
        type: settings.accountType,
        tab: settings.tab,
        measure: settings.measure,
      });
      window.history.replaceState(null, '', `?${u.toString()}`);
    } catch {
      // localStorage indisponible (private mode) — non bloquant
    }
  }, [settings]);

  const marketCalib: MarketCalib | null = useMemo(() => {
    if (!calib) return null;
    return {
      bates: calib.bates.params,
      fwdDriftAnn: calib.fwdDriftAnn,
      equityRiskPremium: measure === 'p' ? ERP_P : 0,
      rate: calib.rate,
      asOf: calib.asOf,
      source: calib.source,
      spot: calib.spot,
    };
  }, [calib, measure]);

  // réoptimisation quand calib/spec/objective/quality/measure changent
  useEffect(() => {
    if (!marketCalib) return;
    setOptLoading(true);
    setSurface(null);
    setLadder(null);
    const t = setTimeout(() => {
      try {
        const nSims = quality === 'deep' ? 3000 : 800;
        const r = optimizeLeverages(spec, marketCalib, {
          objective,
          nSims,
          seed: 42,
          lambdaCap: accountType === 'swing' ? 8 : 8,
        });
        setOpt(r);
        setSens(
          sensitivityGrid(spec, marketCalib, r.lambdaEvalStar, r.lambdaFundedStar, { nSims: 600 })
        );
        // échelle de risque: λ éval × {0.5..2} autour de λ* (proxy risk/jour)
        const sigmaDay = Math.sqrt(marketCalib.bates.V0 / 252);
        setLadder(
          [0.5, 0.75, 1, 1.5, 2].map((m) => {
            const lam = +(r.lambdaEvalStar * m).toFixed(2);
            const mcL = simulateChallenge(spec, marketCalib, lam, r.lambdaFundedStar, {
              nSims: 600,
              seed: 42,
            });
            return {
              lambdaEval: lam,
              riskDayPct: lam * sigmaDay * 100,
              pPass1: mcL.pPassPhase1,
              pFunded: mcL.pReachFunded,
              edgeNet: mcL.fairValue - spec.feeUsd,
              isStar: m === 1,
            };
          })
        );
      } finally {
        setOptLoading(false);
      }
    }, 30);
    return () => clearTimeout(t);
  }, [marketCalib, spec, objective, quality, accountType]);

  const runStress = useCallback(() => {
    if (!marketCalib) return;
    setStressLoading(true);
    setTimeout(() => {
      setStress(stressScenarios(spec, marketCalib, { nSims: 600 }));
      setStressLoading(false);
    }, 30);
  }, [marketCalib, spec]);

  const runSurface = useCallback(() => {
    if (!marketCalib) return;
    setSurfaceLoading(true);
    const doSync = () => {
      const s = edgeSurface(spec, marketCalib, { nSims: 250, nLambda: 8, lambdaMax: 8 });
      setSurface(s);
      setSurfaceLoading(false);
    };
    if (typeof Worker !== 'undefined') {
      try {
        const w = new Worker(new URL('../../lib/ftmo-pricer/surface.worker.ts', import.meta.url));
        w.onmessage = (e: MessageEvent) => {
          setSurface(e.data as { lambdaEval: number; lambdaFunded: number; edge: number }[]);
          setSurfaceLoading(false);
          w.terminate();
        };
        w.onerror = () => {
          w.terminate();
          doSync();
        };
        w.postMessage({ spec, calib: marketCalib, nSims: 250, nLambda: 8, lambdaMax: 8 });
        return;
      } catch {
        // worker indisponible — fallback synchrone
      }
    }
    setTimeout(doSync, 30);
  }, [marketCalib, spec]);

  const runRuin = useCallback(() => {
    if (!marketCalib || !opt) return;
    setRuinLoading(true);
    setTimeout(() => {
      const r = analyzeRuin(spec, marketCalib, opt.lambdaEvalStar, opt.lambdaFundedStar, {
        nSims: 200,
        years: 3,
        maxChallenges: 40,
      });
      setRuin(r);
      setRuinLoading(false);
    }, 30);
  }, [marketCalib, opt, spec]);

  const mc: McResult | null = opt ? opt.mc : null;
  const kelly = useMemo(
    () =>
      mc
        ? kellyFromPayoffs(mc.payoffs, spec.feeUsd)
        : { fullKelly: 0, halfKelly: 0, discreteKelly: null, interpretation: '—' },
    [mc, spec.feeUsd]
  );
  const kellyLoop = useMemo(
    () =>
      ruin
        ? kellyFromPayoffs(ruin.perChallengePayoffs, spec.feeUsd)
        : null,
    [ruin, spec.feeUsd]
  );
  // friction annuelle estimée: coûts quotidiens × λ moyen × notionnel (bps → $)
  const frictionAnnual = useMemo(() => {
    if (!opt) return 0;
    const totalBps = DEFAULT_COSTS.dailyCostBps + DEFAULT_COSTS.swapBps;
    const lambdaAvg = (opt.lambdaEvalStar + opt.lambdaFundedStar) / 2;
    return (spec.accountSize * lambdaAvg * totalBps * 252) / 10000;
  }, [opt, spec.accountSize]);

  const measureLabel = measure === 'q' ? 'mesure Q' : `mesure P (ERP ${(ERP_P * 100).toFixed(1)}%)`;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 px-4 py-3 flex flex-col gap-6">
        {/* onglets pricer / bankroll comme la référence */}
        <div className="flex gap-1">
          {(['pricer', 'bankroll'] as const).map((t) => (
            <button
              key={t}
              onClick={() => set({ tab: t })}
              className={`rounded-[2px] border px-3 py-1 font-mono text-[0.55rem] uppercase tracking-[2px] ${
                tab === t
                  ? 'border-[var(--purple)] text-[var(--purple)] bg-[var(--purple)]/10'
                  : 'border-[var(--border)] text-[var(--dim)] hover:text-[var(--text)]'
              }`}
            >
              {t === 'pricer' ? 'Pricer challenge' : 'Bankroll / ruine'}
            </button>
          ))}
        </div>

        {tab === 'pricer' ? (
          <>
            {/* TIER 0 — sélection + règles */}
            <section className="flex flex-col gap-3">
              <TierLabel>Tier 0 · Sélection — compte · modèle · type · objectif · qualité MC · mesure</TierLabel>
              <FtmoSpecCard
                spec={spec}
                accountKey={accountKey}
                model={model}
                accountType={accountType}
                onAccountChange={(k) => set({ accountKey: k as AccountKey })}
                onModelChange={(m) => set({ model: m })}
                onAccountTypeChange={(t) => set({ accountType: t })}
              />
              <FtmoFloorsCard
                spec={spec}
                accountKey={accountKey}
                model={model}
                accountType={accountType}
                riskPerTrade={settings.riskPerTrade}
                onRiskPerTradeChange={(r) => set({ riskPerTrade: r })}
              />
              <div className="flex flex-wrap items-center gap-2 font-mono text-[0.55rem]">
                <span className="text-[var(--label)] uppercase tracking-[1px]">objectif optimisation:</span>
                {(Object.keys(OBJECTIVE_LABEL) as LeverageObjective[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => set({ objective: o })}
                    className={`rounded-[2px] border px-2 py-0.5 ${
                      objective === o
                        ? 'border-[var(--purple)] text-[var(--purple)] bg-[var(--purple)]/10'
                        : 'border-[var(--border)] text-[var(--dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {OBJECTIVE_LABEL[o]}
                  </button>
                ))}
                <span className="ml-2 text-[var(--label)] uppercase tracking-[1px]">qualité:</span>
                {(['standard', 'deep'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => set({ quality: q })}
                    className={`rounded-[2px] border px-2 py-0.5 ${
                      quality === q
                        ? 'border-[var(--purple)] text-[var(--purple)] bg-[var(--purple)]/10'
                        : 'border-[var(--border)] text-[var(--dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {q === 'standard' ? 'standard' : 'deep (plus de trajectoires)'}
                  </button>
                ))}
                <span className="ml-2 text-[var(--label)] uppercase tracking-[1px]">mesure:</span>
                {(['q', 'p'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => set({ measure: m })}
                    title={m === 'q' ? 'risque-neutre (valorisation)' : `physique: drift + ${(ERP_P * 100).toFixed(1)}%/an de prime de risque`}
                    className={`rounded-[2px] border px-2 py-0.5 ${
                      measure === m
                        ? 'border-[var(--purple)] text-[var(--purple)] bg-[var(--purple)]/10'
                        : 'border-[var(--border)] text-[var(--dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {m === 'q' ? 'Q (valorisation)' : `P (ERP ${(ERP_P * 100).toFixed(1)}%)`}
                  </button>
                ))}
              </div>
            </section>

            {/* TIER calibration */}
            <section className="flex flex-col gap-3">
              <TierLabel>Tier 1 · Calibration — chaîne SPX → SSVI sans arbitrage → Bates (SVJ)</TierLabel>
              {calibError ? (
                <div className="rounded-[3px] border border-[var(--red)] bg-[var(--bg2)] p-3 font-mono text-[0.55rem] text-[var(--red)]">
                  Erreur calibration: {calibError} — la page reste vide plutôt que d'afficher un verdict en fausse
                  confiance.
                </div>
              ) : null}
              <FtmoCalibrationCard calib={calib} loading={calibLoading && !calibError} />
            </section>

            {/* TIER optimisation */}
            <section className="flex flex-col gap-3">
              <TierLabel>Tier 2 · Optimisation du levier — λ* éval / λ* funded · surface edge</TierLabel>
              {optLoading || !opt ? (
                <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 font-mono text-[0.55rem] text-[var(--dim)]">
                  {optLoading ? 'optimisation en cours (grille 2D + sections dorées alternées)…' : 'en attente de calibration…'}
                </div>
              ) : (
                <FtmoOptimizationCard
                  curve={opt.curve}
                  lambdaEvalStar={opt.lambdaEvalStar}
                  lambdaFundedStar={opt.lambdaFundedStar}
                  objectiveLabel={OBJECTIVE_LABEL[objective]}
                  surface={surface}
                  surfaceLoading={surfaceLoading}
                  onRunSurface={runSurface}
                />
              )}
            </section>

            {/* TIER décision */}
            <section className="flex flex-col gap-3">
              <TierLabel>Tier 3 · Décision — funnel · décomposition edge ± IC · verdict · Kelly · sensibilité</TierLabel>
              {mc ? (
                <FtmoDecisionCard
                  mc={mc}
                  kelly={kelly}
                  fee={spec.fee}
                  feeUsd={spec.feeUsd}
                  feeRefundable={spec.feeRefundable}
                  frictionAnnual={frictionAnnual}
                  sensitivity={sens}
                  stress={stress}
                  stressLoading={stressLoading}
                  onRunStress={runStress}
                  ladder={ladder}
                  measureLabel={measureLabel}
                  label={`${accountKey.toUpperCase()} ${model === 'two_step' ? '2-step' : '1-step'} ${accountType}`}
                />
              ) : (
                <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 font-mono text-[0.55rem] text-[var(--dim)]">
                  en attente du Monte Carlo…
                </div>
              )}
            </section>

            {/* TIER risque */}
            <section className="flex flex-col gap-3">
              <TierLabel>Tier 4 · Risque — trajectoires stratifiées · payoffs (log)</TierLabel>
              {mc ? <FtmoRiskCard mc={mc} spec={spec} measureLabel={measureLabel} /> : null}
            </section>
          </>
        ) : (
          <section className="flex flex-col gap-3">
            <TierLabel>Tier 5 · Bankroll — rachat en boucle · P(ruine) · badge edge réalisé</TierLabel>
            <FtmoBankrollCard
              result={ruin}
              loading={ruinLoading}
              onRun={runRuin}
              years={3}
              nScen={200}
              kellyLoop={kellyLoop}
              feeUsd={spec.feeUsd}
            />
          </section>
        )}
      </main>

      <footer className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px]">
        <span>
          {measure === 'q'
            ? 'Valorisation risque-neutre (Q) — CBOE SPX · SSVI · Bates · pricer, pas un hedge'
            : `Mesure physique (P, ERP ${(ERP_P * 100).toFixed(1)}%) — scénarios réels estimés, pas une valorisation`}
        </span>
        <span className="text-[var(--dim)]">educational · not investment advice</span>
      </footer>
    </div>
  );
}
