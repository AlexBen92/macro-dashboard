'use client';
import { useEffect, useState, useCallback } from 'react';
import { MIN_EDGE, SCORE_WEIGHTS, VOL_WINDOWS, TOP_N, HL_TAKER_FEE, HL_ROUND_TRIP, HL_MAKER_FEE } from '@/lib/constants';

interface TokenScore {
  symbol:       string;
  price:        number;
  funding:      number;
  oi:           number;
  vol24h:       number;
  score:        number;
  bias:         'LONG' | 'SHORT' | 'NEUTRAL';
  edgeRatio:    number;
  edgeValid:    boolean;
  volWindow:    string;
  volScore:     number;
  signals:      string[];
  rank:         number;
}

function currentVolWindow() {
  const h = new Date().getUTCHours();
  return VOL_WINDOWS.find(w => h >= w.start && h < w.end) ?? null;
}

function scoreAsset(name: string, ctx: Record<string, string>, rank: number): TokenScore {
  const price   = parseFloat(ctx.markPx   ?? '0');
  const funding = parseFloat(ctx.funding  ?? '0');
  const oi      = parseFloat(ctx.openInterest ?? '0');
  const vol24h  = parseFloat(ctx.dayNtlVlm   ?? '0');

  const absFunding = Math.abs(funding);

  // 1. Funding score
  const fundingScore = Math.min(absFunding / 0.0005, 1.0);

  // 2. OI score (liquidité proxy)
  const oiScore = Math.min(oi / 2e9, 1.0);

  // 3. Liquidation potential (funding × OI combiné)
  const liqScore = fundingScore * 0.7 + oiScore * 0.3;

  // 4. Vol window score
  const win = currentVolWindow();
  const volWindowScore = win?.score ?? 0.35;

  // 5. Volume momentum proxy
  const volScore = Math.min(vol24h / 5e8, 1.0);

  const raw = (
    fundingScore  * SCORE_WEIGHTS.funding +
    oiScore       * SCORE_WEIGHTS.oi_momentum +
    liqScore      * SCORE_WEIGHTS.liquidation +
    volWindowScore * SCORE_WEIGHTS.vol_window +
    volScore      * SCORE_WEIGHTS.price_mom
  );
  const score = Math.round(raw * 100);

  // Edge calc: funding 8h / 16 bougies M30
  const edgePerM30 = absFunding / 16;
  const netEdge    = edgePerM30 - HL_TAKER_FEE;
  const edgeRatio  = edgePerM30 / MIN_EDGE;

  // Bias
  let bias: TokenScore['bias'] = 'NEUTRAL';
  if (absFunding > 0.0002) bias = funding < 0 ? 'SHORT' : 'LONG';  // V21 §D2/A1 continuation

  const signals: string[] = [];
  if (absFunding > 0.0003) signals.push(`⚡ Funding ${funding >= 0 ? '+' : ''}${(funding * 100).toFixed(4)}%`);
  if (oi > 1e9)            signals.push(`🔥 OI $${(oi / 1e9).toFixed(2)}B`);
  if (edgeRatio >= 1)      signals.push(`• Carry ratio ${edgeRatio.toFixed(1)}× (non validé V25 §2.1)`);
  if (win)                 signals.push(`⏰ ${win.label}`);

  return {
    symbol: name, price, funding, oi, vol24h,
    score, bias, edgeRatio, edgeValid: netEdge >= 0,
    volWindow: win?.label ?? 'Off-hours', volScore: volWindowScore,
    signals, rank,
  };
}

const BIAS_COLORS = {
  LONG:    { border: '#00ff88', bg: '#00ff8811', text: '#00ff88' },
  SHORT:   { border: '#ff4466', bg: '#ff446611', text: '#ff4466' },
  NEUTRAL: { border: '#555',    bg: '#11111120', text: '#888' },
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#00ff88' : score >= 55 ? '#ffcc00' : '#ff4466';
  return (
    <div className="relative w-16 h-16 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#222" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${score} 100`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none" style={{ color }}>{score}</span>
        <span className="text-[9px] text-gray-500">/ 100</span>
      </div>
    </div>
  );
}

export default function Top5ScoreEngine() {
  const [tokens,  setTokens]  = useState<TokenScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [ts,      setTs]      = useState('');
  const [err,     setErr]     = useState('');
  const win = currentVolWindow();

  const refresh = useCallback(async () => {
    try {
      const res  = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data  = await res.json();
      const meta: Array<{ name: string }> = data[0]?.universe ?? [];
      const ctxs: Array<Record<string, string>> = data[1] ?? [];

      const scored = meta
        .map((m, i) => scoreAsset(m.name, ctxs[i] ?? {}, i))
        .filter(t => parseFloat(String(t.oi)) > 5e6)          // >5M OI minimum
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_N)
        .map((t, i) => ({ ...t, rank: i + 1 }));

      setTokens(scored);
      setTs(new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setErr('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <section className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-white tracking-widest uppercase">
            🎯 Top {TOP_N} — Score Engine
          </h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Seuil: ≥{(MIN_EDGE * 100).toFixed(2)}% net · {ts}
          </p>
        </div>
        <button onClick={refresh}
          className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition">
          ↻
        </button>
      </div>

      {err && <div className="mb-3 p-2 bg-red-950/40 text-red-400 text-xs rounded border border-red-800/30">{err}</div>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: TOP_N }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-900/60 rounded-lg animate-pulse border border-gray-800" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map(t => {
            const bc = BIAS_COLORS[t.bias];
            const isTradeable = t.edgeValid && t.score >= 60;
            return (
              <div key={t.symbol}
                className={`relative rounded-lg border p-3 transition-all hover:brightness-110 ${!isTradeable ? 'opacity-50' : ''}`}
                style={{ borderColor: bc.border + '44', background: bc.bg }}>

                {/* Rank */}
                <span className="absolute top-3 right-3 text-xs text-gray-600 font-mono">#{t.rank}</span>

                <div className="flex items-center gap-4">
                  <ScoreBadge score={t.score} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-bold text-base">{t.symbol}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: bc.border + '22', color: bc.text }}>
                        {t.bias}
                      </span>
                      {t.score >= 75 && <span className="text-xs text-green-400">🔥 HIGH</span>}
                      {t.score >= 60 && t.score < 75 && <span className="text-xs text-yellow-400">⚡ STRONG</span>}
                      {t.score < 60  && <span className="text-xs text-gray-500">👁️ WATCH</span>}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400 mb-2">
                      <span>Prix: <b className="text-white font-mono">${t.price > 1 ? t.price.toFixed(2) : t.price.toFixed(5)}</b></span>
                      <span>Funding: <b style={{ color: t.funding < 0 ? '#00ff88' : '#ff4466' }}>
                        {t.funding >= 0 ? '+' : ''}{(t.funding * 100).toFixed(4)}%
                      </b></span>
                      <span>OI: <b className="text-white">${(t.oi / 1e9).toFixed(2)}B</b></span>
                      <span>Edge/Fees: <b style={{ color: t.edgeRatio >= 1 ? '#00ff88' : '#ff4466' }}>
                        {t.edgeRatio.toFixed(2)}×
                      </b></span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {t.signals.map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 bg-black/30 rounded-full text-gray-300 border border-gray-700/30">
                          {s}
                        </span>
                      ))}
                      {!t.edgeValid && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-950/40 text-red-400 rounded-full border border-red-800/30">
                          ⚠️ Edge &lt; seuil frais
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${t.score}%`,
                      background: t.score >= 75 ? 'linear-gradient(90deg,#00ff88,#00ccff)'
                        : t.score >= 55 ? 'linear-gradient(90deg,#ffcc00,#ff8800)' : '#ff4466',
                    }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-2 text-[10px] text-gray-600 text-center">
        MÀJ 30s · Hyperliquid API · Seuil edge = {(MIN_EDGE*100).toFixed(2)}%
      </p>
    </section>
  );
}
