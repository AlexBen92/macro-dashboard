'use client';

import type { GammaRegime, DealerDeltaBias, OptionsExposureSnapshot } from '@/lib/options/types';
import { buildOptionsRead } from '@/lib/options/read-engine';

interface OptionsReadCardProps {
  snapshot: OptionsExposureSnapshot | null;
  isLoading?: boolean;
}

const REGIME_STYLE: Record<GammaRegime, { bg: string; border: string; text: string }> = {
  positive: {
    bg: 'rgba(74,222,128,0.06)',
    border: 'var(--bull)',
    text: 'var(--bull)',
  },
  negative: {
    bg: 'rgba(255,51,85,0.07)',
    border: 'var(--bear)',
    text: 'var(--bear)',
  },
  neutral: {
    bg: 'rgba(140,140,160,0.04)',
    border: 'var(--muted)',
    text: 'var(--muted)',
  },
  unknown: {
    bg: 'transparent',
    border: 'var(--border)',
    text: 'var(--muted)',
  },
};

const DEX_COLOR: Record<DealerDeltaBias, string> = {
  long: 'var(--bull)',
  short: 'var(--bear)',
  flat: 'var(--muted)',
  unknown: 'var(--muted)',
};

export default function OptionsReadCard({ snapshot, isLoading }: OptionsReadCardProps) {
  const read = snapshot ? buildOptionsRead(snapshot) : null;
  const regime = snapshot?.regime.gamma ?? 'unknown';
  const g = REGIME_STYLE[regime];
  const dexColor = DEX_COLOR[snapshot?.regime.dealerDelta ?? 'unknown'];

  return (
    <div
      className="border border-[var(--border)] border-l-[3px] rounded-[4px]"
      style={{ background: g.bg, borderColor: `var(--border)`, borderLeftColor: g.border }}
    >
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
        {!isLoading && read && snapshot && (
          <>
            <div
              className="font-mono text-[0.7rem] leading-relaxed"
              style={{ color: regime === 'unknown' ? 'var(--text)' : g.text }}
            >
              {read.lines[0]}
            </div>
            <div className="font-mono text-[0.7rem] text-[var(--text)] leading-relaxed">
              {read.lines[1]}
            </div>
            <div className="font-mono text-[0.7rem] leading-relaxed">
              <span className="text-[var(--text)]">
                {read.lines[2].split(' ')[0]}{' '}
                {read.lines[2].split(' ')[1]}
              </span>{' '}
              <span style={{ color: dexColor, fontWeight: 600 }}>
                {snapshot.regime.dealerDelta}
              </span>{' '}
              <span className="text-[var(--text)]">
                {read.lines[2].split(' ').slice(2).join(' ').replace(/^\([a-z]+\)\s*/, '')}
              </span>
            </div>
            <div className="font-mono text-[0.55rem] text-[var(--dim)] pt-1">
              Sign = raw aggregate · NOT dealer/client positioning · source: {snapshot.source}
              {snapshot.includedExpiries.length > 0
                ? ` · ${snapshot.includedExpiries.length} expiries`
                : ''}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

