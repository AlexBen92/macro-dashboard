'use client';
import { useState, useEffect, useCallback } from 'react';

export interface EdgeFinderBreakdown {
  cot: number;
  trend: number;
  macro: number;
  sentiment: number;
  seasonal: number;
}

export interface EdgeFinderScore {
  total: number;
  signal: string;
  breakdown: EdgeFinderBreakdown;
}

export interface COTData {
  netPosition: number;
  prevNetPosition: number;
  weeklyChange: number;
  cotIndex: number;
  reportDate: string;
  weeks52: number[];
}

export interface EdgeFinderData {
  scores: Record<string, EdgeFinderScore>;
  cot: Record<string, COTData>;
  macro: Record<string, number>;
  strength: Record<string, number>;
  fxRates: Record<string, number>;
  goldPrice: { price: number | null; source: string } | null;
  oilPrice: { price: number | null; prevPrice: number | null; source: string } | null;
  apiStatus: Record<string, string>;
  timestamp: string | null;
  loading: boolean;
  error: string | null;
}

const EMPTY: EdgeFinderData = {
  scores: {},
  cot: {},
  macro: {},
  strength: {},
  fxRates: {},
  goldPrice: null,
  oilPrice: null,
  apiStatus: {},
  timestamp: null,
  loading: true,
  error: null,
};

const CACHE_KEY = 'edgefinder_v1';
const CACHE_TTL = 30 * 60 * 1000; // 30min

function loadCache(): EdgeFinderData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - new Date(parsed.timestamp).getTime() > CACHE_TTL) return null;
    return { ...parsed, loading: false, error: null };
  } catch { return null; }
}

function saveCache(data: EdgeFinderData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* full */ }
}

export function useEdgeFinder(refreshInterval = 1800000) {
  const [data, setData] = useState<EdgeFinderData>(EMPTY);

  const refresh = useCallback(async (force = false) => {
    if (!force) {
      const cached = loadCache();
      if (cached) { setData(cached); return; }
    }
    setData(prev => ({ ...prev, loading: true, error: null }));
    try {
      const r = await fetch('/api/edgefinder');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      const next: EdgeFinderData = {
        scores: json.scores ?? {},
        cot: json.cot ?? {},
        macro: json.macro ?? {},
        strength: json.strength ?? {},
        fxRates: json.fxRates ?? {},
        goldPrice: json.goldPrice ?? null,
        oilPrice: json.oilPrice ?? null,
        apiStatus: json.apiStatus ?? {},
        timestamp: json.timestamp ?? new Date().toISOString(),
        loading: false,
        error: null,
      };
      saveCache(next);
      setData(next);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setData(prev => ({ ...prev, loading: false, error: msg }));
    }
  }, []);

  useEffect(() => {
    refresh(false);
    const interval = setInterval(() => refresh(true), refreshInterval);
    return () => clearInterval(interval);
  }, [refresh, refreshInterval]);

  return { ...data, refresh: () => refresh(true) };
}
