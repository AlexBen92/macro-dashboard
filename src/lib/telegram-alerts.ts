/**
 * TELEGRAM ALERTS - M15 Scoring
 * Send token scores and alerts to Telegram
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

export interface TelegramAlert {
  symbol: string;
  finalScore: number;
  action: 'READY' | 'WATCH' | 'AVOID';
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence?: {
    l1: number;
    l2: number;
    l3: number;
    global: number;
  };
  layer1: { score: number; reasons: string[] };
  layer2: { total: number; reasons: string[] };
  layer3: { total: number; reasons: string[] };
  price: number;
  funding: number;
  cvd15m?: number;
  oiChange?: number;
}

/**
 * Format alert message for Telegram
 */
export function formatAlertMessage(alert: TelegramAlert): string {
  const emoji = alert.action === 'READY' ? '🟢' : alert.action === 'WATCH' ? '🟡' : '🔴';
  const dirEmoji = alert.direction === 'LONG' ? '📈' : alert.direction === 'SHORT' ? '📉' : '➡️';

  let message = `${emoji} *${alert.symbol}* - ${alert.action} ${dirEmoji}\n`;
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `*Score:* ${alert.finalScore}/100\n`;
  message += `*Direction:* ${alert.direction}\n`;

  if (alert.confidence) {
    const confEmoji = alert.confidence.global >= 70 ? '✅' : alert.confidence.global >= 50 ? '⚠️' : '❌';
    message += `*Confidence:* ${confEmoji} ${alert.confidence.global}%\n`;
    message += `  ├─ L1: ${alert.confidence.l1}%\n`;
    message += `  ├─ L2: ${alert.confidence.l2}%\n`;
    message += `  └─ L3: ${alert.confidence.l3}%\n`;
  }

  message += `\n*Layer Scores:*\n`;
  message += `  L1 (Filters): ${alert.layer1.score}\n`;
  message += `  L2 (Setup): ${alert.layer2.total}\n`;
  message += `  L3 (Confirm): ${alert.layer3.total}\n`;

  message += `\n*Metrics:*\n`;
  message += `  Price: $${alert.price < 1 ? alert.price.toFixed(6) : alert.price.toFixed(2)}\n`;
  message += `  Funding: ${alert.funding > 0 ? '+' : ''}${alert.funding.toFixed(4)}%\n`;
  if (alert.cvd15m !== undefined) message += `  CVD 15m: ${alert.cvd15m.toFixed(0)}%\n`;
  if (alert.oiChange !== undefined) message += `  OI Change: ${(alert.oiChange * 100).toFixed(1)}%\n`;

  message += `\n*Reasons:*\n`;
  const allReasons = [...alert.layer1.reasons.slice(0, 2), ...alert.layer2.reasons.slice(0, 2), ...alert.layer3.reasons.slice(0, 2)];
  allReasons.forEach(r => message += `  ${r}\n`);

  return message;
}

/**
 * Send alert to Telegram
 */
export async function sendTelegramAlert(alert: TelegramAlert): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('[Telegram] Missing credentials');
    return false;
  }

  const message = formatAlertMessage(alert);

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram API: ${response.status}`);
    }

    const data = await response.json();
    console.log('[Telegram] Alert sent:', data.result?.message_id);
    return true;
  } catch (err) {
    console.error('[Telegram] Send error:', err);
    return false;
  }
}

/**
 * Send batch alerts for multiple tokens
 */
export async function sendBatchAlerts(alerts: TelegramAlert[]): Promise<number> {
  // Only send READY and WATCH alerts
  const relevantAlerts = alerts.filter(a => a.action !== 'AVOID');

  if (relevantAlerts.length === 0) {
    console.log('[Telegram] No relevant alerts to send');
    return 0;
  }

  let sent = 0;
  for (const alert of relevantAlerts) {
    const success = await sendTelegramAlert(alert);
    if (success) sent++;
    await new Promise(r => setTimeout(r, 500)); // Rate limit: 1 msg per 500ms
  }

  return sent;
}

/**
 * Send summary of all tokens
 */
export async function sendSummaryAlert(tokens: TelegramAlert[]): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('[Telegram] Missing credentials');
    return false;
  }

  const ready = tokens.filter(t => t.action === 'READY');
  const watch = tokens.filter(t => t.action === 'WATCH');

  let message = `📊 *M15 Token Scanner - Summary*\n`;
  message += `━━━━━━━━━━━━━━━━━━\n`;
  message += `🟢 *READY (${ready.length}):*\n`;
  ready.slice(0, 5).forEach(t => {
    message += `  ${t.symbol}: ${t.finalScore} (${t.direction}) ${t.confidence ? `C:${t.confidence.global}%` : ''}\n`;
  });

  if (watch.length > 0) {
    message += `\n🟡 *WATCH (${watch.length}):*\n`;
    watch.slice(0, 3).forEach(t => {
      message += `  ${t.symbol}: ${t.finalScore} (${t.direction})\n`;
    });
  }

  message += `\n🕐 ${new Date().toISOString()}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    return response.ok;
  } catch (err) {
    console.error('[Telegram] Summary error:', err);
    return false;
  }
}
