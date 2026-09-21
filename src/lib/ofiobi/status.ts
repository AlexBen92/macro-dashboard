import type { OfiObiStatus } from '@/hooks/api/useOfiObiStatus';

export interface StatusStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

export const OFI_OBI_STATUS_STYLE: Record<OfiObiStatus, StatusStyle> = {
  NULL: { bg: 'rgba(255,90,90,0.15)', text: 'var(--bear)', border: 'var(--bear)', label: 'NULL' },
  IN_TEST: { bg: 'rgba(140,140,160,0.10)', text: 'var(--dim)', border: 'var(--border)', label: 'IN TEST' },
  IN_VALIDATION: { bg: 'rgba(255,170,0,0.18)', text: 'var(--caution)', border: 'var(--caution)', label: 'IN VAL' },
  CONFIRMED: { bg: 'rgba(74,222,128,0.18)', text: 'var(--bull)', border: 'var(--bull)', label: 'CONF' },
};

export function statusStyleFor(status: OfiObiStatus | null): StatusStyle {
  return OFI_OBI_STATUS_STYLE[status ?? 'NULL'];
}

export function formatIc(ic: number | null | undefined): string {
  return ic != null ? ic.toFixed(4) : '—';
}

export function formatBps(v: number | null | undefined): string {
  return v != null ? v.toFixed(1) : '—';
}

/** Stale = export older than threshold (registres statiques → 25 h). */
export function isPayloadStale(
  lastExportSuccess: string | null | undefined,
  nowMs: number,
  thresholdMs: number,
): boolean {
  if (!lastExportSuccess) return false;
  const t = Date.parse(lastExportSuccess);
  if (Number.isNaN(t)) return false;
  return nowMs - t > thresholdMs;
}
