'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  buildPaperDsrView,
  PAPER_DSR_TONE_COLOR,
  type PaperDsrPayload,
  type PaperDsrView,
} from '@/lib/paper-dsr';

const REFRESH_MS = 5 * 60 * 1000;

function fmtUsd(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return '—';
  const s = v >= 0 ? '+' : '−';
  return `${s}$${Math.abs(v).toFixed(2)}`;
}

function fmtPct(v: number | null, digits = 2): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '' : '−'}${Math.abs(v * 100).toFixed(digits)}%`;
}

function fmtNum(v: number | null, digits = 2): string {
  if (v === null || !Number.isFinite(v)) return '—';
  return v.toFixed(digits);
}

export default function PaperDsrCard() {
  const [view, setView] = useState<PaperDsrView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/paper-dsr', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload = (await res.json()) as PaperDsrPayload;
      setView(buildPaperDsrView(payload, Date.now()));
      setLastUpdate(Date.now());
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const staleBanner = view?.isStale ? (
    <span className="text-[var(--muted)]">· STALE {Math.round(view.ageMs / 3600000)}h</span>
  ) : null;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] px-3 py-2 font-mono text-[0.58rem] flex flex-col gap-1.5">
      <div className="flex items-center gap-2 uppercase tracking-[2px] text-[0.55rem] text-[var(--muted)]">
        <span>freqtrade paper · rolling sharpe / dsr 60j</span>
        <span className="border-l border-[var(--border)] h-3" />
        <span>
          SR* lot 39 = {view ? fmtNum(view.srStarAnn, 1) + '/an' : '—'} (journalier{' '}
          {view ? fmtNum(view.srStar, 3) : '—'})
        </span>
        {staleBanner}
        {error && <span className="text-[var(--red, #ef4444)]">· erreur {error}</span>}
      </div>

      {view?.rows.map((r) => (
        <div
          key={r.name}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] pt-1.5"
          title={
            r.status === 'OK'
              ? `Premier close ${r.firstClose ?? '—'} · dernier ${r.lastClose ?? '—'} · fenêtre ${view.windowDays}j`
              : (r.reason ?? 'Données insuffisantes')
          }
        >
          <span className="uppercase tracking-[1px]">{r.name}</span>
          <span
            className="px-1.5 py-0.5 rounded-[3px] border text-[0.55rem]"
            style={{
              color: PAPER_DSR_TONE_COLOR[r.dsrTone],
              borderColor: PAPER_DSR_TONE_COLOR[r.dsrTone],
            }}
          >
            {r.status === 'OK' ? `DSR ${fmtNum(r.dsr)}` : 'INSUFFICIENT'}
          </span>
          <span>
            trades fermés <span className="text-[var(--fg, #ddd)]">{r.closedTrades}</span> · ouverts{' '}
            <span className="text-[var(--fg, #ddd)]">{r.openTrades}</span>
          </span>
          <span>
            pnl <span className={r.pnlAbs !== null && r.pnlAbs < 0 ? 'text-[var(--red, #ef4444)]' : 'text-[var(--green, #22c55e)]'}>{fmtUsd(r.pnlAbs)}</span>
          </span>
          <span>win {r.winPct !== null ? `${r.winPct.toFixed(1)}%` : '—'}</span>
          <span>SR (an) {fmtNum(r.srAnn, 2)}</span>
          <span>SR roulant {fmtNum(r.rollingSrAnn, 2)}</span>
          <span>PSR vs lot {r.psrVsLot !== null ? r.psrVsLot.toFixed(3) : '—'}</span>
          {r.status !== 'OK' && (
            <span className="text-[var(--muted)]">
              lisible quand ≥60j de trades fermés (hold ICHI 3j · SRSI 7j)
            </span>
          )}
        </div>
      ))}

      <div className="text-[var(--muted)] text-[0.55rem]">
        dry-run 1000 USDT · DSR vs SR* gelé du retest (39 essais) · alerte TG advisory si DSR &lt; 0.5 ·
        maj {lastUpdate ? new Date(lastUpdate).toLocaleTimeString('fr-FR') : '—'}
      </div>
    </div>
  );
}
