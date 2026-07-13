'use client';

import { CheckCircle2, Info, Lock, FlaskConical, type LucideIcon } from 'lucide-react';

export type ActionabilityVariant =
  | 'actionable'
  | 'informational'
  | 'options_required'
  | 'validation';

interface BadgeConfig {
  icon: LucideIcon;
  color: string;
  label: string;
  title: string;
}

const CONFIG: Record<ActionabilityVariant, BadgeConfig> = {
  actionable: {
    icon: CheckCircle2,
    color: 'var(--bull)',
    label: 'Actionnable perp',
    title: "Signal actionnable directement sur perp, sans friction d'accès",
  },
  informational: {
    icon: Info,
    color: 'var(--dim)',
    label: 'Filtre lent',
    title: 'Informationnel — utile pour ajuster une position, pas un signal de trade autonome',
  },
  options_required: {
    icon: Lock,
    color: 'var(--muted)',
    label: 'Options requises',
    title: "Nécessite accès options (structure pro) — non disponible sans statut MiFID adéquat",
  },
  validation: {
    icon: FlaskConical,
    color: 'var(--caution)',
    label: 'En validation',
    title: 'Statut de recherche — pas encore fiable, ne pas trader sans validation supplémentaire',
  },
};

interface Props {
  variant: ActionabilityVariant;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
  note?: string;
}

export default function ActionabilityBadge({
  variant,
  size = 'sm',
  showLabel = true,
  className = '',
  note,
}: Props) {
  const cfg = CONFIG[variant];
  const Icon = cfg.icon;
  const iconSize = size === 'sm' ? 11 : 13;
  const padY = size === 'sm' ? '2px' : '3px';
  const padX = size === 'sm' ? '6px' : '8px';
  const font = size === 'sm' ? '0.55rem' : '0.62rem';
  const label = note ?? cfg.label;

  return (
    <span
      title={cfg.title}
      className={`inline-flex items-center gap-1 font-mono uppercase whitespace-nowrap border border-[var(--border)] bg-[var(--bg2)] ${className}`}
      style={{
        padding: `${padY} ${padX}`,
        borderRadius: '3px',
        fontSize: font,
        letterSpacing: '0.08em',
        fontWeight: 500,
        lineHeight: 1.2,
      }}
    >
      <Icon size={iconSize} strokeWidth={1.75} style={{ color: cfg.color }} />
      {showLabel && <span style={{ color: 'var(--label)' }}>{label}</span>}
    </span>
  );
}
