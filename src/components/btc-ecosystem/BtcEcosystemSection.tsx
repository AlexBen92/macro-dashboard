'use client';
import { motion } from 'framer-motion';
import { useBtcEcosystem } from '@/hooks/useBtcEcosystem';

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  btc_proxy: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Proxy BTC' },
  miner: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'Miner' },
  exchange: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'Exchange' },
  tech: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Tech' },
  macro: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', label: 'Macro' },
};

function CorrelationBar({ corr, beta }: { corr: number; beta: number }) {
  const width = Math.max(0, Math.min(100, corr * 100));
  const intensity = corr >= 0.8 ? 'bg-orange-400' : corr >= 0.6 ? 'bg-teal-400' : 'bg-teal-500/60';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-[#1e1e32] rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${intensity}`}
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="font-mono text-xs text-[#8890a0] w-8">{corr.toFixed(2)}</span>
    </div>
  );
}

function AssetRow({ asset, btcChange }: { asset: any; btcChange: number }) {
  const catStyle = CATEGORY_COLORS[asset.category] ?? CATEGORY_COLORS.macro;
  const isPositive = asset.change24h >= 0;
  const relativePerf = (asset.change24h - btcChange).toFixed(2);
  const isOutperforming = parseFloat(relativePerf) > 0;

  return (
    <motion.div
      className="grid grid-cols-12 gap-2 px-3 py-2.5 border-b border-[#1e1e32] last:border-0 hover:bg-[#0f0f1a]/50 transition-colors"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="col-span-3 flex items-center gap-2">
        <span className="font-mono text-sm font-semibold text-white">{asset.ticker}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${catStyle.bg} ${catStyle.text}`}>
          {catStyle.label}
        </span>
      </div>

      <div className="col-span-2 font-mono text-sm text-white">
        {asset.price >= 1000 ? asset.price.toLocaleString('en-US', { maximumFractionDigits: 0 }) : asset.price.toFixed(2)}
      </div>

      <div className="col-span-2 font-mono text-sm">
        <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
          {isPositive ? '+' : ''}{asset.change24h.toFixed(2)}%
        </span>
      </div>

      <div className="col-span-3">
        <CorrelationBar corr={asset.baseCorr} beta={asset.beta} />
      </div>

      <div className="col-span-2 flex items-center justify-between">
        <span className="font-mono text-xs text-[#8890a0]">
          β ~{asset.beta.toFixed(1)}x
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            isOutperforming ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
          }`}
          title={`Performance relative au BTC: ${isOutperforming ? '+' : ''}${relativePerf}%`}
        >
          {isOutperforming ? '+' : ''}{relativePerf}%
        </span>
      </div>
    </motion.div>
  );
}

function TimeAgo({ date }: { date: Date | null }) {
  if (!date) return null;

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return <span>il y a {seconds}s</span>;
  if (seconds < 3600) return <span>il y a {Math.floor(seconds / 60)}min</span>;
  return <span>il y a {Math.floor(seconds / 3600)}h</span>;
}

export default function BtcEcosystemSection() {
  const { data, isLoading, isStale, error } = useBtcEcosystem();

  if (isLoading && !data) {
    return (
      <div className="border border-[#1e1e32] rounded-xl bg-[#0a0a14] p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#1e1e32] rounded w-48" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-[#1e1e32] rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="border border-[#1e1e32] rounded-xl bg-[#0a0a14] p-6">
        <div className="text-center font-mono text-sm text-red-400">
          Erreur de chargement: {error}
        </div>
      </div>
    );
  }

  const btc = data?.btc;
  const assets = data?.assets ?? [];

  return (
    <motion.div
      className="border border-[#1e1e32] rounded-xl bg-[#0a0a14] overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="px-4 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-[#8890a0] tracking-[2px] uppercase">
            BTC Ecosystem
          </span>
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#1e1e32]/50">
            <span className="text-[10px] text-[#8890a0]">BTC</span>
            {btc && (
              <>
                <span className="font-mono text-sm text-white">
                  ${btc.price.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </span>
                <span className={`font-mono text-xs ${btc.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {btc.change24h >= 0 ? '+' : ''}{btc.change24h.toFixed(1)}%
                </span>
                {btc.change24h >= 0 ? (
                  <span className="text-emerald-400 text-xs">▲</span>
                ) : (
                  <span className="text-red-400 text-xs">▼</span>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#5a6070] font-mono">
          {isStale && <span className="text-amber-400">🕐 Données de secours</span>}
          <TimeAgo date={data?.updatedAt ? new Date(data.updatedAt) : null} />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-[#0f0f1a] border-b border-[#1e1e32] text-[10px] text-[#5a6070] font-mono uppercase tracking-wider">
        <div className="col-span-3">Actif</div>
        <div className="col-span-2">Prix</div>
        <div className="col-span-2">24h</div>
        <div className="col-span-3">Corrélation BTC</div>
        <div className="col-span-2">Beta / Rel</div>
      </div>

      <div className="divide-y divide-[#1e1e32]/50">
        {assets.map((asset) => (
          <AssetRow
            key={asset.ticker}
            asset={asset}
            btcChange={btc?.change24h ?? 0}
          />
        ))}
      </div>

      <div className="px-3 py-2 bg-[#0f0f1a] border-t border-[#1e1e32] flex items-center gap-4 text-[10px] text-[#5a6070] font-mono">
        <span>Corrélation baseline (90j bull market)</span>
        <span className="flex-1" />
        <span>β = Si BTC +1%, actif fait historiquement +β% en moyenne</span>
      </div>
    </motion.div>
  );
}
