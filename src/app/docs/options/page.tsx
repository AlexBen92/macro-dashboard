import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Options documentation · macro-dashboard',
  description:
    'Conventions, methods, source limits and rule versions for the /crypto options command center.',
};

export default function OptionsDocsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <article className="v4-container prose prose-invert max-w-none">
        <header className="mb-8">
          <p className="font-mono text-[0.65rem] text-[var(--muted)] uppercase tracking-[3px]">
            /docs/options
          </p>
          <h1 className="font-mono text-2xl mt-1">Options Command Center — Documentation</h1>
          <p className="text-[var(--dim)] mt-2 text-sm">
            Conventions, methods and source limits. Companion to the{' '}
            <Link href="/crypto" className="text-[var(--accent)] underline">
              /crypto day-trading console
            </Link>
            .
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="font-mono text-base text-[var(--label)] uppercase tracking-[2px]">
            Source
          </h2>
          <p className="text-sm">
            <strong>Deribit public API</strong>. No API key required. Server-side fetches only.
          </p>
          <ul className="text-sm list-disc list-inside space-y-1">
            <li>
              <code className="font-mono text-xs">
                GET /api/v2/public/get_book_summary_by_currency?currency=&#123;BTC|ETH&#125;&kind=option
              </code>
            </li>
            <li>
              <code className="font-mono text-xs">
                GET /api/v2/public/get_index_price?index_name=&#123;ccy&#125;_usd
              </code>
            </li>
          </ul>
          <p className="text-sm">
            Public book summary returns: <code>instrument_name, mark_iv, open_interest,
            bid/ask, mark_price, underlying_price, volume_usd</code>. Greeks are NOT provided —
            we compute them transparently (see below).
          </p>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="font-mono text-base text-[var(--label)] uppercase tracking-[2px]">
            Currency & Notional
          </h2>
          <ul className="text-sm list-disc list-inside space-y-1">
            <li>Underlying S = Deribit index price (USD per coin).</li>
            <li>Notional per contract = S × contracts.</li>
            <li>GEX unit: USD per 1% spot move (γ · OI · S · S · 0.01).</li>
            <li>DEX unit: USD notional × delta (δ · OI · S).</li>
            <li>Supported currencies: BTC, ETH. SOL not in Deribit options scope for this page.</li>
          </ul>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="font-mono text-base text-[var(--label)] uppercase tracking-[2px]">
            Sign convention
          </h2>
          <p className="text-sm">
            Values are <strong>raw aggregate</strong> from public open interest. We label them{' '}
            <em>“Provider net GEX/DEX”</em>. The Deribit public API does not expose the
            dealer/client split — therefore the UI never claims dealer positioning, long/short
            gamma from the dealers’ perspective, or inventory-driven interpretations.
          </p>
          <p className="text-sm">
            Convention: calls contribute +gex (positive γ multiplied by +1), puts contribute −gex
            (positive γ multiplied by −1). DEX uses signed δ: calls +, puts −.
          </p>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="font-mono text-base text-[var(--label)] uppercase tracking-[2px]">
            Black-Scholes Greeks
          </h2>
          <p className="text-sm">
            Risk-free rate r = 0, dividend yield q = 0 (crypto). Time T in years. Volatility σ =
            mark_iv / 100.
          </p>
          <pre className="bg-[var(--bg2)] border border-[var(--border)] rounded p-3 text-xs font-mono whitespace-pre-wrap">
{`d1 = (ln(S/K) + (σ²/2)·T) / (σ·√T)
γ  = φ(d1) / (S·σ·√T)
δ_call = N(d1)
δ_put  = N(d1) − 1
GEX_row = γ · OI · S · S · 0.01 · (call ? +1 : −1)
DEX_row = δ · OI · S · (call ? +1 : −1)`}
          </pre>
          <p className="text-sm">
            Normal CDF uses Abramowitz-Stegun 7.1.26 approximation (|err| &lt; 7.5e-8).
            Limitations: BS assumes log-normal returns, constant volatility, continuous trading,
            no jumps. Adequate for a regime read; insufficient for tail / smile modelling.
          </p>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="font-mono text-base text-[var(--label)] uppercase tracking-[2px]">
            Levels
          </h2>
          <ul className="text-sm list-disc list-inside space-y-1">
            <li>
              <strong>Call Wall</strong>: strike with the largest call GEX (max positive
              call-side contribution).
            </li>
            <li>
              <strong>Put Wall</strong>: strike with the most negative put GEX (min put-side
              contribution).
            </li>
            <li>
              <strong>HVL (High Volume Level)</strong>: strike with max |netGex|.
            </li>
            <li>
              <strong>Zero Gamma / Gamma Flip</strong>: strike where cumulative net GEX (sorted
              ascending by strike) crosses zero. Linear interpolation between bracketing strikes.
            </li>
          </ul>
          <p className="text-sm">
            All four are <em>candidate references</em>, never automatic support / resistance.
            Distance % = (strike − spot) / spot × 100.
          </p>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="font-mono text-base text-[var(--label)] uppercase tracking-[2px]">
            Expiry buckets
          </h2>
          <ul className="text-sm list-disc list-inside space-y-1">
            <li><code>all</code>: every live expiry with DTE &gt; 0.</li>
            <li><code>0-7d</code>, <code>8-30d</code>, <code>31-90d</code>: bucket filters.</li>
            <li>Expired or DTE ≤ 0 are dropped.</li>
          </ul>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="font-mono text-base text-[var(--label)] uppercase tracking-[2px]">
            Freshness
          </h2>
          <ul className="text-sm list-disc list-inside space-y-1">
            <li><strong>Live</strong>: age &lt; 15 s.</li>
            <li><strong>Delayed</strong>: 15–60 s.</li>
            <li><strong>Stale</strong>: &gt; 60 s (UI keeps last valid snapshot with Stale badge).</li>
            <li><strong>Unavailable</strong>: source timestamp missing or upstream error.</li>
          </ul>
          <p className="text-sm">
            Snapshot route polls every 5 minutes; in-memory cache TTL 5 min.
          </p>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="font-mono text-base text-[var(--label)] uppercase tracking-[2px]">
            Rule versions
          </h2>
          <ul className="text-sm list-disc list-inside space-y-1">
            <li>Gamma regime · <code>v1</code> · thresholds derived from spot² · 0.01.</li>
            <li>Provider DEX direction · <code>v1</code> · |netDex| &gt; spot · 1000 to leave “flat”.</li>
            <li>Options read engine · <code>v1</code> · deterministic 3-line summary.</li>
            <li>Session plan · <code>v1</code> · max 5 conditional, non-imperative items.</li>
            <li>Context badge · <code>v1</code> · risk-on / risk-off / mixed / insufficient.</li>
          </ul>
        </section>

        <section className="space-y-3 mt-8">
          <h2 className="font-mono text-base text-[var(--label)] uppercase tracking-[2px]">
            Disclaimers
          </h2>
          <p className="text-sm">
            This page is a decision aid. It does not constitute investment advice. It does not
            generate automatic trading signals. Past regime / correlation behaviour does not
            predict future returns.
          </p>
        </section>
      </article>
    </div>
  );
}
