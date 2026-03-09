'use client';
import type { AsianRangeState, ScalpState, LondonBOState, MeanRevState, ORBState } from '@/lib/ftmo/types';
import StrategyCard from './StrategyCard';

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#556680]">{label}</span>
      <span className="font-semibold" style={{ color: color || '#e8e8f0' }}>{value}</span>
    </div>
  );
}

function TrendBadge({ trend }: { trend: string }) {
  const col = trend === 'UP' || trend === 'BULL' ? '#4ade80' : trend === 'DOWN' || trend === 'BEAR' ? '#ff3355' : '#a0a0b8';
  const arrow = trend === 'UP' || trend === 'BULL' ? '▲' : trend === 'DOWN' || trend === 'BEAR' ? '▼' : '—';
  return <span style={{ color: col }}>{trend} {arrow}</span>;
}

export default function StrategyPanel({
  asianRange, scalp, londonBOEUR, londonBOGBP, meanRevEUR, meanRevEURGBP, orbNAS, orbUS30,
}: {
  asianRange: AsianRangeState;
  scalp: ScalpState;
  londonBOEUR: LondonBOState;
  londonBOGBP: LondonBOState;
  meanRevEUR: MeanRevState;
  meanRevEURGBP: MeanRevState;
  orbNAS: ORBState;
  orbUS30: ORBState;
}) {
  return (
    <div className="flex flex-col gap-3">
      {/* 1. Gold Asian Range */}
      <StrategyCard icon="🥇" title="GOLD ASIAN RANGE" type="manual" status={asianRange.status}>
        <Row label="Range" value={asianRange.rangeHigh > 0 ? `$${asianRange.rangeLow.toFixed(0)} — $${asianRange.rangeHigh.toFixed(0)} ($${asianRange.rangeWidth.toFixed(0)})` : 'Forming...'} />
        <Row label="H4 Trend" value="" />
        <div className="text-right -mt-3"><TrendBadge trend={asianRange.h4Trend} /></div>
        {asianRange.breakoutDirection !== 'NONE' && (
          <>
            <Row label="Breakout" value={asianRange.breakoutDirection} color={asianRange.breakoutDirection === 'ABOVE' ? '#4ade80' : '#ff3355'} />
            {asianRange.entry && <Row label="Entry" value={`$${asianRange.entry.toFixed(0)}`} color="#00e5ff" />}
            {asianRange.stop && <Row label="Stop" value={`$${asianRange.stop.toFixed(0)}`} color="#ff3355" />}
            {asianRange.tp1 && <Row label="TP1 (1:2)" value={`$${asianRange.tp1.toFixed(0)}`} color="#4ade80" />}
          </>
        )}
        <div className="text-[#556680] text-[0.68rem] mt-1.5">⏰ Fenetre: 07:00-12:00 GMT</div>
      </StrategyCard>

      {/* 2. Gold Scalp */}
      <StrategyCard icon="⚡" title="GOLD SCALP L/NY" type="manual" status={scalp.status}>
        <Row label="Session" value={scalp.isOverlapActive ? 'London-NY overlap ✓' : 'Hors fenetre'} color={scalp.isOverlapActive ? '#4ade80' : '#ff3355'} />
        {scalp.ema20 > 0 && (
          <>
            <Row label="EMA20 M15" value={`$${scalp.ema20.toFixed(1)}`} />
            <Row label="EMA50 M15" value={`$${scalp.ema50.toFixed(1)}`} />
            <Row label="Trend M15" value="" />
            <div className="text-right -mt-3"><TrendBadge trend={scalp.emaTrend} /></div>
            <Row label="Pullback EMA20" value={scalp.pullbackToEMA ? 'OUI → SETUP' : 'Non'} color={scalp.pullbackToEMA ? '#4ade80' : '#a0a0b8'} />
            <Row label="ATR(14) M15" value={`$${scalp.atrCurrent.toFixed(2)} (pctile ${scalp.atrPercentile}%)`} />
          </>
        )}
        <div className="text-[#556680] text-[0.68rem] mt-1.5">⏰ 13:00-16:30 GMT</div>
      </StrategyCard>

      {/* 3. London BO EUR */}
      <StrategyCard icon="🤖" title={`LONDON BO ${londonBOEUR.pair}`} type="ea" status={londonBOEUR.eaStatus}>
        <Row label="Asian Range" value={londonBOEUR.asianRangeHigh > 0 ? `${londonBOEUR.asianRangeLow.toFixed(4)} — ${londonBOEUR.asianRangeHigh.toFixed(4)} (${londonBOEUR.rangeWidthPips} pips)` : '--'} />
        <Row label="Range" value={londonBOEUR.tooWide ? '✗ Trop large' : '✓ OK'} color={londonBOEUR.tooWide ? '#ff3355' : '#4ade80'} />
        {londonBOEUR.buyStop && <Row label="Buy Stop" value={londonBOEUR.buyStop.toFixed(4)} color="#4ade80" />}
        {londonBOEUR.sellStop && <Row label="Sell Stop" value={londonBOEUR.sellStop.toFixed(4)} color="#ff3355" />}
        <Row label="TP" value={`±${londonBOEUR.tpDistance.toFixed(0)} pips (1.5×)`} />
      </StrategyCard>

      {/* 3b. London BO GBP */}
      <StrategyCard icon="🤖" title={`LONDON BO ${londonBOGBP.pair}`} type="ea" status={londonBOGBP.eaStatus}>
        <Row label="Asian Range" value={londonBOGBP.asianRangeHigh > 0 ? `${londonBOGBP.asianRangeLow.toFixed(4)} — ${londonBOGBP.asianRangeHigh.toFixed(4)} (${londonBOGBP.rangeWidthPips} pips)` : '--'} />
        <Row label="Range" value={londonBOGBP.tooWide ? '✗ Trop large' : '✓ OK'} color={londonBOGBP.tooWide ? '#ff3355' : '#4ade80'} />
      </StrategyCard>

      {/* 4. Mean Rev EUR */}
      <StrategyCard icon="🤖" title={`MEAN REV ${meanRevEUR.pair}`} type="ea" status={meanRevEUR.eaStatus}>
        <Row label="H4 RSI(14)" value={meanRevEUR.rsi14.toFixed(0)} color={meanRevEUR.rsi14 < 30 ? '#4ade80' : meanRevEUR.rsi14 > 70 ? '#ff3355' : '#a0a0b8'} />
        <Row label="ADX" value={`${meanRevEUR.adx.toFixed(0)} ${meanRevEUR.adxFilter ? '(< 25 ✓)' : '(> 25 ✗ TREND)'}`} color={meanRevEUR.adxFilter ? '#4ade80' : '#ff3355'} />
        <Row label="BB" value={`${meanRevEUR.bbLower.toFixed(4)} — ${meanRevEUR.bbMiddle.toFixed(4)} — ${meanRevEUR.bbUpper.toFixed(4)}`} />
        <Row label="Prix vs BB" value={meanRevEUR.priceVsBB} color={meanRevEUR.priceVsBB !== 'INSIDE' ? '#ffaa00' : '#a0a0b8'} />
        {meanRevEUR.signalType !== 'NONE' && <Row label="Signal" value={meanRevEUR.signalType} color={meanRevEUR.signalType === 'BUY' ? '#4ade80' : '#ff3355'} />}
        <Row label="Prochain close H4" value={meanRevEUR.nextCloseIn} />
      </StrategyCard>

      {/* 4b. Mean Rev EUR/GBP */}
      <StrategyCard icon="🤖" title={`MEAN REV ${meanRevEURGBP.pair}`} type="ea" status={meanRevEURGBP.eaStatus}>
        <Row label="H4 RSI(14)" value={meanRevEURGBP.rsi14.toFixed(0)} color={meanRevEURGBP.rsi14 < 30 ? '#4ade80' : meanRevEURGBP.rsi14 > 70 ? '#ff3355' : '#a0a0b8'} />
        <Row label="ADX" value={`${meanRevEURGBP.adx.toFixed(0)} ${meanRevEURGBP.adxFilter ? '✓' : '✗ TREND'}`} color={meanRevEURGBP.adxFilter ? '#4ade80' : '#ff3355'} />
        <Row label="Signal" value={meanRevEURGBP.signalType} />
      </StrategyCard>

      {/* 5. ORB NAS100 */}
      <StrategyCard icon="🔄" title={`ORB ${orbNAS.instrument}`} type="semi" status={orbNAS.status}>
        {orbNAS.status === 'WAITING' && <Row label="Ouverture US dans" value={`${orbNAS.minutesUntilOpen} min`} />}
        <Row label="H1 Bias" value="" />
        <div className="text-right -mt-3"><TrendBadge trend={orbNAS.h1Bias} /></div>
        {orbNAS.orbHigh != null && (
          <>
            <Row label="ORB Range" value={`${orbNAS.orbLow} — ${orbNAS.orbHigh} (${orbNAS.orbWidthPoints} pts)`} />
            {orbNAS.breakoutDirection !== 'NONE' && <Row label="Breakout" value={orbNAS.breakoutDirection} color={orbNAS.breakoutDirection === 'ABOVE' ? '#4ade80' : '#ff3355'} />}
          </>
        )}
        <div className="text-[#556680] text-[0.68rem] mt-1.5">⏰ 14:30-16:30 GMT</div>
      </StrategyCard>

      {/* 5b. ORB US30 */}
      <StrategyCard icon="🔄" title={`ORB ${orbUS30.instrument}`} type="semi" status={orbUS30.status}>
        <Row label="H1 Bias" value="" />
        <div className="text-right -mt-3"><TrendBadge trend={orbUS30.h1Bias} /></div>
        {orbUS30.orbHigh != null && <Row label="ORB Range" value={`${orbUS30.orbLow} — ${orbUS30.orbHigh}`} />}
      </StrategyCard>
    </div>
  );
}
