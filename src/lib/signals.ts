import type { CoinData, TradeCandidate, AlertItem, MarketData } from './types';
import { fPct, fmtCD } from './format';
import { nextMacro } from './scoring';

export function selectTrades(coinData: Record<string, CoinData>): TradeCandidate[] {
  const candidates: TradeCandidate[] = [];

  for (const k of Object.keys(coinData)) {
    const c = coinData[k];
    if (!c.sharpe || !c.whaleCount) continue;
    if (Math.abs(c.sharpe) < 0.5) continue;

    let score = 0;
    const reasons: string[] = [];
    let dir: string | null = null;
    let sizing = 'NORMAL';

    // LONG
    if (
      c.sharpe > 0.5 && c.vwapD != null && c.vwapD > 0 &&
      (c.sentiment === 'STRONG LONG' || c.sentiment === 'LONG BIAS')
    ) {
      dir = 'LONG';
      score += c.sharpe;
      reasons.push('Sharpe ' + c.sharpe.toFixed(1));
      reasons.push('Whales ' + c.sentiment + ' (' + c.whaleCount + ')');
      reasons.push('Prix > VWAP (' + fPct(c.vwapD) + ')');
      if (c.funding != null && c.funding < 0) {
        score += 1;
        reasons.push('Funding negatif (pas crowde)');
      }
      if (c.twapD != null && c.twapD > 0) {
        score += 0.5;
        reasons.push('TWAP confirme (' + fPct(c.twapD) + ')');
      }
    }

    // SHORT
    if (
      !dir && c.sharpe < -0.5 && c.vwapD != null && c.vwapD < 0 &&
      (c.sentiment === 'STRONG SHORT' || c.sentiment === 'SHORT BIAS')
    ) {
      dir = 'SHORT';
      score += Math.abs(c.sharpe);
      reasons.push('Sharpe ' + c.sharpe.toFixed(1));
      reasons.push('Whales ' + c.sentiment + ' (' + c.whaleCount + ')');
      reasons.push('Prix < VWAP (' + fPct(c.vwapD) + ')');
      if (c.funding != null && c.funding > 0.03) {
        score += 1;
        reasons.push('Funding positif = longs fragiles');
      }
      if (c.twapD != null && c.twapD < 0) {
        score += 0.5;
        reasons.push('TWAP confirme (' + fPct(c.twapD) + ')');
      }
    }

    // CONTRARIAN LONG
    if (
      !dir && c.sentiment === 'STRONG SHORT' &&
      c.funding != null && c.funding < -0.1 && c.sharpe != null && c.sharpe < -2
    ) {
      dir = 'CONTRARIAN LONG';
      score += 2;
      reasons.push('Squeeze setup: tout le monde short');
      reasons.push('Funding ' + c.funding.toFixed(3) + '% (shorts paient)');
    }

    if (dir) {
      if (c.var95 != null && c.var95 < -5) sizing = '÷2 (VaR eleve)';
      else if (c.var95 != null && c.var95 < -3) sizing = '÷1.5';
      candidates.push({
        coin: c.coin,
        dir,
        score,
        reasons,
        sizing,
        price: c.price ?? 0,
        vwap: c.vwap ?? null,
        twap: c.twap ?? null,
        sharpe: c.sharpe,
        var95: c.var95 ?? 0,
        funding: c.funding ?? null,
        whaleCount: c.whaleCount ?? 0,
        sentiment: c.sentiment ?? 'NEUTRAL',
        vwapD: c.vwapD ?? null,
        twapD: c.twapD ?? null,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function generateAlerts(
  data: MarketData | null,
  coinData: Record<string, CoinData>
): AlertItem[] {
  const alerts: AlertItem[] = [];
  if (!data) return alerts;

  if (data.vix?.v != null && data.vix.v > 25) {
    alerts.push({
      t: data.vix.v > 30 ? 'danger' : '',
      m: 'VIX ' + data.vix.v.toFixed(1) + ' → ' +
        (data.vix.v > 30 ? 'EXTREME : CASH' : 'ELEVATED : taille ÷2 sur tous les trades'),
    });
  }

  const ne = nextMacro();
  if (ne) {
    const hrs = (ne.t - Date.now()) / 36e5;
    if (hrs < 24) {
      alerts.push({ t: 'danger', m: ne.n + ' dans ' + fmtCD(ne.t - Date.now()) + " : surveiller, pas d'entree large" });
    } else if (hrs < 72) {
      alerts.push({ t: '', m: ne.n + ' dans ' + fmtCD(ne.t - Date.now()) + " : pas d'impact immediat" });
    }
  }

  for (const k of Object.keys(coinData)) {
    const c = coinData[k];
    if (c.funding != null && c.funding < -0.1 && (c.whaleCount ?? 0) > 0 && c.sentiment === 'STRONG SHORT') {
      alerts.push({
        t: 'info',
        m: c.coin + ' : Whale SHORT + Funding tres negatif = SQUEEZE RISK (ne pas shorter)',
      });
    }
  }

  if (data.fng && data.fng.v < 15) {
    alerts.push({
      t: 'info',
      m: 'F&G ' + data.fng.v + ' Extreme Fear : opportunite contrarian si confirmee par whales',
    });
  }

  return alerts.slice(0, 3);
}
