'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useFtmoData } from '@/hooks/ftmo/useFtmoData';
import { useFlowMap } from '@/hooks/ftmo/useFlowMap';
import FtmoDecisionBar from '@/components/ftmo/FtmoDecisionBar';
import MacroFlowMap from '@/components/ftmo/MacroFlowMap';
import StrategyPanel from '@/components/ftmo/StrategyPanel';
import FtmoTradeCard from '@/components/ftmo/FtmoTradeCard';
import CurrencyStrength from '@/components/ftmo/CurrencyStrength';
import GoldOilPanel from '@/components/ftmo/GoldOilPanel';
import SessionClock from '@/components/ftmo/SessionClock';
import ScorePanel from '@/components/ftmo/ScorePanel';
import type { TrafficLightStatus } from '@/lib/types';

function computeLight(score: number, vix: number, sessionActive: boolean, eventHours: number): { light: TrafficLightStatus; verdict: string } {
  if (vix > 30 || eventHours < 2) return { light: 'stop', verdict: 'NO TRADE' };
  if (score < -2 || !sessionActive || vix > 25 || eventHours < 24) return { light: 'caution', verdict: 'PRUDENT' };
  if (score > 2) return { light: 'go', verdict: 'TRADE' };
  return { light: 'caution', verdict: 'PRUDENT' };
}

export default function FtmoPage() {
  const ftmo = useFtmoData();
  const { nodes, edges, alerts } = useFlowMap(ftmo.instruments);

  const nowH = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  const sessionActive = (nowH >= 7 && nowH <= 16) || (nowH >= 13 && nowH <= 22);
  const eventHours = ftmo.nextEvent?.hoursLeft ?? 999;
  const { light, verdict } = computeLight(ftmo.score.score, ftmo.vix, sessionActive, eventHours);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen"
    >
      <FtmoDecisionBar
        light={light}
        verdict={verdict}
        score={ftmo.score}
        riskPct={0.5}
        sessionActive={sessionActive}
        nextEvent={ftmo.nextEvent}
        countdown={ftmo.countdown}
        loading={ftmo.loading}
        latency={ftmo.latency}
      />

      {/* Main grid: Flow Map (60%) + Strategy Panel (40%) */}
      <div className="grid grid-cols-[60fr_40fr] max-lg:grid-cols-1 min-h-[50vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 border-r border-[#1a1a30]"
        >
          <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#d4a017]" /> MACRO FLOW MAP
          </div>
          <MacroFlowMap nodes={nodes} edges={edges} alerts={alerts} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-6 overflow-y-auto max-h-[60vh] bg-[#0c0c16]"
        >
          <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#00e5ff]" /> STRATEGIES
          </div>
          <StrategyPanel
            asianRange={ftmo.asianRange}
            scalp={ftmo.scalp}
            londonBOEUR={ftmo.londonBOEUR}
            londonBOGBP={ftmo.londonBOGBP}
            meanRevEUR={ftmo.meanRevEUR}
            meanRevEURGBP={ftmo.meanRevEURGBP}
            orbNAS={ftmo.orbNAS}
            orbUS30={ftmo.orbUS30}
          />
        </motion.div>
      </div>

      {/* Trade Cards */}
      <div className="px-6 py-4 border-t border-[#1a1a30]">
        <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
          <div className="w-[6px] h-[6px] rounded-full bg-[#4ade80]" /> TOP TRADES
        </div>
        <AnimatePresence>
          {ftmo.trades.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {ftmo.trades.slice(0, 3).map((t, i) => (
                <FtmoTradeCard key={t.instrument + t.direction} trade={t} index={i} />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-10 border-2 border-dashed border-[#1a1a30] rounded"
            >
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="font-mono text-[1.4rem] font-bold text-[#ff3355] tracking-[3px] mb-2"
              >
                PAS DE SETUP — CASH
              </motion.div>
              <div className="font-mono text-[0.82rem] text-[#556680]">Aucune strategie ne genere de signal</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom row: Currency Strength + Gold/Oil + Calendar/Clock */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-[#1a1a30]">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 border-r border-[#1a1a30]"
        >
          <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#2980b9]" /> CURRENCY STRENGTH
          </div>
          <CurrencyStrength data={ftmo.currencyStrength} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="p-6 border-r border-[#1a1a30]"
        >
          <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#d4a017]" /> GOLD / OIL
          </div>
          <GoldOilPanel
            goldCandles={ftmo.raw['XAUUSD_1h']?.candles ?? []}
            oilCandles={ftmo.raw['OIL_1h']?.candles ?? []}
            brentCandles={ftmo.raw['BRENT_1h']?.candles ?? []}
            goldPrice={ftmo.instruments.XAUUSD?.price ?? 0}
            oilPrice={ftmo.instruments.OIL?.price ?? 0}
            brentPrice={ftmo.raw['BRENT_1h']?.price ?? 0}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="p-6"
        >
          <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#aa66ff]" /> SESSION / CALENDAR
          </div>
          <SessionClock />

          {/* Score breakdown */}
          <div className="mt-3">
            <ScorePanel score={ftmo.score} />
          </div>
        </motion.div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-6 py-1 border-t border-[#1a1a30] bg-[#0c0c16] font-mono text-[0.62rem] text-[#556680]">
        <span>VIX: <span className={ftmo.vix > 25 ? 'text-[#ff3355]' : 'text-[#4ade80]'}>{ftmo.vix.toFixed(1)}</span></span>
        <span>DXY: <span className="text-[#e8e8f0]">{ftmo.dxyPrice.toFixed(1)}</span></span>
        <span>10Y: <span className="text-[#e8e8f0]">{ftmo.yield10y.toFixed(2)}%</span></span>
        <span className="flex-1" />
        <span>{ftmo.latency}ms</span>
        <span>MACRO STACK — FTMO Decision Engine v2</span>
      </div>
    </motion.div>
  );
}
