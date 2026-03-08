import type { MarketData, ScoreResult, ScoreBreakdown } from './types';
import { WEIGHTS, MACRO_EVENTS } from './constants';
import { clamp } from './format';

function nextMacro(): { t: number; n: string; d: string } | null {
  const now = Date.now();
  let best: { t: number; n: string; d: string } | null = null;
  for (const e of MACRO_EVENTS) {
    const t = new Date(e.d + 'T18:00:00Z').getTime();
    if (t > now && (!best || t < best.t)) best = { t, n: e.n, d: e.d };
  }
  return best;
}

export { nextMacro };

export function calcScore(
  D: MarketData,
  priceHist: number[],
  fngHist: number[],
  whaleByCoin: { _totalLong: number; _totalShort: number; [k: string]: unknown }
): ScoreResult {
  const W = WEIGHTS;
  const bd: ScoreBreakdown[] = [];

  function add(k: string, l: string, raw: number) {
    const n = clamp(raw, -1, 1);
    const w = W[k] || 0;
    bd.push({ k, l, r: n, w, pts: n * w * 10 });
  }

  const bc = D.prices?.BTC?.ch ?? 0;
  add('btc_24h', 'BTC 24H', clamp(bc / 5, -1, 1));

  let b7 = 0;
  if (priceHist.length > 1 && D.prices?.BTC)
    b7 = ((D.prices.BTC.p - priceHist[0]) / priceHist[0]) * 100;
  add('btc_7d', 'BTC 7D', clamp(b7 / 10, -1, 1));

  let eb = 0;
  if (D.prices?.ETH?.btc) eb = clamp((D.prices.ETH.btc - 0.04) / 0.02, -1, 1);
  add('eth_btc', 'ETH/BTC', eb);

  let vn = 0;
  if (D.prices?.BTC?.vol && D.prices.BTC.mc)
    vn = clamp((D.prices.BTC.vol / D.prices.BTC.mc - 0.03) / 0.02, -1, 1);
  add('vol', 'Volume', vn);

  let dn = 0;
  if (D.global) dn = clamp((54 - (D.global.dom || 54)) / 6, -1, 1);
  add('dom', 'BTC Dom', dn);

  let fd = 0;
  if (D.bFund.BTC != null && D.hl.BTC) {
    const bf2 = D.bFund.BTC * 100;
    const hf2 = D.hl.BTC.f * 100;
    fd = clamp(Math.abs(bf2 - hf2) / 0.03, -1, 1) * ((bf2 + hf2) / 2 < 0 ? 1 : -1);
  }
  add('fund_div', 'Fund Div', fd);

  let fe = 0, fc2 = 0, fs2 = 0;
  if (D.bFund.BTC != null) { fs2 += D.bFund.BTC * 100; fc2++; }
  if (D.hl.BTC) { fs2 += D.hl.BTC.f * 100; fc2++; }
  if (fc2) fe = clamp(-(fs2 / fc2) / 0.05, -1, 1);
  add('fund_ext', 'Fund Extreme', fe);

  let oin = 0;
  if (D.bOI.BTC && D.hl.BTC) oin = clamp(bc / 3, -1, 1);
  add('oi', 'OI Mom', oin);

  let ln = 0;
  if (D.ls) ln = clamp((1.05 - D.ls.r) / 0.2, -1, 1);
  add('ls', 'L/S Ratio', ln);

  let wn = 0;
  const wt = (whaleByCoin._totalLong || 0) + (whaleByCoin._totalShort || 0);
  if (wt > 0) wn = clamp(((whaleByCoin._totalLong || 0) - (whaleByCoin._totalShort || 0)) / wt, -1, 1);
  add('whale', 'Whale Bias', wn);

  let fn = 0;
  if (D.fng) fn = clamp((50 - D.fng.v) / 30, -1, 1);
  add('fg', 'F&G', fn);

  let ft = 0;
  if (fngHist.length >= 2) ft = clamp((fngHist[fngHist.length - 1] - fngHist[0]) / 20, -1, 1);
  add('fg_trend', 'F&G Trend', ft);

  let mn = 0;
  const ne = nextMacro();
  if (ne) {
    const hrs = (ne.t - Date.now()) / 36e5;
    mn = hrs < 24 ? -0.8 : hrs < 72 ? -0.3 : 0.2;
  }
  add('macro', 'Event Prox', mn);

  let dxn = 0;
  if (D.dxy?.v != null && D.dxy?.prev != null)
    dxn = clamp(-(D.dxy.v - D.dxy.prev) / 0.5, -1, 1);
  add('dxy', 'DXY', dxn);

  let vn2 = 0;
  if (D.vix?.v != null) vn2 = clamp((20 - D.vix.v) / 8, -1, 1);
  add('vix', 'VIX', vn2);

  let cn = 0;
  if (D.cbbi) cn = clamp((0.4 - D.cbbi.conf) / 0.3, -1, 1);
  add('cbbi', 'CBBI', cn);

  let tot = 0;
  for (const b of bd) tot += b.pts;
  tot = Math.round(clamp(tot, -10, 10) * 10) / 10;

  let sig: string;
  if (tot > 4) sig = 'BULLISH';
  else if (tot >= 1) sig = 'MILD BULLISH';
  else if (tot >= -1) sig = 'NEUTRAL';
  else if (tot >= -4) sig = 'MILD BEARISH';
  else sig = 'BEARISH';

  bd.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
  return { score: tot, bd, signal: sig };
}
