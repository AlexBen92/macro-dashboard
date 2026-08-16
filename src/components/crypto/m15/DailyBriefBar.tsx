'use client';

import { useRegimeStatus, type RegimeLabel } from '@/hooks/api/useRegimeStatus';
import { useEdgeM15Status } from '@/hooks/api/useEdgeM15Status';

const REGIME_COLOR: Record<RegimeLabel, string> = {
  CALM: 'var(--bull)',
  BUILDING: 'var(--info-soft)',
  STRESS: 'var(--caution)',
  CRISIS: 'var(--bear)',
};

export default function DailyBriefBar() {
  const { data: regime } = useRegimeStatus();
  const { data: edge } = useEdgeM15Status();

  if (!regime || !edge) return null;

  const verdict = edge.verdict_btc;
  const regimeLabel = regime.current_regime;
  const streak = regime.days_in_regime ?? 0;

  if (!regimeLabel || !verdict) return null;

  const bias =
    verdict.rsi > 55 ? 'haussier' : verdict.rsi < 45 ? 'baissier' : 'neutre';
  const biasColor =
    verdict.rsi > 55 ? 'var(--bull)' : verdict.rsi < 45 ? 'var(--bear)' : 'var(--muted)';
  const volRatio = verdict.vol_ratio ?? 1;
  const volState = volRatio > 1.5 ? 'vol élevée' : volRatio < 0.8 ? 'vol basse' : 'vol normale';
  const adxTrend = verdict.adx > 25 ? 'tendance active' : 'range';
  const regimeText = REGIME_COLOR[regimeLabel] ? regimeLabel : '—';

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] px-3 py-2 font-mono text-[0.65rem] text-[var(--text)] flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-[var(--label)] uppercase tracking-[2px]">Brief</span>
      <span>
        Régime{' '}
        <b style={{ color: REGIME_COLOR[regimeLabel] }}>{regimeText}</b>{' '}
        <span className="text-[var(--muted)]">depuis {streak}j</span>
      </span>
      <span className="text-[var(--border)]">·</span>
      <span>
        Biais M15 <b style={{ color: biasColor }}>{bias}</b>
        <span className="text-[var(--muted)]"> (RSI {verdict.rsi.toFixed(0)})</span>
      </span>
      <span className="text-[var(--border)]">·</span>
      <span>
        {volState}
        <span className="text-[var(--muted)]"> (ATR {volRatio.toFixed(2)}×)</span>
      </span>
      <span className="text-[var(--border)]">·</span>
      <span>
        ADX {verdict.adx.toFixed(0)}{' '}
        <span className="text-[var(--muted)]">({adxTrend})</span>
      </span>
      <span className="ml-auto text-[var(--muted)] uppercase tracking-[1px] text-[0.55rem]">
        {verdict.label}
      </span>
    </div>
  );
}
