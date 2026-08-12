'use client';

import { useRegimeStatus, type RegimeLabel } from '@/hooks/api/useRegimeStatus';
import { useEdgeM15Status } from '@/hooks/api/useEdgeM15Status';

const REGIME_STYLE: Record<RegimeLabel, {
  bg: string; border: string; text: string; emoji: string; blurb: string;
}> = {
  CALM: {
    bg: 'rgba(74,222,128,0.08)',
    border: 'var(--bull)',
    text: 'var(--bull)',
    emoji: '🟢',
    blurb: 'Low vol pct — mean-reversion & range favored',
  },
  BUILDING: {
    bg: 'rgba(100,160,255,0.08)',
    border: 'rgb(100,160,255)',
    text: 'rgb(140,180,255)',
    emoji: '🔵',
    blurb: 'Vol rising — trend & breakout favored',
  },
  STRESS: {
    bg: 'rgba(255,170,0,0.08)',
    border: 'var(--caution)',
    text: 'var(--caution)',
    emoji: '🟡',
    blurb: 'High vol / sharp DD — lead-lag & carry only',
  },
  CRISIS: {
    bg: 'rgba(255,51,85,0.08)',
    border: 'var(--bear)',
    text: 'var(--bear)',
    emoji: '🔴',
    blurb: 'Tail regime — no trade',
  },
};

const REGIME_ORDER: RegimeLabel[] = ['CALM', 'BUILDING', 'STRESS', 'CRISIS'];

function classifyAdx(adx: number): { label: string; color: string; pct: number } {
  if (adx < 20) return { label: 'RANGE', color: 'var(--bull)', pct: (adx / 25) * 100 };
  if (adx < 25) return { label: 'BUILDING', color: 'rgb(140,180,255)', pct: (adx / 50) * 100 + 40 };
  return { label: 'TREND', color: 'var(--caution)', pct: Math.min(100, (adx / 50) * 100) };
}

function classifyVolRatio(vr: number | null): { label: string; color: string; pct: number } | null {
  if (vr === null) return null;
  if (vr < 0.8) return { label: 'LOW', color: 'var(--bull)', pct: Math.max(5, vr * 60) };
  if (vr <= 1.2) return { label: 'MID', color: 'rgb(140,180,255)', pct: vr * 60 };
  if (vr <= 1.5) return { label: 'HIGH', color: 'var(--caution)', pct: Math.min(100, vr * 60) };
  return { label: 'CRISIS', color: 'var(--bear)', pct: 100 };
}

function classifyRsi(rsi: number): { label: string; color: string; pct: number } {
  if (rsi < 30) return { label: 'OVERSOLD', color: 'var(--bear)', pct: rsi };
  if (rsi > 70) return { label: 'OVERBOUGHT', color: 'var(--bear)', pct: rsi };
  if (rsi > 55) return { label: 'BULLISH', color: 'var(--bull)', pct: rsi };
  if (rsi < 45) return { label: 'BEARISH', color: 'rgb(140,180,255)', pct: rsi };
  return { label: 'NEUTRAL', color: 'var(--muted)', pct: rsi };
}

function computeBbPosition(
  close: number | undefined,
  upper: number | null | undefined,
  lower: number | null | undefined,
): { pos: number; tag: string } | null {
  if (close === undefined || !upper || !lower || upper <= lower) return null;
  const pos = (close - lower) / (upper - lower);
  const clamped = Math.max(0, Math.min(1, pos));
  let tag = 'MID';
  if (clamped > 0.95) tag = 'UPPER TAG';
  else if (clamped < 0.05) tag = 'LOWER TAG';
  else if (clamped > 0.8) tag = 'UPPER ZONE';
  else if (clamped < 0.2) tag = 'LOWER ZONE';
  return { pos: clamped, tag };
}

function computeCompositeScore(
  adx: number,
  rsi: number,
  bbPos: number | null,
  regime: RegimeLabel,
): number {
  let score = 0;
  score += (rsi - 50) * 1.2;
  if (bbPos !== null) score += (bbPos - 0.5) * 60;
  if (regime === 'STRESS') score *= 0.7;
  if (regime === 'CRISIS') score *= 0.4;
  const adxMult = Math.min(1, adx / 25);
  score *= adxMult;
  return Math.max(-100, Math.min(100, score));
}

function compositeColor(score: number): { color: string; label: string } {
  if (score > 30) return { color: 'var(--bull)', label: 'BULL' };
  if (score > 10) return { color: 'var(--bull)', label: 'BULLISH' };
  if (score < -30) return { color: 'var(--bear)', label: 'BEAR' };
  if (score < -10) return { color: 'var(--bear)', label: 'BEARISH' };
  return { color: 'var(--muted)', label: 'NEUTRAL' };
}

export default function RegimeSummaryCard() {
  const { data, isLoading, error } = useRegimeStatus();
  const { data: edgeData, isStale, lastExportAgeMs } = useEdgeM15Status();

  if (isLoading) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[260px] animate-pulse" />
    );
  }
  if (error || !data || !data.current_regime) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 font-mono text-[0.6rem] text-[var(--muted)]">
        Régime indisponible — export cron 05:17 UTC en attente
      </div>
    );
  }

  const regime = data.current_regime;
  const style = REGIME_STYLE[regime];
  const streak = data.days_in_regime ?? 0;
  const ageMin = lastExportAgeMs !== null ? Math.round(lastExportAgeMs / 60000) : null;
  const distribution = data.regime_distribution ?? {};
  const verdict = edgeData?.verdict_btc;
  const adxGate = verdict ? classifyAdx(verdict.adx) : null;
  const vrGate = verdict ? classifyVolRatio(verdict.vol_ratio ?? null) : null;
  const rsiGate = verdict ? classifyRsi(verdict.rsi) : null;
  const bb = computeBbPosition(verdict?.close, verdict?.bb_upper, verdict?.bb_lower);
  const composite = verdict
    ? computeCompositeScore(verdict.adx, verdict.rsi, bb?.pos ?? null, regime)
    : null;
  const compositeStyle = composite !== null ? compositeColor(composite) : null;

  return (
    <div
      className="bg-[var(--bg2)] border rounded-[4px] p-3 flex flex-col gap-2"
      style={{ background: style.bg, borderColor: style.border }}
    >
      {isStale && (
        <div
          className="font-mono text-[0.5rem] uppercase tracking-[1px] px-2 py-1 rounded-[2px] flex items-center gap-1"
          style={{
            background: 'rgba(255,51,85,0.12)',
            color: 'var(--bear)',
            border: '1px solid var(--bear)',
          }}
          title="Le cron d'export M15 n'a pas écrit depuis plus de 20 minutes — données possiblement obsolètes"
        >
          <span className="animate-pulse">●</span> STALE — export HS ({ageMin}min)
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Régime WF
        </span>
        <span className="font-mono text-[0.55rem]" style={{ color: style.text }}>
          {style.emoji} {regime}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-[1.4rem] font-bold leading-none"
          style={{ color: style.text }}
        >
          {regime}
        </span>
        <span className="font-mono text-[0.6rem] text-[var(--muted)]">
          {streak}d streak
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <div className="font-mono text-[0.5rem] text-[var(--label)] uppercase tracking-[2px]">
          Régime probs (WF)
        </div>
        <div className="flex flex-col gap-0.5">
          {REGIME_ORDER.map((r) => {
            const pct = (distribution[r] ?? 0) * 100;
            const rStyle = REGIME_STYLE[r];
            const isCurrent = r === regime;
            return (
              <div key={r} className="flex items-center gap-1.5 font-mono text-[0.55rem]">
                <span
                  className="w-[58px] uppercase tracking-[0.5px]"
                  style={{ color: isCurrent ? rStyle.text : 'var(--muted)', fontWeight: isCurrent ? 700 : 400 }}
                >
                  {isCurrent ? '▸' : ' '} {r}
                </span>
                <div className="flex-1 h-[3px] bg-[var(--bg3)] rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${Math.min(100, pct)}%`, background: rStyle.border }}
                  />
                </div>
                <span className="w-[34px] text-right" style={{ color: 'var(--text)' }}>
                  {pct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {verdict && (
        <div className="flex flex-col gap-1 pt-1 border-t border-[var(--border)]">
          <div className="font-mono text-[0.5rem] text-[var(--label)] uppercase tracking-[2px]">
            Gate intraday · verdict BTC M15
          </div>
          <div className="grid grid-cols-3 gap-1.5 font-mono text-[0.5rem]">
            {adxGate && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[var(--muted)] uppercase tracking-[1px]">ADX</span>
                <span className="text-[var(--text)]">{verdict.adx.toFixed(1)}</span>
                <div className="h-[2px] bg-[var(--bg3)] rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${adxGate.pct}%`, background: adxGate.color }} />
                </div>
                <span style={{ color: adxGate.color }}>{adxGate.label}</span>
              </div>
            )}
            {vrGate && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[var(--muted)] uppercase tracking-[1px]">ATR ratio</span>
                <span className="text-[var(--text)]">{(verdict.vol_ratio ?? 0).toFixed(2)}×</span>
                <div className="h-[2px] bg-[var(--bg3)] rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${vrGate.pct}%`, background: vrGate.color }} />
                </div>
                <span style={{ color: vrGate.color }}>{vrGate.label}</span>
              </div>
            )}
            {rsiGate && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[var(--muted)] uppercase tracking-[1px]">RSI</span>
                <span className="text-[var(--text)]">{verdict.rsi.toFixed(1)}</span>
                <div className="h-[2px] bg-[var(--bg3)] rounded-full overflow-hidden">
                  <div className="h-full" style={{ width: `${rsiGate.pct}%`, background: rsiGate.color }} />
                </div>
                <span style={{ color: rsiGate.color }}>{rsiGate.label}</span>
              </div>
            )}
          </div>
          {bb && (
            <div className="flex items-center justify-between font-mono text-[0.5rem] pt-0.5">
              <span className="text-[var(--muted)] uppercase tracking-[1px]">BB pos</span>
              <div className="flex-1 mx-1.5 relative h-[4px] bg-[var(--bg3)] rounded-full">
                <div
                  className="absolute top-[-2px] w-[2px] h-[8px]"
                  style={{
                    left: `${Math.min(100, Math.max(0, bb.pos * 100))}%`,
                    background: bb.tag.includes('UPPER') ? 'var(--caution)' : bb.tag.includes('LOWER') ? 'var(--bear)' : 'var(--text)',
                  }}
                />
              </div>
              <span
                className="uppercase tracking-[0.5px]"
                style={{
                  color:
                    verdict.bb_bw_expanding === undefined
                      ? 'var(--muted)'
                      : bb.tag.includes('TAG')
                        ? 'var(--caution)'
                        : 'var(--text)',
                }}
              >
                {bb.tag} {verdict.bb_bw_expanding ? '↑EXP' : verdict.bb_bw_expanding === false ? '↓CMP' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {composite !== null && compositeStyle && (
        <div className="flex flex-col gap-1 pt-1 border-t border-[var(--border)]">
          <div className="flex items-center justify-between font-mono text-[0.5rem]">
            <span className="text-[var(--label)] uppercase tracking-[2px]">Score composite</span>
            <span style={{ color: compositeStyle.color }}>
              {composite >= 0 ? '+' : ''}{composite.toFixed(0)} · {compositeStyle.label}
            </span>
          </div>
          <div className="relative h-[6px] bg-[var(--bg3)] rounded-full overflow-hidden">
            <div
              className="absolute top-0 bottom-0"
              style={{
                left: composite >= 0 ? '50%' : `${50 + composite / 2}%`,
                width: `${Math.abs(composite) / 2}%`,
                background: compositeStyle.color,
              }}
            />
            <div
              className="absolute top-[-2px] bottom-[-2px] w-[1px] bg-[var(--text)]"
              style={{ left: '50%' }}
            />
          </div>
          <div className="flex items-center justify-between font-mono text-[0.45rem] text-[var(--muted)]">
            <span>-100 BEAR</span>
            <span>0</span>
            <span>+100 BULL</span>
          </div>
        </div>
      )}

      <div className="font-mono text-[0.6rem] text-[var(--muted)] leading-tight">
        {style.blurb}
      </div>
    </div>
  );
}
