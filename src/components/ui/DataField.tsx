'use client';

/**
 * Un seul composant pour les 3 états "pas de valeur":
 *  - loading (transitoire): skeleton shimmer
 *  - stale (donnée périmée): dernière valeur connue + badge orange horodaté
 *  - unavailable (source coupée / non applicable): badge gris, jamais "0"
 *
 * Objectif: remplacer n/a | unknown | unavailable | — | chargement… éparpillés.
 */

export function formatAge(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)} h`;
  return `${(ms / 86_400_000).toFixed(1)} j`;
}

interface DataFieldProps {
  value: string | number | null | undefined;
  loading?: boolean;
  stale?: boolean;
  staleAgeMs?: number | null;
  unavailableReason?: string;
  title?: string;
  className?: string;
}

export default function DataField({
  value,
  loading = false,
  stale = false,
  staleAgeMs = null,
  unavailableReason,
  title,
  className = '',
}: DataFieldProps) {
  const hasValue = value !== null && value !== undefined && value !== '';

  if (loading && !hasValue) {
    return (
      <span
        className={`inline-block h-3 w-10 animate-pulse rounded-[2px] bg-[var(--border)] align-middle ${className}`}
        title={title ?? 'Chargement'}
      />
    );
  }

  if (!hasValue) {
    return (
      <span
        className={`inline-flex items-center rounded-[2px] border border-[var(--border)] px-1 font-mono text-[0.55rem] uppercase tracking-[1px] text-[var(--muted)] ${className}`}
        title={unavailableReason ?? title ?? 'Indisponible — source coupée ou non applicable'}
      >
        indisp.
      </span>
    );
  }

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`} title={title}>
      <span className={stale ? 'opacity-60' : undefined}>{value}</span>
      {stale && (
        <span
          className="inline-flex items-center rounded-[2px] border px-1 font-mono text-[0.5rem] uppercase tracking-[1px]"
          style={{ color: 'var(--caution)', borderColor: 'var(--caution)' }}
          title="Dernière valeur connue — donnée périmée"
        >
          {staleAgeMs !== null ? `il y a ${formatAge(staleAgeMs)}` : 'stale'}
        </span>
      )}
    </span>
  );
}
