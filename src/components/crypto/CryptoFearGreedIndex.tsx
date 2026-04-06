'use client';
import { motion } from 'framer-motion';

interface FearGreedData {
  value: number;
  valueClassification: string;
  timestamp: string;
}

interface Props {
  data?: FearGreedData;
  loading?: boolean;
}

const DEFAULT_DATA: FearGreedData = {
  value: 55,
  valueClassification: 'Neutral',
  timestamp: new Date().toISOString(),
};

export default function CryptoFearGreedIndex({ data = DEFAULT_DATA, loading }: Props) {
  const getGaugeColor = (value: number): { bg: string; text: string; border: string } => {
    if (value >= 75) return { bg: '#ff335520', text: '#ff3355', border: '#ff3355' };
    if (value >= 60) return { bg: '#ffaa0020', text: '#ffaa00', border: '#ffaa00' };
    if (value >= 40) return { bg: '#4ade8020', text: '#4ade80', border: '#4ade80' };
    return { bg: '#aa66ff20', text: '#aa66ff', border: '#aa66ff' };
  };

  const gaugeColor = getGaugeColor(data.value);
  const gaugePosition = ((data.value - 0) / 100) * 100;

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            CRYPTO FEAR & GREED
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="font-mono text-[0.58rem] text-[#5a6070]">
          Bitcoin & Ethereum
        </div>
      </div>

      <div className="p-6">
        <div className="relative w-full h-4 bg-[#1a1a2e] rounded-full overflow-hidden mb-6">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${gaugePosition}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full rounded-full relative"
            style={{
              background: `linear-gradient(90deg, ${
                data.value < 25 ? '#aa66ff' :
                data.value < 45 ? '#4ade80' :
                data.value < 65 ? '#ffaa00' :
                '#ff3355'
              }, ${
                data.value < 35 ? '#4ade80' :
                data.value < 55 ? '#ffaa00' :
                '#ff3355'
              })`,
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
              className={`w-6 h-6 rounded-full border-2 ${gaugeColor.border} bg-[#0a0a14]`}
            />
          </div>
        </div>

        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="font-mono text-7xl font-black mb-2"
            style={{ color: gaugeColor.text }}
          >
            {data.value}
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="font-mono text-xl font-bold uppercase tracking-wider"
            style={{ color: gaugeColor.text }}
          >
            {data.valueClassification}
          </motion.div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          {['EXTREME FEAR', 'FEAR', 'GREED', 'EXTREME GREED'].map((label, i) => {
            const isActive =
              (i === 0 && data.value <= 25) ||
              (i === 1 && data.value > 25 && data.value <= 45) ||
              (i === 2 && data.value > 45 && data.value <= 65) ||
              (i === 3 && data.value > 65);

            return (
              <div
                key={label}
                className={`py-2 px-1 rounded border ${
                  isActive
                    ? ''
                    : 'border-transparent opacity-30'
                }`}
                style={{
                  borderColor: isActive ? gaugeColor.border : undefined,
                  background: isActive ? gaugeColor.bg : undefined,
                }}
              >
                <div className="font-mono text-[0.52rem] uppercase" style={{ color: isActive ? gaugeColor.text : '#5a6070' }}>
                  {label}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-[#0e0e1a] border border-[#1e1e32] rounded-lg">
          <div className="font-mono text-[0.65rem] text-[#8890a0] uppercase mb-2">
            💡 Interprétation Contrarian
          </div>
          <ul className="space-y-1 font-mono text-[0.58rem] text-[#5a6070]">
            {data.value <= 25 && <li>❌ Extreme Fear → Signals d'achat potentiels</li>}
            {data.value > 25 && data.value <= 45 && <li>⚠️ Fear → Bon point d'entrée long</li>}
            {data.value > 45 && data.value <= 65 && <li>😐 Neutral → Marché équilibré</li>}
            {data.value > 65 && <li>✅ Greed → Signals de prudence, prendre profits</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
