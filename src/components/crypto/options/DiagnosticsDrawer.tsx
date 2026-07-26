'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { OptionsExposureSnapshot } from '@/lib/options/types';
import { compactUSD, compactOI } from '@/lib/options/format';

interface DiagnosticsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshot: OptionsExposureSnapshot | null;
  error?: string | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 py-0.5 border-b border-[var(--border)] last:border-0">
      <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px] w-40 flex-shrink-0">
        {label}
      </span>
      <span className="font-mono text-[0.65rem] text-[var(--text)] break-all">{value}</span>
    </div>
  );
}

export default function DiagnosticsDrawer({
  open,
  onOpenChange,
  snapshot,
  error,
}: DiagnosticsDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-[640px] max-h-[88vh] overflow-y-auto bg-[var(--bg)] border border-[var(--border)] rounded-[6px] p-5"
          aria-label="Diagnostics"
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-mono text-[0.75rem] text-[var(--label)] uppercase tracking-[3px]">
              Diagnostics
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="p-1 rounded-[3px] text-[var(--muted)] hover:text-[var(--text)]"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {error && (
            <div className="font-mono text-[0.65rem] text-[var(--bear)] p-2 border border-[var(--bear)]/40 rounded-[3px] mb-3">
              Error: {error}
            </div>
          )}

          {!snapshot && !error && (
            <div className="font-mono text-[0.7rem] text-[var(--muted)] italic">
              No snapshot available
            </div>
          )}

          {snapshot && (
            <div className="space-y-1">
              <Row label="Source" value={snapshot.source} />
              <Row label="Currency" value={snapshot.currency} />
              <Row label="Schema" value={`v${snapshot.schemaVersion}`} />
              <Row label="Spot" value={snapshot.spot != null ? String(snapshot.spot) : 'null'} />
              <Row label="As of" value={snapshot.asOf} />
              <Row label="Bucket" value={snapshot.expiryBucket} />
              <Row label="Included expiries" value={`${snapshot.includedExpiries.length}`} />
              <Row label="Strikes" value={`${snapshot.strikes.length}`} />
              <Row label="Total OI" value={compactOI(snapshot.aggregate.totalOi)} />
              <Row label="Net GEX" value={compactUSD(snapshot.aggregate.netGex)} />
              <Row label="Net DEX" value={compactUSD(snapshot.aggregate.netDex)} />
              <Row label="Gamma regime" value={snapshot.regime.gamma} />
              <Row label="Provider DEX dir" value={snapshot.regime.dealerDelta} />
              <Row label="Regime rule" value={snapshot.regime.ruleVersion} />
              <Row
                label="Freshness"
                value={`${snapshot.freshness.status} (age ${Math.round(snapshot.freshness.ageMs / 1000)}s)`}
              />
              <Row label="Source ts" value={snapshot.freshness.sourceTs ?? 'null'} />
              <Row label="Computed ts" value={snapshot.freshness.computedTs} />
              <Row
                label="Call Wall"
                value={snapshot.levels.callWall ? `${snapshot.levels.callWall.strike}` : 'null'}
              />
              <Row
                label="Put Wall"
                value={snapshot.levels.putWall ? `${snapshot.levels.putWall.strike}` : 'null'}
              />
              <Row
                label="Zero Gamma"
                value={snapshot.levels.zeroGamma ? `${snapshot.levels.zeroGamma.strike}` : 'null'}
              />
              <Row label="HVL" value={snapshot.levels.hvl ? `${snapshot.levels.hvl.strike}` : 'null'} />
              <div className="pt-3">
                <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px] mb-1">
                  Warnings ({snapshot.warnings.length})
                </div>
                {snapshot.warnings.length === 0 ? (
                  <div className="font-mono text-[0.65rem] text-[var(--bull)]">none</div>
                ) : (
                  <ul className="space-y-0.5">
                    {snapshot.warnings.map((w, i) => (
                      <li
                        key={i}
                        className="font-mono text-[0.6rem] text-[var(--caution)] leading-snug"
                      >
                        · {w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
