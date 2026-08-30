'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

import FtmoSpecCard from '@/components/ftmo/FtmoSpecCard';
import FtmoCalibrationCard from '@/components/ftmo/FtmoCalibrationCard';
import FtmoOptimizationCard from '@/components/ftmo/FtmoOptimizationCard';
import FtmoDecisionCard from '@/components/ftmo/FtmoDecisionCard';
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
import { optimizeLeverage, edgeSurface, type LeverageObjective } from '@/lib/ftmo-pricer/leverage-optimizer';
import type { MarketCalib, McResult } from '@/lib/ftmo-pricer/monte-carlo';
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

export default function FtmoPage() {
  const [accountKey, setAccountKey] = useState<AccountKey>('100k');
  const [model, setModel] = useState<FtmoModel>('two_step');
  const [accountType, setAccountType] = useState<FtmoAccountType>('standard');
  const [objective, setObjective] = useState<LeverageObjective>('pv_funded');
  const [quality, setQuality] = useState<'standard' | 'deep'>('standard');
  const [tab, setTab] = useState<'pricer' | 'bankroll'>('pricer');

  const [calib, setCalib] = useState<FtmoCalibPayload | null>(null);
  const [calibError, setCalibError] = useState<string | null>(null);
  const [opt, setOpt] = useState<ReturnType<typeof optimizeLeverage> | null>(null);
  const [optLoading, setOptLoading] = useState(false);
  const [surface, setSurface] = useState<{ lambdaEval: number; lambdaFunded: number; edge: number }[] | null>(null);
  const [surfaceLoading, setSurfaceLoading] = useState(false);
  const [ruin, setRuin] = useState<RuinAnalysisResult | null>(null);
  const [ruinLoading, setRuinLoading] = useState(false);

  const spec = getFtmoSpec(SIZE_MAP[accountKey], model, accountType);

  useEffect(() => {
    fetchFtmoCalib()
      .then(setCalib)
      .catch((e: Error) => setCalibError(e.message));
  }, []);

  const marketCalib: MarketCalib | null = useMemo(() => {
    if (!calib) return null;
    return {
      bates: calib.bates.params,
      fwdDriftAnn: calib.fwdDriftAnn,
      rate: calib.rate,
      asOf: calib.asOf,
      source: calib.source,
      spot: calib.spot,
    };
  }, [calib]);

  // réoptimisation quand calib/spec/objective/quality changent
  useEffect(() => {
    if (!marketCalib) return;
    setOptLoading(true);
    setSurface(null);
    const t = setTimeout(() => {
      try {
        const nSims = quality === 'deep' ? 3000 : 800;
        const r = optimizeLeverage(spec, marketCalib, 2, {
          objective,
          nSims,
          seed: 42,
          lambdaCap: accountType === 'swing' ? 8 : 12,
        });
        setOpt(r);
      } finally {
        setOptLoading(false);
      }
    }, 30);
    return () => clearTimeout(t);
  }, [marketCalib, spec, objective, quality, accountType]);

  const runSurface = useCallback(() => {
    if (!marketCalib) return;
    setSurfaceLoading(true);
    setTimeout(() => {
      const s = edgeSurface(spec, marketCalib, { nSims: 250, nLambda: 8, lambdaMax: 8 });
      setSurface(s);
      setSurfaceLoading(false);
    }, 30);
  }, [marketCalib, spec]);

  const runRuin = useCallback(() => {
    if (!marketCalib || !opt) return;
    setRuinLoading(true);
    setTimeout(() => {
      const r = analyzeRuin(spec, marketCalib, opt.lambdaStar, 2, {
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
        ? kellyFromPayoffs(mc.payoffs, spec.fee)
        : { fullKelly: 0, halfKelly: 0, discreteKelly: null, interpretation: '—' },
    [mc, spec.fee]
  );
  // friction annuelle estimée: coûts quotidiens × λ* × notionnel (bps → $)
  const frictionAnnual = useMemo(() => {
    if (!opt) return 0;
    return (spec.accountSize * opt.lambdaStar * 3.3) / 10000 / 100;
  }, [opt, spec.accountSize]);

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 px-4 py-3 flex flex-col gap-6">
        {/* onglets pricer / bankroll comme la référence */}
        <div className="flex gap-1">
          {(['pricer', 'bankroll'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
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
              <TierLabel>Tier 0 · Sélection — compte · modèle · type · objectif · qualité MC</TierLabel>
              <FtmoSpecCard
                spec={spec}
                accountKey={accountKey}
                model={model}
                accountType={accountType}
                onAccountChange={(k) => setAccountKey(k as AccountKey)}
                onModelChange={setModel}
                onAccountTypeChange={setAccountType}
              />
              <div className="flex flex-wrap items-center gap-2 font-mono text-[0.55rem]">
                <span className="text-[var(--label)] uppercase tracking-[1px]">objectif optimisation:</span>
                {(Object.keys(OBJECTIVE_LABEL) as LeverageObjective[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => setObjective(o)}
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
                    onClick={() => setQuality(q)}
                    className={`rounded-[2px] border px-2 py-0.5 ${
                      quality === q
                        ? 'border-[var(--purple)] text-[var(--purple)] bg-[var(--purple)]/10'
                        : 'border-[var(--border)] text-[var(--dim)] hover:text-[var(--text)]'
                    }`}
                  >
                    {q === 'standard' ? 'standard' : 'deep (plus de trajectoires)'}
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
              <FtmoCalibrationCard calib={calib} />
            </section>

            {/* TIER optimisation */}
            <section className="flex flex-col gap-3">
              <TierLabel>Tier 2 · Optimisation du levier — λ* par phase · surface edge</TierLabel>
              {optLoading || !opt ? (
                <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3 font-mono text-[0.55rem] text-[var(--dim)]">
                  {optLoading ? 'optimisation en cours (grille λ + section dorée)…' : 'en attente de calibration…'}
                </div>
              ) : (
                <FtmoOptimizationCard
                  curve={opt.curve}
                  lambdaStar={opt.lambdaStar}
                  objectiveLabel={OBJECTIVE_LABEL[objective]}
                  surface={surface}
                  surfaceLoading={surfaceLoading}
                  onRunSurface={runSurface}
                />
              )}
            </section>

            {/* TIER décision */}
            <section className="flex flex-col gap-3">
              <TierLabel>Tier 3 · Décision — funnel Q · décomposition edge · verdict · Kelly</TierLabel>
              {mc ? (
                <FtmoDecisionCard
                  mc={mc}
                  kelly={kelly}
                  fee={spec.fee}
                  frictionAnnual={frictionAnnual}
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
              {mc ? <FtmoRiskCard mc={mc} accountSize={spec.accountSize} /> : null}
            </section>
          </>
        ) : (
          <section className="flex flex-col gap-3">
            <TierLabel>Tier 5 · Bankroll — rachat en boucle · P(ruine) · badge edge réalisé</TierLabel>
            <FtmoBankrollCard result={ruin} loading={ruinLoading} onRun={runRuin} years={3} nScen={200} />
          </section>
        )}
      </main>

      <footer className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg2)] flex items-center justify-between font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px]">
        <span>Valorisation risque-neutre (Q) — CBOE SPX · SSVI · Bates · pricer, pas un hedge</span>
        <span className="text-[var(--dim)]">educational · not investment advice</span>
      </footer>
    </div>
  );
}
