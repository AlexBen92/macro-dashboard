'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { X } from 'lucide-react';

interface OptionsGuideDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-mono text-[0.65rem] text-[var(--label)] uppercase tracking-[2px] border-l-2 border-[var(--purple)] pl-2">
        {title}
      </h3>
      <div className="font-mono text-[0.7rem] text-[var(--text)] leading-relaxed space-y-1.5">
        {children}
      </div>
    </section>
  );
}

export default function OptionsGuideDrawer({ open, onOpenChange }: OptionsGuideDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-[760px] max-h-[88vh] overflow-y-auto bg-[var(--bg)] border border-[var(--border)] rounded-[6px] p-5"
          aria-label="Options guide"
        >
          <div className="flex items-center justify-between mb-5">
            <Dialog.Title className="font-mono text-[0.75rem] text-[var(--label)] uppercase tracking-[3px]">
              Options Guide
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

          <div className="space-y-5">
            <Section title="Reading GEX and DEX">
              <p>
                <strong>GEX (Gamma Exposure)</strong> measures how much option dealer hedging
                flows may accelerate or dampen price moves. Positive aggregate gamma tends to
                dampen moves around concentrated strikes; negative aggregate gamma can amplify.
              </p>
              <p>
                <strong>DEX (Delta Exposure)</strong> measures the notional-weighted delta across
                the option book — the directional tilt of raw delta exposure.
              </p>
              <p className="text-[var(--caution)]">
                Sign convention: values shown are <em>raw aggregate</em> from Deribit public
                data, labelled “Provider net GEX/DEX”. Public data does not expose the
                dealer/client split — we do not infer dealer positioning.
              </p>
            </Section>

            <Section title="Levels">
              <p>
                <strong>Call Wall</strong>: strike with the largest positive call GEX. Often
                acts as a reference resistance candidate (price magnet).
              </p>
              <p>
                <strong>Put Wall</strong>: strike with the most negative put GEX. Often acts as
                a reference support candidate (price magnet).
              </p>
              <p>
                <strong>Zero Gamma / Gamma Flip</strong>: strike where cumulative GEX crosses
                zero. Above → stabilizing regime; below → amplifying regime.
              </p>
              <p>
                <strong>HVL (High Volume Level)</strong>: strike with the largest absolute net
                GEX — the most concentration.
              </p>
              <p className="text-[var(--muted)]">
                All levels are <em>candidate references</em>. They are not automatic
                support/resistance and do not guarantee reversals.
              </p>
            </Section>

            <Section title="Black-Scholes Greeks">
              <p>Greeks computed server-side using BS formulas with r = 0:</p>
              <pre className="bg-[var(--bg2)] border border-[var(--border)] rounded-[3px] p-2 text-[0.6rem] whitespace-pre-wrap">
{`d1 = (ln(S/K) + (σ²/2)·T) / (σ·√T)
γ  = φ(d1) / (S·σ·√T)
δ_call = N(d1)
δ_put  = N(d1) − 1
GEX_row = γ · OI · S · S · 0.01 · (±1)
DEX_row = δ · OI · S · (±1)`}
              </pre>
              <p className="text-[var(--muted)]">
                Inputs: S = Deribit index price, σ = mark_iv, T = (expiry − now)/365, K = strike.
                OI = open_interest (contracts). Limitations: BS assumes log-normal, constant vol,
                no jumps — adequate for headline regime read but not for tail/IV surface modelling.
              </p>
            </Section>

            <Section title="Freshness">
              <p>
                <span className="text-[var(--bull)]">Live</span> &lt; 15s ·{' '}
                <span className="text-[var(--caution)]">Delayed</span> 15–60s ·{' '}
                <span className="text-[var(--bear)]">Stale</span> &gt; 60s ·{' '}
                <span className="text-[var(--muted)]">Unavailable</span> when source timestamp
                missing or upstream error.
              </p>
              <p className="text-[var(--muted)]">
                Refresh cadence: snapshot route polls every 5 min by default; in-memory cache
                TTL 5 min.
              </p>
            </Section>

            <Section title="Rule versions">
              <p>
                Regime rule <code>v1</code> · Read engine <code>v1</code> · Session plan{' '}
                <code>v1</code> · Context badge <code>v1</code>. All deterministic, versioned
                for audit.
              </p>
            </Section>

            <div className="pt-3 border-t border-[var(--border)]">
              <Link
                href="/docs/options"
                className="font-mono text-[0.65rem] text-[var(--accent)] underline"
              >
                Full documentation → /docs/options
              </Link>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
