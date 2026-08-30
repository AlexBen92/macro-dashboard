import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

import FtmoDecisionCard, { type LadderRow } from '@/components/ftmo/FtmoDecisionCard';
import FtmoFloorsCard from '@/components/ftmo/FtmoFloorsCard';
import { getFtmoSpec } from '@/lib/ftmo';
import type { McResult } from '@/lib/ftmo-pricer/monte-carlo';

function fakeMc(pPass1: number, pFunded: number): McResult {
  const n = 1000;
  const outcomes: McResult['outcomes'] = Array.from({ length: n }, (_, i) =>
    i < pFunded * n ? 'funded_alive_end' : 'fail_phase1'
  );
  return {
    nSims: n,
    pPassPhase1: pPass1,
    pPassPhase2: pFunded,
    pReachFunded: pFunded,
    pFailP1: 1 - pPass1,
    pTimeoutP1: 0,
    pFailP2: pPass1 - pFunded,
    pTimeoutP2: 0,
    pKoFunded: 0,
    pKoAfterPayout: 0,
    pFundedAliveEnd: pFunded,
    pFailDailyP1: 0.5,
    pFailTotalP1: 0.5 - pPass1,
    pFailDailyP2: 0,
    pFailTotalP2: 0,
    outcomes,
    payoffs: [-483, 5000],
    payoutsCash: outcomes.map((o) => (o === 'funded_alive_end' ? 8000 : 0)),
    simDays: [100],
    fairValue: 2000,
    fairValueSe: 100,
    fairValueCI95: [1800, 2200],
    representativePaths: {},
  };
}

const kelly = { fullKelly: 0.05, halfKelly: 0.025, discreteKelly: null, interpretation: 'test' };
const ladder: LadderRow[] = [
  { lambdaEval: 0.5, riskDayPct: 0.5, pPass1: 0.9, pFunded: 0.85, edgeNet: 100, isStar: false },
  { lambdaEval: 1, riskDayPct: 1, pPass1: 0.8, pFunded: 0.72, edgeNet: 300, isStar: true },
  { lambdaEval: 2, riskDayPct: 2, pPass1: 0.5, pFunded: 0.35, edgeNet: -50, isStar: false },
];

describe('FtmoDecisionCard render', () => {
  it('GO: pFunded 72%, resets < 2 — affiche feu GO + resets + économie + échelle', () => {
    const html = renderToStaticMarkup(
      createElement(FtmoDecisionCard, {
        mc: fakeMc(0.8, 0.72),
        kelly,
        fee: 439,
        feeUsd: 483,
        feeRefundable: true,
        frictionAnnual: 1000,
        sensitivity: null,
        ladder,
        measureLabel: 'mesure Q',
        label: '100K 2-step standard',
      })
    );
    expect(html).toContain('◉ GO');
    expect(html).toContain('Resets moyens');
    expect(html).toContain('Économie réelle');
    expect(html).toContain('Échelle de risque');
    expect(html).toContain('EV cash net');
    // E[attempts] = 1/0.72 ≈ 1.4
    expect(html).toContain('1.4');
  });

  it('STOP: pFunded 35% — feu STOP', () => {
    const html = renderToStaticMarkup(
      createElement(FtmoDecisionCard, {
        mc: fakeMc(0.5, 0.35),
        kelly,
        fee: 439,
        feeUsd: 483,
        feeRefundable: false,
        frictionAnnual: 1000,
        sensitivity: null,
        ladder: null,
        measureLabel: 'mesure Q',
        label: '100K 1-step standard',
      })
    );
    expect(html).toContain('◉ STOP');
    expect(html).not.toContain('Échelle de risque');
  });
});

describe('FtmoFloorsCard render', () => {
  it('affiche floors $ + slider + règle du jour', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const html = renderToStaticMarkup(
      createElement(FtmoFloorsCard, { spec, riskPerTrade: 0.005, onRiskPerTradeChange: () => {} })
    );
    expect(html).toContain('Floor daily');
    expect(html).toContain('type="range"');
    expect(html).toContain('stop du jour');
  });
});
