'use client';
import type { MarketData } from '@/lib/types';
import { fU, fPct, clamp, colorForFng } from '@/lib/format';
import MiniBar from './MiniBar';

export default function MacroBlock({ data }: { data: MarketData | null }) {
  if (!data) return <div className="font-mono text-[0.65rem] text-[#556680] py-2">Loading macro...</div>;

  interface Row { l: string; v: string; t: string; col: string; pct: number }
  const rows: Row[] = [];

  if (data.fng) {
    const v = data.fng.v;
    rows.push({ l: 'F&G', v: String(v), t: data.fng.c, col: colorForFng(v), pct: v });
  }
  if (data.cbbi) {
    const cv = Math.round(data.cbbi.conf * 100);
    const col = cv < 25 ? '#4ade80' : cv < 50 ? '#ffaa00' : cv < 75 ? '#ff8800' : '#ff3355';
    const cls = cv < 25 ? 'Accumulation' : cv < 50 ? 'Heating Up' : cv < 75 ? 'Euphoria' : 'DANGER';
    rows.push({ l: 'CBBI', v: cv + '%', t: cls, col, pct: cv });
  }
  if (data.vix?.v != null) {
    const vv = data.vix.v;
    const vc = vv > 30 ? '#ff3355' : vv > 25 ? '#ff8800' : vv > 20 ? '#ffaa00' : '#4ade80';
    const vt = vv > 30 ? 'Extreme Fear' : vv > 25 ? 'Elevated' : vv > 20 ? 'Normal' : 'Calm';
    rows.push({ l: 'VIX', v: vv.toFixed(1), t: `${vt} (${data.vix.src})`, col: vc, pct: clamp(vv / 40 * 100, 0, 100) });
  }
  if (data.dxy?.v != null) {
    const dc = data.dxy.prev != null ? fPct(data.dxy.v - data.dxy.prev) : '';
    rows.push({ l: 'DXY', v: data.dxy.v.toFixed(2), t: dc, col: data.dxy.prev != null && data.dxy.v < data.dxy.prev ? '#4ade80' : '#ff3355', pct: 50 });
  }
  if (data.y10?.v != null) {
    rows.push({ l: '10Y', v: data.y10.v.toFixed(2) + '%', t: '', col: '#a0a0b8', pct: 50 });
  }
  if (data.global) {
    rows.push({
      l: 'BTC Dom', v: (data.global.dom || 0).toFixed(1) + '%', t: data.global.dom > 58 ? 'BTC flight' : '',
      col: data.global.dom > 58 ? '#ff3355' : data.global.dom < 50 ? '#4ade80' : '#a0a0b8',
      pct: clamp(data.global.dom, 40, 70) / 70 * 100,
    });
    rows.push({
      l: 'MCap', v: fU(data.global.mc), t: fPct(data.global.mcChg),
      col: data.global.mcChg >= 0 ? '#4ade80' : '#ff3355', pct: 50,
    });
  }

  return (
    <div className="mb-3.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5 py-1 border-b border-[#1a1a30]/50 font-mono text-[0.7rem]">
          <span className="text-[#556680] min-w-[60px] text-[0.6rem] tracking-[1px]">{r.l}</span>
          <span className="font-bold min-w-[60px]" style={{ color: r.col }}>{r.v}</span>
          <span className="text-[0.58rem] text-[#a0a0b8] min-w-[80px]">{r.t}</span>
          <div className="flex-1">
            <MiniBar value={r.pct} color={r.col} />
          </div>
        </div>
      ))}
    </div>
  );
}
