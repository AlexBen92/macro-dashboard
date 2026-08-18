'use client';

import useSWR from 'swr';
import type { CorrCell, CorrWindow } from '@/lib/engines/correlation';

export interface CorrBasketPayload {
  as_of: string | null;
  last_export_success: string | null;
  windows: CorrWindow[];
  universe: string[];
  cells: CorrCell[];
  note: string;
  errors: Array<{ id: string; error: string }>;
}

export const CORR_BASKET_STALE_MS = 26 * 60 * 60 * 1000;

export function isCorrBasketStale(payload: CorrBasketPayload | null, nowMs = Date.now()): boolean {
  if (!payload) return true;
  // as_of = date du dernier bar (J-1) — fraîcheur mesurée sur l'export
  const exportMs = payload.last_export_success
    ? Date.parse(payload.last_export_success)
    : NaN;
  const asOfMs = payload.as_of ? Date.parse(payload.as_of) : NaN;
  if (Number.isNaN(exportMs) && Number.isNaN(asOfMs)) return true;
  const refMs = Number.isNaN(exportMs) ? asOfMs : exportMs;
  return nowMs - refMs > CORR_BASKET_STALE_MS;
}

const fetcher = async (url: string): Promise<CorrBasketPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as CorrBasketPayload;
};

export function useCorrBasket(): {
  data: CorrBasketPayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<CorrBasketPayload>(
    '/api/corr-basket',
    fetcher,
    { refreshInterval: 3_600_000, revalidateOnFocus: false },
  );
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: isCorrBasketStale(data ?? null),
  };
}
