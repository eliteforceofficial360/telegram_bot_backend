import fetch from 'node-fetch';

/**
 * Send Telegram Bot notifications for Market task events
 */
export async function sendMarketNotification({ telegramId, botToken, type, title, reward, workers, budget, reason, status }) {
  if (!botToken || !telegramId) return;

  let text = '';
  switch (type) {
    case 'TASK_CREATED':
      text = `✅ *Task Created Successfully*\n\n📌 *Task:* ${title}\n💰 *Reward:* ${reward} EFC\n👥 *Workers:* ${workers}\n💵 *Escrow Budget:* ${budget} EFC\n⏳ *Status:* Pending Moderation Review`;
      break;
    case 'TASK_LIVE':
      text = `🚀 *Your Campaign is Live!*\n\n📌 *Task:* ${title}\nWorkers can now start completing your task.`;
      break;
    case 'TASK_PAUSED':
      text = `⏸ *Campaign Paused*\n\n📌 *Task:* ${title}\nNo new submissions will be accepted until resumed.`;
      break;
    case 'TASK_EXPIRED':
      text = `⌛ *Campaign Expired*\n\n📌 *Task:* ${title}\nUnused escrow balance has been refunded to your account.`;
      break;
    case 'TASK_COMPLETED':
      text = `🎉 *Campaign Completed!*\n\n📌 *Task:* ${title}\nAll ${workers} slots have been fulfilled.`;
      break;
    case 'WORKER_SUBMITTED':
      text = `🔍 *Verification Started*\n\nYour submission for "*${title}*" has been received and is pending review.`;
      break;
    case 'WORKER_APPROVED':
      text = `✅ *Task Approved!*\n\n🎁 You earned *+${reward} EFC* for completing "*${title}*".`;
      break;
    case 'WORKER_REJECTED':
      text = `❌ *Submission Rejected*\n\nTask: "*${title}*"\nReason: ${reason || 'Proof requirements not met.'}`;
      break;
    default:
      text = `📢 *Market Notification*\n\n${title}`;
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('[MarketNotifications] Failed to send Telegram notification:', err.message);
  }
}
