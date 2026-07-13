/**
 * Trade-level logging for M15 composite score (L1/L2/L3 @ 30/40/30).
 * Append-only JSONL. Enables DSR/PBO/PSR/MC audit per V25 §6.
 */
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const LOG_PATH = path.join(DATA_DIR, 'm15_signals.jsonl');
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB cap

export interface M15SignalEntry {
  ts: string;
  symbol: string;
  session: string;
  session_score: number;
  layers: { l1: number; l2: number; l3: number; final: number };
  action: 'READY' | 'WATCH' | 'AVOID';
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  price_entry: number;
  size_usd: number | null;
  sl: number | null;
  tp: number | null;
  vol_regime: string | null;
  garch_phi: number | null;
  ofi_score: number | null;
  acf_direction: string | null;
  p_continuation: number | null;
  funding_pct: number | null;
  version: string;
}

export interface PersistedEntry extends M15SignalEntry {
  _id: string;
  _seq: number;
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function rotateIfNeeded(): Promise<void> {
  try {
    const stat = await fs.stat(LOG_PATH);
    if (stat.size < MAX_BYTES) return;
    const rotated = `${LOG_PATH}.${Date.now()}.bak`;
    await fs.rename(LOG_PATH, rotated);
  } catch {
    /* file may not exist yet */
  }
}

export async function appendSignal(entry: M15SignalEntry): Promise<{ ok: true; id: string; seq: number }> {
  await ensureDir();
  await rotateIfNeeded();
  const seq = Date.now();
  const _id = `${entry.symbol}.${seq}`;
  const line = JSON.stringify({ _id, _seq: seq, ...entry }) + '\n';
  await fs.appendFile(LOG_PATH, line, 'utf8');
  return { ok: true as const, id: _id, seq };
}

export async function readSignals(opts: {
  symbol?: string;
  since?: number; // ms epoch
  limit?: number;
  action?: 'READY' | 'WATCH' | 'AVOID';
}): Promise<PersistedEntry[]> {
  let content: string;
  try {
    content = await fs.readFile(LOG_PATH, 'utf8');
  } catch {
    return [];
  }
  const lines = content.split('\n').filter(Boolean);
  let out: PersistedEntry[] = [];
  for (const ln of lines) {
    let e: PersistedEntry;
    try {
      e = JSON.parse(ln);
    } catch {
      continue;
    }
    if (opts.symbol && e.symbol !== opts.symbol) continue;
    if (opts.since && e._seq < opts.since) continue;
    if (opts.action && e.action !== opts.action) continue;
    out.push(e);
  }
  if (opts.limit && out.length > opts.limit) {
    out = out.slice(-opts.limit);
  }
  return out;
}

export async function getStats(): Promise<{
  count: number;
  by_action: Record<string, number>;
  by_symbol: Record<string, number>;
  first_ts: string | null;
  last_ts: string | null;
}> {
  const all = await readSignals({});
  const by_action: Record<string, number> = {};
  const by_symbol: Record<string, number> = {};
  for (const e of all) {
    by_action[e.action] = (by_action[e.action] ?? 0) + 1;
    by_symbol[e.symbol] = (by_symbol[e.symbol] ?? 0) + 1;
  }
  return {
    count: all.length,
    by_action,
    by_symbol,
    first_ts: all[0]?.ts ?? null,
    last_ts: all[all.length - 1]?.ts ?? null,
  };
}
