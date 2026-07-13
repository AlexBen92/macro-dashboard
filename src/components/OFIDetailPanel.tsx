/**
 * OFI DETAIL PANEL — Slide-in panel showing full OFI analysis on token click
 */

'use client';

import React from 'react';
import { ACFMiniChart } from './ACFMiniChart';
import { RVRegimeBadge } from './RVRegimeBadge';

export interface TokenSignalExtended {
  symbol: string;
  totalScore?: number;
  l1?: number;
  l2?: number;
  l3?: number;
  acfDirection: 'BUY' | 'SELL' | 'NEUTRAL';
  acfStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  pContinuation: number;
  acfLags: number[];
  depthImbalance?: number;
  spreadBps?: number;
  ofiScore?: number;
  rvRegime?: 'LOW' | 'NORMAL' | 'HIGH' | 'EXPLOSIVE';
  price?: number;
}

interface OFIDetailPanelProps {
  token: TokenSignalExtended;
  onClose: () => void;
}

export function OFIDetailPanel({ token, onClose }: OFIDetailPanelProps) {
  const p = Math.round((token.pContinuation ?? 0.5) * 100);
  const acf = token.acfLags ?? [];

  // Compute sumACF from lags
  const sumACF = acf.slice(0, 5).reduce((a, b) => a + b, 0);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '340px',
      height: '100vh',
      background: '#0a0a0f',
      borderLeft: '1px solid #222',
      padding: '20px',
      overflowY: 'auto',
      zIndex: 1000,
      fontFamily: 'ui-monospace, SFMono-Regular, Monaco, monospace',
      color: '#ccc',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 12,
        borderBottom: '1px solid #222',
      }}>
        <div>
          <span style={{
            fontSize: 18,
            fontWeight: 700,
            color: '#fff',
          }}>
            {token.symbol}
          </span>
          {token.price && (
            <span style={{
              fontSize: 14,
              color: '#888',
              marginLeft: 8,
            }}>
              ${token.price < 1 ? token.price.toFixed(5) : token.price < 100 ? token.price.toFixed(3) : token.price.toFixed(1)}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: 18,
            padding: 4,
            borderRadius: 4,
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
        >
          ✕
        </button>
      </div>

      {/* Score global */}
      {token.totalScore !== undefined && (
        <div style={{
          background: '#111',
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>COMPOSITE SCORE</div>
          <div style={{
            fontSize: 32,
            fontWeight: 900,
            color: (token.totalScore ?? 0) >= 80 ? '#00ff88' : (token.totalScore ?? 0) >= 60 ? '#ffaa00' : '#ff4444',
          }}>
            {Math.round(token.totalScore ?? 0)}<span style={{ fontSize: 16, color: '#444' }}>/100</span>
          </div>
          <div style={{ fontSize: 11, color: '#555', marginTop: 6 }}>
            L1: {(token.l1 ?? 0).toFixed(1)} · L2: {(token.l2 ?? 0).toFixed(1)} · L3: {(token.l3 ?? 0).toFixed(1)}
          </div>
        </div>
      )}

      {/* OFI Autocorr */}
      <div style={{
        background: '#111',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>OFI AUTOCORRELATION</div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div>
            <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>DIRECTION</div>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: token.acfDirection === 'BUY' ? '#00ff88' : token.acfDirection === 'SELL' ? '#ff4444' : '#888',
            }}>
              {token.acfDirection === 'BUY' ? '▲' : token.acfDirection === 'SELL' ? '▼' : '◆'} {token.acfDirection}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>p(CONT)</div>
            <div style={{
              fontSize: 14,
              fontWeight: 700,
              color: p > 60 ? '#00ff88' : p > 45 ? '#ffaa00' : '#ff4444',
            }}>
              {p}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 9, color: '#555', marginBottom: 2 }}>STRENGTH</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ccc' }}>
              {token.acfStrength[0]}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>ACF Lags 1–10</div>
        <ACFMiniChart lags={acf} width={280} height={40} />

        <div style={{
          fontSize: 9,
          color: '#444',
          marginTop: 6,
          textAlign: 'right',
        }}>
          ΣACF(1-5): {sumACF.toFixed(3)}
        </div>
      </div>

      {/* Microstructure */}
      <div style={{
        background: '#111',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
      }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 10 }}>MICROSTRUCTURE</div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}>
          {[
            {
              label: 'Depth Imbalance',
              value: (token.depthImbalance ?? 0).toFixed(3),
              color: (token.depthImbalance ?? 0) > 0.1 ? '#00ff88' : (token.depthImbalance ?? 0) < -0.1 ? '#ff4444' : '#888',
            },
            {
              label: 'Spread (bps)',
              value: (token.spreadBps ?? 0).toFixed(1),
              color: (token.spreadBps ?? 0) < 2 ? '#00ff88' : (token.spreadBps ?? 0) < 5 ? '#ffaa00' : '#ff4444',
            },
            {
              label: 'OFI Score',
              value: `${Math.round(token.ofiScore ?? 50)}/100`,
              color: (token.ofiScore ?? 50) > 60 ? '#00ff88' : (token.ofiScore ?? 50) < 40 ? '#ff4444' : '#888',
            },
            {
              label: 'Vol Regime',
              value: token.rvRegime ?? 'NORMAL',
              isRegime: true,
            },
          ].map(({ label, value, color, isRegime }) => (
            <div
              key={label}
              style={{
                background: '#0a0a0f',
                borderRadius: 6,
                padding: 8,
              }}
            >
              <div style={{ fontSize: 9, color: '#555', marginBottom: 3 }}>{label}</div>
              {isRegime ? (
                <RVRegimeBadge regime={value as any} compact />
              ) : (
                <div style={{ fontSize: 13, fontWeight: 600, color: color as string }}>
                  {value}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Signal summary */}
      <div style={{
        background: '#0d1a0d',
        border: '1px solid #0a3a0a',
        borderRadius: 8,
        padding: 12,
      }}>
        <div style={{ fontSize: 11, color: '#00aa44', marginBottom: 8 }}>📊 SIGNAL SUMMARY</div>
        <div style={{ fontSize: 11, color: '#aaa', lineHeight: 1.9 }}>
          {token.acfDirection !== 'NEUTRAL' && (
            <div>✅ OFI flow: {token.acfDirection} ({token.acfStrength})</div>
          )}
          {p > 55 && <div>• Continuation {p}% (observation microstructure, non prédictif hors coût — V25 §4.2)</div>}
          {(token.depthImbalance ?? 0) > 0.15 && <div>✅ Bid depth dominance</div>}
          {(token.depthImbalance ?? 0) < -0.15 && <div>✅ Ask depth dominance</div>}
          {(token.spreadBps ?? 99) < 3 && <div>✅ Tight spread ({(token.spreadBps ?? 0).toFixed(1)}bps)</div>}
          {token.rvRegime === 'HIGH' && <div>⚠️ High volatility — adjust stops</div>}
          {token.rvRegime === 'EXPLOSIVE' && <div>🚨 Explosive vol — avoid entry</div>}
          {token.rvRegime === 'LOW' && <div>⚠️ Low vol — reduce TP target</div>}
        </div>
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: 16,
        fontSize: 9,
        color: '#444',
        textAlign: 'center',
      }}>
        OFI = Order Flow Imbalance · ACF = Autocorrelation Function<br />
        Data updates every 500ms via WebSocket
      </div>
    </div>
  );
}
