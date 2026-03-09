import type { AsianRangeState, ScalpState, LondonBOState, MeanRevState, ORBState } from './types';
import { MACRO_EVENTS } from './constants';

// ══════════ SWAP RATES (USD per lot per night, typical FTMO) ══════════
// Positive = you receive, Negative = you pay
// Updated periodically — these are approximate
export const SWAP_RATES: Record<string, { long: number; short: number }> = {
  XAUUSD:  { long: -48.0, short: 12.0 },
  EURUSD:  { long: -6.5,  short: 1.2 },
  GBPUSD:  { long: -4.2,  short: -1.8 },
  USDJPY:  { long: 8.5,   short: -15.2 },
  USDCHF:  { long: 3.8,   short: -8.5 },
  AUDUSD:  { long: -5.1,  short: 0.5 },
  USDCAD:  { long: -1.2,  short: -4.8 },
  EURGBP:  { long: -4.8,  short: 0.3 },
  NAS100:  { long: -18.5, short: 2.0 },
  US30:    { long: -16.0, short: 1.5 },
};

// ══════════ CORRELATION GROUPS ══════════
// Pairs that are strongly correlated — trading both = doubling risk
export const CORRELATION_GROUPS: { pairs: string[]; correlation: number; note: string }[] = [
  { pairs: ['EURUSD', 'GBPUSD'], correlation: 0.82, note: 'EUR et GBP bougent ensemble vs USD' },
  { pairs: ['EURUSD', 'USDCHF'], correlation: -0.92, note: 'Miroir quasi-parfait — doublon' },
  { pairs: ['GBPUSD', 'EURGBP'], correlation: -0.65, note: 'GBP dans les deux — hedging partiel' },
  { pairs: ['AUDUSD', 'USDCAD'], correlation: 0.55, note: 'Commodity currencies — risque similaire' },
  { pairs: ['NAS100', 'US30'], correlation: 0.88, note: 'Indices US — meme direction' },
];

// ══════════ TRADABLE INSTRUMENT ══════════
export interface TradableInstrument {
  instrument: string;
  tradable: boolean;
  reasons: string[];
  warnings: string[];
  strategyReady: string | null;   // which strategy has a signal
  strategyStatus: string;         // status text
  swapLong: number;
  swapShort: number;
  isTripleSwap: boolean;          // Wednesday = triple swap
  blockedByEvent: string | null;  // event name if blocked
  blockedByCorrelation: string | null; // correlated instrument already in list
  sessionActive: boolean;
}

export function computeTradableToday(
  strategies: {
    asianRange: AsianRangeState;
    scalp: ScalpState;
    londonBOEUR: LondonBOState;
    londonBOGBP: LondonBOState;
    meanRevEUR: MeanRevState;
    meanRevEURGBP: MeanRevState;
    orbNAS: ORBState;
    orbUS30: ORBState;
  },
  vix: number,
  nextEventHours: number,
  nextEventName: string | null,
): TradableInstrument[] {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 3=Wed
  const isWednesday = dayOfWeek === 3;
  const isSunday = dayOfWeek === 0;
  const nowH = now.getUTCHours() + now.getUTCMinutes() / 60;

  // Find next event within 4h
  const eventBlocking = nextEventHours < 4 ? nextEventName : null;

  // Map instruments to their strategy availability
  const instrumentStrategies: Record<string, { name: string; status: string; ready: boolean }[]> = {
    XAUUSD: [
      { name: 'Asian Range', status: strategies.asianRange.status, ready: ['READY', 'TRIGGERED'].includes(strategies.asianRange.status) },
      { name: 'Scalp L/NY', status: strategies.scalp.status, ready: ['SETUP', 'ACTIVE'].includes(strategies.scalp.status) },
    ],
    EURUSD: [
      { name: 'London BO', status: strategies.londonBOEUR.eaStatus, ready: ['PLACING', 'LIVE', 'TRIGGERED'].includes(strategies.londonBOEUR.eaStatus) },
      { name: 'Mean Rev', status: strategies.meanRevEUR.eaStatus, ready: strategies.meanRevEUR.signalType !== 'NONE' },
    ],
    GBPUSD: [
      { name: 'London BO', status: strategies.londonBOGBP.eaStatus, ready: ['PLACING', 'LIVE', 'TRIGGERED'].includes(strategies.londonBOGBP.eaStatus) },
    ],
    EURGBP: [
      { name: 'Mean Rev', status: strategies.meanRevEURGBP.eaStatus, ready: strategies.meanRevEURGBP.signalType !== 'NONE' },
    ],
    NAS100: [
      { name: 'ORB', status: strategies.orbNAS.status, ready: ['READY', 'TRIGGERED'].includes(strategies.orbNAS.status) },
    ],
    US30: [
      { name: 'ORB', status: strategies.orbUS30.status, ready: ['READY', 'TRIGGERED'].includes(strategies.orbUS30.status) },
    ],
    USDJPY: [],
    USDCHF: [],
    AUDUSD: [],
    USDCAD: [],
  };

  // Session windows per instrument
  const sessionWindows: Record<string, { start: number; end: number }[]> = {
    XAUUSD: [{ start: 7, end: 12 }, { start: 13, end: 16.5 }],
    EURUSD: [{ start: 7, end: 16 }],
    GBPUSD: [{ start: 7, end: 16 }],
    EURGBP: [{ start: 7, end: 16 }],
    NAS100: [{ start: 14.5, end: 16.5 }],
    US30:   [{ start: 14.5, end: 16.5 }],
    USDJPY: [{ start: 0, end: 9 }, { start: 13, end: 22 }],
    USDCHF: [{ start: 7, end: 16 }],
    AUDUSD: [{ start: 0, end: 9 }, { start: 22, end: 24 }],
    USDCAD: [{ start: 13, end: 22 }],
  };

  // Build results
  const tradableList: string[] = [];
  const results: TradableInstrument[] = [];

  for (const instrument of Object.keys(instrumentStrategies)) {
    const swap = SWAP_RATES[instrument] || { long: 0, short: 0 };
    const strats = instrumentStrategies[instrument];
    const readyStrat = strats.find(s => s.ready);
    const bestStatus = readyStrat?.name ? `${readyStrat.name} ${readyStrat.status}` : strats[0]?.name ? `${strats[0].name} ${strats[0].status}` : 'Pas de strategie';

    // Session check
    const windows = sessionWindows[instrument] || [];
    const inSession = windows.some(w => {
      if (w.start > w.end) return nowH >= w.start || nowH < w.end;
      return nowH >= w.start && nowH < w.end;
    });

    // Correlation check
    let blockedByCorr: string | null = null;
    for (const group of CORRELATION_GROUPS) {
      if (group.pairs.includes(instrument)) {
        const otherPair = group.pairs.find(p => p !== instrument && tradableList.includes(p));
        if (otherPair && Math.abs(group.correlation) >= 0.7) {
          blockedByCorr = `${otherPair} (corr ${group.correlation.toFixed(2)})`;
          break;
        }
      }
    }

    // Event blocking for indices and high-impact
    const blockedByEvent = eventBlocking && (nextEventHours < 2 || ['NAS100', 'US30', 'XAUUSD'].includes(instrument))
      ? `${eventBlocking} dans ${Math.round(nextEventHours * 60)}min`
      : null;

    // VIX blocking
    const vixBlock = vix > 30;

    const reasons: string[] = [];
    const warnings: string[] = [];

    if (readyStrat) reasons.push(`${readyStrat.name} pret`);
    if (strats.length > 0 && !readyStrat) reasons.push(bestStatus);
    if (strats.length === 0) reasons.push('Pas de strategie assignee');

    // Swap warnings
    if (isWednesday) warnings.push('SWAP TRIPLE ce soir');
    const worstSwap = Math.min(swap.long, swap.short);
    if (worstSwap < -30) warnings.push(`Swap couteux: $${Math.abs(worstSwap).toFixed(0)}/nuit`);

    if (!inSession) warnings.push('Hors session optimale');
    if (blockedByCorr) warnings.push(`Doublon: ${blockedByCorr}`);
    if (blockedByEvent) warnings.push(`Event: ${blockedByEvent}`);
    if (vixBlock) warnings.push('VIX > 30 — no trade');
    if (isSunday) warnings.push('Dimanche — marche ferme');

    const tradable = !isSunday && !vixBlock && !blockedByEvent && !blockedByCorr && (readyStrat != null || strats.length === 0) && inSession;

    if (tradable) tradableList.push(instrument);

    results.push({
      instrument,
      tradable,
      reasons,
      warnings,
      strategyReady: readyStrat?.name ?? null,
      strategyStatus: bestStatus,
      swapLong: swap.long,
      swapShort: swap.short,
      isTripleSwap: isWednesday,
      blockedByEvent,
      blockedByCorrelation: blockedByCorr,
      sessionActive: inSession,
    });
  }

  // Sort: tradable first, then by strategy readiness
  results.sort((a, b) => {
    if (a.tradable !== b.tradable) return a.tradable ? -1 : 1;
    if (a.strategyReady && !b.strategyReady) return -1;
    if (!a.strategyReady && b.strategyReady) return 1;
    return 0;
  });

  return results;
}
