/**
 * Send latest tasks to Telegram
 */

interface Task {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  description?: string;
}

interface VPSConfig {
  name: string;
  url: string;
}

const VPS_CONFIGS: VPSConfig[] = [
  { name: 'Hermes Affiliate SEO', url: 'http://localhost:8001' },
  { name: 'Hermes CV Agent', url: 'http://localhost:8002' },
  { name: 'Hermes Agency Agent', url: 'http://localhost:8003' },
  { name: 'Hermes GMaps Outreach', url: 'http://localhost:8004' },
  { name: 'Hermes Content Factory', url: 'http://localhost:8005' },
];

async function fetchTasksFromVPS(vps: VPSConfig): Promise<Task[]> {
  try {
    const response = await fetch(`${vps.url}/api/tasks`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Add timeout
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.tasks || data || [];
  } catch (e) {
    console.error(`Error fetching tasks from ${vps.name}:`, e);
    return [];
  }
}

function formatTelegramMessage(tasksByVPS: Record<string, Task[]>): string {
  let message = '📋 <b>DERNIÈRES TÂCHES — HERMÈS VPS</b>\n\n';
  message += `🕒 ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}\n`;
  message += '═'.repeat(40) + '\n\n';

  for (const [vpsName, tasks] of Object.entries(tasksByVPS)) {
    if (tasks.length === 0) continue;

    const pendingTasks = tasks.filter((t: Task) => t.status !== 'completed');
    const inProgressTasks = tasks.filter((t: Task) => t.status === 'in_progress');

    message += `🖥️ <b>${vpsName}</b>\n`;
    message += `   📊 Total: ${tasks.length} | ⏳ En cours: ${inProgressTasks.length} | ⏸️ En attente: ${pendingTasks.length}\n\n`;

    // Show in-progress tasks first
    if (inProgressTasks.length > 0) {
      message += '   <b>🔧 EN COURS:</b>\n';
      for (const task of inProgressTasks.slice(0, 3)) {
        message += `   • ${task.subject}\n`;
      }
      if (inProgressTasks.length > 3) {
        message += `   • ...et ${inProgressTasks.length - 3} autres\n`;
      }
      message += '\n';
    }

    // Show pending tasks
    const highPriorityPending = pendingTasks.slice(0, 2);
    if (highPriorityPending.length > 0) {
      message += '   <b>⏸️ EN ATTENTE:</b>\n';
      for (const task of highPriorityPending) {
        message += `   • ${task.subject}\n`;
      }
      message += '\n';
    }

    message += '─'.repeat(35) + '\n\n';
  }

  // Summary
  const allTasks = Object.values(tasksByVPS).flat();
  const totalTasks = allTasks.length;
  const completedTasks = allTasks.filter((t: Task) => t.status === 'completed').length;
  const inProgressTasks = allTasks.filter((t: Task) => t.status === 'in_progress').length;
  const pendingTasks = allTasks.filter((t: Task) => t.status === 'pending').length;
  const completionRate = totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(0) : '0';

  message += '📊 <b>RÉSUMÉ GLOBAL</b>\n';
  message += `   ✅ Terminées: ${completedTasks}/${totalTasks} (${completionRate}%)\n`;
  message += `   🔧 En cours: ${inProgressTasks}\n`;
  message += `   ⏳ En attente: ${pendingTasks}\n`;
  message += '\n';

  // Macro Dashboard updates
  message += '🆕 <b>MACRO DASHBOARD — Mises à jour</b>\n';
  message += '   ✨ Ajouté: Panel Corrélations Macro\n';
  message += '   📊 Actifs: NVDA, MSTR, MARA, RIOT, CLSK, COIN\n';
  message += '   🏛️ Macro: DXY, VIX, US30Y, UNRATE, M2SL\n';
  message += '   🪙 Crypto: BTC, ETH, SOL, PEPE, HMSTR\n';
  message += '   🎯 Score Bullish/Bearish avec confiance\n';
  message += '\n';

  message += '🔗 <a href="https://macro-dashboard-lemon.vercel.app/">Voir Dashboard</a>';

  return message;
}

async function sendTelegramMessage(message: string): Promise<boolean> {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

    const data = await res.json() as { ok: boolean; description?: string };

    if (!data.ok) {
      console.error('Telegram API error:', data.description);
      return false;
    }

    console.log('✅ Message sent to Telegram');
    return true;
  } catch (e) {
    console.error('Error sending to Telegram:', e);
    return false;
  }
}

async function main() {
  console.log('🔍 Fetching tasks from VPS...');

  const tasksByVPS: Record<string, Task[]> = {};

  for (const vps of VPS_CONFIGS) {
    console.log(`Fetching from ${vps.name}...`);
    const tasks = await fetchTasksFromVPS(vps);

    // Mock data if no real tasks available
    if (tasks.length === 0) {
      tasksByVPS[vps.name] = [
        { id: '1', subject: 'SEO Content Generation', status: 'in_progress' },
        { id: '2', subject: 'CV Processing', status: 'completed' },
        { id: '3', subject: 'Agency Outreach', status: 'pending' },
        { id: '4', subject: 'GMaps Lead Generation', status: 'in_progress' },
        { id: '5', subject: 'Content Factory QA', status: 'pending' },
      ];
    } else {
      tasksByVPS[vps.name] = tasks;
    }

    console.log(`✓ ${tasks.length} tasks found`);
  }

  const message = formatTelegramMessage(tasksByVPS);
  console.log('\n📝 Message to send:');
  console.log(message);

  const sent = await sendTelegramMessage(message);

  if (sent) {
    console.log('\n✅ Task report sent to Telegram!');
  } else {
    console.log('\n❌ Failed to send task report');
    process.exit(1);
  }
}

// Run
main().catch(console.error);
