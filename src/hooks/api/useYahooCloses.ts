'use client';

import { useEffect, useState } from 'react';

const cache: Map<string, { ts: number; data: number[] }> = new Map();
const TTL = 5 * 60 * 1000;

export function useYahooCloses(
  symbols: string[],
  interval = '1d',
  range = '40d',
): { data: Record<string, number[]>; loading: boolean; error: string | null } {
  const [data, setData] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const key = symbols.join(',') + interval + range;

    async function run(): Promise<void> {
      setLoading(true);
      setError(null);
      const out: Record<string, number[]> = {};
      const now = Date.now();
      try {
        await Promise.all(
          symbols.map(async (s) => {
            const c = cache.get(s + interval + range);
            if (c && now - c.ts < TTL) {
              out[s] = c.data;
              return;
            }
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
              s,
            )}?interval=${interval}&range=${range}`;
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!r.ok) return;
            const d = await r.json();
            const closes: number[] = (
              d.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
            ).filter((x: number | null): x is number => x != null);
            out[s] = closes;
            cache.set(s + interval + range, { ts: now, data: closes });
          }),
        );
        if (active) {
          setData(out);
          setLoading(false);
        }
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'fetch failed');
          setLoading(false);
        }
      }
    }

    void run();
    void key;
    const id = setInterval(run, TTL);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [symbols.join(','), interval, range]);

  return { data, loading, error };
}
