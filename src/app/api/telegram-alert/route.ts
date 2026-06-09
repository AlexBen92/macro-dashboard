import { NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

interface M15Alert {
  type: 'WINDOW_OPEN' | 'STRONG_SIGNAL' | 'EDGE_CROSSING';
  data: {
    timestamp: string;
    session?: string;
    symbol?: string;
    signalType?: 'STRONG_LONG' | 'STRONG_SHORT' | 'LONG' | 'SHORT';
    signalStrength?: number;
    edgeNet?: number;
    price?: number;
    slDist?: number;
    tp1?: number;
    tp2?: number;
  };
}

function formatTelegramMessage(alert: M15Alert): string {
  const emoji = {
    WINDOW_OPEN: '⏰',
    STRONG_SIGNAL: alert.data.signalType === 'STRONG_LONG' ? '🚀' : '💥',
    EDGE_CROSSING: '📊',
  };

  let message = `${emoji[alert.type]} <b>`;

  if (alert.type === 'WINDOW_OPEN') {
    message += `FENÊTRE ACTIVE</b>\n\n`;
    message += `📍 Session: ${alert.data.session}\n`;
    message += `⏰ Heure UTC: ${new Date(alert.data.timestamp).getUTCHours()}h\n`;
    message += `✅ <i>Prêt à scanner les setups M15</i>\n`;
  } else if (alert.type === 'STRONG_SIGNAL') {
    message += `SIGNAL M15 ${alert.data.signalType}</b>\n\n`;
    message += `🪙 ${alert.data.symbol}\n`;
    message += `💪 Force: ${alert.data.signalStrength}/100\n`;
    message += `💰 Edge Net: ${(alert.data.edgeNet! * 100).toFixed(3)}%\n`;
    message += `💵 Prix: $${alert.data.price?.toFixed(2)}\n\n`;
    message += `📊 <i>Risk Management:</i>\n`;
    message += `🔴 SL: ${alert.data.slDist?.toFixed(2)}%\n`;
    message += `🟢 TP1: ${alert.data.tp1?.toFixed(2)}% (1R)\n`;
    message += `🟢 TP2: ${alert.data.tp2?.toFixed(2)}% (2R)\n`;
  }

  message += `\n🔗 <a href="https://macro-dashboard-lemon.vercel.app/">Voir Dashboard</a>`;
  return message;
}

async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram credentials not configured');
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
    const data = await res.json() as { ok: boolean };
    return data.ok;
  } catch (e) {
    console.error('Telegram API error:', e);
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const alert = (await req.json()) as M15Alert;
    const message = formatTelegramMessage(alert);
    const sent = await sendTelegramMessage(message);

    return NextResponse.json({ success: sent, message: sent ? 'Alert sent' : 'Failed to send' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// Health check
export async function GET() {
  const configured = !!(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID);
  return NextResponse.json({
    status: configured ? 'configured' : 'not_configured',
    message: configured
      ? 'Telegram alerts are ready'
      : 'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars',
  });
}
