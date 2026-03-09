import type { FtmoScoreResult, AsianRangeState, MeanRevState, LondonBOState, ORBState, YahooCandle } from './types';
import { clamp } from '../format';

interface InstrumentInfo {
  price: number;
  change24h: number;
  candles1h?: YahooCandle[];
}

const FTMO_WEIGHTS: Record<string, number> = {
  dxy_momentum: 0.12,
  vix_regime: 0.08,
  yield_curve_signal: 0.05,
  gold_dxy_alignment: 0.10,
  cross_asset_agreement: 0.05,
  session_quality: 0.10,
  currency_dispersion: 0.08,
  gold_atr_regime: 0.07,
  event_proximity: 0.05,
  asian_range_quality: 0.10,
  mean_rev_signal: 0.08,
  london_bo_range: 0.07,
  orb_bias_clarity: 0.05,
};

export function calcFtmoScore(
  instruments: Record<string, InstrumentInfo>,
  asianRange: AsianRangeState,
  meanRevEUR: MeanRevState,
  londonBOEUR: LondonBOState,
  orbNAS: ORBState,
  vix: number,
  dxyChange: number,
  sessionActive: boolean,
  eventHours: number,
): FtmoScoreResult {
  const W = FTMO_WEIGHTS;
  const bd: { k: string; l: string; pts: number; w: number }[] = [];

  function add(k: string, l: string, raw: number) {
    const n = clamp(raw, -1, 1);
    const w = W[k] || 0;
    bd.push({ k, l, pts: n * w * 10, w });
  }

  // DXY momentum
  add('dxy_momentum', 'DXY Momentum', clamp(Math.abs(dxyChange) / 0.5, 0, 1) * (Math.abs(dxyChange) > 0.1 ? 1 : -0.5));

  // VIX regime
  add('vix_regime', 'VIX Regime', vix < 18 ? 0.8 : vix < 25 ? 0.2 : vix < 30 ? -0.5 : -1);

  // Yield curve
  const y10 = instruments['10Y']?.price ?? 0;
  add('yield_curve_signal', 'Yield Signal', y10 > 4.5 ? -0.5 : y10 < 3.5 ? 0.5 : 0);

  // Gold/DXY alignment
  const goldCh = instruments.XAUUSD?.change24h ?? 0;
  const dxyCh = dxyChange;
  const aligned = (goldCh > 0 && dxyCh < 0) || (goldCh < 0 && dxyCh > 0);
  add('gold_dxy_alignment', 'Gold/DXY Align', aligned ? 0.8 : -0.3);

  // Cross asset agreement
  const eurCh = instruments.EURUSD?.change24h ?? 0;
  const gbpCh = instruments.GBPUSD?.change24h ?? 0;
  const sameDir = (eurCh > 0 && gbpCh > 0 && dxyCh < 0) || (eurCh < 0 && gbpCh < 0 && dxyCh > 0);
  add('cross_asset_agreement', 'Cross Agreement', sameDir ? 0.8 : 0);

  // Session quality
  add('session_quality', 'Session Quality', sessionActive ? 0.8 : -0.5);

  // Currency dispersion
  const changes = Object.values(instruments).map(i => i.change24h).filter(c => !isNaN(c));
  const maxCh = Math.max(...changes.map(Math.abs));
  add('currency_dispersion', 'FX Dispersion', clamp(maxCh / 1, 0, 1));

  // Gold ATR regime
  const goldATR = instruments.XAUUSD?.candles1h?.length ?
    (() => { const h = instruments.XAUUSD.candles1h; return h.length >= 2 ? Math.abs(h[h.length-1].h - h[h.length-1].l) : 0; })() : 0;
  add('gold_atr_regime', 'Gold ATR', goldATR > 5 ? 0.5 : goldATR > 2 ? 0.8 : -0.3);

  // Event proximity
  add('event_proximity', 'Event Proximity', eventHours < 24 ? -0.8 : eventHours < 72 ? -0.3 : 0.3);

  // Asian range quality
  const rangeOK = asianRange.rangeWidth > 5 && asianRange.rangeWidth < 30 && asianRange.status !== 'EXPIRED';
  add('asian_range_quality', 'Asian Range', rangeOK ? 0.7 : -0.3);

  // Mean rev signal
  add('mean_rev_signal', 'Mean Rev Signal', meanRevEUR.signalType !== 'NONE' ? 0.9 : meanRevEUR.rsi14 < 35 || meanRevEUR.rsi14 > 65 ? 0.3 : -0.2);

  // London BO range
  const lboOK = !londonBOEUR.tooWide && londonBOEUR.rangeWidthPips > 15 && londonBOEUR.eaStatus !== 'DONE';
  add('london_bo_range', 'London BO', lboOK ? 0.7 : -0.3);

  // ORB bias clarity
  add('orb_bias_clarity', 'ORB Clarity', orbNAS.h1Bias !== 'NEUTRAL' && orbNAS.status !== 'EXPIRED' ? 0.7 : -0.2);

  let tot = 0;
  for (const b of bd) tot += b.pts;
  tot = Math.round(clamp(tot, -10, 10) * 10) / 10;

  let signal: string;
  if (tot > 4) signal = 'STRONG SETUP';
  else if (tot >= 1.5) signal = 'GOOD CONDITIONS';
  else if (tot >= -1) signal = 'MIXED';
  else if (tot >= -4) signal = 'POOR CONDITIONS';
  else signal = 'AVOID TRADING';

  bd.sort((a, b) => Math.abs(b.pts) - Math.abs(a.pts));
  return { score: tot, signal, breakdown: bd };
}
