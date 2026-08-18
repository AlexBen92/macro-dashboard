'use client';

import { useState, type ReactNode } from 'react';

/**
 * Section de recherche exploratoire — repliée par défaut, dimming 50%.
 * Contenu NON TRADABLE: aucune stratégie validée sur cet univers (NO_EDGE
 * confirmé WF/DSR/PBO). Reste consultable pour le suivi de recherche.
 */
export default function ExploratorySection({
  label,
  children,
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 font-mono text-[0.6rem] uppercase tracking-[3px] text-[var(--muted)] hover:text-[var(--text)] text-left"
        title="Recherche exploratoire — aucun edge validé (programme directionnel M15/H4/D1 classé NO_EDGE après WF/DSR/PBO)"
      >
        <span className="inline-flex items-center rounded-[2px] border border-[var(--border)] px-1 py-px text-[0.5rem] tracking-[1px] text-[var(--muted)]">
          exploratoire · non tradable
        </span>
        <span>{label}</span>
        <span className="opacity-60">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 opacity-60">{children}</div>
      )}
      {!open && (
        <div className="opacity-50 font-mono text-[0.5rem] text-[var(--muted)] pl-1">
          replié — recherche non tradable, cliquer pour étendre
        </div>
      )}
    </section>
  );
}
