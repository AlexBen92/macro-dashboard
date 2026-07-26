'use client';

import type { OptionsExposureSnapshot } from '@/lib/options/types';
import { buildOptionsRead } from '@/lib/options/read-engine';

interface OptionsReadCardProps {
  snapshot: OptionsExposureSnapshot | null;
  isLoading?: boolean;
}

export default function OptionsReadCard({ snapshot, isLoading }: OptionsReadCardProps) {
  const read = snapshot ? buildOptionsRead(snapshot) : null;
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Options read
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          rule {read?.ruleVersion ?? 'v1'} · deterministic
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        {isLoading && (
          <div className="h-12 w-full animate-pulse bg-[var(--bg3)] rounded-[3px]" />
        )}
        {!isLoading && !snapshot && (
          <div className="font-mono text-[0.65rem] text-[var(--muted)] italic">
            Snapshot unavailable
          </div>
        )}
        {!isLoading && read && (
          <>
            {read.lines.map((l, i) => (
              <div key={i} className="font-mono text-[0.7rem] text-[var(--text)] leading-relaxed">
                {l}
              </div>
            ))}
            <div className="font-mono text-[0.55rem] text-[var(--dim)] pt-1">
              Sign = raw aggregate · NOT dealer/client positioning · source: {snapshot!.source}
              {snapshot!.includedExpiries.length > 0
                ? ` · ${snapshot!.includedExpiries.length} expiries`
                : ''}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
