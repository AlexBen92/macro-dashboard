'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ColorType,
  LineStyle,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts';

import {
  aggBars,
  breakMarker,
  chartLevels,
  vwapSeries,
  type NasdaqBars,
  type NasdaqStatus,
  type NasdaqTrendH1,
  type Tf,
} from '@/lib/nasdaq';

/**
 * Graphique §5 : bougies jour + veille en transparence, boîte du range via
 * price lines, VWAP, bandes EM ±0,5/±1, marqueur de cassure, entrée/stop
 * théoriques. Faits seulement, aucun « signal » (spec §12). Heures affichées ET.
 */
const TFS: Tf[] = ['M1', 'M5', 'M15'];

export default function OrbChart({
  bars,
  status,
  emPts,
  trend,
}: {
  bars?: NasdaqBars;
  status?: NasdaqStatus;
  emPts?: number;
  trend?: NasdaqTrendH1;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const todayRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const prevRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const vwapRef = useRef<ISeriesApi<'Line'> | null>(null);
  const linesRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']>[]>([]);
  const [tf, setTf] = useState<Tf>('M5');

  const today = useMemo(() => aggBars(bars, tf, 'today'), [bars, tf]);
  const prev = useMemo(() => aggBars(bars, tf, 'prev'), [bars, tf]);
  const vwap = useMemo(() => vwapSeries(bars), [bars]);
  const levels = useMemo(() => chartLevels({ bars, status, emPts }), [bars, status, emPts]);
  const marker = useMemo(
    () => breakMarker(status?.break ?? null, new Date().toISOString().slice(0, 10)),
    [status?.break]
  );

  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height: ref.current.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8a8a8a',
        fontFamily: 'var(--font-mono, monospace)',
      },
      grid: {
        vertLines: { color: 'rgba(140,140,140,0.08)' },
        horzLines: { color: 'rgba(140,140,140,0.08)' },
      },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: 'rgba(140,140,140,0.2)' },
      rightPriceScale: { borderColor: 'rgba(140,140,140,0.2)' },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;
    prevRef.current = chart.addCandlestickSeries({
      upColor: 'rgba(120,130,125,0.35)',
      downColor: 'rgba(150,125,120,0.35)',
      borderVisible: false,
      wickColor: 'rgba(140,140,140,0.3)',
    });
    todayRef.current = chart.addCandlestickSeries({
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderVisible: false,
      wickColor: '#71717a',
      priceLineVisible: false,
    });
    vwapRef.current = chart.addLineSeries({
      color: 'rgba(168,85,247,0.9)',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      title: 'VWAP',
    });
    const ro = new ResizeObserver(() => {
      if (ref.current) chart.applyOptions({ width: ref.current.clientWidth });
    });
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    todayRef.current?.setData(today as CandlestickData<UTCTimestamp>[]);
    prevRef.current?.setData(prev as CandlestickData<UTCTimestamp>[]);
    vwapRef.current?.setData(vwap.map((p) => ({ ...p, time: p.time as UTCTimestamp })));
    const s = todayRef.current;
    if (!s) return;
    for (const l of linesRef.current) s.removePriceLine(l);
    linesRef.current = levels.map((l) =>
      s.createPriceLine({
        price: l.price,
        color: l.color,
        lineWidth: l.width ?? 1,
        lineStyle:
          l.style === 'dashed' ? LineStyle.Dashed : l.style === 'dotted' ? LineStyle.Dotted : LineStyle.Solid,
        axisLabelVisible: true,
        title: l.title,
      })
    );
    s.setMarkers(marker ? [{ ...marker, time: marker.time as UTCTimestamp }] : []);
  }, [today, prev, vwap, levels, marker]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {trend ? (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                trend.v === 1
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : trend.v === -1
                    ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
            >
              H1 {trend.v === 1 ? 'haussière' : trend.v === -1 ? 'baissière' : 'neutre'}
              {trend.ma20 !== undefined && trend.ma50 !== undefined ? (
                <>
                  {' '}
                  · MA20 {trend.ma20} / MA50 {trend.ma50}
                  {trend.dist_pct !== undefined
                    ? ` (${trend.dist_pct > 0 ? '+' : ''}${trend.dist_pct} %)`
                    : ''}
                </>
              ) : null}{' '}
              · {trend.as_of}
            </span>
          ) : null}
        </div>
        <div className="flex gap-1">
          {TFS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTf(t)}
              aria-pressed={tf === t}
              className={`rounded px-2 py-0.5 text-xs ${
                tf === t
                  ? 'bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900'
                  : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div ref={ref} className="h-[280px] w-full md:h-[420px]" />
      <p className="mt-1 text-xs text-neutral-500">
        Gris pâle = veille ({bars?.prev_day?.date ?? '—'}) · violet = VWAP séance · ambre = range
        09:30-09:45 · pointillés = bandes EM ±0,5/±1 EM (open {bars?.bars?.today_o?.[0] ?? '—'} ±{' '}
        {emPts ?? '—'} pts) · flèche = cassure clôture M5 · bleu/rouge gras = entrée/stop
        théoriques. Descriptif — pas un signal.
      </p>
    </div>
  );
}
