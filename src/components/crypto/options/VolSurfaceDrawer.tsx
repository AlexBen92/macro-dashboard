'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import PedagogicalPanel from '@/components/vol/PedagogicalPanel';
import VolOverviewBar from '@/components/vol/VolOverviewBar';
import VrpCard from '@/components/vol/VrpCard';
import D1Card from '@/components/vol/D1Card';
import TermStructureCard from '@/components/vol/TermStructureCard';
import SkewCard from '@/components/vol/SkewCard';
import S1PaperPerformanceSection from '@/components/vol/S1PaperPerformanceSection';
import { useVolResearch } from '@/hooks/api/useVolResearch';

interface VolSurfaceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BTC_COLOR = 'var(--caution)';
const ETH_COLOR = 'var(--info)';

export default function VolSurfaceDrawer({ open, onOpenChange }: VolSurfaceDrawerProps) {
  const { payload, available, isLoading, error } = useVolResearch();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-[1100px] max-h-[88vh] overflow-y-auto bg-[var(--bg)] border border-[var(--border)] rounded-[6px] p-5"
          aria-label="Vol Surface"
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-mono text-[0.75rem] text-[var(--label)] uppercase tracking-[3px]">
              Vol Surface · VRP / D1 / Term / Skew / S1
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

          {isLoading && (
            <div className="font-mono text-[0.7rem] text-[var(--muted)] p-6 text-center">
              Loading vol research…
            </div>
          )}
          {!isLoading && !available && (
            <div className="font-mono text-[0.65rem] text-[var(--caution)] p-4 border border-[var(--caution)]/40 rounded-[3px]">
              Vol research unavailable{error ? ` — ${error}` : ''}
            </div>
          )}
          {!isLoading && available && payload && (
            <div className="space-y-4">
              <PedagogicalPanel />
              <VolOverviewBar payload={payload} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <VrpCard ccy="BTC" data={payload.vrp.BTC} ccyColor={BTC_COLOR} />
                <VrpCard ccy="ETH" data={payload.vrp.ETH} ccyColor={ETH_COLOR} />
                <D1Card ccy="BTC" data={payload.d1_compression.BTC} ccyColor={BTC_COLOR} />
                <D1Card ccy="ETH" data={payload.d1_compression.ETH} ccyColor={ETH_COLOR} />
                <TermStructureCard ccy="BTC" data={payload.term_structure.BTC} ccyColor={BTC_COLOR} />
                <TermStructureCard ccy="ETH" data={payload.term_structure.ETH} ccyColor={ETH_COLOR} />
                <SkewCard ccy="BTC" data={payload.skew.BTC} ccyColor={BTC_COLOR} />
                <SkewCard ccy="ETH" data={payload.skew.ETH} ccyColor={ETH_COLOR} />
              </div>
              <S1PaperPerformanceSection />
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
