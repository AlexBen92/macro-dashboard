import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CACHE_DIR = '/tmp/hyperliquid-monitor';
const CACHE_FILE = join(CACHE_DIR, 'prev-data.json');
const CACHE_TTL = 120000; // 2 minutes max

interface PrevDataEntry {
  oi: number;
  vol: number;
  timestamp: number;
}

interface PrevData {
  timestamp: number;
  data: Record<string, PrevDataEntry>;
}

let memoryCache: PrevData | null = null;

function ensureCacheDir() {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function loadCache(): PrevData | null {
  // Try memory first
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL) {
    return memoryCache;
  }

  // Try file
  if (existsSync(CACHE_FILE)) {
    try {
      const content = readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(content) as PrevData;

      // Check if cache is not too old
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        memoryCache = parsed;
        return parsed;
      }
    } catch {
      // Invalid cache, ignore
    }
  }

  return null;
}

function saveCache(data: Record<string, PrevDataEntry>) {
  const cache: PrevData = {
    timestamp: Date.now(),
    data,
  };

  memoryCache = cache;

  try {
    ensureCacheDir();
    writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8');
  } catch {
    // Ignore write errors
  }
}

export function getPrevDataMap(): Map<string, { oi: number; vol: number }> {
  const cached = loadCache();
  if (!cached) return new Map();

  const map = new Map<string, { oi: number; vol: number }>();
  for (const [symbol, entry] of Object.entries(cached.data)) {
    map.set(symbol, { oi: entry.oi, vol: entry.vol });
  }

  return map;
}

export function updatePrevDataMap(rows: Array<{
  symbol: string;
  openInterest: number | null;
  volume24h: number | null;
}>) {
  const data: Record<string, PrevDataEntry> = {};

  for (const row of rows) {
    if (row.openInterest !== null && row.volume24h !== null) {
      data[row.symbol] = {
        oi: row.openInterest,
        vol: row.volume24h,
        timestamp: Date.now(),
      };
    }
  }

  saveCache(data);
}

export function clearCache() {
  memoryCache = null;
  try {
    if (existsSync(CACHE_FILE)) {
      // unlinkSync(CACHE_FILE);
    }
  } catch {
    // Ignore
  }
}
