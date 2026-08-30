/**
 * GET /api/ftmo-risk — gate de risque temps réel pour bots/agents (circuit-breaker).
 *
 * Paramètres:
 *   account=100k|25k|50k|10k|200k   (défaut 100k)
 *   model=two_step|one_step          (défaut two_step)
 *   type=standard|swing              (défaut standard)
 *   equity=96200                     equity live USD (floating inclus) — OBLIGATOIRE pour le gate
 *   dayStart=100000                  balance/equity 00:00 CE(S)T (défaut = solde initial)
 *   peak=104000                      plus haut solde minuit (1-step trailing)
 *   risk=0.005                       risk/trade fraction (défaut 0.005)
 *
 * Réponse: spec + floors ($/usage) + soft-stop + gate {canOpenNewTrade, reduceOnly, killNow, verdict}.
 * Sans equity: renvoie le budget statique (probe mode, 200).
 */
import { NextResponse } from 'next/server';
import { getFtmoSpec, FTMO_ACCOUNT_KEYS, type AccountKey, type FtmoModel, type FtmoAccountType } from '@/lib/ftmo';
import { computeRiskBudget, computeRiskGate, DEFAULT_SOFT_STOP_SHARE } from '@/lib/ftmo-pricer/risk-budget';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SIZE: Record<string, number> = { '10k': 10000, '25k': 25000, '50k': 50000, '100k': 100000, '200k': 200000 };

function num(v: string | null): number | null {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const u = new URL(request.url);
  const account = (u.searchParams.get('account') ?? '100k') as AccountKey;
  const model = (u.searchParams.get('model') ?? 'two_step') as FtmoModel;
  const type = (u.searchParams.get('type') ?? 'standard') as FtmoAccountType;

  if (!FTMO_ACCOUNT_KEYS.includes(account)) {
    return NextResponse.json(
      { error: `account invalide: ${account}. Valides: ${FTMO_ACCOUNT_KEYS.join(',')}` },
      { status: 400 }
    );
  }
  if (model !== 'two_step' && model !== 'one_step') {
    return NextResponse.json({ error: 'model invalide: two_step|one_step' }, { status: 400 });
  }
  if (type !== 'standard' && type !== 'swing') {
    return NextResponse.json({ error: 'type invalide: standard|swing' }, { status: 400 });
  }

  const spec = getFtmoSpec(SIZE[account], model, type);
  const risk = num(u.searchParams.get('risk')) ?? 0.005;
  if (risk <= 0 || risk > 0.05) {
    return NextResponse.json({ error: 'risk doit être dans (0, 0.05]' }, { status: 400 });
  }

  const budget = computeRiskBudget(spec, risk, DEFAULT_SOFT_STOP_SHARE);
  const equity = num(u.searchParams.get('equity'));
  const dayStart = num(u.searchParams.get('dayStart')) ?? spec.accountSize;
  const peak = num(u.searchParams.get('peak')) ?? undefined;

  const base = {
    asOf: new Date().toISOString(),
    spec: {
      account: account,
      accountSize: spec.accountSize,
      model,
      type,
      maxDailyLossPct: spec.maxDailyLoss,
      maxTotalLossPct: spec.maxTotalLoss,
      maxLossMode: spec.maxLossMode,
      dailyLossAnchor: 'balance/equity 00:00 CE(S)T (param dayStart)',
      minTradingDaysPhase: spec.minTradingDaysPhase,
      profitTargetP1: spec.profitTargetPhase1,
      profitTargetP2: spec.profitTargetPhase2,
      feeEur: spec.fee,
      feeUsd: spec.feeUsd,
      newsRestrictions: spec.newsRestrictions,
    },
    budget,
    usage: 'GET /api/ftmo-risk?account=100k&equity=96200&dayStart=100000&risk=0.005',
  };

  if (equity === null || equity <= 0) {
    return NextResponse.json(
      { ...base, gate: null, note: 'param equity requis pour le gate live (probe mode: budget statique seul)' },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }
  if (dayStart <= 0) {
    return NextResponse.json({ error: 'dayStart doit être > 0' }, { status: 400 });
  }

  const gate = computeRiskGate(spec, { equity, dayStartEquity: dayStart, peakEodBalance: peak, riskPerTrade: risk });
  return NextResponse.json(
    { ...base, equity, gate },
    { headers: { 'Cache-Control': 'no-store', 'X-Risk-Verdict': gate.verdict } }
  );
}
