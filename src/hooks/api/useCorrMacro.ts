'use client';

import useSWR from 'swr';

export interface CorrMacroDailyCell {
  row: string;
  col: string;
  window: string;
  r: number;
  n: number;
}

export interface CorrMacroMonthlyCell {
  row: string;
  col: string;
  r: number;
  n_obs: number;
}

export interface CorrMacroPayload {
  as_of: string | null;
  last_export_success: string | null;
  rows: string[];
  cols: string[];
  windows: string[];
  daily: { cells: CorrMacroDailyCell[] };
  monthly: { window_months: number; cells: CorrMacroMonthlyCell[] };
  alt_index: {
    members: string[];
    excluded: Array<{ sym: string; reason: string }>;
    min_members_per_day: number;
  };
  note: string;
  errors: Array<{ id: string; error: string }>;
}

export const CORR_MACRO_STALE_MS = 26 * 60 * 60 * 1000;

export function isCorrMacroStale(payload: CorrMacroPayload | null, nowMs = Date.now()): boolean {
  if (!payload) return true;
  const exportMs = payload.last_export_success
    ? Date.parse(payload.last_export_success)
    : NaN;
  const asOfMs = payload.as_of ? Date.parse(payload.as_of) : NaN;
  if (Number.isNaN(exportMs) && Number.isNaN(asOfMs)) return true;
  const refMs = Number.isNaN(exportMs) ? asOfMs : exportMs;
  return nowMs - refMs > CORR_MACRO_STALE_MS;
}

const fetcher = async (url: string): Promise<CorrMacroPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as CorrMacroPayload;
};

export function useCorrMacro(): {
  data: CorrMacroPayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<CorrMacroPayload>(
    '/api/corr-macro',
    fetcher,
    { refreshInterval: 3_600_000, revalidateOnFocus: false },
  );
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: isCorrMacroStale(data ?? null),
  };
}
