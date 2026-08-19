'use client';
import { useState, useEffect, useCallback } from 'react';
import type { TradeRecord, PerformanceMetrics } from '@/lib/performance';
import { calcPerformanceMetrics } from '@/lib/performance';

const STORAGE_KEY = 'macro_trade_log_v1';

function loadTrades(): TradeRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TradeRecord[]) : [];
  } catch {
    return [];
  }
}

function saveTrades(trades: TradeRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch {
    // storage full
  }
}

export function usePerformance() {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>(() => calcPerformanceMetrics([]));

  // Load from localStorage on mount
  useEffect(() => {
    const loaded = loadTrades();
    setTrades(loaded);
    setMetrics(calcPerformanceMetrics(loaded));
  }, []);

  const addTrade = useCallback((trade: Omit<TradeRecord, 'id'>) => {
    const newTrade: TradeRecord = {
      ...trade,
      id: `trade-${crypto.randomUUID().slice(0, 8)}`,
    };
    setTrades(prev => {
      const updated = [...prev, newTrade];
      saveTrades(updated);
      setMetrics(calcPerformanceMetrics(updated));
      return updated;
    });
    return newTrade;
  }, []);

  const closeTrade = useCallback((id: string, exit: number, closedAt?: string) => {
    setTrades(prev => {
      const updated = prev.map(t => {
        if (t.id !== id) return t;
        const risk = Math.abs(t.entry - t.stop);
        const pnlPrice = t.direction === 'LONG' ? exit - t.entry : t.entry - exit;
        const pnlR = risk > 0 ? pnlPrice / risk : 0;
        const status: TradeRecord['status'] = pnlR > 0.05 ? 'WIN' : pnlR < -0.05 ? 'LOSS' : 'BE';
        return {
          ...t,
          exit,
          closedAt: closedAt ?? new Date().toISOString(),
          pnlR: Math.round(pnlR * 100) / 100,
          status,
        };
      });
      saveTrades(updated);
      setMetrics(calcPerformanceMetrics(updated));
      return updated;
    });
  }, []);

  const deleteTrade = useCallback((id: string) => {
    setTrades(prev => {
      const updated = prev.filter(t => t.id !== id);
      saveTrades(updated);
      setMetrics(calcPerformanceMetrics(updated));
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setTrades([]);
    saveTrades([]);
    setMetrics(calcPerformanceMetrics([]));
  }, []);

  return { trades, metrics, addTrade, closeTrade, deleteTrade, clearAll };
}
