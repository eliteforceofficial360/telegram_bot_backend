/**
 * notificationService.ts
 * Sends push notifications to users via the Elite Force Bot HTTP API.
 *
 * The bot server must be running (backend/bot.js) and the Bot API URL
 * must be configured in Admin → Settings → Bot API URL.
 */

const DEFAULT_SECRET = 'elite_force_secret_2024';

interface NotifyResult {
  ok: boolean;
  sent?: number;
  failed?: number;
  error?: string;
}

async function postToApi(
  botApiUrl: string,
  endpoint: string,
  body: object,
  secret = DEFAULT_SECRET
): Promise<NotifyResult> {
  if (!botApiUrl) return { ok: false, error: 'Bot API URL not configured in Admin Settings.' };

  const url = botApiUrl.replace(/\/$/, '') + endpoint;
  
  // List of candidate secrets to try
  const secrets = [
    secret,
    'https://elite-force-telegram-app.onrender.com',
    'elite_force_secret_2024'
  ];

  let res: Response | null = null;
  let lastErrorMsg = '';

  for (const s of secrets) {
    if (!s) continue;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${s}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        continue;
      }

      break;
    } catch (err: any) {
      lastErrorMsg = err.message;
    }
  }

  if (!res) {
    return { ok: false, error: lastErrorMsg || 'Network error' };
  }

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, ...data };
}

/**
 * Send a custom message to a single user's Telegram.
 */
export const sendMessageToUser = (
  botApiUrl: string,
  telegramId: number,
  message: string,
  secret?: string,
  imageUrl?: string,
  btnText?: string,
  btnUrl?: string
): Promise<NotifyResult> =>
  postToApi(botApiUrl, '/notify/message', { telegramId, message, imageUrl, btnText, btnUrl }, secret);

/**
 * Broadcast an announcement to all supplied Telegram IDs.
 */
export const sendAnnouncement = (
  botApiUrl: string,
  message: string,
  telegramIds: number[],
  secret?: string,
  imageUrl?: string,
  btnText?: string,
  btnUrl?: string
): Promise<NotifyResult> =>
  postToApi(botApiUrl, '/notify/announcement', { message, telegramIds, imageUrl, btnText, btnUrl }, secret);

/**
 * Notify a user about their withdrawal status (Approved / Rejected / Banned).
 */
export const sendWithdrawNotification = (
  botApiUrl: string,
  telegramId: number,
  status: 'Approved' | 'Rejected' | 'Banned',
  amount: number,
  asset: 'usdt' | 'token',
  adminNote = '',
  secret?: string
): Promise<NotifyResult> =>
  postToApi(botApiUrl, '/notify/withdraw', { telegramId, status, amount, asset, adminNote }, secret);

/**
 * Notify a referrer that their referral just started mining.
 */
export const sendReferralNotification = (
  botApiUrl: string,
  referrerId: number,
  refereeName: string,
  refereeUsername: string,
  secret?: string
): Promise<NotifyResult> =>
  postToApi(botApiUrl, '/notify/referral', { referrerId, refereeName, refereeUsername }, secret);
