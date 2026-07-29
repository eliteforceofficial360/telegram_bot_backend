import { bot } from './bot.js';

/**
 * Reusable function to send Telegram notifications
 * @param {number|string} chatId - User's Telegram ID
 * @param {string} message - Notification content (HTML allowed)
 * @param {object} options - Extra telegraf options
 */
export async function notifyUser(chatId, message, options = {}) {
  if (!chatId) return;
  
  try {
    await bot.telegram.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      ...options,
    });
    console.log(`Notification sent successfully to ${chatId}`);
  } catch (err) {
    console.error(`Telegram notify failed for chat_id ${chatId}:`, err.message);
    // Future: Handle blocked bot errors or log to DB
  }
}
