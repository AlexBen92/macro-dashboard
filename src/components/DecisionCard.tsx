// components/DecisionCard.tsx
import React from 'react';
import type { DecisionOutput } from '@/lib/scalp-decision';
import { StyleBadge } from './StyleBadge';

interface Props {
  decision: DecisionOutput;
}

export function DecisionCard({ decision }: Props) {
  const verdictColor =
    decision.verdict === 'READY' ? '#00ff88' :
    decision.verdict === 'WATCH' ? '#ffaa00' : '#ff4444';

  return (
    <div style={{
      background: '#0d0d14', border: `1px solid ${verdictColor}33`,
      borderRadius: 8, padding: 12, flex: 1,
    }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
        ⚡ DECISION ENGINE
      </div>

      {/* Verdict */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <span style={{ fontSize: 24 }}>{decision.verdictEmoji}</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 900, color: verdictColor }}>
            {decision.verdict}
          </div>
          <div style={{ fontSize: 11, color: '#666' }}>
            Score: {decision.scalpScore}/100
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[
          { label: 'DIR',  val: decision.directionScore,  w: '40%' },
          { label: 'EXEC', val: decision.executionScore,  w: '25%' },
          { label: 'VOL',  val: decision.regimeScore,     w: '35%' },
        ].map(({ label, val, w }) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#666' }}>{label} {w}</div>
            <div style={{
              fontSize: 14, fontWeight: 700,
              color: val >= 70 ? '#00ff88' : val >= 45 ? '#ffaa00' : '#ff4444'
            }}>
              {val}
            </div>
          </div>
        ))}
      </div>

      {/* Risk params */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        {[
          { label: 'Size',    value: `×${(decision.size_mult * 100).toFixed(0)}%` },
          { label: 'Stop',    value: `${decision.stop_bps}bps` },
          { label: 'Timeout', value: `${(decision.timeout_ms / 1000).toFixed(0)}s` },
          { label: 'Style',   value: decision.allowed_style, isStyle: true },
        ].map(({ label, value, isStyle }) => (
          <div key={label} style={{ background: '#0a0a10', borderRadius: 5, padding: '5px 8px' }}>
            <div style={{ fontSize: 9, color: '#666' }}>{label}</div>
            {isStyle ? (
              <StyleBadge style={value} compact />
            ) : (
              <div style={{ fontSize: 12, fontWeight: 600, fontFamily: 'monospace', color: '#ccc' }}>
                {value}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Blockers */}
      {decision.blockers.length > 0 && (
        <div style={{ background: '#1a0000', borderRadius: 6, padding: '6px 8px' }}>
          {decision.blockers.map((b, i) => (
            <div key={i} style={{ fontSize: 10, color: '#ff8888' }}>⛔ {b}</div>
          ))}
        </div>
      )}

      {/* Reasons */}
      {decision.reasons.length > 0 && decision.blockers.length === 0 && (
        <div style={{ background: '#001a08', borderRadius: 6, padding: '6px 8px' }}>
          {decision.reasons.map((r, i) => (
            <div key={i} style={{ fontSize: 10, color: '#88ff88' }}>✅ {r}</div>
          ))}
        </div>
      )}
    </div>
  );
}
