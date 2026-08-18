'use client';

import useSWR from 'swr';
import { isEventImpactStale, type EventImpactPayload } from '@/lib/eventImpact';

const fetcher = async (url: string): Promise<EventImpactPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as EventImpactPayload;
};

export function useEventImpact(): {
  data: EventImpactPayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<EventImpactPayload>(
    '/api/event-impact',
    fetcher,
    { refreshInterval: 3_600_000, revalidateOnFocus: false },
  );
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: isEventImpactStale(data ?? null),
  };
}
