'use client';

import type { SessionPlan } from '@/lib/options/types';

interface SessionPlanCardProps {
  plan: SessionPlan | null;
  isLoading?: boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  info: 'var(--info)',
  caution: 'var(--caution)',
  alert: 'var(--bear)',
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
      <div className="p-3 space-y-2">
        {isLoading && (
          <div className="h-16 w-full animate-pulse bg-[var(--bg3)] rounded-[3px]" />
        )}
        {!isLoading && (!plan || plan.items.length === 0) && (
          <div className="font-mono text-[0.65rem] text-[var(--muted)] italic">
            No plan computed
          </div>
        )}
        {!isLoading &&
          plan &&
          plan.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2"
              title={item.rationale}
            >
              <div
                className="w-[6px] h-[6px] rounded-full mt-1.5 flex-shrink-0"
                style={{ background: SEVERITY_COLOR[item.severity] }}
              />
              <div className="flex-1">
                <div className="font-mono text-[0.65rem] text-[var(--text)] leading-relaxed">
                  {item.text}
                </div>
                <div className="font-mono text-[0.55rem] text-[var(--dim)] mt-0.5 leading-snug">
                  {item.rationale}
                </div>
              </div>
            </div>
          ))}
        <div className="font-mono text-[0.5rem] text-[var(--muted)] pt-1 border-t border-[var(--border)]">
          Decision aid · not investment advice · no automatic signal
        </div>
      </div>
    </div>
  );
}
