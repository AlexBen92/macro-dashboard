import { bsDelta, bsGamma } from './greeks';
import {
  findCallWall,
  findHvl,
  findPutWall,
  findZeroGamma,
} from './levels';
import { computeFreshness } from './freshness';
import { dealerDeltaBias, gammaRegime, REGIME_RULE_VERSION } from './regime';
import type {
  ExpiryBucket,
  OptionsExposureSnapshot,
  StrikeExposure,
  SupportedCurrency,
} from './types';

const DERIBIT_BASE = 'https://www.deribit.com/api/v2';
const DAY_MS = 86_400_000;

export interface DeribitBookRow {
  instrument_name: string;
  mark_iv: number | null;
  open_interest: number | null;
  bid_price: number | null;
  ask_price: number | null;
  mark_price: number | null;
  underlying_price: number | null;
  volume_usd: number | null;
  base_currency: string;
}

export interface ParsedInstrument {
  ccy: string;
  expiryISO: string;
  expiryTs: number;
  strike: number;
  isCall: boolean;
}

const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

export function parseInstrumentName(name: string): ParsedInstrument | null {
  const parts = name.split('-');
  if (parts.length !== 4) return null;
  const [ccy, ddmmyy, strikeStr, side] = parts;
  if (side !== 'C' && side !== 'P') return null;
  if (!/^\d+(\.\d+)?$/.test(strikeStr)) return null;
  const strike = Number.parseFloat(strikeStr);
  if (!Number.isFinite(strike) || strike <= 0) return null;
  const m = /^(\d{1,2})([A-Z]{3})(\d{2})$/.exec(ddmmyy.toUpperCase());
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  const monthIdx = MONTHS[m[2]];
  if (monthIdx === undefined) return null;
  if (day < 1 || day > 31) return null;
  const yearNum = 2000 + Number.parseInt(m[3], 10);
  if (!Number.isFinite(yearNum)) return null;
  const expiryDate = new Date(Date.UTC(yearNum, monthIdx, day, 8, 0, 0));
  return {
    ccy: ccy.toUpperCase(),
    expiryISO: expiryDate.toISOString().slice(0, 10),
    expiryTs: expiryDate.getTime(),
    strike,
    isCall: side === 'C',
  };
}

export function inBucket(dteDays: number, bucket: ExpiryBucket): boolean {
  switch (bucket) {
    case 'all':
      return true;
    case '0-7d':
      return dteDays >= 0 && dteDays <= 7;
    case '8-30d':
      return dteDays > 7 && dteDays <= 30;
    case '31-90d':
      return dteDays > 30 && dteDays <= 90;
    default:
      return true;
  }
}

export interface DeribitFetchResult {
  rows: DeribitBookRow[];
  underlying: number | null;
  sourceTs: string;
  warnings: string[];
}

export async function fetchDeribitBookSummary(
  currency: SupportedCurrency,
  opts: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<DeribitFetchResult> {
  const warnings: string[] = [];
  const timeoutMs = opts.timeoutMs ?? 8000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort();
    else opts.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }
  try {
    const [bookRes, idxRes] = await Promise.all([
      fetch(
        `${DERIBIT_BASE}/public/get_book_summary_by_currency?currency=${currency}&kind=option`,
        { signal: ctrl.signal, headers: { Accept: 'application/json' } },
      ),
      fetch(
        `${DERIBIT_BASE}/public/get_index_price?index_name=${currency.toLowerCase()}_usd`,
        { signal: ctrl.signal, headers: { Accept: 'application/json' } },
      ),
    ]);
    if (!bookRes.ok) throw new Error(`book_summary HTTP ${bookRes.status}`);
    const bookJson = (await bookRes.json()) as {
      result?: DeribitBookRow[];
      error?: { message?: string };
    };
    if (!bookJson.result) {
      throw new Error(bookJson.error?.message ?? 'empty book_summary result');
    }
    let underlying: number | null = null;
    if (idxRes.ok) {
      const idxJson = (await idxRes.json()) as {
        result?: { index_price?: number };
      };
      if (Number.isFinite(idxJson.result?.index_price ?? NaN)) {
        underlying = idxJson.result!.index_price!;
      }
    }
    if (underlying == null) {
      const first = bookJson.result.find(
        (r) => Number.isFinite(r.underlying_price ?? NaN) && (r.underlying_price ?? 0) > 0,
      );
      if (first) underlying = first.underlying_price;
      else warnings.push('underlying_price missing — spot will be null');
    }
    return {
      rows: bookJson.result,
      underlying,
      sourceTs: new Date().toISOString(),
      warnings,
    };
  } finally {
    clearTimeout(timer);
  }
}

interface AggOptions {
  asOf?: string;
  expiryBucket: ExpiryBucket;
  now?: number;
}

export function aggregateExposure(
  rows: DeribitBookRow[],
  underlying: number | null,
  opts: AggOptions,
): OptionsExposureSnapshot {
  const warnings: string[] = [];
  const asOf = opts.asOf ?? new Date().toISOString();
  const now = opts.now ?? Date.now();
  const expiryBucket = opts.expiryBucket;
  const spot = underlying && underlying > 0 ? underlying : null;

  if (spot == null) {
    warnings.push('spot unavailable — greeks computation skipped');
  }

  const byStrike = new Map<number, StrikeExposure>();
  const includedExpiries = new Set<string>();
  let totalOi = 0;

  for (const row of rows) {
    if (row.base_currency && row.base_currency !== 'BTC' && row.base_currency !== 'ETH') continue;
    const parsed = parseInstrumentName(row.instrument_name);
    if (!parsed) {
      continue;
    }
    const iv = row.mark_iv;
    const oi = row.open_interest;
    if (iv == null || iv <= 0) continue;
    if (oi == null || oi <= 0) continue;
    const dteDays = (parsed.expiryTs - now) / DAY_MS;
    if (dteDays <= 0) continue;
    if (!inBucket(dteDays, expiryBucket)) continue;
    if (spot == null) continue;

    const T = dteDays / 365;
    const sigma = iv / 100;
    const gamma = bsGamma(spot, parsed.strike, T, sigma);
    const delta = bsDelta(spot, parsed.strike, T, sigma, parsed.isCall);
    const contracts = oi;
    const notional = contracts * spot;
    const gexRow = gamma * notional * spot * 0.01 * (parsed.isCall ? 1 : -1);
    const dexRow = delta * notional * (parsed.isCall ? 1 : -1);

    includedExpiries.add(parsed.expiryISO);
    totalOi += contracts;

    const existing = byStrike.get(parsed.strike);
    if (existing) {
      if (parsed.isCall) {
        existing.callGex += gexRow;
        existing.callDex += dexRow;
        existing.callOi += contracts;
      } else {
        existing.putGex += gexRow;
        existing.putDex += dexRow;
        existing.putOi += contracts;
      }
      existing.netGex = existing.callGex + existing.putGex;
      existing.netDex = existing.callDex + existing.putDex;
      if (!existing.expiries.includes(parsed.expiryISO)) {
        existing.expiries.push(parsed.expiryISO);
      }
    } else {
      const base: StrikeExposure = {
        strike: parsed.strike,
        callGex: 0,
        putGex: 0,
        netGex: 0,
        callDex: 0,
        putDex: 0,
        netDex: 0,
        callOi: 0,
        putOi: 0,
        expiries: [parsed.expiryISO],
      };
      if (parsed.isCall) {
        base.callGex = gexRow;
        base.callDex = dexRow;
        base.callOi = contracts;
      } else {
        base.putGex = gexRow;
        base.putDex = dexRow;
        base.putOi = contracts;
      }
      base.netGex = base.callGex + base.putGex;
      base.netDex = base.callDex + base.putDex;
      byStrike.set(parsed.strike, base);
    }
  }

  const strikes = Array.from(byStrike.values()).sort((a, b) => a.strike - b.strike);

  if (strikes.length === 0) {
    warnings.push('no parseable strikes in selected bucket');
  }

  const netGex = strikes.reduce((s, k) => s + k.netGex, 0);
  const netDex = strikes.reduce((s, k) => s + k.netDex, 0);

  const freshness = computeFreshness(asOf, now);

  return {
    schemaVersion: 1,
    source: 'deribit_public',
    currency: rows[0]?.base_currency === 'ETH' ? 'ETH' : 'BTC',
    spot,
    asOf,
    expiryBucket,
    includedExpiries: Array.from(includedExpiries).sort(),
    strikes,
    levels: {
      callWall: findCallWall(strikes, spot),
      putWall: findPutWall(strikes, spot),
      zeroGamma: findZeroGamma(strikes, spot),
      hvl: findHvl(strikes, spot),
    },
    aggregate: { netGex, netDex, totalOi },
    regime: {
      gamma: gammaRegime(netGex, spot),
      dealerDelta: dealerDeltaBias(netDex, spot),
      ruleVersion: REGIME_RULE_VERSION,
    },
    freshness: {
      status: freshness.status,
      sourceTs: asOf,
      computedTs: asOf,
      ageMs: freshness.ageMs,
    },
    warnings,
  };
}
