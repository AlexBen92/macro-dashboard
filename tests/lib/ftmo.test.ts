import { describe, expect, it } from 'vitest';

import {
  computeFtmoCost,
  computeSpxHedge,
  computeUs500Exposure,
  getFtmoCosts,
  getFtmoSpec,
  getUs500Spec,
  simulateFtmoRisk,
} from '@/lib/ftmo';

describe('ftmo spec loader', () => {
  it('charge un spec 100k two_step standard complet', () => {
    const s = getFtmoSpec(100000, 'two_step', 'standard');
    expect(s.accountKey).toBe('100k');
    expect(s.fee).toBeGreaterThan(0);
    expect(s.profitTargetPhase1).toBe(0.10);
    expect(s.profitTargetPhase2).toBe(0.05);
    expect(s.maxDailyLoss).toBe(0.05);
    expect(s.maxTotalLoss).toBe(0.10);
    expect(s.feeRefundable).toBe(true);
    expect(s.leverageByAsset.indices).toBe(50);
  });

  it('one_step: daily 3%, non remboursable, split 90%', () => {
    const s = getFtmoSpec(50000, 'one_step', 'swing');
    expect(s.maxDailyLoss).toBe(0.03);
    expect(s.feeRefundable).toBe(false);
    expect(s.profitSplitInitial).toBe(0.90);
    expect(s.leverageByAsset.indices).toBe(15);
  });

  it('taille inconnue → erreur explicite', () => {
    expect(() => getFtmoSpec(12345)).toThrow(/inconnue/);
  });
});

describe('simulateFtmoRisk', () => {
  const spec = getFtmoSpec(100000, 'two_step', 'standard');

  it('probabilités bornées [0,1] et cohérentes', () => {
    const r = simulateFtmoRisk({
      spec,
      strategyVol: 0.025,
      avgWin: 0.012,
      avgLoss: 0.008,
      winRate: 0.55,
      tradesPerDay: 3,
      daysPlanned: 30,
      nSims: 500,
      seed: 7,
    });
    for (const p of [
      r.probPassChallenge,
      r.probPassVerification,
      r.probReachFunded,
      r.probBreachDaily,
      r.probBreachTotal,
    ]) {
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
    expect(r.probReachFunded).toBeLessThanOrEqual(r.probPassChallenge + 1e-9);
    expect(r.pnlPath.length).toBeGreaterThan(0);
    expect(r.pnlPath.length).toBe(r.dailyLossUsage.length);
    expect(r.pnlPath.length).toBe(r.maxDrawdownUsage.length);
  });

  it('stratégie dégénérée gagnante → prob challenge élevée', () => {
    const r = simulateFtmoRisk({
      spec,
      strategyVol: 0.01,
      avgWin: 0.05,
      avgLoss: 0.001,
      winRate: 0.99,
      tradesPerDay: 2,
      daysPlanned: 20,
      nSims: 300,
      seed: 7,
    });
    expect(r.probPassChallenge).toBeGreaterThan(0.9);
  });

  it('stratégie dégénérée perdante → breach élevé', () => {
    const r = simulateFtmoRisk({
      spec,
      strategyVol: 0.02,
      avgWin: 0.001,
      avgLoss: 0.03,
      winRate: 0.05,
      tradesPerDay: 2,
      daysPlanned: 20,
      nSims: 300,
      seed: 7,
    });
    expect(r.probBreachDaily + r.probBreachTotal).toBeGreaterThan(0.8);
  });

  it('déterministe: même seed → même résultat', () => {
    const args = {
      spec,
      strategyVol: 0.025,
      avgWin: 0.012,
      avgLoss: 0.008,
      winRate: 0.55,
      tradesPerDay: 3,
      daysPlanned: 30,
      nSims: 200,
      seed: 11,
    } as const;
    const a = simulateFtmoRisk(args);
    const b = simulateFtmoRisk(args);
    expect(a.probPassChallenge).toBe(b.probPassChallenge);
    expect(a.pnlPath).toEqual(b.pnlPath);
  });
});

describe('computeFtmoCost', () => {
  it('gross = fee × (1+resets), remboursement si two_step', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const r = computeFtmoCost({ spec, resets: 1, tradedVolume: 100 });
    expect(r.challengeFeesGross).toBe(spec.fee * 2);
    expect(r.challengeFeesNetIfSuccess).toBe(spec.fee);
    expect(r.tradingCosts).toBe(100 * getFtmoCosts().commissions.forex_lot_round);
    expect(r.breakEvenProfitBeforePayout).toBeCloseTo(r.expectedCost / 0.8, 6);
  });

  it('one_step: pas de remboursement', () => {
    const spec = getFtmoSpec(10000, 'one_step', 'standard');
    const r = computeFtmoCost({ spec, resets: 0, tradedVolume: 0 });
    expect(r.challengeFeesNetIfSuccess).toBe(spec.fee);
  });
});

describe('us500 + hedge SPX', () => {
  it('exposition: notional = prix × lots × contract_size', () => {
    const r = computeUs500Exposure({ price: 6800, lots: 2 });
    expect(r.notional).toBe(13600);
    const ref = getUs500Spec().limits_reference;
    expect(r.dailyLossLimitValue).toBe(ref.account_size * ref.max_daily_loss);
  });

  it('hedge SPX: ratio cohérent entre multiplicateurs', () => {
    const spx = computeSpxHedge({
      notionalUs500: 136000,
      optionType: 'SPX',
      spxLevel: 6800,
      hedgeDeltaTarget: 0.5,
    });
    expect(spx.singleContractNotional).toBe(680000);
    expect(spx.contractsNeeded).toBeCloseTo((136000 * 0.5) / 680000, 6);

    const xsp = computeSpxHedge({
      notionalUs500: 136000,
      optionType: 'XSP',
      spxLevel: 6800,
      hedgeDeltaTarget: 0.5,
    });
    expect(xsp.singleContractNotional).toBe(68000);
    expect(xsp.contractsNeeded).toBeCloseTo(spx.contractsNeeded * 10, 6);

    const nano = computeSpxHedge({
      notionalUs500: 136000,
      optionType: 'NANO',
      spxLevel: 6800,
      hedgeDeltaTarget: 0.5,
    });
    expect(nano.singleContractNotional).toBeCloseTo(68, 6);
    expect(nano.contractsNeeded).toBeCloseTo(spx.contractsNeeded * 10000, 2);
  });
});
