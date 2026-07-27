import { describe, it, expect } from 'vitest';
import { computeContextBadge } from '../../src/lib/options/context-badge';

describe('computeContextBadge', () => {
  it('not_configured when no cells', () => {
    const r = computeContextBadge(null);
    expect(r.badge).toBe('not_configured');
    expect(r.ruleVersion).toBe('v2');
  });

  it('insufficient when <2 points', () => {
    const r = computeContextBadge([
      { a: 'BTC', b: 'DXY', r: 0.5, window: '7d', n: 7 },
    ]);
    expect(r.badge).toBe('insufficient');
  });

  it('risk-off when BTC-DXY>0.30 and BTC-SPX<0.10', () => {
    const r = computeContextBadge([
      { a: 'BTC', b: 'DXY', r: 0.55, window: '7d', n: 7 },
      { a: 'BTC', b: 'SPX', r: 0.05, window: '7d', n: 7 },
      { a: 'BTC', b: 'DXY', r: 0.4, window: '30d', n: 30 },
      { a: 'BTC', b: 'SPX', r: 0.2, window: '30d', n: 30 },
    ]);
    expect(r.badge).toBe('risk-off');
    expect(r.evidence.length).toBeGreaterThan(0);
  });

  it('risk-on when BTC-SPX>0.30 and BTC-DXY<0.10', () => {
    const r = computeContextBadge([
      { a: 'BTC', b: 'DXY', r: -0.2, window: '7d', n: 7 },
      { a: 'BTC', b: 'SPX', r: 0.7, window: '7d', n: 7 },
    ]);
    expect(r.badge).toBe('risk-on');
  });

  it('mixed otherwise', () => {
    const r = computeContextBadge([
      { a: 'BTC', b: 'DXY', r: 0.1, window: '7d', n: 7 },
      { a: 'BTC', b: 'SPX', r: 0.3, window: '7d', n: 7 },
    ]);
    expect(r.badge).toBe('mixed');
  });

  it('treats (a,b) symmetrically', () => {
    const r = computeContextBadge([
      { a: 'DXY', b: 'BTC', r: 0.55, window: '7d', n: 7 },
      { a: 'SPX', b: 'BTC', r: 0.05, window: '7d', n: 7 },
    ]);
    expect(r.badge).toBe('risk-off');
  });
});
