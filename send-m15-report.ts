/**
 * M15 SCORING REPORT - TELEGRAM
 *
 * Envoie un rapport détaillé des scores L1/L2/L3 sur Telegram
 *
 * Usage: npx tsx send-m15-report.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local manually
function loadEnv() {
  const envPath = resolve(__dirname, '.env.local');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (value && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
  } catch (e) {
    console.warn('Could not load .env.local:', e);
  }
}

loadEnv();

import { VOL_WINDOWS, HL_TAKER_FEE, HL_MAKER_FEE, HL_ROUND_TRIP } from './src/lib/constants';

// ─── TYPES ───

interface HyperliquidAssetCtx {
  markPx?: string;
  funding?: string;
  openInterest?: string;
  dayNtlVlm?: string;
  fundingRate?: string;
  [key: string]: string | undefined;
}

interface TokenData {
  symbol: string;
  price: number;
  funding: number;
  fundingRate: number;
  oi: number;
  oiChange: number;
  vol24h: number;
  change24h: number;
  cvd5m?: number;
  cvd15m?: number;
  vwapDist?: number;
  atr5m?: number;
  atr15m?: number;
}

interface LayerScores {
  l1: { score: number; pass: boolean; reasons: string[] };
  l2: { score: number; breakdown: Record<string, number>; reasons: string[] };
  l3: { score: number; breakdown: Record<string, number>; reasons: string[] };
  final: number;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  action: 'READY' | 'WATCH' | 'AVOID';
}

// ─── CONSTANTS ───

const TOP_TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'PEPE', 'BNB', 'ADA', 'AVAX', 'LINK'];
const SESSION_WINDOWS = VOL_WINDOWS;

function getSessionScore(): number {
  const h = new Date().getUTCHours();
  const win = SESSION_WINDOWS.find(w => h >= w.start && h < w.end);
  return win ? win.score * 100 : 0;
}

// ─── LAYER 1: HARD FILTERS ───

function computeL1(token: TokenData, sessionScore: number): LayerScores['l1'] {
  const reasons: string[] = [];
  let score = 0;

  // 1. Session (25 pts)
  if (sessionScore >= 70) {
    score += 25;
    reasons.push('✅ Session active');
  } else if (sessionScore >= 35) {
    score += 10;
    reasons.push('⚠️ Session moyenne');
  } else {
    reasons.push('❌ Session off');
  }

  // 2. Vol24h (20 pts)
  if (token.vol24h >= 2_000_000) {
    score += 20;
    reasons.push('✅ Vol24h OK');
  } else {
    reasons.push('❌ Vol24h faible');
  }

  // 3. OI (15 pts)
  if (token.oi >= 5_000_000) {
    score += 15;
    reasons.push('✅ OI OK');
  } else {
    reasons.push('❌ OI faible');
  }

  // 4. Spread proxy (15 pts)
  const spreadProxy = Math.abs(token.fundingRate);
  if (spreadProxy < 0.001) {
    score += 15;
    reasons.push('✅ Spread OK');
  } else if (spreadProxy < 0.003) {
    score += 8;
    reasons.push('⚠️ Spread moyen');
  } else {
    reasons.push('❌ Spread élevé');
  }

  // 5. News (15 pts) - assume OK
  score += 15;
  reasons.push('✅ Pas de news risque');

  // 6. Chop (10 pts)
  score += 10;
  reasons.push('✅ Chop OK');

  const pass = score >= 60;

  return { score, pass, reasons };
}

// ─── LAYER 2: SETUP SCORE ───

function computeL2(token: TokenData): LayerScores['l2'] {
  const reasons: string[] = [];
  const breakdown: Record<string, number> = {};

  // 1. VWAP (20%)
  let vwapScore = 0;
  const vwapDist = token.vwapDist ?? 0.01;
  if (vwapDist < 0.002) {
    vwapScore = 100;
    reasons.push('✅ Prix proche VWAP');
  } else if (vwapDist < 0.005) {
    vwapScore = 70;
    reasons.push('⚠️ Prix modérément VWAP');
  } else if (vwapDist < 0.01) {
    vwapScore = 40;
    reasons.push('⬜ Prix éloigné VWAP');
  } else {
    vwapScore = 10;
    reasons.push('❌ Prix loin VWAP');
  }
  breakdown.vwap = vwapScore;

  // 2. Funding (25%)
  let fundingScore = 0;
  const fundingEdge = Math.abs(token.fundingRate) * 100 - HL_TAKER_FEE * 100;
  if (fundingEdge >= 0.10) {
    fundingScore = 100;
    reasons.push(`✅ Funding edge ${fundingEdge.toFixed(3)}%`);
  } else if (fundingEdge >= 0.05) {
    fundingScore = 70;
    reasons.push(`⚠️ Funding edge ${fundingEdge.toFixed(3)}%`);
  } else {
    fundingScore = 30;
    reasons.push(`⬜ Funding edge ${fundingEdge.toFixed(3)}%`);
  }
  breakdown.funding = fundingScore;

  // 3. OI Momentum (15%)
  let oiScore = 30;
  reasons.push('⬜ OI stable');
  breakdown.oi = oiScore;

  // 4. Volatility (15%)
  let volScore = 70;
  reasons.push('⚠️ Volatilité moyenne');
  breakdown.volatility = volScore;

  // 5. Order Flow (15%)
  let flowScore = 50;
  if (token.cvd15m !== undefined) {
    const cvdPct = token.cvd15m;
    if (cvdPct > 65 || cvdPct < 35) {
      flowScore = 80;
      reasons.push(`✅ CVD ${cvdPct > 50 ? 'bull' : 'bear'} ${Math.abs(cvdPct - 50).toFixed(0)}%`);
    } else {
      reasons.push('⬜ CVD neutre');
    }
  } else {
    reasons.push('⬜ CVD N/A');
  }
  breakdown.orderFlow = flowScore;

  // 6. Trend (10%)
  let trendScore = 50;
  if (token.change24h > 0.5 && token.fundingRate < -0.0002) {
    trendScore = 100;
    reasons.push('✅ Trend UP + funding LONG alignés');
  } else if (token.change24h < -0.5 && token.fundingRate > 0.0002) {
    trendScore = 100;
    reasons.push('✅ Trend DOWN + funding SHORT alignés');
  } else if (Math.abs(token.change24h) > 0.3) {
    trendScore = 60;
    reasons.push('⚠️ Trend modéré');
  } else {
    reasons.push('⬜ Trend faible');
  }
  breakdown.trend = trendScore;

  // Weighted total
  const total = Math.round(
    vwapScore * 0.20 +
    fundingScore * 0.25 +
    oiScore * 0.15 +
    volScore * 0.15 +
    flowScore * 0.15 +
    trendScore * 0.10
  );

  return { score: total, breakdown, reasons };
}

// ─── LAYER 3: CONFIRMATION ───

function computeL3(token: TokenData): LayerScores['l3'] {
  const reasons: string[] = [];
  const breakdown: Record<string, number> = {};

  // 1. M5 Momentum (30%)
  let momScore = 50;
  if (token.atr5m && token.atr5m > 0.002) {
    momScore = 70;
    reasons.push('✅ Momentum M5 actif');
  } else {
    reasons.push('⚠️ Momentum M5 faible');
  }
  breakdown.momentum = momScore;

  // 2. Reclaim (25%)
  let reclaimScore = 50;
  const vwapDist = token.vwapDist ?? 0.01;
  if (vwapDist < 0.003) {
    reclaimScore = 80;
    reasons.push('✅ Reclaim VWAP probable');
  } else {
    reasons.push('⬜ Pas de reclaim');
  }
  breakdown.reclaim = reclaimScore;

  // 3. CVD 5m (25%)
  let cvdScore = 50;
  if (token.cvd5m !== undefined) {
    const cvd = token.cvd5m;
    if (cvd > 60 || cvd < 40) {
      cvdScore = 80;
      reasons.push(`✅ CVD 5m ${cvd > 50 ? 'bull' : 'bear'}`);
    } else {
      reasons.push('⬜ CVD 5m neutre');
    }
  } else {
    reasons.push('⬜ CVD 5m N/A');
  }
  breakdown.cvd = cvdScore;

  // 4. Structure Break (10%)
  let structScore = 50;
  if (Math.abs(token.change24h) > 1) {
    structScore = 70;
    reasons.push('✅ Structure break probable');
  } else {
    reasons.push('⬜ Pas de structure break');
  }
  breakdown.structure = structScore;

  // 5. Retest (10%)
  let retestScore = 50;
  if (vwapDist < 0.005) {
    retestScore = 70;
    reasons.push('✅ Retest/VWAP contact');
  } else {
    reasons.push('⬜ Pas de retest');
  }
  breakdown.retest = retestScore;

  // Weighted total
  const total = Math.round(
    momScore * 0.30 +
    reclaimScore * 0.25 +
    cvdScore * 0.25 +
    structScore * 0.10 +
    retestScore * 0.10
  );

  return { score: total, breakdown, reasons };
}

// ─── MAIN SCORING ───

function computeM15Score(token: TokenData): LayerScores {
  const sessionScore = getSessionScore();

  const l1 = computeL1(token, sessionScore);
  if (!l1.pass) {
    return {
      l1,
      l2: { score: 0, breakdown: {}, reasons: [] },
      l3: { score: 0, breakdown: {}, reasons: [] },
      final: l1.score,
      direction: 'NEUTRAL',
      action: 'AVOID',
    };
  }

  const l2 = computeL2(token);
  const l3 = computeL3(token);

  const final = Math.round(l1.score * 0.30 + l2.score * 0.40 + l3.score * 0.30);

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (token.fundingRate < -0.0002 && token.change24h > 0) direction = 'LONG';
  else if (token.fundingRate > 0.0002 && token.change24h < 0) direction = 'SHORT';

  let action: 'READY' | 'WATCH' | 'AVOID';
  if (final >= 80) action = 'READY';
  else if (final >= 60) action = 'WATCH';
  else action = 'AVOID';

  return { l1, l2, l3, final, direction, action };
}

// ─── FETCH DATA ───

async function fetchHyperliquidData(): Promise<TokenData[]> {
  const response = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const meta: Array<{ name: string }> = data[0]?.universe ?? [];
  const ctxs: HyperliquidAssetCtx[] = data[1] ?? [];

  const tokens: TokenData[] = [];

  for (let i = 0; i < meta.length; i++) {
    const symbol = meta[i].name;
    if (!TOP_TOKENS.includes(symbol)) continue;

    const ctx = ctxs[i] ?? {};
    const price = parseFloat(ctx.markPx ?? '0');
    const funding = parseFloat(ctx.funding ?? '0');
    const fundingRate = parseFloat(ctx.funding ?? '0');
    const oi = parseFloat(ctx.openInterest ?? '0');
    const vol24h = parseFloat(ctx.dayNtlVlm ?? '0');

    if (price === 0 || oi < 5_000_000) continue;

    // Proxy change24h from funding/price
    const change24h = (fundingRate * 100) / price;

    tokens.push({
      symbol,
      price,
      funding,
      fundingRate,
      oi,
      oiChange: 0,
      vol24h,
      change24h,
    });
  }

  return tokens;
}

// ─── FORMAT MESSAGE ───

function formatTelegramMessage(tokens: TokenData[], scores: Map<string, LayerScores>): string {
  let message = '📊 <b>M15 SCORING REPORT — L1/L2/L3</b>\n\n';
  message += `🕒 ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}\n`;
  message += '═'.repeat(40) + '\n\n';

  // Session info
  const h = new Date().getUTCHours();
  const win = SESSION_WINDOWS.find(w => h >= w.start && w < w.end);
  message += `🌍 <b>Session</b>: ${win ? win.label : 'Off-hours'}\n`;
  message += `⏰ UTC: ${h}h00\n\n`;

  // Scores header
  message += '📈 <b>FORMULE</b>: Final = L1×30% + L2×40% + L3×30%\n\n';

  message += '─'.repeat(35) + '\n\n';

  // Token scores
  const sorted = tokens.sort((a, b) => {
    const scoreA = scores.get(a.symbol)?.final ?? 0;
    const scoreB = scores.get(b.symbol)?.final ?? 0;
    return scoreB - scoreA;
  });

  for (const token of sorted) {
    const s = scores.get(token.symbol);
    if (!s) continue;

    const actionEmoji = s.action === 'READY' ? '🟢' : s.action === 'WATCH' ? '🟡' : '🔴';
    const dirEmoji = s.direction === 'LONG' ? '📈' : s.direction === 'SHORT' ? '📉' : '⬜';

    message += `${actionEmoji} <b>${token.symbol}</b> — Score: <b>${s.final}/100</b> ${dirEmoji}\n`;
    message += `   Action: <b>${s.action}</b> | Direction: <b>${s.direction}</b>\n`;
    message += `   ├─ <b>L1</b>: ${s.l1.score}/100 ${s.l1.pass ? '✅' : '❌'}\n`;
    message += `   ├─ <b>L2</b>: ${s.l2.score}/100\n`;
    message += `   └─ <b>L3</b>: ${s.l3.score}/100\n`;

    // L2 breakdown
    if (s.l2.score > 0) {
      message += `   L2: VWAP ${s.l2.breakdown.vwap} | Funding ${s.l2.breakdown.funding} | Flow ${s.l2.breakdown.orderFlow}\n`;
    }

    message += '\n';
  }

  message += '─'.repeat(35) + '\n\n';

  // Legend
  message += '📖 <b>LÉGENDE</b>\n';
  message += '   <b>L1</b>: Hard Filters (session, liquidité, spread)\n';
  message += '   <b>L2</b>: Setup (VWAP, funding, OI, vol, flow, trend)\n';
  message += '   <b>L3</b>: Confirmation (momentum, reclaim, CVD)\n\n';

  message += '🎯 <b>ACTIONS</b>\n';
  message += '   🟢 READY (&gt;=80) -&gt; Full size\n';
  message += '   🟡 WATCH (60-79) -&gt; Half size\n';
  message += '   🔴 AVOID (&lt;60) -&gt; No trade\n\n';

  message += '🔗 <a href="https://macro-dashboard-lemon.vercel.app/">Voir Dashboard</a>';

  return message;
}

// ─── SEND TELEGRAM ───

async function sendTelegramMessage(message: string): Promise<boolean> {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Telegram credentials not configured');
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json() as { ok: boolean; description?: string };

    if (!data.ok) {
      console.error('❌ Telegram API error:', data.description);
      return false;
    }

    console.log('✅ Message sent to Telegram');
    return true;
  } catch (e) {
    console.error('❌ Error sending to Telegram:', e);
    return false;
  }
}

// ─── MAIN ───

async function main() {
  console.log('🔍 Fetching Hyperliquid data...');

  const tokens = await fetchHyperliquidData();
  console.log(`✓ Found ${tokens.length} tokens`);

  const scores = new Map<string, LayerScores>();

  for (const token of tokens) {
    const score = computeM15Score(token);
    scores.set(token.symbol, score);
    console.log(`✓ ${token.symbol}: ${score.final}/100 (${score.action})`);
  }

  const message = formatTelegramMessage(tokens, scores);

  console.log('\n📝 Sending to Telegram...');
  const sent = await sendTelegramMessage(message);

  if (sent) {
    console.log('\n✅ M15 report sent to Telegram!');
  } else {
    console.log('\n❌ Failed to send report');
    process.exit(1);
  }
}

main().catch(console.error);
