'use client';
import { useMemo } from 'react';
import type { MarketData, CoinData, TradeCandidate, AlertItem } from '@/lib/types';
import { selectTrades, generateAlerts } from '@/lib/signals';

interface UseTradeSelectionReturn {
  trades: TradeCandidate[];
  alerts: AlertItem[];
}

export function useTradeSelection(
  coinData: Record<string, CoinData>,
  data: MarketData | null,
): UseTradeSelectionReturn {
  return useMemo(() => {
    const trades = selectTrades(coinData);
    const alerts = generateAlerts(data, coinData);
    return { trades, alerts };
  }, [coinData, data]);
}
