'use client';

import {
  H4D1_PROGRAM,
  RESEARCH_STATUS_COLOR,
  RESEARCH_STATUS_LABEL,
  type ResearchProgramEntry,
} from '@/lib/researchStatus';

function StatusChip({ entry }: { entry: ResearchProgramEntry }) {
  const color = RESEARCH_STATUS_COLOR[entry.status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[3px] border font-mono text-[0.55rem] uppercase tracking-[1px]"
      style={{ color, borderColor: color, background: 'transparent' }}
      title={`${entry.label} — ${entry.detail}`}
    >
      <span>{entry.label}</span>
      <span className="opacity-70">· {RESEARCH_STATUS_LABEL[entry.status]}</span>
    </span>
  );
}

export default function ResearchProgramStatus({
  variant = 'markets',
}: {
  variant?: 'markets' | 'crypto';
}) {
  const entries = H4D1_PROGRAM.entries;

  return (
    <div
      className={`bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 ${
        variant === 'crypto' ? 'font-mono text-[0.58rem]' : ''
      }`}
      title={`Programme de recherche H4/Daily fermé le ${H4D1_PROGRAM.closed} — ${H4D1_PROGRAM.families} familles, ${H4D1_PROGRAM.configs} configs walk-forward testées (gates DSR/PBO/permutation). Aucune stratégie non validée n'est affichée comme tradable.`}
    >
      <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
        recherche h4/d1 · {H4D1_PROGRAM.families} familles / {H4D1_PROGRAM.configs} configs wf
      </span>
      <span className="border-l border-[var(--border)] h-3" />
      {entries.map((e) => (
        <StatusChip key={e.id} entry={e} />
      ))}
    </div>
  );
}
