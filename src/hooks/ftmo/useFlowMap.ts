'use client';
import { useMemo, useRef } from 'react';
import type { FlowNode, FlowEdge, YahooCandle } from '@/lib/ftmo/types';
import { FLOW_NODE_POSITIONS, BASE_CORRELATIONS } from '@/lib/ftmo/constants';

interface UseFlowMapReturn {
  nodes: FlowNode[];
  edges: FlowEdge[];
  alerts: string[];
}

export function useFlowMap(
  instruments: Record<string, { price: number; change24h: number; candles1h: YahooCandle[] }>,
): UseFlowMapReturn {
  const prevPrices = useRef<Record<string, number>>({});

  return useMemo(() => {
    const nodes: FlowNode[] = [];
    const alerts: string[] = [];

    // Build nodes
    for (const [id, pos] of Object.entries(FLOW_NODE_POSITIONS)) {
      const inst = instruments[id];
      const price = inst?.price ?? 0;
      const change24h = inst?.change24h ?? 0;

      // Calculate session change (vs last refresh)
      const prev = prevPrices.current[id] ?? price;
      const changeSession = prev > 0 ? ((price - prev) / prev) * 100 : 0;
      prevPrices.current[id] = price;

      const pulseIntensity = Math.min(1, Math.abs(changeSession) / 0.3);

      nodes.push({
        id,
        label: id,
        price,
        change24h,
        changeSession,
        x: pos.x,
        y: pos.y,
        size: pos.size,
        pulseIntensity,
        category: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD'].includes(id) ? 'currency'
          : ['GOLD', 'OIL'].includes(id) ? 'commodity'
          : ['VIX', 'DXY', '10Y'].includes(id) ? 'macro' : 'index',
      });
    }

    // Build edges
    const edges: FlowEdge[] = BASE_CORRELATIONS.map(base => {
      const fromNode = nodes.find(n => n.id === base.from);
      const toNode = nodes.find(n => n.id === base.to);
      const isActive = (fromNode?.pulseIntensity ?? 0) > 0.3;

      // Check if correlation is holding
      const fromChange = fromNode?.change24h ?? 0;
      const toChange = toNode?.change24h ?? 0;
      const expectedDirection = base.correlation > 0 ? (fromChange > 0 ? 1 : -1) : (fromChange > 0 ? -1 : 1);
      const actualDirection = toChange > 0 ? 1 : toChange < 0 ? -1 : 0;
      const correlationHolding = expectedDirection === actualDirection || Math.abs(fromChange) < 0.05;

      if (!correlationHolding && Math.abs(base.correlation) > 0.5 && Math.abs(fromChange) > 0.1) {
        alerts.push(`${base.from}/${base.to} decouple (attendu ${base.correlation > 0 ? 'meme dir' : 'inverse'}, observe contraire)`);
      }

      return {
        ...base,
        isActive,
        strength: Math.abs(base.correlation) > 0.7 ? 'strong' as const : Math.abs(base.correlation) > 0.4 ? 'moderate' as const : 'weak' as const,
      };
    });

    return { nodes, edges, alerts };
  }, [instruments]);
}
