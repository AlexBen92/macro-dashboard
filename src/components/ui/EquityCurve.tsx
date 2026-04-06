'use client';
import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface EquityCurveProps {
  equityCurve: number[];
  drawdownCurve: number[];
  unit?: string; // '$' or 'R'
}

function toSvgPoints(data: number[], width: number, height: number, minVal: number, maxVal: number): string {
  if (data.length < 2) return '';
  const range = maxVal - minVal || 1;
  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - minVal) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function toAreaPath(data: number[], width: number, height: number, minVal: number, maxVal: number, baseline: number): string {
  if (data.length < 2) return '';
  const range = maxVal - minVal || 1;
  const baselineY = height - ((baseline - minVal) / range) * height;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - minVal) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M 0,${baselineY.toFixed(1)} L ${points.join(' L ')} L ${width},${baselineY.toFixed(1)} Z`;
}

export default function EquityCurve({ equityCurve, drawdownCurve, unit = 'R' }: EquityCurveProps) {
  const W = 800;
  const EH = 160; // equity chart height
  const DH = 60;  // drawdown chart height

  const { eqMin, eqMax, eqPoints, eqArea, ddPoints, ddArea } = useMemo(() => {
    const eqMin = Math.min(...equityCurve, 0) - 0.5;
    const eqMax = Math.max(...equityCurve, 0) + 0.5;
    const eqPoints = toSvgPoints(equityCurve, W, EH, eqMin, eqMax);
    const eqArea = toAreaPath(equityCurve, W, EH, eqMin, eqMax, 0);

    const ddMin = Math.min(...drawdownCurve, -0.5);
    const ddMax = 0;
    const ddPoints = toSvgPoints(drawdownCurve, W, DH, ddMin, ddMax);
    const ddArea = toAreaPath(drawdownCurve, W, DH, ddMin, ddMax, 0);

    return { eqMin, eqMax, eqPoints, eqArea, ddPoints, ddArea };
  }, [equityCurve, drawdownCurve]);

  const lastVal = equityCurve[equityCurve.length - 1] ?? 0;
  const isPositive = lastVal >= 0;

  if (equityCurve.length < 2) {
    return (
      <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] p-6 text-center font-mono text-[0.75rem] text-[#5a6070]">
        Pas encore de trades enregistrés — la courbe apparaîtra ici.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase">EQUITY CURVE ({unit})</div>
        <div className={`font-mono text-[0.85rem] font-bold ${isPositive ? 'text-[#4ade80]' : 'text-[#ff3355]'}`}>
          {isPositive ? '+' : ''}{unit === '$' ? lastVal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : lastVal.toFixed(2)}{unit}
        </div>
      </div>

      {/* Equity SVG */}
      <div className="px-2 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${EH + 4}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: `${EH}px` }}
        >
          <defs>
            <linearGradient id="eq-grad-pos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4ade80" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="eq-grad-neg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff3355" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#ff3355" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Zero line */}
          <line
            x1="0" x2={W}
            y1={EH - ((0 - eqMin) / (eqMax - eqMin)) * EH}
            y2={EH - ((0 - eqMin) / (eqMax - eqMin)) * EH}
            stroke="#1e1e32" strokeWidth="1" strokeDasharray="4,4"
          />

          {/* Area fill */}
          <motion.path
            d={eqArea}
            fill={isPositive ? 'url(#eq-grad-pos)' : 'url(#eq-grad-neg)'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          />

          {/* Line */}
          <motion.polyline
            points={eqPoints}
            fill="none"
            stroke={isPositive ? '#4ade80' : '#ff3355'}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
      </div>

      {/* Drawdown SVG */}
      <div className="px-2 w-full overflow-hidden border-t border-[#1e1e32]">
        <div className="font-mono text-[0.55rem] text-[#5a6070] tracking-[2px] uppercase px-2 pt-1">DRAWDOWN</div>
        <svg
          viewBox={`0 0 ${W} ${DH}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: `${DH}px` }}
        >
          <defs>
            <linearGradient id="dd-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff3355" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#ff3355" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          <motion.path
            d={ddArea}
            fill="url(#dd-grad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          />
          <motion.polyline
            points={ddPoints}
            fill="none"
            stroke="#ff3355"
            strokeWidth="1.5"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
      </div>
    </div>
  );
}
