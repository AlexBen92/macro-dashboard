'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Lock, CheckCircle2 } from 'lucide-react';

interface ActionRow {
  indicator: string;
  signal: string;
  perp_action: string;
  options_action: string;
}

const ROWS: ActionRow[] = [
  {
    indicator: 'VRP',
    signal: 'VRP bas ou négatif',
    perp_action:
      'Réduire exposition perp / anticiper expansion de vol — filtre lent, pas signal direct',
    options_action: 'Straddle long (acheter IV sous-évalué)',
  },
  {
    indicator: 'VRP',
    signal: 'VRP élevé',
    perp_action:
      'Risque d’expansion violent — taille réduite, stop tight, éviter nouveaux leverage',
    options_action: 'Short vol (straddle short / iron condor)',
  },
  {
    indicator: 'D1',
    signal: 'Compression RV < 20e pct',
    perp_action:
      'Pas d’action directe sur perp — surveiller breakout directionnel, préparer sizing réduit',
    options_action: 'Long straddle (anticipation expansion)',
  },
  {
    indicator: 'Term structure',
    signal: 'Backwardation (court > long)',
    perp_action:
      'Stress court terme — éviter nouveaux leverage, rapprocher stops',
    options_action: 'Calendar spread (short front / long back)',
  },
  {
    indicator: 'Skew',
    signal: 'Put bid (puts chers)',
    perp_action:
      'Sentiment défensif — favoriser stratégies long/short plutôt que long-only',
    options_action: 'Sell put spreads (financier la protection)',
  },
];

const STORAGE_KEY = 'crypto_vol_pedago_seen';

export default function PedagogicalPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeen, setHasSeen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY) === '1';
      setHasSeen(seen);
      setIsOpen(!seen);
    } catch {
      setHasSeen(false);
      setIsOpen(true);
    }
  }, []);

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next && !hasSeen) {
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        /* noop */
      }
      setHasSeen(true);
    }
  };

  return (
    <div className="border border-[var(--border)] rounded-[4px] bg-[var(--bg2)] overflow-hidden">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg3)] transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.15em] text-[var(--dim)]">
            Ce que je peux faire avec ça
          </span>
          {!hasSeen && (
            <span className="font-mono text-[0.5rem] px-1.5 py-0.5 rounded-[2px] border border-[var(--caution)] text-[var(--caution)] uppercase tracking-[0.1em]">
              Nouveau
            </span>
          )}
        </div>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[var(--muted)]"
        >
          <ChevronDown size={14} strokeWidth={1.75} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-[var(--border)] rounded-[3px] p-3 bg-[var(--bg3)]">
                  <div className="flex items-center gap-1.5 mb-2 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--bull)]">
                    <CheckCircle2 size={11} strokeWidth={1.75} />
                    <span>Disponible maintenant — perp</span>
                  </div>
                  <div className="font-mono text-[0.5rem] text-[var(--muted)] mb-3 leading-snug">
                    Pas d’accès options (particulier UE, MiCA/MiFID II). Actions filtrage / sizing / risk management uniquement.
                  </div>
                  <div className="space-y-2">
                    {ROWS.map((r, i) => (
                      <div key={`perp-${i}`} className="text-[0.6rem]">
                        <div className="font-mono text-[var(--dim)]">
                          <span className="text-[var(--text)]">{r.indicator}</span> · {r.signal}
                        </div>
                        <div className="font-mono text-[0.55rem] text-[var(--text)] mt-0.5 leading-snug">
                          → {r.perp_action}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-[var(--border)] rounded-[3px] p-3 bg-[var(--bg)] relative overflow-hidden">
                  <div className="absolute inset-0 bg-[var(--bg)] opacity-60 pointer-events-none" />
                  <div className="relative">
                    <div className="flex items-center gap-1.5 mb-2 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-[var(--muted)]">
                      <Lock size={11} strokeWidth={1.75} />
                      <span>Nécessite accès options — structure pro</span>
                    </div>
                    <div className="font-mono text-[0.5rem] text-[var(--muted)] mb-3 leading-snug">
                      Stratégies impliquant options (straddle, calendar, iron condor). Non disponibles sans statut MiFID adéquat.
                    </div>
                    <div className="space-y-2 opacity-60">
                      {ROWS.map((r, i) => (
                        <div key={`opt-${i}`} className="text-[0.6rem]">
                          <div className="font-mono text-[var(--dim)]">
                            <span className="text-[var(--text)]">{r.indicator}</span> · {r.signal}
                          </div>
                          <div className="font-mono text-[0.55rem] text-[var(--muted)] mt-0.5 leading-snug">
                            → {r.options_action}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 font-mono text-[0.5rem] text-[var(--muted)] leading-snug border-l-2 border-[var(--border)] pl-2">
                Aucun des indicateurs ci-dessus ne constitue un signal de trade autonome. Le panneau traduit
                un état de la surface de vol en décision de risk management — pas l’inverse. S1 (paper trader) reste
                le seul signal en validation.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
