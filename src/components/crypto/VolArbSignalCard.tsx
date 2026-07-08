'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface StrongestSignal {
  instrument: string;
  current_residual: number;
  direction: 'long_vol' | 'short_vol';
  expiry: string;
}

interface AssetSignal {
  threshold_vol_pts: number;
  signal_active: boolean;
  n_open_signals: number;
  n_new_today: number;
  strongest_signal: StrongestSignal | null;
  win_rate_backtest: number;
  win_rate_range_backtest: string;
}

interface VolArbPayload {
  last_updated: string;
  status: string;
  paper_trading_since: string;
  next_reeval: string;
  assets: { BTC: AssetSignal; ETH: AssetSignal };
  disclaimer: string;
}

interface ApiResponse {
  success: boolean;
  available: boolean;
  data?: VolArbPayload;
  error?: string;
}

export default function VolArbSignalCard() {
  const [payload, setPayload] = useState<VolArbPayload | null>(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchSignal = async () => {
      try {
        const res = await fetch('/api/vol-arb-signal');
        const json: ApiResponse = await res.json();
        if (cancelled) return;
        if (json.success && json.data) {
          setPayload(json.data);
          setAvailable(true);
        } else {
          setAvailable(false);
        }
      } catch {
        if (!cancelled) setAvailable(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchSignal();
    const id = setInterval(fetchSignal, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-mono text-sm text-[#8890a0]"
        >
          CHARGEMENT S1 VOL-ARB...
        </motion.div>
      </div>
    );
  }

  if (!available || !payload) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-6">
        <Header />
        <div className="mt-4 p-6 rounded-lg border border-[#3a2a1a] bg-[#1a140a] text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <div className="font-mono text-[0.72rem] text-[#ffaa00] mb-1">
            DONNÉES INDISPONIBLES
          </div>
          <div className="font-mono text-[0.58rem] text-[#5a6070]">
            VPS Hermes injoignable — réessayez dans quelques minutes
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      <Header lastUpdated={payload.last_updated} />

      <div className="p-5">
        <ValidationBanner
          since={payload.paper_trading_since}
          nextReeval={payload.next_reeval}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <AssetBlock ccy="BTC" data={payload.assets.BTC} />
          <AssetBlock ccy="ETH" data={payload.assets.ETH} />
        </div>

        <div className="mt-5 bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-4">
          <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase tracking-[2px] mb-2">
            ⚠️ Lecture importante
          </div>
          <ul className="space-y-1.5 font-mono text-[0.6rem] text-[#8890a0] leading-relaxed">
            <li>• Win rate = backtest nested CV, <span className="text-[#eaeef4]">pas performance garantie</span></li>
            <li>• Paper trading = simulation sans capital réel</li>
            <li>• Aucune décision de trading basée sur cette card sans validation 30j+</li>
            <li>• Signal contrarian : short vol quand IV marché {'>'} IV modèle (et inversement)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Header({ lastUpdated }: { lastUpdated?: string }) {
  return (
    <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
          S1 — VOL SURFACE ARBITRAGE
        </span>
        <span className="font-mono text-[0.58rem] px-2 py-0.5 rounded border bg-[#3a2a1a] border-[#d4a017] text-[#d4a017] uppercase tracking-[2px] font-bold">
          Paper Trading
        </span>
      </div>
      <div className="font-mono text-[0.58rem] text-[#5a6070]">
        {lastUpdated ? `MAJ ${formatTime(lastUpdated)}` : 'Hermes VPS'}
      </div>
    </div>
  );
}

function ValidationBanner({ since, nextReeval }: { since: string; nextReeval: string }) {
  const days = Math.max(
    0,
    Math.floor((Date.now() - new Date(since).getTime()) / (1000 * 60 * 60 * 24)),
  );
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 rounded-lg border-2 bg-[#3a2a1a]/40 border-[#d4a017]/60"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">🧪</div>
        <div className="flex-1">
          <div className="font-mono text-[0.72rem] text-[#d4a017] font-bold uppercase tracking-[2px] mb-1">
            En cours de validation
          </div>
          <div className="font-mono text-[0.65rem] text-[#eaeef4] leading-relaxed">
            Paper trading depuis le {formatDate(since)} ({days}j). Pas encore déployé en capital réel.
          </div>
          <div className="font-mono text-[0.58rem] text-[#8890a0] mt-1">
            Re-validation seuil : {formatDate(nextReeval)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function AssetBlock({ ccy, data }: { ccy: string; data: AssetSignal }) {
  const color = ccy === 'BTC' ? '#f97316' : '#00e5ff';
  const directionLabel = data.strongest_signal?.direction === 'short_vol' ? 'SHORT VOL' : 'LONG VOL';
  const directionColor = data.strongest_signal?.direction === 'short_vol' ? '#ff3355' : '#4ade80';

  return (
    <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-black" style={{ color }}>
            {ccy}
          </span>
          <span className="font-mono text-[0.58rem] text-[#5a6070]">
            seuil {data.threshold_vol_pts}pt
          </span>
        </div>
        {data.signal_active ? (
          <span className="flex items-center gap-1.5 font-mono text-[0.58rem] text-[#d4a017]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4a017] animate-pulse" />
            SIGNAL ACTIF
          </span>
        ) : (
          <span className="font-mono text-[0.58rem] text-[#5a6070]">—</span>
        )}
      </div>

      {data.strongest_signal ? (
        <>
          <div className="mb-3">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">Résidu le plus fort</div>
            <div className="flex items-baseline gap-2">
              <span
                className="font-mono text-2xl font-black"
                style={{ color: directionColor }}
              >
                {data.strongest_signal.current_residual.toFixed(1)}
              </span>
              <span className="font-mono text-[0.65rem] text-[#8890a0]">vol pts</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded p-2">
              <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase mb-0.5">Direction</div>
              <div
                className="font-mono text-[0.7rem] font-bold"
                style={{ color: directionColor }}
              >
                {directionLabel}
              </div>
            </div>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded p-2">
              <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase mb-0.5">Expiry</div>
              <div className="font-mono text-[0.7rem] font-bold text-[#eaeef4]">
                {data.strongest_signal.expiry}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="mb-3 p-3 bg-[#0a0a14] border border-[#1e1e32] rounded text-center">
          <div className="font-mono text-[0.65rem] text-[#5a6070]">Aucun signal ouvert</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-[#0a0a14] border border-[#1e1e32] rounded p-2">
          <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase mb-0.5">Ouverts</div>
          <div className="font-mono text-sm font-bold text-[#eaeef4]">{data.n_open_signals}</div>
        </div>
        <div className="bg-[#0a0a14] border border-[#1e1e32] rounded p-2">
          <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase mb-0.5">Nouveaux (24h)</div>
          <div className="font-mono text-sm font-bold text-[#eaeef4]">{data.n_new_today}</div>
        </div>
      </div>

      <div className="pt-3 border-t border-[#1e1e32]">
        <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase mb-1">
          Win rate backtest
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold text-[#eaeef4]">
            {(data.win_rate_backtest * 100).toFixed(0)}%
          </span>
          <span className="font-mono text-[0.55rem] text-[#5a6070]">
            ({data.win_rate_range_backtest} selon période)
          </span>
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
