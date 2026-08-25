'use client';

import { useMemo, useState } from 'react';

import { useCockpitState } from '@/hooks/api/useCockpitState';
import {
  filterJournal,
  formatPct,
  journalKindColor,
  journalKindLabel,
} from '@/lib/cockpit/display';
import type { JournalEvent } from '@/lib/cockpit/payloads';

const SOURCES = [
  ['all', 'Tous'],
  ['hl-agent', 'HL-agent'],
  ['m15-agent', 'M15-agent'],
  ['alerts', 'Rejets & alertes'],
] as const;

/**
 * Bloc 10 — Timeline journal / rejets / alertes. Un clic sur un événement
 * ouvre le contexte au moment du trade (régime, vol, funding, snapshot).
 */
export default function JournalTimeline() {
  const { data, isLoading, error } = useCockpitState();
  const [source, setSource] = useState<string>('all');
  const [selected, setSelected] = useState<JournalEvent | null>(null);

  const events = useMemo(
    () => filterJournal(data?.journal.events ?? [], source),
    [data?.journal.events, source],
  );

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="journal-timeline">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          JOURNAL / REJETS / ALERTES
        </span>
        <div className="flex flex-wrap gap-1">
          {SOURCES.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSource(key)}
              className="font-mono text-[0.42rem] px-1.5 py-0.5 rounded-[2px] border"
              style={{
                color: source === key ? 'var(--text)' : 'var(--dim)',
                borderColor: source === key ? 'var(--label)' : 'var(--border)',
                background: source === key ? 'var(--bg)' : 'transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {error && <div className="font-mono text-[0.55rem] text-[var(--caution)]">indisponible</div>}
      {events.length === 0 && !isLoading && !error && (
        <div className="font-mono text-[0.55rem] text-[var(--dim)]">aucun événement</div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className="lg:col-span-2 max-h-[420px] overflow-y-auto flex flex-col gap-1 pr-1">
          {events.slice(0, 80).map((e, i) => (
            <button
              key={`${e.ts}-${i}`}
              type="button"
              onClick={() => setSelected(e)}
              className="text-left rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 hover:border-[var(--label)] transition-colors"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 font-mono text-[0.48rem]">
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: journalKindColor(e.kind) }}
                  />
                  <span style={{ color: journalKindColor(e.kind) }}>{journalKindLabel(e.kind)}</span>
                  {e.asset && <span className="font-bold">{e.asset}</span>}
                  {e.action && <span className="text-[var(--dim)]">{e.action}</span>}
                </span>
                <span className="flex items-center gap-2 text-[var(--dim)]">
                  {e.pnl_pct !== null && e.pnl_pct !== undefined && (
                    <span style={{ color: e.pnl_pct >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                      {formatPct(e.pnl_pct)}
                    </span>
                  )}
                  {e.ts?.slice(5, 16).replace('T', ' ')}
                </span>
              </div>
              {(e.risk_reason || e.setup) && (
                <div className="mt-0.5 font-mono text-[0.42rem] text-[var(--dim)] truncate">
                  {e.setup} {e.risk_reason ? `· ${e.risk_reason}` : ''}
                </div>
              )}
            </button>
          ))}
        </div>
        <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2">
          {selected ? (
            <div className="flex flex-col gap-1.5 font-mono text-[0.45rem]">
              <div className="text-[0.5rem] font-bold" style={{ color: journalKindColor(selected.kind) }}>
                {journalKindLabel(selected.kind)} · {selected.asset ?? '—'}
              </div>
              <div className="text-[var(--dim)]">{selected.ts}</div>
              {selected.setup && <div>setup: {selected.setup}</div>}
              {selected.direction && <div>direction: {selected.direction}</div>}
              {selected.risk_action && <div>risk: {selected.risk_action} — {selected.risk_reason}</div>}
              {selected.exit_reason && <div>exit: {selected.exit_reason}</div>}
              {selected.context ? (
                <pre className="mt-1 max-h-[280px] overflow-auto whitespace-pre-wrap break-all text-[0.4rem] leading-relaxed text-[var(--muted)] bg-[var(--bg2)] rounded-[3px] p-2">
                  {JSON.stringify(selected.context, null, 1).slice(0, 2500)}
                </pre>
              ) : (
                <div className="text-[var(--dim)]">pas de snapshot contexte pour cet événement</div>
              )}
              <div className="text-[var(--dim)]">
                Contexte = market_state_snapshot au moment de la décision (régime, m15, funding,
                orderflow).
              </div>
            </div>
          ) : (
            <div className="font-mono text-[0.45rem] text-[var(--dim)]">
              Cliquer un événement pour voir le contexte vol/régime/contrat au moment du trade.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
