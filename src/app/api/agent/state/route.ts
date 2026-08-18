/**
 * GET /api/agent/state
 *
 * État structuré pour l'agent de trading autonome: régime, setups M15/H4/D1
 * avec statut de validation (tradable), orderflow. Chaque setup porte son
 * statut — pas d'exception. Cache 60s/swr 30s (spec: 60-300s).
 *
 * L'agent Python re-vérifie les registres sur disque côté VPS avant tout
 * capital réel; cette route est le snapshot d'orchestration/audit.
 */
import { NextResponse } from 'next/server';
import { DASH_DATA_ORIGIN, fetchAgentState } from '@/lib/agentState';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const state = await fetchAgentState(DASH_DATA_ORIGIN);
  return NextResponse.json(state, {
    status: 200,
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      'X-Stale': state.stale ? '1' : '0',
      'X-As-Of': state.as_of,
    },
  });
}
