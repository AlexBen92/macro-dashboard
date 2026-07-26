'use client';

import type { SessionPlan, SessionSeverity } from '@/lib/options/types';

interface SessionPlanCardProps {
  plan: SessionPlan | null;
  isLoading?: boolean;
}

const SEVERITY_STYLE: Record<
  SessionSeverity,
  { bg: string; border: string; text: string; dot: string; tag: string }
> = {
  info: {
    bg: 'rgba(74,222,128,0.06)',
    border: 'var(--bull)',
    text: 'var(--bull)',
    dot: 'var(--bull)',
    tag: 'INFO',
  },
  caution: {
    bg: 'rgba(255,170,0,0.06)',
    border: 'var(--caution)',
    text: 'var(--caution)',
    dot: 'var(--caution)',
    tag: 'CAUTION',
  },
  alert: {
    bg: 'rgba(255,51,85,0.07)',
    border: 'var(--bear)',
    text: 'var(--bear)',
    dot: 'var(--bear)',
    tag: 'ALERT',
  },
};

export default function SessionPlanCard({ plan, isLoading }: SessionPlanCardProps) {
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Session plan
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          rule {plan?.ruleVersion ?? 'v1'} · conditional · ≤5
        </div>
      </div>
      <div className="p-2 space-y-1.5">
        {isLoading && (
          <div className="h-16 w-full animate-pulse bg-[var(--bg3)] rounded-[3px]" />
        )}
        {!isLoading && (!plan || plan.items.length === 0) && (
          <div className="font-mono text-[0.65rem] text-[var(--muted)] italic px-2 py-3">
            No plan computed
          </div>
        )}
        {!isLoading &&
          plan &&
          plan.items.map((item) => {
            const s = SEVERITY_STYLE[item.severity];
            return (
              <div
                key={item.id}
                className="border-l-[3px] rounded-[3px] px-2 py-1.5"
                style={{ background: s.bg, borderColor: s.border }}
                title={item.rationale}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="font-mono text-[0.5rem] uppercase tracking-[1.5px] font-semibold"
                    style={{ color: s.text }}
                  >
                    {s.tag}
                  </span>
                </div>
                <div className="font-mono text-[0.65rem] text-[var(--text)] leading-relaxed">
                  {item.text}
                </div>
                <div className="font-mono text-[0.55rem] text-[var(--dim)] mt-0.5 leading-snug">
                  {item.rationale}
                </div>
              </div>
            );
          })}
        <div className="font-mono text-[0.5rem] text-[var(--muted)] pt-1 border-t border-[var(--border)]">
          Decision aid · not investment advice · no automatic signal
        </div>
      </div>
    </div>
  );
}

