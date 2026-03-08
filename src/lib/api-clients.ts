import type { MarketData } from './types';
import { ASSETS } from './constants';

function fetchJ(url: string) {
  return fetch(url).then(r => r.json());
}

function hlPost(body: Record<string, unknown>) {
  return fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(r => r.json());
}

export { hlPost };

export async function fetchMarketData(): Promise<MarketData> {
  const results = await Promise.all([
    fetchJ('https://api.alternative.me/fng/?limit=7').catch(() => null),                     // 0
    fetchJ('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd,btc,eur&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true').catch(() => null), // 1
    fetchJ('https://api.coingecko.com/api/v3/global').catch(() => null),                      // 2
    fetchJ('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT').catch(() => null),  // 3
    fetchJ('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=ETHUSDT').catch(() => null),  // 4
    fetchJ('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=SOLUSDT').catch(() => null),  // 5
    fetchJ('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BNBUSDT').catch(() => null),  // 6
    fetchJ('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT').catch(() => null),  // 7
    fetchJ('https://fapi.binance.com/fapi/v1/openInterest?symbol=ETHUSDT').catch(() => null),  // 8
    fetchJ('https://fapi.binance.com/fapi/v1/openInterest?symbol=SOLUSDT').catch(() => null),  // 9
    fetchJ('https://fapi.binance.com/fapi/v1/openInterest?symbol=BNBUSDT').catch(() => null),  // 10
    fetchJ('https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=1h&limit=1').catch(() => null), // 11
    hlPost({ type: 'metaAndAssetCtxs' }).catch(() => null),                                    // 12
    hlPost({ type: 'allMids' }).catch(() => null),                                              // 13
  ]);

  const D: MarketData = { bFund: {}, bMark: {}, bOI: {}, hl: {}, hlMids: {} };

  // F&G
  try {
    if (results[0]?.data) {
      D.fng = { v: parseInt(results[0].data[0].value), c: results[0].data[0].value_classification };
      D.fngH = results[0].data.map((x: { value: string }) => parseInt(x.value)).reverse();
    }
  } catch { /* skip */ }

  // Prices
  try {
    if (results[1]) {
      const q = results[1];
      D.prices = {
        BTC: { p: q.bitcoin.usd, ch: q.bitcoin.usd_24h_change, mc: q.bitcoin.usd_market_cap, vol: q.bitcoin.usd_24h_vol },
        ETH: { p: q.ethereum.usd, ch: q.ethereum.usd_24h_change, mc: q.ethereum.usd_market_cap, btc: q.ethereum.btc },
        SOL: { p: q.solana.usd, ch: q.solana.usd_24h_change, mc: q.solana.usd_market_cap },
        BNB: { p: q.binancecoin.usd, ch: q.binancecoin.usd_24h_change, mc: q.binancecoin.usd_market_cap },
      };
    }
  } catch { /* skip */ }

  // Global
  try {
    if (results[2]?.data) {
      const g = results[2].data;
      D.global = { mc: g.total_market_cap.usd, mcChg: g.market_cap_change_percentage_24h_usd, dom: g.market_cap_percentage.btc };
    }
  } catch { /* skip */ }

  // Binance funding
  for (let i = 0; i < 4; i++) {
    try {
      const fr = results[3 + i];
      if (fr) {
        D.bFund[ASSETS[i]] = parseFloat(fr.lastFundingRate);
        D.bMark[ASSETS[i]] = parseFloat(fr.markPrice);
      }
    } catch { /* skip */ }
  }

  // Binance OI
  for (let i = 0; i < 4; i++) {
    try {
      const oi = results[7 + i];
      if (oi) D.bOI[ASSETS[i]] = parseFloat(oi.openInterest) * (D.bMark[ASSETS[i]] || 0);
    } catch { /* skip */ }
  }

  // L/S
  try {
    if (results[11]?.length) D.ls = { r: parseFloat(results[11][0].longShortRatio) };
  } catch { /* skip */ }

  // HL meta
  try {
    const hl = results[12];
    if (hl && Array.isArray(hl) && hl.length >= 2) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      hl[0].universe.forEach((u: any, idx: number) => {
        const c = hl[1][idx];
        if (c) D.hl[u.name] = { f: parseFloat(c.funding), oi: parseFloat(c.openInterest), mp: parseFloat(c.markPx) };
      });
    }
  } catch { /* skip */ }

  // HL mids
  try {
    if (results[13]) {
      for (const k of Object.keys(results[13])) {
        D.hlMids[k] = parseFloat(results[13][k]);
      }
    }
  } catch { /* skip */ }

  return D;
}

export async function fetchCoinCandles(coin: string): Promise<{ o: number; h: number; l: number; c: number; v: number }[]> {
  const now = Date.now();
  const start = now - 7 * 864e5;
  try {
    const data = await hlPost({
      type: 'candleSnapshot',
      req: { coin, interval: '1h', startTime: start, endTime: now },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((x: any) => ({ o: +x.o, h: +x.h, l: +x.l, c: +x.c, v: +x.v }));
  } catch {
    return [];
  }
}
