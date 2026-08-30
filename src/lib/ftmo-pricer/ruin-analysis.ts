/**
 * Analyse de ruine: rachat en boucle du challenge sur plusieurs années.
 * 2000 scénarios / 3 ans par défaut. Recherche du capital initial minimal
 * tel que P(ruine) ≤ 5% ET NAV médiane finale > capital engagé.
 * Badge "Edge réalisé" uniquement si les deux critères tiennent simultanément.
 */
import { simulateChallenge, mulberry32, type MarketCalib, type McOptions } from './monte-carlo';
import type { FtmoSpec } from '../ftmo';

export interface RuinOptions extends McOptions {
  years?: number;
  initialCapitals?: number[];
  maxChallenges?: number;
}

export interface RuinScenarioResult {
  initialCapital: number;
  pRuin: number;
  medianFinalNav: number;
  medianCagr: number;
  medianCalmar: number;
  sharpeNav: number;
  pBreakeven: number;
  medianBreakevenDays: number | null;
  medianMaxDd: number;
  p95MaxDd: number;
  avgChallenges: number;
  avgFunded: number;
  pAtLeastOneFunded: number;
  avgPayoutsMinusFees: number;
}

export interface RuinAnalysisResult {
  scenarios: RuinScenarioResult[];
  minimalCapital: number | null;
  edgeRealise: boolean;
  /** distribution de payoffs agrégée du meilleur scénario (pour Kelly) */
  bestScenario: RuinScenarioResult | null;
  perChallengePayoffs: number[];
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function percentile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
}

/** Un scénario multi-années: bankroll rachète le challenge en boucle jusqu'à épuisement ou fin. */
function runBankrollPath(
  seed: number,
  initialCapital: number,
  spec: FtmoSpec,
  calib: MarketCalib,
  lambdaEval: number,
  lambdaFunded: number,
  opts: Required<Pick<RuinOptions, 'years' | 'maxChallenges'>> & McOptions
): {
  finalNav: number;
  ruined: boolean;
  navPath: number[];
  challenges: number;
  funded: number;
  payoutsMinusFees: number;
  breakevenDay: number | null;
} {
  const rng = mulberry32(seed);
  let bank = initialCapital;
  const totalDays = Math.round(opts.years * 252);
  let day = 0;
  let challenges = 0;
  let fundedCount = 0;
  let payoutsMinusFees = 0;
  let breakevenDay: number | null = null;
  const navPath: number[] = [bank];
  while (day < totalDays && challenges < opts.maxChallenges && bank >= spec.fee) {
    challenges++;
    // PV net simulé (payouts non actualisés ici: NAV en cash)
    const res = simulateChallenge(spec, calib, lambdaEval, lambdaFunded, {
      nSims: 1,
      seed: Math.floor(rng() * 2 ** 31),
      maxDaysEval: opts.maxDaysEval,
      maxDaysFunded: opts.maxDaysFunded,
      payoutDays: opts.payoutDays,
      costs: opts.costs,
    });
    const net = res.payoffs[0];
    // durée approx du challenge: si funded atteint, compte jours éval+funded
    bank += net;
    payoutsMinusFees += net;
    if (res.pReachFunded > 0) fundedCount++;
    // approximation durée: chemins courts si échec tôt
    const outcome = res.outcomes[0];
    const approxDays =
      outcome === 'fail_phase1' || outcome === 'timeout_phase1'
        ? 20
        : outcome === 'fail_phase2' || outcome === 'timeout_phase2'
          ? 45
          : 90;
    day += approxDays;
    navPath.push(bank);
    if (breakevenDay === null && bank > initialCapital) breakevenDay = day;
    if (bank < spec.fee) break;
  }
  while (navPath.length < 2) navPath.push(bank);
  return {
    finalNav: bank,
    ruined: bank < initialCapital * 0.05,
    navPath,
    challenges,
    funded: fundedCount,
    payoutsMinusFees,
    breakevenDay,
  };
}

export function analyzeRuin(
  spec: FtmoSpec,
  calib: MarketCalib,
  lambdaEval: number,
  lambdaFunded: number,
  opts: RuinOptions = {}
): RuinAnalysisResult {
  const years = opts.years ?? 3;
  const nScen = opts.nSims ?? 400;
  const capitals = (opts.initialCapitals ?? [1000, 1500, 2000, 3000, 5000, 8000]).filter(
    (c) => c >= spec.fee
  );
  const maxChallenges = opts.maxChallenges ?? 40;
  const fixedOpts = {
    years,
    maxChallenges,
    maxDaysEval: opts.maxDaysEval,
    maxDaysFunded: opts.maxDaysFunded,
    payoutDays: opts.payoutDays,
    costs: opts.costs,
  };
  const scenarios: RuinScenarioResult[] = [];
  let best: RuinScenarioResult | null = null;
  const perChallengePayoffs: number[] = [];
  for (const cap of capitals) {
    const finals: number[] = [];
    const dds: number[] = [];
    let ruined = 0;
    let breakeven = 0;
    let beDays: number[] = [];
    let challs = 0;
    let fundedT = 0;
    let atLeastOne = 0;
    let pmf = 0;
    const navsForSharpe: number[] = [];
    for (let s = 0; s < nScen; s++) {
      const r = runBankrollPath(1000 + s * 7919 + Math.round(cap), cap, spec, calib, lambdaEval, lambdaFunded, fixedOpts);
      finals.push(r.finalNav);
      navsForSharpe.push(r.finalNav / cap);
      if (r.ruined) ruined++;
      if (r.breakevenDay !== null) {
        breakeven++;
        beDays.push(r.breakevenDay);
      }
      if (r.funded > 0) atLeastOne++;
      challs += r.challenges;
      fundedT += r.funded;
      pmf += r.payoutsMinusFees;
      const peak = Math.max(...r.navPath);
      dds.push(peak > 0 ? Math.max(0, (peak - r.finalNav) / peak) : 0);
      if (s < 60) perChallengePayoffs.push(r.payoutsMinusFees);
    }
    const medNav = median(finals);
    const meanNav = finals.reduce((a, b) => a + b, 0) / nScen;
    const varNav = finals.reduce((s, x) => s + (x - meanNav) ** 2, 0) / nScen;
    const navTotal = medNav / cap - 1;
    const cagr = Math.pow(Math.max(medNav, 1) / cap, 1 / years) - 1;
    const medDd = median(dds);
    const res: RuinScenarioResult = {
      initialCapital: cap,
      pRuin: ruined / nScen,
      medianFinalNav: medNav,
      medianCagr: cagr,
      medianCalmar: medDd > 0 ? cagr / medDd : 0,
      sharpeNav: varNav > 0 ? (meanNav - cap) / Math.sqrt(varNav) : 0,
      pBreakeven: breakeven / nScen,
      medianBreakevenDays: beDays.length ? median(beDays) : null,
      medianMaxDd: medDd,
      p95MaxDd: percentile(dds, 0.95),
      avgChallenges: challs / nScen,
      avgFunded: fundedT / nScen,
      pAtLeastOneFunded: atLeastOne / nScen,
      avgPayoutsMinusFees: pmf / nScen,
    };
    scenarios.push(res);
    void navTotal;
    if (res.pRuin <= 0.05 && res.medianFinalNav > cap) {
      if (best === null || cap < best.initialCapital) best = res;
    }
  }
  return {
    scenarios,
    minimalCapital: best ? best.initialCapital : null,
    edgeRealise: best !== null,
    bestScenario: best,
    perChallengePayoffs,
  };
}
