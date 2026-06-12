/**
 * TRADING TERMINAL HEADER
 * Header compact style terminal pro avec:
 * - Decision Engine (verdict, score, sizing)
 * - Market Regime
 * - Session Status
 * - News Risk
 */
'use client';

import { useState, useEffect } from 'react';
import type { ScoreResult, TrafficLightStatus, SessionInfo } from '@/lib/types';

interface TerminalHeaderProps {
  light: TrafficLightStatus;
  verdict: string;
  score: ScoreResult | null;
  sizing: string;
  session: SessionInfo;
  nextEvent: { name: string; countdown: string; hoursLeft: number } | null;
  loading: boolean;
  latency: number;
}

interface RegimeData {
  composite?: {
    overall_regime: 'trend_following' | 'mean_reverting' | 'random_walk' | 'volatile_chop';
    trend_score: number;
    confidence: number;
  };
}

interface NewsData {
  upcomingEvents?: Array<{ name: string; impact: string; hoursLeft: number }>;
}

function getVerdictColor(light: TrafficLightStatus): string {
  switch (light) {
    case 'go': return '#4ade80';
    case 'caution': return '#f97316';
    case 'stop': return '#ef4444';
    default: return '#64748b';
  }
}

function getRegimeColor(regime?: string): string {
  switch (regime) {
    case 'trend_following': return '#4ade80';
    case 'mean_reverting': return '#a855f7';
    case 'volatile_chop': return '#ef4444';
    default: return '#64748b';
  }
}

function getRegimeLabel(regime?: string): string {
  switch (regime) {
    case 'trend_following': return 'TREND';
    case 'mean_reverting': return 'MEAN REV';
    case 'volatile_chop': return 'CHOP';
    default: return 'RANGE';
  }
}

function getNewsRisk(hoursLeft?: number): { color: string; label: string } {
  if (hoursLeft === undefined || hoursLeft > 24) {
    return { color: '#64748b', label: 'LOW' };
  }
  if (hoursLeft < 2) {
    return { color: '#ef4444', label: 'HIGH' };
  }
  return { color: '#f97316', label: 'MED' };
}

export default function TradingTerminalHeader({
  light, verdict, score, sizing, session, nextEvent, loading, latency,
}: TerminalHeaderProps) {
  const [regime, setReg] = useState<RegimeData | null>(null);
  const [news, setNews] = useState<NewsData | null>(null);

  useEffect(() => {
    // Fetch regime data
    fetch('/api/quant-regimes?symbol=BTC')
      .then(r => r.json())
      .then(setReg)
      .catch(() => {});

    // Fetch news data
    fetch('/api/macro')
      .then(r => r.json())
      .then(setNews)
      .catch(() => {});
  }, []);

  const verdictColor = getVerdictColor(light);
  const scoreVal = score?.score ?? 0;
  const regimeColor = getRegimeColor(regime?.composite?.overall_regime);
  const regimeLabel = getRegimeLabel(regime?.composite?.overall_regime);
  const nextNews = news?.upcomingEvents?.[0];
  const newsRisk = getNewsRisk(nextNews?.hoursLeft);

  return (
    <div className="border-b border-[#1a1a30] bg-[#08080f]">
      {/* Main Header Row */}
      <div className="flex items-center gap-4 px-4 py-2 max-w-[96rem] mx-auto">
        {/* Brand */}
        <div className="font-mono text-[0.65rem] font-bold text-[#556680] tracking-[2px] uppercase">
          Macro Stack
        </div>

        <div className="w-px h-4 bg-[#1a1a30]" />

        {/* Decision Engine */}
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: verdictColor }}
          />
          <span className="font-mono text-[0.7rem] font-semibold" style={{ color: verdictColor }}>
            {verdict}
          </span>
          <span className="font-mono text-[0.65rem] text-[#8890a0]">
            {scoreVal >= 0 ? '+' : ''}{scoreVal.toFixed(1)}
          </span>
        </div>

        <div className="w-px h-4 bg-[#1a1a30]" />

        {/* Sizing */}
        <span className="font-mono text-[0.65rem] text-[#a0a8b8]">
          {sizing}
        </span>

        <div className="w-px h-4 bg-[#1a1a30]" />

        {/* Market Regime */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.6rem] text-[#5a6070]">REGIME</span>
          <span className="font-mono text-[0.65rem] font-semibold px-1.5 py-0.5 rounded" style={{
            background: regimeColor + '22',
            color: regimeColor,
          }}>
            {regimeLabel}
          </span>
        </div>

        <div className="w-px h-4 bg-[#1a1a30]" />

        {/* Session */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.6rem] text-[#5a6070]">SESSION</span>
          {session.active ? (
            <span className="font-mono text-[0.65rem] text-[#4ade80]">
              {session.active}
            </span>
          ) : (
            <span className="font-mono text-[0.65rem] text-[#64748b]">OFF</span>
          )}
        </div>

        <div className="w-px h-4 bg-[#1a1a30]" />

        {/* News Risk */}
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.6rem] text-[#5a6070]">NEWS</span>
          <span className="font-mono text-[0.65rem] font-semibold px-1.5 py-0.5 rounded" style={{
            background: newsRisk.color + '22',
            color: newsRisk.color,
          }}>
            {newsRisk.label}
          </span>
          {nextNews && nextNews.hoursLeft < 24 && (
            <span className="font-mono text-[0.55rem] text-[#8890a0]">
              {nextNews.name}
            </span>
          )}
        </div>

        <div className="flex-1" />

        {/* Status */}
        <div className="flex items-center gap-3">
          {loading && (
            <div className="w-2 h-2 border-2 border-[#1e1e32] border-t-[#00e5ff] rounded-full animate-spin" />
          )}
          <span className="font-mono text-[0.55rem] text-[#5a6070] hidden sm:inline">
            {latency}ms
          </span>
        </div>
      </div>
    </div>
  );
}
