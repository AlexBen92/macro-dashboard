import ResearchCatalog from '@/components/ResearchCatalog';
import { H4D1_PROGRAM } from '@/lib/researchStatus';

export const metadata = {
  title: 'Research — catalogue stratégies',
};

export default function ResearchPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
              RESEARCH · CATALOGUE STRATÉGIES
            </div>
            <div className="font-[var(--font-display)] italic text-[0.85rem] text-[var(--dim)] mt-0.5">
              {H4D1_PROGRAM.families} familles · {H4D1_PROGRAM.configs} configs WF · programme fermé {H4D1_PROGRAM.closed}
            </div>
          </div>
          <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px] text-right max-w-[420px]">
            audit, pas décision — un statut seul fait foi (registre unique)
          </div>
        </div>
        <div className="font-mono text-[0.58rem] text-[var(--muted)] mt-2 leading-relaxed">
          méthodologie: walk-forward 3 blocs · DSR (Lopez de Prado) · PBO cscv · permutation test jambes.
          règle exclusion: pas de retest identique (famille+tf+params) d&apos;une stratégie NULL.
          snapshot statique des registres — {H4D1_PROGRAM.entries.filter((e) => e.status === 'VALIDATED').length} VALIDATED.
        </div>
      </div>
      <div className="max-w-[96rem] mx-auto p-4">
        <ResearchCatalog />
      </div>
    </div>
  );
}
