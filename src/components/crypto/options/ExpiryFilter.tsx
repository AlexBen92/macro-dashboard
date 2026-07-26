'use client';

import type { ExpiryBucket } from '@/lib/options/types';

interface ExpiryFilterProps {
  value: ExpiryBucket;
  onChange: (b: ExpiryBucket) => void;
  includedExpiries?: string[];
}

const BUCKETS: { key: ExpiryBucket; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: '0-7d', label: '0-7D' },
  { key: '8-30d', label: '8-30D' },
  { key: '31-90d', label: '31-90D' },
];

export default function ExpiryFilter({ value, onChange, includedExpiries }: ExpiryFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px]">
        Expiry
      </span>
      <div
        className="flex items-center gap-0.5 rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-0.5"
        title="Filter applies to Deribit option expiries only"
      >
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => onChange(b.key)}
            className={`px-2 py-0.5 rounded-[2px] font-mono text-[0.6rem] uppercase tracking-[1.5px] transition-colors ${
              value === b.key
                ? 'bg-[var(--accent)] text-[var(--bg)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {includedExpiries && includedExpiries.length > 0 && (
        <span
          className="font-mono text-[0.55rem] text-[var(--dim)]"
          title={`Included expiries (${includedExpiries.length}): ${includedExpiries.join(', ')}`}
        >
          · {includedExpiries.length} exp
        </span>
      )}
    </div>
  );
}
