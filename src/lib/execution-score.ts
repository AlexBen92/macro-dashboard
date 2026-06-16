// lib/execution-score.ts
// Execution quality score: spread, depth, spoofing, refill

export interface ExecutionMetrics {
  spreadBps:      number;   // bid-ask spread in bps
  topBidDepth:    number;   // best bid size in USD
  topAskDepth:    number;   // best ask size in USD
  depthRatio:     number;   // bid/ask depth ratio (>1 = bid dominant)
  flickerCount:   number;   // large orders appearing/disappearing < 200ms
  refillScore:    number;   // 0..1 — does depth refill after hits?
}

export interface ExecutionScore {
  raw:          number;   // 0..100
  spreadOk:     boolean;  // spread < 3bps
  depthOk:      boolean;  // both sides > $50k
  spoofy:       boolean;  // flickerCount high
  label:        'CLEAN' | 'ACCEPTABLE' | 'POOR' | 'AVOID';
}

// Rolling flicker detector
export class FlickerDetector {
  private largeOrders: Map<string, { size: number; ts: number }> = new Map();
  private flickerCount = 0;
  private readonly FLICKER_WINDOW_MS  = 300;
  private readonly SIZE_THRESHOLD_USD = 50000;

  update(bids: [number, number][], asks: [number, number][], ts: number): number {
    // Track large orders. If they disappear within FLICKER_WINDOW_MS → flicker
    const checkSide = (levels: [number, number][], side: 'B' | 'A') => {
      for (const [px, sz] of levels.slice(0, 3)) {
        const key  = `${side}${px.toFixed(2)}`;
        const usd  = px * sz;
        const prev = this.largeOrders.get(key);
        if (usd > this.SIZE_THRESHOLD_USD) {
          this.largeOrders.set(key, { size: sz, ts });
        } else if (prev && (ts - prev.ts) < this.FLICKER_WINDOW_MS) {
          this.flickerCount++;
          this.largeOrders.delete(key);
        }
      }
    };

    checkSide(bids, 'B');
    checkSide(asks, 'A');

    // Decay old flicker count (half-life 5s)
    if (ts % 5000 < 500) this.flickerCount = Math.max(0, this.flickerCount - 1);

    return this.flickerCount;
  }

  getCount() { return this.flickerCount; }
  reset()    { this.flickerCount = 0; this.largeOrders.clear(); }
}

export function computeExecutionScore(m: ExecutionMetrics): ExecutionScore {
  // Spread score (0..35): perfect = 0bps, bad = >5bps
  const spreadScore = Math.max(0, 35 - m.spreadBps * 10);

  // Depth score (0..30): $100k each side = 30pts
  const depthMin  = Math.min(m.topBidDepth, m.topAskDepth);
  const depthScore = Math.min(30, (depthMin / 100000) * 30);

  // Depth balance score (0..15): ratio close to 1 = 15, extreme = 0
  const ratio = Math.min(m.depthRatio, 1 / m.depthRatio);
  const balanceScore = ratio * 15;

  // Spoofing penalty (0..−20)
  const spoofy        = m.flickerCount > 3;
  const spoofinPenalty = Math.min(20, m.flickerCount * 4);

  // Refill bonus (0..20)
  const refillBonus = m.refillScore * 20;

  const raw = Math.max(0, Math.min(100,
    spreadScore + depthScore + balanceScore + refillBonus - spoofinPenalty
  ));

  const label: ExecutionScore['label'] =
    spoofy || m.spreadBps > 8 ? 'AVOID'      :
    raw >= 70                  ? 'CLEAN'      :
    raw >= 45                  ? 'ACCEPTABLE' : 'POOR';

  return {
    raw,
    spreadOk: m.spreadBps < 3,
    depthOk:  Math.min(m.topBidDepth, m.topAskDepth) > 50000,
    spoofy,
    label,
  };
}

// Per-asset flicker detectors
const flickerMap: Record<string, FlickerDetector> = {};
export function getFlickerDetector(asset: string): FlickerDetector {
  if (!flickerMap[asset]) flickerMap[asset] = new FlickerDetector();
  return flickerMap[asset];
}
