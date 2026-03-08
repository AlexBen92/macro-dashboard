import { NextResponse } from 'next/server';

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function hlPost(body: Record<string, unknown>) {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function GET() {
  try {
    // 1. Fetch leaderboard
    const lbRes = await fetch('https://stats-data.hyperliquid.xyz/Mainnet/leaderboard');
    const lb = await lbRes.json();
    const rows = lb.leaderboardRows || [];

    // 2. Filter candidates: account value ≥ $500K, sort by PnL
    interface Candidate {
      addr: string;
      av: number;
      pnl: number;
      sharpe?: number | null;
      winRate?: number | null;
      fills?: number;
      posCount?: number;
      sRank?: number;
      pRank?: number;
    }
    const cands: Candidate[] = [];
    for (const row of rows) {
      const av = parseFloat(row.accountValue || '0');
      if (av < 500000) continue;
      let mpnl = 0;
      for (const wp of (row.windowPerformances || [])) {
        if (wp[0] === 'month') mpnl = parseFloat(wp[1].pnl || '0');
      }
      cands.push({ addr: row.ethAddress, av, pnl: mpnl });
    }
    cands.sort((a, b) => b.pnl - a.pnl);
    const top50 = cands.slice(0, 50);

    // 3. Scan each candidate
    const qualified: Candidate[] = [];
    for (const c of top50) {
      try {
        const [st, fills] = await Promise.all([
          hlPost({ type: 'clearinghouseState', user: c.addr }).catch(() => null),
          hlPost({ type: 'userFillsByTime', user: c.addr, startTime: Date.now() - 90 * 864e5 }).catch(() => null),
        ]);

        let posCount = 0;
        if (st?.assetPositions) {
          posCount = st.assetPositions.length;
          c.av = parseFloat(st.marginSummary?.accountValue || String(c.av));
        }
        const fc = Array.isArray(fills) ? fills.length : 0;
        if (fc < 200 && posCount === 0) { await sleep(80); continue; }

        let sharpe: number | null = null;
        let winRate: number | null = null;
        if (Array.isArray(fills) && fills.length > 7) {
          const daily: Record<string, number> = {};
          let wins = 0, tot = 0;
          for (const f of fills) {
            const day = new Date(f.time).toISOString().slice(0, 10);
            if (!daily[day]) daily[day] = 0;
            const cp = parseFloat(f.closedPnl || '0');
            daily[day] += cp;
            if (cp > 0) wins++;
            if (cp !== 0) tot++;
          }
          winRate = tot > 0 ? wins / tot : null;
          const pnls = Object.values(daily);
          if (pnls.length >= 7) {
            const m = pnls.reduce((a, b) => a + b, 0) / pnls.length;
            const std = Math.sqrt(pnls.reduce((a, b) => a + (b - m) * (b - m), 0) / (pnls.length - 1));
            if (std > 0) sharpe = (m / std) * Math.sqrt(365);
          }
        }

        qualified.push({ addr: c.addr, av: c.av, pnl: c.pnl, sharpe, winRate, fills: fc, posCount });
      } catch { /* skip */ }
      await sleep(80);
    }

    // 4. Sort by composite PnL 50% + Sharpe 50%
    const ws = qualified.filter(q => q.sharpe != null);
    ws.sort((a, b) => (b.sharpe ?? 0) - (a.sharpe ?? 0));
    ws.forEach((q, i) => { q.sRank = i; });
    qualified.sort((a, b) => b.pnl - a.pnl);
    qualified.forEach((q, i) => {
      q.pRank = i;
      if (q.sRank == null) q.sRank = qualified.length;
    });
    qualified.sort((a, b) => {
      const aR = (a.pRank ?? 0) * 0.5 + (a.sRank ?? 0) * 0.5;
      const bR = (b.pRank ?? 0) * 0.5 + (b.sRank ?? 0) * 0.5;
      return aR - bR;
    });

    const whales = qualified.slice(0, 15);

    // 5. Fetch positions for each whale
    const positions: Array<{
      addr: string; coin: string; side: string; lev: string;
      not: number; entry: number; upnl: number; liq: number | null;
    }> = [];
    const whaleByCoin: Record<string, { l: number; s: number; n: number }> = {};
    let totalLong = 0, totalShort = 0;

    for (const w of whales) {
      try {
        const st = await hlPost({ type: 'clearinghouseState', user: w.addr });
        if (st?.assetPositions) {
          w.posCount = st.assetPositions.length;
          w.av = parseFloat(st.marginSummary?.accountValue || String(w.av));
          for (const ap of st.assetPositions) {
            const pos = ap.position;
            if (!pos) continue;
            const sz = parseFloat(pos.szi);
            if (Math.abs(sz) < 0.001) continue;
            const mp = parseFloat(pos.entryPx);
            const not = Math.abs(sz) * mp;
            const side = sz > 0 ? 'LONG' : 'SHORT';
            const upnl = parseFloat(pos.unrealizedPnl || '0');
            if (side === 'LONG') totalLong += not; else totalShort += not;
            if (!whaleByCoin[pos.coin]) whaleByCoin[pos.coin] = { l: 0, s: 0, n: 0 };
            whaleByCoin[pos.coin].n++;
            if (side === 'LONG') whaleByCoin[pos.coin].l += not; else whaleByCoin[pos.coin].s += not;
            positions.push({
              addr: w.addr, coin: pos.coin, side, lev: pos.leverage?.value ?? '?',
              not, entry: parseFloat(pos.entryPx), upnl,
              liq: pos.liquidationPx ? parseFloat(pos.liquidationPx) : null,
            });
          }
        }
      } catch { /* skip */ }
      await sleep(80);
    }

    positions.sort((a, b) => b.not - a.not);

    return NextResponse.json(
      { whales, positions, whaleByCoin, totalLong, totalShort, timestamp: Date.now() },
      { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=300' } }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
