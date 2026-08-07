import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import http from 'http';
import crypto from 'crypto';
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  getUploadFolder,
  getCloudinaryStatus,
} from './uploadService.js';
import { db, FieldValue } from './firebaseAdmin.js';
import {
  verifyXTask,
  runXPeriodicMonitoring,
} from './xVerificationEngine.js';
import { sendMarketNotification } from './marketNotifications.js';

dotenv.config();

// ── Required env vars — validate BOT_TOKEN ──────────────────────────────────
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('❌ FATAL: BOT_TOKEN env var is not set. The bot cannot start without it.');
  process.exit(1);
}

const BASE_APP_URL = 'https://elite-force-844d0.web.app';
let webAppUrlRaw = (process.env.MINI_APP_URL || BASE_APP_URL).trim();
const webAppUrl = webAppUrlRaw.includes('firebaseapp.com') || webAppUrlRaw.includes('web.app') || webAppUrlRaw.includes('localhost') ? (webAppUrlRaw.endsWith('/') ? webAppUrlRaw.slice(0, -1) : webAppUrlRaw) : BASE_APP_URL;
const API_PORT = process.env.PORT || process.env.API_PORT || 4000;
const API_SECRET = process.env.API_SECRET || '';
if (!process.env.API_SECRET) {
  console.warn('⚠️ API_SECRET env var not set. Protected endpoints will reject all requests.');
}
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || '';
const RECAPTCHA_PROJECT_ID = process.env.RECAPTCHA_PROJECT_ID; // e.g. 'balmy-access-465013-m7'
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY;

export const bot = new Telegraf(token);

// ── Dynamic Admin Settings Cache & Firestore Real-time Listener ──────────────
let dynamicSettings = {
  miniAppUrl: webAppUrl,
  botStartMessage: '',
  botStartButtonText: '🔥 Launch Elite Force App 🔥',
  adminTelegramId: '',
};

function getEffectiveAppUrl() {
  let raw = (dynamicSettings.miniAppUrl || process.env.MINI_APP_URL || BASE_APP_URL).trim();
  if (raw.endsWith('/')) raw = raw.slice(0, -1);
  return raw;
}

/**
 * Cryptographically validates Telegram WebApp initData string using HMAC-SHA256.
 */
function validateTelegramInitData(initData) {
  if (!initData) return false;
  try {
    const urlParams = new URLSearchParams(initData);
    const hash = urlParams.get('hash');
    if (!hash) return false;
    urlParams.delete('hash');

    const dataCheckString = Array.from(urlParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${key}=${val}`)
      .join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    return calculatedHash === hash;
  } catch {
    return false;
  }
}

function getWelcomeMessage(firstName = 'Force Agent') {
  const safeName = escapeHTML(firstName);
  if (dynamicSettings.botStartMessage && dynamicSettings.botStartMessage.trim()) {
    let msg = dynamicSettings.botStartMessage;
    return msg.replace(/\{name\}/gi, safeName).replace(/\{username\}/gi, safeName);
  }

  return `🔥 <b>ELITE FORCE — EForce Token</b> 🔥

👋 Welcome, <b>${safeName}</b>!

You've just entered the <b>next-generation Web3 mining ecosystem</b>. Elite Force rewards you for every action.

━━━━━━━━━━━━━━━━━━━━
⛏️  <b>Mine</b> EForce tokens passively
✅  <b>Complete missions</b> & earn rewards
🏆  <b>Climb</b> the global leaderboard
👥  <b>Refer friends</b> and earn commissions
💸  <b>Withdraw</b> USDT to your BEP-20 wallet
━━━━━━━━━━━━━━━━━━━━

🚀 Tap the button below to launch your dashboard!`;
}

// REST API sync for Firestore admin settings (works 100% on Render without GCP Service Account / ADC credentials)
async function syncAdminSettingsFromRest() {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'elite-force-844d0';
    const res = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/adminSettings/config`
    );
    if (!res.ok) return;
    const json = await res.json();
    const fields = json.fields || {};

    if (fields.miniAppUrl?.stringValue) {
      dynamicSettings.miniAppUrl = fields.miniAppUrl.stringValue.trim();
    }
    if (fields.botStartMessage?.stringValue !== undefined) {
      dynamicSettings.botStartMessage = fields.botStartMessage.stringValue;
    }
    if (fields.botStartButtonText?.stringValue) {
      dynamicSettings.botStartButtonText = fields.botStartButtonText.stringValue.trim();
    }
    if (fields.adminTelegramId?.stringValue) {
      dynamicSettings.adminTelegramId = fields.adminTelegramId.stringValue.trim();
    }
  } catch {
    /* silent catch */
  }
}

// Initial sync & 15-second background interval
syncAdminSettingsFromRest();
setInterval(syncAdminSettingsFromRest, 15 * 1000);

// Real-time Firestore sync listener (if GCP service account is provided)
try {
  db.collection('adminSettings').doc('config').onSnapshot((snap) => {
    if (snap.exists) {
      const data = snap.data();
      if (data.miniAppUrl && typeof data.miniAppUrl === 'string' && data.miniAppUrl.trim()) {
        dynamicSettings.miniAppUrl = data.miniAppUrl.trim();
      }
      if (typeof data.botStartMessage === 'string') {
        dynamicSettings.botStartMessage = data.botStartMessage;
      }
      if (data.botStartButtonText && typeof data.botStartButtonText === 'string' && data.botStartButtonText.trim()) {
        dynamicSettings.botStartButtonText = data.botStartButtonText.trim();
      }
      if (data.adminTelegramId && (typeof data.adminTelegramId === 'string' || typeof data.adminTelegramId === 'number')) {
        dynamicSettings.adminTelegramId = String(data.adminTelegramId).trim();
      }
    }
  }, () => {
    // Suppress warning; REST API polling handles settings sync automatically
  });
} catch {
  // Suppress warning
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHTML(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Constant-time comparison for bearer tokens, avoids timing attacks. */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Uploads a base64 data URL to ImgBB and returns a hosted URL, or null on failure. */
async function uploadBase64ToImgbb(dataUrl) {
  try {
    const cleanBase64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const bodyParams = new URLSearchParams();
    bodyParams.append('key', IMGBB_API_KEY);
    bodyParams.append('image', cleanBase64);

    const imgbbRes = await fetch('https://api.imgbb.com/1/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: bodyParams.toString(),
    });

    if (!imgbbRes.ok) return null;
    const imgbbData = await imgbbRes.json();
    return imgbbData.data?.url || imgbbData.data?.display_url || null;
  } catch (err) {
    console.warn('[ImgBB] Base64 upload failed:', err.message);
    return null;
  }
}

/** Resolves any imageUrl (base64 or plain URL) to a format Telegraf sendPhoto accepts directly. */
async function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (typeof imageUrl === 'object' && (imageUrl.source || imageUrl.url)) {
    return imageUrl;
  }
  if (typeof imageUrl !== 'string') return null;
  const trimmed = imageUrl.trim();
  if (!trimmed) return null;

  // 1. If Base64 data URL -> convert directly to Node Buffer so Telegraf uploads straight to Telegram!
  if (trimmed.startsWith('data:image/')) {
    try {
      const base64Data = trimmed.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length > 0) {
        return { source: buffer };
      }
    } catch (err) {
      console.warn('[Bot] Failed to parse base64 image buffer:', err.message);
    }
  }

  // 2. Try ImgBB upload if API key is set
  if (trimmed.startsWith('data:image/') && IMGBB_API_KEY) {
    const imgbbUrl = await uploadBase64ToImgbb(trimmed);
    if (imgbbUrl) return imgbbUrl;
  }

  // 3. If HTTP/HTTPS URL -> return directly
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return null;
}

/** Send a Telegram HTML message or photo to a specific user. Returns true/false. */
async function sendToUser(telegramId, html, extra = {}, photoInput = null) {
  try {
    let finalPhoto = photoInput;
    if (typeof photoInput === 'string') {
      finalPhoto = await resolveImageUrl(photoInput);
    } else if (photoInput && typeof photoInput === 'object' && (photoInput.source || photoInput.url)) {
      finalPhoto = photoInput;
    }

    if (finalPhoto) {
      try {
        // Telegram caption limit is 1024 chars. If text is longer, send photo then a separate message.
        if (html.length > 1024) {
          await bot.telegram.sendPhoto(telegramId, finalPhoto);
          await bot.telegram.sendMessage(telegramId, html, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...extra,
          });
        } else {
          await bot.telegram.sendPhoto(telegramId, finalPhoto, {
            caption: html,
            parse_mode: 'HTML',
            ...extra,
          });
        }
        return true;
      } catch (photoErr) {
        console.warn(`[Bot] Failed to send photo to ${telegramId}:`, photoErr.message);

        // Fallback: If photo was a URL string and Telegram servers couldn't fetch it directly, download to Buffer and send!
        if (typeof finalPhoto === 'string' && (finalPhoto.startsWith('http://') || finalPhoto.startsWith('https://'))) {
          try {
            const imgRes = await fetch(finalPhoto);
            if (imgRes.ok) {
              const arrayBuf = await imgRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuf);
              if (buffer.length > 0) {
                const bufPhoto = { source: buffer };
                if (html.length > 1024) {
                  await bot.telegram.sendPhoto(telegramId, bufPhoto);
                  await bot.telegram.sendMessage(telegramId, html, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                    ...extra,
                  });
                } else {
                  await bot.telegram.sendPhoto(telegramId, bufPhoto, {
                    caption: html,
                    parse_mode: 'HTML',
                    ...extra,
                  });
                }
                return true;
              }
            }
          } catch (fetchErr) {
            console.warn(`[Bot] Buffer fallback fetch failed for ${finalPhoto}:`, fetchErr.message);
          }
        }
      }
    }

    await bot.telegram.sendMessage(telegramId, html, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra,
    });
    return true;
  } catch (err) {
    console.error(`[Bot] Failed to send to ${telegramId}:`, err.message);
    return false;
  }
}

/** Send a message/photo to a list of Telegram IDs (announcement), with pacing to avoid rate limits. */
async function broadcast(ids, html, extra = {}, imageUrl = null, delayMs = 60) {
  let sent = 0, failed = 0;
  const finalPhoto = await resolveImageUrl(imageUrl);

  for (const id of ids) {
    const ok = await sendToUser(id, html, extra, finalPhoto);
    ok ? sent++ : failed++;
    if (ids.length > 20) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { sent, failed };
}

// ── DEFAULT TELEGRAM NOTIFICATION TEMPLATES ──────────────────────────────────
const DEFAULT_NOTIFICATION_TEMPLATES = {
  SOCIAL_CONNECTED: {
    enabled: true,
    template: `✅ <b>Connection Successful</b>\n\n<b>Platform:</b>\n{platformName}\n\n<b>Username:</b>\n{handle}\n\n<b>Connected At:</b>\n{connectedAt}`,
    buttonText: 'Open Profile',
    buttonTab: 'profile',
  },
  SOCIAL_DISCONNECTED: {
    enabled: true,
    template: `⚠️ <b>{platformName} Disconnected</b>\n\nYour {platformName} account has been removed.\n\nPlatform-specific tasks are now locked until you reconnect.`,
    buttonText: 'Reconnect',
    buttonTab: 'profile',
  },
  TASK_COMPLETED: {
    enabled: true,
    template: `🎉 <b>Task Completed</b>\n\n<b>Task:</b>\n{taskTitle}\n\n<b>Reward:</b>\n+{reward} EFC{tokenRewardText}\n\n<b>New Balance:</b>\n{newBalance} EFC`,
    buttonText: 'Open Elite Force',
    buttonTab: 'tasks',
  },
  TASK_REJECTED: {
    enabled: true,
    template: `❌ <b>Task Verification Failed</b>\n\n<b>Task:</b>\n{taskTitle}\n\n<b>Reason:</b>\n• {reason}\n\nPlease complete the task again.`,
    buttonText: 'Retry',
    buttonTab: 'tasks',
  },
  CAMPAIGN_COMPLETED: {
    enabled: true,
    template: `🏆 <b>Campaign Completed</b>\n\n<b>Campaign:</b>\n{campaignTitle}\n\n<b>Completed Tasks:</b>\n{completedCount}/{totalCount}\n\n<b>Total Reward:</b>\n+{totalReward} EFC\n\nCongratulations!`,
    buttonText: 'Claim Reward',
    buttonTab: 'tasks',
  },
  MINING_COMPLETED: {
    enabled: true,
    template: `⛏ <b>Mining Completed</b>\n\n<b>Reward:</b>\n+{reward} EFC\n\nYour mining session has finished.\nClaim your reward now.`,
    buttonText: 'Claim Reward',
    buttonTab: 'home',
  },
  DAILY_REWARD: {
    enabled: true,
    template: `🎁 <b>Daily Reward Available</b>\n\nYour daily reward of +{reward} EFC is ready.\nClaim it before it expires.`,
    buttonText: 'Claim',
    buttonTab: 'home',
  },
  REFERRAL_BONUS: {
    enabled: true,
    template: `🎉 <b>Referral Reward</b>\n\nYour friend has joined.\n\n<b>Referral:</b>\n{refUsername}\n\n<b>Reward:</b>\n+{reward} EFC`,
    buttonText: 'Open App',
    buttonTab: 'friends',
  },
  WITHDRAW_APPROVED: {
    enabled: true,
    template: `✅ <b>Withdrawal Approved</b>\n\n<b>Amount:</b>\n{amount} EFC\n\n<b>Status:</b>\nCompleted`,
    buttonText: 'Open Wallet',
    buttonTab: 'wallet',
  },
  WITHDRAW_REJECTED: {
    enabled: true,
    template: `❌ <b>Withdrawal Rejected</b>\n\n<b>Amount:</b>\n{amount} EFC\n\n<b>Reason:</b>\n{reason}`,
    buttonText: 'Contact Support',
    buttonTab: 'support',
  },
  DEPOSIT_SUBMITTED: {
    enabled: true,
    template: `📥 <b>Deposit Request Submitted</b>\n\n<b>Amount:</b>\n{amountUsdt} USDT\n\n<b>EFC Bonus:</b>\n+{efcGranted} EFC\n\n<b>TxHash:</b>\n<code>{txHash}</code>\n\nYour deposit is pending verification.`,
    buttonText: 'Open Wallet',
    buttonTab: 'wallet',
  },
  DEPOSIT_APPROVED: {
    enabled: true,
    template: `✅ <b>Deposit Approved</b>\n\nYour deposit of <b>{amountUsdt} USDT</b> (+{efcGranted} EFC) has been verified and added to your balance.\n\n<b>TxHash:</b>\n<code>{txHash}</code>`,
    buttonText: 'Open Wallet',
    buttonTab: 'wallet',
  },
  DEPOSIT_REJECTED: {
    enabled: true,
    template: `❌ <b>Deposit Rejected</b>\n\nYour deposit request for <b>{amountUsdt} USDT</b> was rejected.\n\n<b>Reason:</b>\n{reason}`,
    buttonText: 'Contact Support',
    buttonTab: 'support',
  },
  MARKET_TASK_CREATED: {
    enabled: true,
    template: `📌 <b>Market Campaign Created</b>\n\n<b>Task:</b>\n{taskTitle}\n\n<b>Escrow Budget:</b>\n{budget} EFC\n\n<b>Status:</b>\nPending Moderation Review`,
    buttonText: 'Open Market',
    buttonTab: 'market',
  },
  MARKET_TASK_LIVE: {
    enabled: true,
    template: `🚀 <b>Market Campaign Live!</b>\n\n<b>Task:</b>\n{taskTitle}\n\nWorkers can now submit proofs for your campaign.`,
    buttonText: 'Open Market',
    buttonTab: 'market',
  },
  WORKER_APPROVED: {
    enabled: true,
    template: `✅ <b>Task Proof Approved!</b>\n\n<b>Task:</b>\n{taskTitle}\n\n<b>Reward:</b>\n+{reward} EFC`,
    buttonText: 'Open Market',
    buttonTab: 'market',
  },
  WORKER_REJECTED: {
    enabled: true,
    template: `❌ <b>Task Submission Rejected</b>\n\n<b>Task:</b>\n{taskTitle}\n\n<b>Reason:</b>\n{reason}`,
    buttonText: 'Open Market',
    buttonTab: 'market',
  },
  LEVEL_UP: {
    enabled: true,
    template: `⚡ <b>Level Up!</b>\n\nCongratulations! You reached <b>Level {newLevel}</b>.\n\n<b>Reward:</b>\n+{reward} EFC`,
    buttonText: 'View Profile',
    buttonTab: 'profile',
  },
  STREAK_BONUS: {
    enabled: true,
    template: `🔥 <b>Streak Milestone!</b>\n\nYou hit a <b>{streakDays}-Day</b> login streak!\n\n<b>Bonus Reward:</b>\n+{reward} EFC`,
    buttonText: 'Claim Reward',
    buttonTab: 'home',
  },
  SPIN_WIN: {
    enabled: true,
    template: `🎡 <b>Lucky Spin Winner</b>\n\nCongratulations! You won <b>+{reward} EFC</b> from the Lucky Wheel!`,
    buttonText: 'Spin Again',
    buttonTab: 'home',
  },
  PROMO_CODE_REDEEMED: {
    enabled: true,
    template: `🎟 <b>Promo Code Redeemed</b>\n\n<b>Code:</b>\n{code}\n\n<b>Reward:</b>\n+{reward} EFC`,
    buttonText: 'Open App',
    buttonTab: 'home',
  },
  PASS_PURCHASED: {
    enabled: true,
    template: `👑 <b>VIP Pass Activated</b>\n\nYour <b>{passType}</b> pass has been activated!\n\nEnjoy exclusive multipliers and features.`,
    buttonText: 'Open Profile',
    buttonTab: 'profile',
  },
  KYC_VERIFIED: {
    enabled: true,
    template: `🛡 <b>Account Verified</b>\n\nYour identity verification has been successfully approved!`,
    buttonText: 'Open Profile',
    buttonTab: 'profile',
  },
  SECURITY_ALERT: {
    enabled: true,
    template: `🔒 <b>Security Alert</b>\n\nA new login was detected.\n\n<b>Device:</b>\n{device}\n\n<b>Location:</b>\n{location}\n\n<b>Time:</b>\n{time}\n\nIf this wasn't you, contact support immediately.`,
    buttonText: 'Contact Support',
    buttonTab: 'support',
  },
  ADMIN_BROADCAST: {
    enabled: true,
    template: `📢 <b>Announcement</b>\n\n{message}`,
    buttonText: 'Open Elite Force',
    buttonTab: 'home',
  },
};

/**
 * Central Telegram Event Notification Dispatcher.
 * Validates, renders template, attaches Mini App inline button, deduplicates via eventId,
 * sends via bot.telegram, and logs history in Firestore.
 */
async function sendEventNotification({ telegramId, eventType, eventId, params = {} }) {
  if (!telegramId || !isValidTelegramId(telegramId)) return false;

  try {
    const numId = Number(telegramId);
    const dbInstance = getFirestore();

    // 1. Fetch Notification Settings
    const settingsDoc = await dbInstance.collection('adminSettings').doc('global').get();
    const notificationConfig = settingsDoc.exists ? (settingsDoc.data()?.notificationSettings || {}) : {};

    if (notificationConfig.enabled === false) {
      return false;
    }

    const eventSetting = notificationConfig.events?.[eventType] || DEFAULT_NOTIFICATION_TEMPLATES[eventType];
    if (!eventSetting || eventSetting.enabled === false) {
      return false;
    }

    // 2. Idempotency Check
    if (eventId) {
      const historyRef = dbInstance.collection('notificationHistory').doc(String(eventId));
      const historySnap = await historyRef.get();
      if (historySnap.exists) {
        console.log(`[Notification Engine] Idempotent hit: duplicate eventId ${eventId} suppressed.`);
        return false;
      }
    }

    // 3. Template Substitution
    let text = eventSetting.template || '';
    Object.keys(params).forEach((key) => {
      const regex = new RegExp(`\\{${key}\\}`, 'gi');
      text = text.replace(regex, String(params[key] || ''));
    });

    // 4. Inline Button
    const btnText = params.buttonText || eventSetting.buttonText || 'Open Elite Force';
    const btnTab = params.buttonTab || eventSetting.buttonTab || 'home';
    const appUrl = `${getEffectiveAppUrl()}?startapp=${btnTab}`;

    const extra = Markup.inlineKeyboard([
      [Markup.button.webApp(btnText, appUrl)],
    ]);

    // 5. Dispatch via Telegram Bot
    let deliveryStatus = 'failed';
    let messageId = null;

    try {
      const result = await bot.telegram.sendMessage(numId, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...extra,
      });
      deliveryStatus = 'sent';
      messageId = result.message_id;
    } catch (sendErr) {
      if (sendErr.message && sendErr.message.includes('bot was blocked by the user')) {
        deliveryStatus = 'blocked';
      } else {
        console.error(`[Notification Engine] Telegram send error for ${numId}:`, sendErr.message);
        deliveryStatus = 'failed';
      }
    }

    // 6. Record Notification History & In-App Notification Center
    const logDocId = eventId || `notif_${numId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const notifPayload = {
      userId: numId,
      telegramId: numId,
      eventType: eventType,
      eventId: eventId || logDocId,
      timestamp: new Date().toISOString(),
      deliveryStatus: deliveryStatus,
      messageId: messageId,
      content: text,
      read: false,
      params: params,
    };

    await Promise.all([
      dbInstance.collection('notificationHistory').doc(logDocId).set(notifPayload),
      dbInstance.collection('userNotifications').doc(logDocId).set(notifPayload),
    ]);

    return deliveryStatus === 'sent';
  } catch (err) {
    console.error(`[Notification Engine Fatal Error] eventType=${eventType}:`, err.message);
    return false;
  }
}

/**
 * Reads and JSON-parses a request body.
 * Enforces a 50MB body size limit to prevent memory exhaustion from large base64 payloads.
 * Throws on invalid JSON or body too large.
 */
async function readJsonBody(req, maxBytes = 50 * 1024 * 1024) {
  let raw = '';
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += Buffer.byteLength(chunk);
    if (totalBytes > maxBytes) {
      // Drain the rest of the request to prevent socket hang
      req.resume();
      const err = new Error('Request body too large (max 50MB)');
      err.code = 'BODY_TOO_LARGE';
      throw err;
    }
    raw += chunk;
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

function isValidTelegramId(id) {
  return id !== undefined && id !== null && Number.isFinite(Number(id)) && Number(id) > 0;
}

function sendJson(res, status, payload) {
  res.writeHead(status);
  res.end(JSON.stringify(payload));
}

// ── Bot commands ──────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  await syncAdminSettingsFromRest().catch(() => { });
  const username = ctx.from.first_name || 'Force Agent';
  const payload = ctx.startPayload || '';
  const currentAppUrl = getEffectiveAppUrl();
  const finalUrl = payload ? `${currentAppUrl}?tgWebAppStartParam=${encodeURIComponent(payload)}` : currentAppUrl;
  const welcomeMsg = getWelcomeMessage(username);
  const btnText = dynamicSettings.botStartButtonText || '🔥  Launch Elite Force App  🔥';

  await ctx.replyWithHTML(
    welcomeMsg,
    Markup.inlineKeyboard([
      [Markup.button.webApp(btnText, finalUrl)],
    ])
  ).catch((err) => console.error('Error replying start welcome:', err));

  // Handle referral notification if payload is a referral link
  if (payload.startsWith('ref_')) {
    const inviterId = parseInt(payload.replace('ref_', ''), 10);
    if (!isNaN(inviterId) && inviterId !== ctx.from.id) {
      try {
        const inviterChat = await ctx.telegram.getChat(inviterId).catch(() => null);
        const inviterName = inviterChat ? (inviterChat.first_name || inviterChat.username || 'your sponsor') : 'your sponsor';
        const inviterDisplay = inviterChat?.username ? `@${escapeHTML(inviterChat.username)}` : escapeHTML(inviterName);

        const inviteeName = ctx.from.first_name || 'A user';
        const inviteeDisplay = ctx.from.username ? `@${escapeHTML(ctx.from.username)}` : escapeHTML(inviteeName);

        await sendToUser(
          inviterId,
          `🎉 <b>New Referral!</b>\n\nUser <b>${inviteeDisplay}</b> joined using your referral link!\n\n💰 You'll receive your referral reward once they start mining!\n\n🚀 Keep sharing your link to earn more!`,
          { reply_markup: Markup.inlineKeyboard([[Markup.button.webApp('📊 View Referrals', currentAppUrl)]]).reply_markup }
        );

        await ctx.replyWithHTML(
          `🔗 <b>Referral Linked!</b>\n\nYou joined under sponsor <b>${escapeHTML(inviterName)}</b> (${inviterDisplay}). Welcome to the Elite Force team!\n\n⛏️ Start mining to activate your account!`
        ).catch(() => { });
      } catch (err) {
        console.error('Referral notification error:', err);
      }
    }
  }
});

bot.command('app', (ctx) => {
  const currentAppUrl = getEffectiveAppUrl();
  const btnText = dynamicSettings.botStartButtonText || '🚀 Open App';
  ctx.reply('Opening Elite Force...', Markup.inlineKeyboard([
    [Markup.button.webApp(btnText, currentAppUrl)],
  ]));
});

bot.command('status', async (ctx) => {
  const currentAppUrl = getEffectiveAppUrl();
  await ctx.replyWithHTML(`⚡ <b>Elite Force Bot</b> is online!\n\n🌐 App: ${currentAppUrl}\n🤖 Bot: @${ctx.me}`);
});

// ── HTTP Notification API ─────────────────────────────────────────────────────
// All endpoints (except the two explicitly marked public) require:
// Authorization: Bearer <API_SECRET>

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  // Restrict CORS to the known app origin and localhost for dev
  const allowedOrigins = [
    'https://elite-force-844d0.web.app',
    'https://elite-force-844d0.firebaseapp.com',
    'https://mini-telegram-app-c0fb4.web.app',
    BASE_APP_URL,
  ].filter(Boolean);
  const origin = req.headers['origin'] || '';
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url?.split('?')[0];

  try {
    // ── PUBLIC: GET /health ──────────────────────────────────────────────────
    if (req.method === 'GET' && (url === '/health' || url === '/')) {
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, status: 'online', ts: Date.now() }));
      return;
    }

    // ── PUBLIC: POST /verify-captcha ─────────────────────────────────────────
    if (req.method === 'POST' && url === '/verify-captcha') {
      let verifyData;
      try {
        verifyData = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      const { token: captchaToken } = verifyData;
      if (!captchaToken) return sendJson(res, 400, { error: 'token required' });
      if (!RECAPTCHA_PROJECT_ID || !RECAPTCHA_SITE_KEY) {
        return sendJson(res, 500, { error: 'reCAPTCHA is not configured on the server' });
      }

      const googleRes = await fetch(
        `https://recaptchaenterprise.googleapis.com/v1/projects/${RECAPTCHA_PROJECT_ID}/assessments?key=${FIREBASE_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: {
              token: captchaToken,
              expectedAction: 'verification',
              siteKey: RECAPTCHA_SITE_KEY,
            },
          }),
        }
      );

      if (!googleRes.ok) {
        const errText = await googleRes.text();
        console.error('Google reCAPTCHA API error:', errText);
        return sendJson(res, googleRes.status, { error: 'Google API error' });
      }

      const result = await googleRes.json();
      return sendJson(res, 200, result);
    }

    // ── PUBLIC: POST /notify/admin/deposit ────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/admin/deposit') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      const { telegramId, username, amountUsdt, efcGranted, txHash } = body;
      const targetChatId = dynamicSettings.adminTelegramId || process.env.ADMIN_TELEGRAM_ID;

      if (targetChatId) {
        const msg = `📥 <b>NEW DEPOSIT REQUEST!</b>\n\n` +
          `👤 <b>User:</b> ${escapeHTML(username || 'User')}\n` +
          `🆔 <b>Telegram ID:</b> <code>${telegramId}</code>\n` +
          `💵 <b>Amount:</b> $${amountUsdt} USDT\n` +
          `🎁 <b>EFC Points Granted:</b> ${efcGranted}\n` +
          `🔗 <b>TxHash:</b> <code>${escapeHTML(txHash)}</code>\n` +
          `⏰ <b>Time:</b> ${new Date().toLocaleString()}`;

        await bot.telegram.sendMessage(targetChatId, msg, { parse_mode: 'HTML' }).catch((err) => {
          console.warn('[Bot] Admin deposit notify error:', err.message);
        });
      }
      return sendJson(res, 200, { ok: true });
    }

    // ── PUBLIC: POST /notify/admin/withdraw ───────────────────────────────────
    if (req.method === 'POST' && url === '/notify/admin/withdraw') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      const { telegramId, username, amount, type, walletAddress } = body;
      const targetChatId = dynamicSettings.adminTelegramId || process.env.ADMIN_TELEGRAM_ID;

      if (targetChatId) {
        const msg = `💸 <b>NEW WITHDRAWAL REQUEST!</b>\n\n` +
          `👤 <b>User:</b> ${escapeHTML(username || 'User')}\n` +
          `🆔 <b>Telegram ID:</b> <code>${telegramId}</code>\n` +
          `💰 <b>Withdraw Amount:</b> ${amount} ${(type || 'usdt').toUpperCase()}\n` +
          `🏦 <b>Wallet Address:</b> <code>${escapeHTML(walletAddress)}</code>\n` +
          `⏰ <b>Time:</b> ${new Date().toLocaleString()}`;

        await bot.telegram.sendMessage(targetChatId, msg, { parse_mode: 'HTML' }).catch((err) => {
          console.warn('[Bot] Admin withdraw notify error:', err.message);
        });
      }
      return sendJson(res, 200, { ok: true });
    }

    // ── PUBLIC: POST /notify/admin/task ───────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/admin/task') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      const { telegramId, username, title, taskType, budgetUsdt, rewardPoints } = body;
      const targetChatId = dynamicSettings.adminTelegramId || process.env.ADMIN_TELEGRAM_ID;

      if (targetChatId) {
        const msg = `📋 <b>NEW TASK CREATION REQUEST!</b>\n\n` +
          `👤 <b>Creator:</b> ${escapeHTML(username || 'Creator')}\n` +
          `🆔 <b>Telegram ID:</b> <code>${telegramId}</code>\n` +
          `📌 <b>Task Title:</b> ${escapeHTML(title || 'Untitled Task')}\n` +
          `🏷️ <b>Category:</b> ${escapeHTML((taskType || 'general').toUpperCase())}\n` +
          `💵 <b>Total Budget:</b> $${budgetUsdt || 0} USDT\n` +
          `🎁 <b>Per Worker Reward:</b> ${rewardPoints || 0} EFC\n` +
          `⏰ <b>Time:</b> ${new Date().toLocaleString()}`;

        await bot.telegram.sendMessage(targetChatId, msg, { parse_mode: 'HTML' }).catch((err) => {
          console.warn('[Bot] Admin task notify error:', err.message);
        });
      }
      return sendJson(res, 200, { ok: true });
    }

    // ── PUBLIC: POST /notify/admin/support ───────────────────────────────────
    if (req.method === 'POST' && url === '/notify/admin/support') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      const { telegramId, userName, messageText, imageUrl } = body;
      const targetChatId = dynamicSettings.adminTelegramId || process.env.ADMIN_TELEGRAM_ID;

      if (targetChatId) {
        const msg = `🎧 <b>NEW LIVE SUPPORT MESSAGE!</b>\n\n` +
          `👤 <b>From User:</b> ${escapeHTML(userName || 'User')}\n` +
          `🆔 <b>Telegram ID:</b> <code>${telegramId}</code>\n` +
          `💬 <b>Message:</b> ${escapeHTML(messageText || '(Attachment)')}\n` +
          (imageUrl ? `📷 <b>Attachment:</b> ${escapeHTML(imageUrl)}\n` : '') +
          `⏰ <b>Time:</b> ${new Date().toLocaleString()}`;

        await bot.telegram.sendMessage(targetChatId, msg, { parse_mode: 'HTML' }).catch((err) => {
          console.warn('[Bot] Admin support notify error:', err.message);
        });
      }
      return sendJson(res, 200, { ok: true });
    }

    // ── PUBLIC: POST /notify/support/reply ─────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/support/reply') {
      let body;
      try {
        body = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      const { telegramId, text, imageUrl } = body;
      const numId = Number(telegramId);
      if (!isValidTelegramId(numId) || (!text && !imageUrl)) {
        return sendJson(res, 400, { error: 'valid telegramId and text required' });
      }

      const msg = `🎧 <b>LIVE SUPPORT RESPONSE</b>\n\n` +
        `${escapeHTML(text || '(Attachment)')}\n\n` +
        `<i>— Elite Force Customer Support (24/7)</i>`;

      const extra = {};
      if (dynamicSettings.miniAppUrl) {
        extra.reply_markup = Markup.inlineKeyboard([
          [Markup.button.webApp('💬 Open Support Chat', dynamicSettings.miniAppUrl)]
        ]).reply_markup;
      }

      const ok = await sendToUser(numId, msg, extra, imageUrl);
      return sendJson(res, 200, { ok });
    }

    // ── PUBLIC: POST /upload-profile-photo ───────────────────────────────────
    if (req.method === 'POST' && url === '/upload-profile-photo') {
      let uploadData;
      try {
        uploadData = await readJsonBody(req);
      } catch (e) {
        const code = e.code || 'INVALID_JSON';
        const msg = e.code === 'BODY_TOO_LARGE' ? e.message : 'Invalid JSON body';
        return sendJson(res, 400, { success: false, code, message: msg });
      }

      const { telegramId, photoUrl, oldPublicId } = uploadData;
      if (!isValidTelegramId(telegramId) || !photoUrl) {
        return sendJson(res, 400, { success: false, code: 'MISSING_PARAMS', message: 'valid telegramId and photoUrl required' });
      }

      try {
        const result = await uploadToCloudinary(photoUrl, {
          folder: getUploadFolder('profile'),
          publicId: `user_${telegramId}`,
          oldPublicId: oldPublicId || null,
          oldResourceType: 'image',
          overwrite: true,
        });
        return sendJson(res, 200, {
          success: true,
          secureUrl: result.secureUrl,
          publicId: result.publicId,
          resourceType: result.resourceType,
          width: result.width,
          height: result.height,
          bytes: result.bytes,
          format: result.format,
        });
      } catch (err) {
        console.error('[upload-profile-photo] Error:', err.message);
        return sendJson(res, 500, {
          success: false,
          code: err.code || 'UPLOAD_FAILED',
          message: err.message || 'Cloudinary upload failed',
        });
      }
    }

    // ── PUBLIC: POST /check-membership ───────────────────────────────────────
    if (req.method === 'POST' && url === '/check-membership') {
      let checkData;
      try {
        checkData = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      const { telegramId, chatId, chatIds } = checkData;
      if (!isValidTelegramId(telegramId) || (!chatId && (!Array.isArray(chatIds) || chatIds.length === 0))) {
        return sendJson(res, 400, { error: 'valid telegramId and chatId/chatIds required' });
      }

      const chats = Array.isArray(chatIds) && chatIds.length > 0 ? chatIds : [chatId];
      const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
      const results = {};
      let allJoined = true;

      for (const rawChat of chats) {
        if (!rawChat) continue;
        let targetChat = String(rawChat).trim();
        if (targetChat.includes('t.me/')) {
          const parts = targetChat.split('t.me/')[1].split('?')[0].split('/')[0].replace('+', '');
          targetChat = parts ? `@${parts}` : targetChat;
        } else if (!targetChat.startsWith('@') && !targetChat.startsWith('-100') && isNaN(Number(targetChat))) {
          targetChat = `@${targetChat}`;
        }

        try {
          const member = await bot.telegram.getChatMember(targetChat, Number(telegramId));
          const isMember = validStatuses.includes(member.status) && (member.status !== 'restricted' || member.is_member !== false);
          results[rawChat] = isMember;
          results[targetChat] = isMember;
          if (!isMember) allJoined = false;
        } catch (err) {
          console.warn(`[Bot] Membership check failed for ${telegramId} in ${targetChat}:`, err.message);
          results[rawChat] = false;
          results[targetChat] = false;
          allJoined = false;
        }
      }

      return sendJson(res, 200, { isMember: allJoined, results });
    }

    // ── PUBLIC: GET /api/referral/tiers ──────────────────────────────────────
    if (req.method === 'GET' && url.startsWith('/api/referral/tiers')) {
      try {
        const snap = await db.collection('referral_claim_tiers').get();
        let tiers = [];
        if (!snap.empty) {
          tiers = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          tiers = tiers.filter(t => t.isActive !== false);
          tiers.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || (a.requiredReferrals || 0) - (b.requiredReferrals || 0));
        }
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return sendJson(res, 200, { ok: true, tiers });
      } catch (err) {
        console.error('[API] GET /api/referral/tiers error:', err);
        return sendJson(res, 500, { ok: false, error: 'Failed to fetch referral claim tiers' });
      }
    }

    // ── PUBLIC: GET /api/referral/me ─────────────────────────────────────────
    if (req.method === 'GET' && url.startsWith('/api/referral/me')) {
      const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const telegramId = urlParams.get('telegramId');
      if (!isValidTelegramId(telegramId)) {
        return sendJson(res, 400, { ok: false, error: 'valid telegramId is required' });
      }

      try {
        const userDoc = await db.collection('users').doc(String(telegramId)).get();
        const userData = userDoc.exists ? userDoc.data() : {};
        const referralCount = Number(userData.referrals || 0);

        const snap = await db.collection('referral_claim_tiers').get();
        let tiers = [];
        if (!snap.empty) {
          tiers = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          tiers = tiers.filter(t => t.isActive !== false);
          tiers.sort((a, b) => (a.requiredReferrals || 0) - (b.requiredReferrals || 0));
        }

        if (tiers.length === 0) {
          tiers = [
            { id: 'tier_0', requiredReferrals: 0, claimLimit: 5000, bonusUSDT: 0, badge: 'Starter', isActive: true, sortOrder: 1 }
          ];
        }

        let unlockedIndex = 0;
        for (let i = 0; i < tiers.length; i++) {
          if (referralCount >= tiers[i].requiredReferrals) unlockedIndex = i;
          else break;
        }

        const unlockedTier = tiers[unlockedIndex];
        const nextTier = unlockedIndex < tiers.length - 1 ? tiers[unlockedIndex + 1] : null;
        const remainingReferrals = nextTier ? Math.max(0, nextTier.requiredReferrals - referralCount) : 0;

        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return sendJson(res, 200, {
          ok: true,
          referralCount,
          unlockedTier,
          currentClaimLimit: unlockedTier.claimLimit,
          currentBonus: unlockedTier.bonusUSDT,
          nextTier,
          remainingReferrals,
          isMaxTier: !nextTier,
        });
      } catch (err) {
        console.error('[API] GET /api/referral/me error:', err);
        return sendJson(res, 500, { ok: false, error: 'Failed to fetch user referral status' });
      }
    }


    // ── PUBLIC: POST /api/x/save-username ───────────────────────────────────
    if (req.method === 'POST' && url === '/api/x/save-username') {
      let bodyData;
      try {
        bodyData = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
      }
      const { telegramId, username } = bodyData;
      if (!isValidTelegramId(telegramId) || !username) {
        return sendJson(res, 400, { ok: false, error: 'telegramId and username are required' });
      }
      try {
        const numId = Number(telegramId);
        // Normalize: strip @ and lowercase
        const normalized = String(username).trim().replace(/^@/, '').toLowerCase();
        const USERNAME_REGEX = /^[A-Za-z0-9_]{1,15}$/;
        if (!USERNAME_REGEX.test(normalized)) {
          return sendJson(res, 400, { ok: false, error: 'Invalid X username. Use 1–15 letters, numbers, or underscores.' });
        }

        // Check if this user already has a locked username
        const existingDoc = await db.collection('xUsers').doc(String(numId)).get();
        if (existingDoc.exists) {
          const existing = existingDoc.data();
          if (existing.locked && existing.twitterUsername !== normalized) {
            return sendJson(res, 400, { ok: false, error: `Your X account (@${existing.twitterUsername}) is locked. Contact admin to change.`, locked: true, twitterUsername: existing.twitterUsername });
          }
        }

        // Check for duplicate username across accounts
        const duplicateSnap = await db.collection('xUsers').where('twitterUsername', '==', normalized).get();
        for (const docSnap of duplicateSnap.docs) {
          if (docSnap.data().telegramId !== numId) {
            await db.collection('fraudLogs').add({ telegramId: numId, attemptedUsername: normalized, existingTelegramId: docSnap.data().telegramId, reason: 'DUPLICATE_USERNAME_ACROSS_ACCOUNTS', timestamp: FieldValue.serverTimestamp() });
            return sendJson(res, 400, { ok: false, error: `@${normalized} is already linked to another account.` });
          }
        }

        const isLocked = existingDoc.exists ? (existingDoc.data().locked || false) : false;
        const isVerified = existingDoc.exists ? (existingDoc.data().verified || false) : false;

        // Write to xUsers collection
        await db.collection('xUsers').doc(String(numId)).set({
          telegramId: numId,
          twitterUsername: normalized,
          verified: isVerified,
          verifiedAt: existingDoc.exists ? (existingDoc.data().verifiedAt || null) : null,
          locked: isLocked,
          linkedAt: FieldValue.serverTimestamp(),
        }, { merge: true });

        // Write to users collection (socialConnections.x)
        await db.collection('users').doc(String(numId)).set({
          socialConnections: {
            x: {
              handle: `@${normalized}`,
              connected: true,
              linkedAt: new Date().toISOString(),
              verified: isVerified,
            },
          },
        }, { merge: true });

        // Auth log
        await db.collection('authenticationLogs').add({ telegramId: numId, twitterUsername: normalized, event: 'USERNAME_SAVED', timestamp: FieldValue.serverTimestamp() }).catch(() => { });

        console.log(`✅ [API] X username @${normalized} saved for telegramId=${numId}`);

        const cleanHandle = `@${normalized}`;
        sendEventNotification({
          telegramId: numId,
          eventType: 'SOCIAL_CONNECTED',
          eventId: `social_connect_${numId}_x_${Date.now()}`,
          params: { platformName: 'X', handle: cleanHandle },
        }).catch(() => { });

        return sendJson(res, 200, { ok: true, twitterUsername: normalized, locked: isLocked });
      } catch (err) {
        console.error('[API] POST /api/x/save-username error:', err.message, err.stack);
        return sendJson(res, 500, { ok: false, error: `Server error: ${err.message}` });
      }
    }

    // ── PUBLIC: POST /api/social/connect ─────────────────────────────────────
    if (req.method === 'POST' && url === '/api/social/connect') {
      let bodyData;
      try {
        bodyData = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
      }
      const { telegramId, platform, handle } = bodyData;
      if (!isValidTelegramId(telegramId) || !platform || !handle) {
        return sendJson(res, 400, { ok: false, error: 'telegramId, platform, and handle are required' });
      }

      try {
        const numId = Number(telegramId);
        const platformKey = String(platform).toLowerCase();
        const cleanHandle = handle.trim().startsWith('@') ? handle.trim() : `@${handle.trim()}`;
        const dbInstance = getFirestore();

        await dbInstance.collection('users').doc(String(numId)).set({
          socialConnections: {
            [platformKey]: {
              handle: cleanHandle,
              connected: true,
              linkedAt: new Date().toISOString(),
            },
          },
        }, { merge: true });

        const platformLabels = { x: 'X', discord: 'Discord', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', reddit: 'Reddit' };
        const pName = platformLabels[platformKey] || platformKey.toUpperCase();
        const connectedAt = new Date().toUTCString();

        sendEventNotification({
          telegramId: numId,
          eventType: 'SOCIAL_CONNECTED',
          eventId: `social_connect_${numId}_${platformKey}_${Date.now()}`,
          params: {
            platformName: pName,
            handle: cleanHandle,
            connectedAt: connectedAt,
          },
        }).catch(() => { });

        return sendJson(res, 200, { ok: true, message: `${pName} connected successfully.` });
      } catch (err) {
        console.error('[API] POST /api/social/connect error:', err.message);
        return sendJson(res, 500, { ok: false, error: 'Server error while saving connection.' });
      }
    }

    // ── PUBLIC: POST /api/social/disconnect ──────────────────────────────────
    if (req.method === 'POST' && url === '/api/social/disconnect') {
      let bodyData;
      try {
        bodyData = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON' });
      }
      const { telegramId, platform } = bodyData;
      if (!isValidTelegramId(telegramId) || !platform) {
        return sendJson(res, 400, { ok: false, error: 'telegramId and platform are required' });
      }

      try {
        const numId = Number(telegramId);
        const platformKey = String(platform).toLowerCase();
        const dbInstance = getFirestore();

        await dbInstance.collection('users').doc(String(numId)).set({
          socialConnections: {
            [platformKey]: {
              handle: '',
              connected: false,
              unlinkedAt: new Date().toISOString(),
            },
          },
        }, { merge: true });

        const platformLabels = { x: 'X', discord: 'Discord', tiktok: 'TikTok', instagram: 'Instagram', youtube: 'YouTube', reddit: 'Reddit' };
        const pName = platformLabels[platformKey] || platformKey.toUpperCase();

        sendEventNotification({
          telegramId: numId,
          eventType: 'SOCIAL_DISCONNECTED',
          eventId: `social_disconnect_${numId}_${platformKey}_${Date.now()}`,
          params: {
            platformName: pName,
          },
        }).catch(() => { });

        return sendJson(res, 200, { ok: true, message: `${pName} disconnected successfully.` });
      } catch (err) {
        console.error('[API] POST /api/social/disconnect error:', err.message);
        return sendJson(res, 500, { ok: false, error: 'Server error while removing connection.' });
      }
    }


    // ── PUBLIC: POST /api/x/verify-task ─────────────────────────────────────
    if (req.method === 'POST' && url === '/api/x/verify-task') {
      let bodyData;
      try {
        bodyData = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
      const { telegramId, taskId, taskType, targetId, rewardAmount } = bodyData;
      if (!isValidTelegramId(telegramId) || !taskId) {
        return sendJson(res, 400, { error: 'valid telegramId and taskId required' });
      }
      const result = await verifyXTask(telegramId, taskId, taskType, targetId, rewardAmount || 100);
      return sendJson(res, 200, result);
    }

    // ── PUBLIC: POST /api/tasks/verify ───────────────────────────────────────
    if (req.method === 'POST' && url === '/api/tasks/verify') {
      let bodyData;
      try {
        bodyData = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { success: false, error: 'Invalid JSON' });
      }
      const { telegramId, taskId, taskType, userAnswer, adCompleted, requireSocialConnection } = bodyData;
      if (!isValidTelegramId(telegramId) || !taskId) {
        return sendJson(res, 400, { success: false, error: 'valid telegramId and taskId required' });
      }

      const numId = Number(telegramId);
      const dbInstance = getFirestore();

      try {
        // 1. Check Duplicate Task Completion
        const userTaskRef = dbInstance.collection('userTasks').doc(`${numId}_${taskId}`);
        const userTaskSnap = await userTaskRef.get();
        if (userTaskSnap.exists) {
          return sendJson(res, 200, { success: false, error: 'Task Already Completed', isCompleted: true });
        }

        // 2. Check Task Definition in Firestore
        const taskRef = dbInstance.collection('tasks').doc(String(taskId));
        const taskSnap = await taskRef.get();
        if (!taskSnap.exists) {
          return sendJson(res, 404, { success: false, error: 'Task not found' });
        }

        const taskData = taskSnap.data();

        // 3. Verify Answer / Quiz Solution on Server
        if (taskData.answer && String(taskData.answer).trim()) {
          const expected = String(taskData.answer).trim();
          const provided = String(userAnswer || '').trim();
          const isMatch = taskData.answerCaseSensitive ? expected === provided : expected.toLowerCase() === provided.toLowerCase();
          if (!isMatch) {
            sendEventNotification({
              telegramId: numId,
              eventType: 'TASK_REJECTED',
              eventId: `task_reject_${numId}_${taskId}_${Date.now()}`,
              params: {
                taskTitle: taskData.title || 'Mission Task',
                reason: 'Incorrect answer provided.',
              },
            }).catch(() => { });
            return sendJson(res, 200, { success: false, error: '❌ Incorrect Answer. Please check your answer and try again.' });
          }
        }

        // 4. Verify Social Connection Gate on Server (Strict HTTP 403 Forbidden if not connected)
        const inferPlatformFromTask = (tData) => {
          if (tData.requireSocialConnection && tData.requireSocialConnection !== 'none') return tData.requireSocialConnection.toLowerCase();
          const ty = (tData.type || '').toLowerCase();
          const pl = ((tData.platform) || '').toLowerCase();
          const ti = (tData.title || '').toLowerCase();
          const ur = (tData.url || '').toLowerCase();
          if (ty.includes('x') || ty.includes('twitter') || pl.includes('x') || pl.includes('twitter') || ur.includes('x.com') || ur.includes('twitter.com') || ti.includes('follow x') || ti.includes('retweet') || ti.includes('like x')) return 'x';
          if (ty.includes('discord') || pl.includes('discord') || ur.includes('discord.') || ti.includes('discord')) return 'discord';
          if (ty.includes('youtube') || pl.includes('youtube') || ur.includes('youtube.com') || ur.includes('youtu.be') || ti.includes('youtube')) return 'youtube';
          if (ty.includes('instagram') || pl.includes('instagram') || ur.includes('instagram.com') || ti.includes('instagram')) return 'instagram';
          if (ty.includes('tiktok') || pl.includes('tiktok') || ur.includes('tiktok.com') || ti.includes('tiktok')) return 'tiktok';
          if (ty.includes('reddit') || pl.includes('reddit') || ur.includes('reddit.com') || ti.includes('reddit')) return 'reddit';
          return 'none';
        };

        const requiredPlatform = (requireSocialConnection || taskData.requireSocialConnection || inferPlatformFromTask(taskData)).toLowerCase();
        if (requiredPlatform && requiredPlatform !== 'none' && requiredPlatform !== 'telegram') {
          const userRef = dbInstance.collection('users').doc(String(numId));
          const userSnap = await userRef.get();
          const userData = userSnap.exists ? userSnap.data() : {};
          const conn = userData.socialConnections?.[requiredPlatform];
          if (!conn || !conn.connected || !conn.handle) {
            sendEventNotification({
              telegramId: numId,
              eventType: 'TASK_REJECTED',
              eventId: `task_reject_noconn_${numId}_${taskId}_${Date.now()}`,
              params: {
                taskTitle: taskData.title || 'Mission Task',
                reason: `${requiredPlatform.toUpperCase()} account not connected in Profile.`,
              },
            }).catch(() => { });
            return sendJson(res, 403, {
              success: false,
              error: `HTTP 403 Forbidden: Social Account Not Connected. Please connect your ${requiredPlatform.toUpperCase()} account in Profile → Connections first!`,
              requirePlatform: requiredPlatform,
            });
          }
        }

        // 5. Verify Rewarded Ad Completion (only if task explicitly requires it)
        if (taskData.requireRewardedAd === true && !adCompleted) {
          return sendJson(res, 200, {
            success: false,
            error: 'Verification Cancelled: You must watch the complete advertisement to verify this task.',
          });
        }

        // 6. Grant Reward & Store Completion Record
        const rewardPoints = taskData.reward || 100;
        const tokenReward = taskData.tokenReward || 0;

        const batch = dbInstance.batch();
        batch.set(userTaskRef, {
          taskId: String(taskId),
          telegramId: numId,
          completedAt: FieldValue.serverTimestamp(),
          rewardClaimed: true,
          rewardPoints,
          tokenReward,
        });

        const userRef = dbInstance.collection('users').doc(String(numId));
        batch.set(userRef, {
          points: FieldValue.increment(rewardPoints),
          tokens: FieldValue.increment(tokenReward),
        }, { merge: true });

        batch.update(taskRef, {
          completedCount: FieldValue.increment(1),
        });

        await batch.commit();

        // 7. Dispatch Telegram Task Completion Notification
        const userDocAfter = await userRef.get();
        const newBal = userDocAfter.exists ? (userDocAfter.data()?.points || 0) : rewardPoints;

        sendEventNotification({
          telegramId: numId,
          eventType: 'TASK_COMPLETED',
          eventId: `task_complete_${numId}_${taskId}`,
          params: {
            taskTitle: taskData.title || 'Mission Task',
            reward: rewardPoints.toLocaleString(),
            tokenRewardText: tokenReward > 0 ? ` & +${tokenReward} EST` : '',
            newBalance: newBal.toLocaleString(),
          },
        }).catch(() => { });

        return sendJson(res, 200, {
          success: true,
          reward: rewardPoints,
          tokenReward: tokenReward,
          message: 'Task Completed',
        });
      } catch (err) {
        console.error('[Bot] Task Verification Error:', err.message);
        return sendJson(res, 500, { success: false, error: 'Server error during task verification.' });
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ── MARKET API ENDPOINTS (P2P Task Marketplace) ─────────────────────────
    // ──────────────────────────────────────────────────────────────────────────

    // ── POST /api/market/tasks/create ─────────────────────────────────────────
    if (req.method === 'POST' && url === '/api/market/tasks/create') {
      let body;
      try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid JSON' }); }

      const { telegramId, platform, action, targetUrl, title, description, instructions, checklist, inputFields, reward, rewardCurrency, workerLimit, dailyLimit, cooldownHours, expiryDays, audience, verificationType } = body;

      if (!isValidTelegramId(telegramId) || !platform || !action || !targetUrl || !title || !reward || !workerLimit) {
        return sendJson(res, 400, { ok: false, error: 'Required fields missing' });
      }

      try {
        const numId = Number(telegramId);
        const rewardNum = Number(reward);
        const limitNum = Number(workerLimit);
        const expDays = Number(expiryDays) > 0 ? Number(expiryDays) : 7;

        // Escrow Calculation matching frontend
        const isUsdt = rewardCurrency === 'USDT';
        const rewardPool = isUsdt ? Number((rewardNum * limitNum).toFixed(3)) : rewardNum * limitNum;
        const platformFee = isUsdt ? Number((rewardPool * 0.25).toFixed(3)) : Math.round(rewardPool * 0.25 * 10) / 10;

        let tierCost = 0;
        if (audience && audience.type === 'level') {
          if (audience.minLevel === 5) tierCost = isUsdt ? 0.01 * limitNum : 1 * limitNum;
          else if (audience.minLevel === 10) tierCost = isUsdt ? 0.02 * limitNum : 2 * limitNum;
        }

        // Frontend currently sends verificationType: 'manual' always.
        // And it only adds verificationCost if `verifiedOnly` is true, but `verifiedOnly` isn't in body.
        // Let's assume verifiedOnly is passed in body, or we just trust the frontend's verificationCost if we have to.
        // Wait, the frontend doesn't send verifiedOnly. I will just set verificationFee to 0 for now unless verifiedOnly is present in body.
        const verifiedOnly = body.verifiedOnly || false;
        const verificationFee = verifiedOnly ? (isUsdt ? 0.015 * limitNum : 1.5 * limitNum) : 0;

        const reviewFee = platform === 'Custom' ? (isUsdt ? 0.2 : 10) : 0;

        const rawTotalEscrow = rewardPool + platformFee + tierCost + verificationFee + reviewFee;
        const totalEscrow = isUsdt ? Number(rawTotalEscrow.toFixed(3)) : Math.ceil(rawTotalEscrow);

        // Check user balance and create task in atomic transaction
        const userRef = db.collection('users').doc(String(numId));
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
          return sendJson(res, 404, { ok: false, error: 'User account not found' });
        }

        const userData = userSnap.data();
        const currentBalance = isUsdt ? (userData.depositBalance ?? 0) : (userData.points || 0);

        if (currentBalance < totalEscrow) {
          return sendJson(res, 400, {
            ok: false,
            insufficientBalance: true,
            error: isUsdt
              ? `Insufficient Deposit Balance! Required: $${totalEscrow} USDT, Available Deposit Balance: $${currentBalance} USDT. Please deposit USDT into your Wallet to create tasks.`
              : `Insufficient EFC points balance. Required: ${totalEscrow} EFC, Available: ${currentBalance} EFC`,
          });
        }

        const now = new Date();
        const expiresAt = new Date(now.getTime() + expDays * 24 * 60 * 60 * 1000).toISOString();
        const taskDocRef = db.collection('marketTasks').doc();
        const txDocRef = db.collection('transactions').doc();
        const escrowDocRef = db.collection('taskEscrow').doc(taskDocRef.id);

        await db.runTransaction(async (transaction) => {
          const freshUserSnap = await transaction.get(userRef);
          const freshBalance = isUsdt ? (freshUserSnap.data()?.depositBalance ?? 0) : (freshUserSnap.data()?.points || 0);
          if (freshBalance < totalEscrow) {
            throw new Error(`Insufficient Deposit Balance during checkout. Available: $${freshBalance} USDT`);
          }

          // Atomic deduction from user deposit balance & wallet + record escrow points
          if (isUsdt) {
            transaction.update(userRef, {
              depositBalance: FieldValue.increment(-totalEscrow),
              wallet: FieldValue.increment(-totalEscrow),
              escrow_usdt: FieldValue.increment(totalEscrow),
              spent_usdt: FieldValue.increment(totalEscrow),
            });
          } else {
            transaction.update(userRef, {
              points: FieldValue.increment(-totalEscrow),
              escrow_points: FieldValue.increment(totalEscrow),
              spent_points: FieldValue.increment(totalEscrow),
            });
          }

          // Create Task Document
          transaction.set(taskDocRef, {
            creatorTelegramId: numId,
            creatorName: userData.firstName || `@${userData.username || 'user'}`,
            platform,
            action,
            targetUrl,
            title,
            description: description || '',
            instructions: instructions || '',
            checklist: checklist || [],
            inputFields: inputFields || ['screenshot'],
            reward: rewardNum,
            rewardCurrency: rewardCurrency || 'EFC',
            workerLimit: limitNum,
            dailyLimit: Number(dailyLimit || 0),
            cooldownHours: Number(cooldownHours || 0),
            expiryDays: expDays,
            budget: totalEscrow,
            totalEscrow,
            platformFee,
            verificationFee,
            reviewFee,
            verificationType: verificationType || 'automatic',
            audience: audience || { type: 'everyone' },
            status: String(platform).toLowerCase() === 'custom' ? 'pending_review' : 'active',
            completedCount: 0,
            remainingSlots: limitNum,
            featured: false,
            trending: false,
            views: 0,
            completionRate: 100,
            difficulty: rewardNum <= 5 ? 'easy' : rewardNum <= 15 ? 'medium' : 'hard',
            createdAt: now.toISOString(),
            expiresAt,
          });

          // Escrow ledger record
          transaction.set(escrowDocRef, {
            taskId: taskDocRef.id,
            creatorTelegramId: numId,
            totalEscrow,
            remainingEscrow: totalEscrow,
            rewardPool,
            platformFee,
            verificationFee,
            reviewFee,
            status: 'held',
            createdAt: now.toISOString(),
          });

          // Transaction log
          transaction.set(txDocRef, {
            transactionId: txDocRef.id,
            userId: numId,
            taskId: taskDocRef.id,
            amount: totalEscrow,
            type: 'task_escrow',
            status: 'completed',
            date: now.toISOString(),
            reason: `Task creation escrow deposit for "${title}"`,
          });
        });

        // Send Telegram Notification to Creator
        sendMarketNotification({
          telegramId: numId,
          botToken: token,
          type: 'TASK_CREATED',
          title,
          reward: rewardNum,
          workers: limitNum,
          budget: totalEscrow,
        }).catch(() => { });

        // Send Private Telegram Notification to Admin
        const targetAdminId = dynamicSettings.adminTelegramId || process.env.ADMIN_TELEGRAM_ID;
        if (targetAdminId) {
          const adminTaskMsg = `📋 <b>NEW TASK CREATED!</b>\n\n` +
            `👤 <b>Creator:</b> ${escapeHTML(userData.firstName || `@${userData.username || 'user'}`)}\n` +
            `🆔 <b>Creator ID:</b> <code>${numId}</code>\n` +
            `📌 <b>Title:</b> ${escapeHTML(title)}\n` +
            `🏷️ <b>Platform:</b> ${escapeHTML(platform)}\n` +
            `💵 <b>Total Escrow Budget:</b> ${totalEscrow} ${rewardCurrency || 'EFC'}\n` +
            `🎁 <b>Worker Reward:</b> ${rewardNum} ${rewardCurrency || 'EFC'}\n` +
            `⏰ <b>Created At:</b> ${new Date().toLocaleString()}`;

          bot.telegram.sendMessage(targetAdminId, adminTaskMsg, { parse_mode: 'HTML' }).catch(() => {});
        }

        // Broadcast New Task Alert to ALL Users (ANONYMOUS — No Creator Name!)
        if (String(platform).toLowerCase() !== 'custom') {
          (async () => {
            try {
              const usersSnap = await db.collection('users').get();
              if (usersSnap.empty) return;
              const appUrl = getEffectiveAppUrl();
              const rewardSymbol = rewardCurrency === 'USDT' ? 'USDT' : 'EFC';

              const broadcastMsg =
                `🔥 *NEW MISSION AVAILABLE!* 🔥\n\n` +
                `📌 *Task:* ${title}\n` +
                `⚡ *Platform:* ${String(platform).toUpperCase()} (${action})\n` +
                `🎁 *Reward:* +${rewardNum} ${rewardSymbol}\n` +
                `👥 *Slots Available:* ${limitNum}\n\n` +
                `🚀 *Open the Elite Force App now to complete this mission and earn rewards!*`;

              for (const uDoc of usersSnap.docs) {
                const uData = uDoc.data();
                const uId = uData.telegramId || uDoc.id;
                if (!uId || isNaN(Number(uId))) continue;
                bot.telegram.sendMessage(uId, broadcastMsg, {
                  parse_mode: 'Markdown',
                  reply_markup: {
                    inline_keyboard: [
                      [{ text: '🚀 Complete Mission Now', web_app: { url: appUrl } }]
                    ]
                  }
                }).catch(() => {});
              }
            } catch (e) {
              console.error('[Market] Broadcast error:', e.message);
            }
          })();
        }

        console.log(`✅ [Market] Task created id=${taskDocRef.id} by telegramId=${numId}, escrow=${totalEscrow}`);

        return sendJson(res, 200, { ok: true, taskId: taskDocRef.id, totalEscrow });
      } catch (err) {
        console.error('[Market] Task Create Error:', err.message);
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // ── GET /api/market/tasks/discover ────────────────────────────────────────
    if (req.method === 'GET' && url.startsWith('/api/market/tasks/discover')) {
      try {
        const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
        const platform = urlObj.searchParams.get('platform');
        const search = urlObj.searchParams.get('search');
        const minReward = Number(urlObj.searchParams.get('minReward') || 0);

        let query = db.collection('marketTasks').where('status', '==', 'active');

        const snap = await query.get();
        let tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (platform) {
          tasks = tasks.filter(t => t.platform.toLowerCase() === platform.toLowerCase());
        }
        if (minReward > 0) {
          tasks = tasks.filter(t => t.reward >= minReward);
        }
        if (search) {
          const s = search.toLowerCase();
          tasks = tasks.filter(t => t.title?.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s));
        }

        tasks.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

        return sendJson(res, 200, { tasks, total: tasks.length, hasMore: false });
      } catch (err) {
        console.error('[Market] Discover error:', err.message);
        return sendJson(res, 200, { tasks: [], total: 0, hasMore: false });
      }
    }

    // ── GET /api/market/tasks/pending (Admin) ──────────────────────────────────
    if (req.method === 'GET' && url.startsWith('/api/market/tasks/pending')) {
      try {
        const snap = await db.collection('marketTasks')
          .where('status', '==', 'pending_review')
          .get();

        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        tasks.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
        return sendJson(res, 200, { ok: true, tasks });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // ── POST /api/market/tasks/:id/approve (Admin) ────────────────────────────
    if (req.method === 'POST' && url.match(/^\/api\/market\/tasks\/[^/]+\/approve$/)) {
      const taskId = url.split('/')[4];
      try {
        const taskRef = db.collection('marketTasks').doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) return sendJson(res, 404, { ok: false, error: 'Task not found' });

        await taskRef.update({ status: 'active', approvedAt: new Date().toISOString() });
        console.log(`✅ [Market Admin] Approved task id=${taskId}`);
        return sendJson(res, 200, { ok: true, message: 'Task approved and published to Market' });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // ── POST /api/market/tasks/:id/reject (Admin) ─────────────────────────────
    if (req.method === 'POST' && url.match(/^\/api\/market\/tasks\/[^/]+\/reject$/)) {
      const taskId = url.split('/')[4];
      try {
        const taskRef = db.collection('marketTasks').doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) return sendJson(res, 404, { ok: false, error: 'Task not found' });

        const taskData = taskDoc.data();
        const creatorId = taskData.creatorTelegramId;
        const refundAmount = taskData.totalEscrow || 0;

        await db.runTransaction(async (transaction) => {
          transaction.update(taskRef, { status: 'rejected', rejectedAt: new Date().toISOString() });
          if (creatorId && refundAmount > 0) {
            const userRef = db.collection('users').doc(String(creatorId));
            transaction.update(userRef, {
              points: FieldValue.increment(refundAmount),
              escrow_points: FieldValue.increment(-refundAmount),
            });
          }
        });

        console.log(`❌ [Market Admin] Rejected task id=${taskId}, refunded ${refundAmount} to user ${creatorId}`);
        return sendJson(res, 200, { ok: true, message: 'Task rejected and escrow refunded', refundedAmount: refundAmount });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // ── GET /api/market/tasks/my ───────────────────────────────────────────────
    if (req.method === 'GET' && url.startsWith('/api/market/tasks/my')) {
      try {
        const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
        const telegramId = urlObj.searchParams.get('telegramId');
        if (!telegramId) return sendJson(res, 400, { ok: false, error: 'telegramId required' });

        const snap = await db.collection('taskSubmissions')
          .where('workerTelegramId', '==', Number(telegramId))
          .get();

        const submissions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        submissions.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

        return sendJson(res, 200, { submissions });
      } catch (err) {
        return sendJson(res, 200, { submissions: [] });
      }
    }

    // ── GET /api/market/tasks/created ──────────────────────────────────────────
    if (req.method === 'GET' && url.startsWith('/api/market/tasks/created')) {
      try {
        const urlObj = new URL(url, `http://${req.headers.host || 'localhost'}`);
        const telegramId = urlObj.searchParams.get('telegramId');
        if (!telegramId) return sendJson(res, 400, { ok: false, error: 'telegramId required' });

        const snap = await db.collection('marketTasks')
          .where('creatorTelegramId', '==', Number(telegramId))
          .get();

        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        tasks.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));

        return sendJson(res, 200, { tasks });
      } catch (err) {
        return sendJson(res, 200, { tasks: [] });
      }
    }

    // ── POST /api/market/tasks/:id/start ──────────────────────────────────────
    if (req.method === 'POST' && url.match(/^\/api\/market\/tasks\/[^/]+\/start$/)) {
      const taskId = url.split('/')[4];
      let body;
      try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid JSON' }); }
      const { telegramId } = body;
      if (!isValidTelegramId(telegramId)) return sendJson(res, 400, { ok: false, error: 'Invalid telegramId' });

      try {
        const numId = Number(telegramId);
        const taskDoc = await db.collection('marketTasks').doc(taskId).get();
        if (!taskDoc.exists) return sendJson(res, 404, { ok: false, error: 'Task not found' });
        const task = taskDoc.data();

        if (Number(task.creatorTelegramId) === numId) {
          return sendJson(res, 403, { ok: false, error: 'You cannot complete your own created task!' });
        }

        // Check if already completed/submitted
        const existing = await db.collection('taskSubmissions')
          .where('taskId', '==', taskId)
          .where('workerTelegramId', '==', numId)
          .get();

        if (!existing.empty) {
          const sub = existing.docs[0].data();
          return sendJson(res, 200, { ok: true, submissionId: existing.docs[0].id, alreadyStarted: true, status: sub.status });
        }

        if (task.remainingSlots <= 0) {
          return sendJson(res, 400, { ok: false, error: 'Task has no remaining worker slots.' });
        }

        const now = new Date().toISOString();
        const subRef = await db.collection('taskSubmissions').add({
          taskId,
          taskTitle: task.title,
          platform: task.platform,
          workerTelegramId: numId,
          status: 'started',
          reward: task.reward,
          createdAt: now,
        });

        return sendJson(res, 200, { ok: true, submissionId: subRef.id });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // ── POST /api/market/tasks/:id/submit ─────────────────────────────────────
    if (req.method === 'POST' && url.match(/^\/api\/market\/tasks\/[^/]+\/submit$/)) {
      const taskId = url.split('/')[4];
      let body;
      try { body = await readJsonBody(req); } catch { return sendJson(res, 400, { ok: false, error: 'Invalid JSON' }); }
      const { telegramId, proofUrl, proofText, inputValues } = body;
      if (!isValidTelegramId(telegramId)) return sendJson(res, 400, { ok: false, error: 'Invalid telegramId' });

      try {
        const numId = Number(telegramId);
        const taskRef = db.collection('marketTasks').doc(taskId);
        const taskDoc = await taskRef.get();
        if (!taskDoc.exists) return sendJson(res, 404, { ok: false, error: 'Task not found' });
        const task = taskDoc.data();

        if (Number(task.creatorTelegramId) === numId) {
          return sendJson(res, 403, { ok: false, error: 'You cannot complete your own created task!' });
        }

        const subSnap = await db.collection('taskSubmissions')
          .where('taskId', '==', taskId)
          .where('workerTelegramId', '==', numId)
          .get();

        const now = new Date().toISOString();
        const autoApprove = task.verificationType === 'automatic';
        const finalStatus = autoApprove ? 'approved' : 'pending_review';

        if (subSnap.empty) {
          await db.collection('taskSubmissions').add({
            taskId,
            taskTitle: task.title,
            platform: task.platform,
            workerTelegramId: numId,
            status: finalStatus,
            reward: task.reward,
            proofUrl: proofUrl || '',
            proofText: proofText || '',
            inputValues: inputValues || {},
            submittedAt: now,
            createdAt: now,
          });
        } else {
          await subSnap.docs[0].ref.update({
            status: finalStatus,
            proofUrl: proofUrl || '',
            proofText: proofText || '',
            inputValues: inputValues || {},
            submittedAt: now,
          });
        }

        if (autoApprove) {
          // Pay worker immediately
          const isUsdt = task.rewardCurrency === 'USDT';

          if (isUsdt) {
            await db.collection('users').doc(String(numId)).update({
              wallet: FieldValue.increment(task.reward), // USDT
              points: FieldValue.increment(100), // Default EFC bonus for USDT tasks
            });
          } else {
            await db.collection('users').doc(String(numId)).update({
              points: FieldValue.increment(task.reward), // EFC Points
            });
          }

          // Decrement task remaining slots
          await taskRef.update({
            completedCount: FieldValue.increment(1),
            remainingSlots: FieldValue.increment(-1),
          });

          // Send approval notification
          sendMarketNotification({
            telegramId: numId,
            botToken: token,
            type: 'WORKER_APPROVED',
            title: task.title,
            reward: task.reward,
          }).catch(() => { });
        } else {
          sendMarketNotification({
            telegramId: numId,
            botToken: token,
            type: 'WORKER_SUBMITTED',
            title: task.title,
          }).catch(() => { });
        }

        return sendJson(res, 200, { ok: true, status: finalStatus, reward: task.reward });
      } catch (err) {
        return sendJson(res, 500, { ok: false, error: err.message });
      }
    }

    // ── Everything below requires Authorization: Bearer <API_SECRET> ────────
    const auth = req.headers['authorization'] || '';
    const providedToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!safeEqual(providedToken, API_SECRET)) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }

    let data;
    try {
      data = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON' });
    }

    // ── POST /upload-branding ─────────────────────────────────────────────────
    // Production Cloudinary upload with streaming, retry, full metadata response.
    if (req.method === 'POST' && url === '/upload-branding') {
      const { image, filename, folder, publicId, oldPublicId, oldResourceType } = data;
      if (!image || typeof image !== 'string') {
        return sendJson(res, 400, { success: false, code: 'MISSING_IMAGE', message: 'image (base64 data URL) is required.' });
      }

      const isVideo = image.startsWith('data:video/');
      const isImage = image.startsWith('data:image/');
      if (!isImage && !isVideo) {
        return sendJson(res, 400, { success: false, code: 'INVALID_MIME', message: 'Only image/* and video/* data URLs are accepted.' });
      }

      const cloudStatus = getCloudinaryStatus();
      console.log(`[upload-branding] ${isVideo ? 'VIDEO' : 'IMAGE'} | ${Math.round(image.length / 1024)}KB | cloudinary=${cloudStatus.configured}`);

      // ── Try Cloudinary (primary) ─────────────────────────────────────────
      if (cloudStatus.configured) {
        try {
          const result = await uploadToCloudinary(image, {
            folder: folder || getUploadFolder(isVideo ? 'video' : 'branding'),
            publicId: publicId || (filename ? filename.replace(/\.[^.]+$/, '') : null) || `brand_${Date.now()}`,
            oldPublicId: oldPublicId || null,
            oldResourceType: oldResourceType || (isVideo ? 'video' : 'image'),
            overwrite: true,
          });
          return sendJson(res, 200, {
            success: true,
            secureUrl: result.secureUrl,
            publicId: result.publicId,
            resourceType: result.resourceType,
            width: result.width,
            height: result.height,
            bytes: result.bytes,
            format: result.format,
            duration: result.duration,
            createdAt: result.createdAt,
          });
        } catch (err) {
          console.error('[upload-branding] Cloudinary failed, trying fallback:', err.message);
          // Fall through to ImgBB / data URL fallback
        }
      }

      // ── ImgBB fallback (images only — ImgBB does not support video) ────────
      if (isImage) {
        const imgbbUrl = await uploadBase64ToImgbb(image);
        if (imgbbUrl) {
          return sendJson(res, 200, { success: true, secureUrl: imgbbUrl, resourceType: 'image' });
        }
      }

      // ── Data URL fallback — last resort, stored in Firestore (≤ 5MB) ───────
      const MAX_DATA_URL = 5 * 1024 * 1024;
      if (image.length <= MAX_DATA_URL) {
        console.log(`[upload-branding] Falling back to data URL storage (${Math.round(image.length / 1024)}KB)`);
        return sendJson(res, 200, {
          success: true,
          secureUrl: image,
          resourceType: isVideo ? 'video' : 'image',
          isDataUrl: true,
        });
      }

      return sendJson(res, 500, {
        success: false,
        code: isVideo ? 'VIDEO_TOO_LARGE' : 'IMAGE_UPLOAD_FAILED',
        message: isVideo
          ? 'Video upload failed: Cloudinary is not configured and the file is too large to store as data URL. Configure CLOUDINARY_URL in environment variables.'
          : 'Image upload failed via all available methods. Configure CLOUDINARY_URL or reduce file size.',
      });
    }

    // ── POST /upload-delete ───────────────────────────────────────────────────
    // Delete a Cloudinary asset by public_id (called when replacing existing media).
    if (req.method === 'POST' && url === '/upload-delete') {
      const { publicId: delPublicId, resourceType: delResourceType } = data;
      if (!delPublicId) {
        return sendJson(res, 400, { success: false, code: 'MISSING_PUBLIC_ID', message: 'publicId is required.' });
      }
      try {
        const result = await deleteFromCloudinary(delPublicId, delResourceType || 'image');
        return sendJson(res, 200, { success: true, result: result.result });
      } catch (err) {
        console.error('[upload-delete] Error:', err.message);
        return sendJson(res, 500, {
          success: false,
          code: err.code || 'DELETE_FAILED',
          message: err.message || 'Failed to delete Cloudinary asset.',
        });
      }
    }

    // ── POST /notify/message ─────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/message') {
      const { telegramId, message, imageUrl, btnText, btnUrl } = data;
      if (!isValidTelegramId(telegramId) || !message) {
        return sendJson(res, 400, { error: 'valid telegramId and message required' });
      }
      const extra = {};
      if (btnText && btnUrl) {
        extra.reply_markup = Markup.inlineKeyboard([[Markup.button.url(btnText, btnUrl)]]).reply_markup;
      }
      const ok = await sendToUser(
        telegramId,
        `📩 <b>Message from Elite Force Admin</b>\n\n${escapeHTML(message)}`,
        extra,
        imageUrl
      );
      return sendJson(res, 200, { ok });
    }
    // ── POST /api/notify ─────────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/api/notify') {
      const { telegramId, message } = data;
      if (!telegramId || !message) {
        return sendJson(res, 400, { error: 'telegramId and message required' });
      }
      try {
        await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
        return sendJson(res, 200, { success: true });
      } catch (err) {
        console.error(`[API] /api/notify error for ${telegramId}:`, err.message);
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // ── POST /notify/announcement ────────────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/announcement') {
      const { message, telegramIds, imageUrl, btnText, btnUrl } = data;
      if (!message || !Array.isArray(telegramIds) || telegramIds.length === 0) {
        return sendJson(res, 400, { error: 'message and telegramIds[] required' });
      }
      const extra = {};
      if (btnText && btnUrl) {
        extra.reply_markup = Markup.inlineKeyboard([[Markup.button.url(btnText, btnUrl)]]).reply_markup;
      }
      const html = `📢 <b>Elite Force Announcement</b>\n\n${escapeHTML(message)}\n\n<i>— Elite Force Team</i>`;
      const result = await broadcast(telegramIds, html, extra, imageUrl);
      return sendJson(res, 200, { ok: true, ...result });
    }

    // ── POST /notify/withdraw ────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/withdraw') {
      const { telegramId, status, amount, asset, adminNote, reason } = data;
      if (!isValidTelegramId(telegramId) || !status) {
        return sendJson(res, 400, { error: 'valid telegramId and status required' });
      }
      const assetLabel = asset === 'token' ? 'EForce Token' : 'USDT';
      const numId = Number(telegramId);

      if (status === 'Approved') {
        sendEventNotification({
          telegramId: numId,
          eventType: 'WITHDRAW_APPROVED',
          eventId: `withdraw_app_${numId}_${Date.now()}`,
          params: {
            amount: `${amount} ${assetLabel}`,
          },
        }).catch(() => { });
      } else if (status === 'Rejected') {
        sendEventNotification({
          telegramId: numId,
          eventType: 'WITHDRAW_REJECTED',
          eventId: `withdraw_rej_${numId}_${Date.now()}`,
          params: {
            amount: `${amount} ${assetLabel}`,
            reason: reason || adminNote || 'Insufficient verification.',
          },
        }).catch(() => { });
      }

      return sendJson(res, 200, { ok: true });
    }

    // ── POST /notify/deposit ──────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/deposit') {
      const { telegramId, status, amountUsdt, efcGranted, txHash, adminNote } = data;
      if (!isValidTelegramId(telegramId) || !status) {
        return sendJson(res, 400, { error: 'valid telegramId and status required' });
      }
      const numId = Number(telegramId);
      const shortHash = txHash ? (txHash.length > 20 ? `${txHash.slice(0, 10)}...${txHash.slice(-8)}` : txHash) : 'N/A';

      let msg = '';
      if (status === 'Submitted' || status === 'Pending') {
        msg = `📥 <b>BEP-20 Deposit Request Submitted!</b>\n\n` +
          `💰 <b>Amount:</b> $${amountUsdt} USDT\n` +
          `🎁 <b>EFC Bonus:</b> +${efcGranted} EFC Points\n` +
          `🔑 <b>TxHash:</b> <code>${shortHash}</code>\n` +
          `⏳ <b>Status:</b> Pending Admin Verification\n\n` +
          `<i>Our team is verifying your transaction hash on BNB Smart Chain. You will receive another message when approved.</i>`;
      } else if (status === 'Approved') {
        msg = `✅ <b>BEP-20 Deposit Approved!</b>\n\n` +
          `🎉 Your deposit of <b>$${amountUsdt} USDT</b> (+${efcGranted} EFC Points) has been verified and added to your balance!\n\n` +
          `🔑 <b>TxHash:</b> <code>${shortHash}</code>\n` +
          (adminNote ? `📝 <b>Note:</b> ${escapeHTML(adminNote)}\n\n` : '\n') +
          `<i>Thank you for funding your account!</i>`;
      } else if (status === 'Rejected') {
        msg = `❌ <b>BEP-20 Deposit Request Rejected</b>\n\n` +
          `Your deposit request for <b>$${amountUsdt} USDT</b> was rejected by admin.\n\n` +
          `🔑 <b>TxHash:</b> <code>${shortHash}</code>\n` +
          `📝 <b>Reason:</b> ${escapeHTML(adminNote || 'Invalid transaction hash or unconfirmed on chain.')}\n\n` +
          `<i>If you believe this is an error, please double check your TxHash or contact support.</i>`;
      } else {
        return sendJson(res, 400, { error: 'Invalid deposit status' });
      }

      const extra = Markup.inlineKeyboard([
        [Markup.button.webApp('💳 Open Wallet', `${getEffectiveAppUrl()}?startapp=wallet`)],
      ]);

      const ok = await sendToUser(numId, msg, extra);
      return sendJson(res, 200, { ok });
    }

    // ── POST /notify/referral ────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/referral') {
      const { referrerId, refereeName, refereeUsername, rewardAmount } = data;
      if (!isValidTelegramId(referrerId)) {
        return sendJson(res, 400, { error: 'valid referrerId required' });
      }
      const display = refereeUsername ? `@${refereeUsername}` : (refereeName || 'A friend');
      sendEventNotification({
        telegramId: Number(referrerId),
        eventType: 'REFERRAL_BONUS',
        eventId: `ref_bonus_${referrerId}_${Date.now()}`,
        params: {
          refUsername: display,
          reward: (rewardAmount || 200).toLocaleString(),
        },
      }).catch(() => { });
      return sendJson(res, 200, { ok: true });
    }

    // ── POST /notify/tier-unlocked ───────────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/tier-unlocked') {
      const { telegramId, tierBadge, tierName, requiredReferrals, pointsAdded, usdtAdded } = data;
      if (!isValidTelegramId(telegramId)) {
        return sendJson(res, 400, { error: 'valid telegramId required' });
      }

      const numId = Number(telegramId);
      const nameStr = tierName || tierBadge || 'New Tier';
      const reqStr = requiredReferrals !== undefined ? requiredReferrals : 0;
      const pts = Number(pointsAdded || 0);
      const usdt = Number(usdtAdded || 0);

      const msgLines = [
        `🏆 <b>REFERRAL TIER UNLOCKED!</b>`,
        ``,
        `Congratulations! You've unlocked the <b>${escapeHTML(nameStr)}</b> tier (${reqStr} valid referrals)!`,
        ``,
        `🎁 <b>Reward Auto-Credited:</b>`,
      ];
      if (pts > 0) msgLines.push(`⚡ <b>+${pts.toLocaleString()} EFC Points</b>`);
      if (usdt > 0) msgLines.push(`💰 <b>+$${usdt.toFixed(2)} USDT Bonus</b>`);
      msgLines.push(``);
      msgLines.push(`🚀 Keep inviting friends to unlock higher tiers & bigger rewards!`);

      const extra = Markup.inlineKeyboard([
        [Markup.button.webApp('👥 View Referral Tiers', `${getEffectiveAppUrl()}?startapp=referral`)],
      ]);

      const ok = await sendToUser(numId, msgLines.join('\n'), extra).catch(() => false);
      return sendJson(res, 200, { ok: true, sent: ok });
    }

    // ── POST /api/admin/broadcast ─────────────────────────────────────────────
    if (req.method === 'POST' && url === '/api/admin/broadcast') {
      const { targetType, targetIds, campaignId, country, language, isPremiumOnly, templateText, buttonText, buttonTab, imageUrl } = data;
      if (!templateText) {
        return sendJson(res, 400, { success: false, error: 'templateText is required' });
      }

      try {
        const dbInstance = getFirestore();
        let targetTelegramIds = [];

        if (targetType === 'specific' && Array.isArray(targetIds) && targetIds.length > 0) {
          targetTelegramIds = targetIds.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
        } else {
          const snapshot = await dbInstance.collection('users').get();
          snapshot.forEach(docSnap => {
            const u = docSnap.data();
            const uid = Number(docSnap.id);
            if (!uid || isNaN(uid)) return;

            let matches = true;
            if (isPremiumOnly && !u.isPremium) matches = false;
            if (country && u.country && String(u.country).toLowerCase() !== String(country).toLowerCase()) matches = false;
            if (language && u.language && String(u.language).toLowerCase() !== String(language).toLowerCase()) matches = false;
            if (campaignId && Array.isArray(u.completedCampaigns) && !u.completedCampaigns.includes(campaignId)) matches = false;

            if (matches) {
              targetTelegramIds.push(uid);
            }
          });
        }

        if (targetTelegramIds.length === 0) {
          return sendJson(res, 400, { success: false, error: 'No matching users found for this broadcast target.' });
        }

        const appUrl = `${getEffectiveAppUrl()}?startapp=${buttonTab || 'home'}`;
        const extra = Markup.inlineKeyboard([
          [Markup.button.webApp(buttonText || 'Open Elite Force', appUrl)]
        ]);

        const broadcastRes = await broadcast(targetTelegramIds, templateText, extra, imageUrl);

        await dbInstance.collection('notificationHistory').add({
          userId: 0,
          eventType: 'ADMIN_BROADCAST',
          eventId: `broadcast_${Date.now()}`,
          timestamp: new Date().toISOString(),
          deliveryStatus: `sent:${broadcastRes.sent},failed:${broadcastRes.failed}`,
          content: templateText,
          params: { targetType, count: targetTelegramIds.length, sent: broadcastRes.sent, failed: broadcastRes.failed },
        });

        return sendJson(res, 200, {
          success: true,
          totalTargets: targetTelegramIds.length,
          sent: broadcastRes.sent,
          failed: broadcastRes.failed,
        });
      } catch (err) {
        console.error('[API] POST /api/admin/broadcast error:', err.message);
        return sendJson(res, 500, { success: false, error: err.message || 'Failed to process broadcast.' });
      }
    }

    // ── GET /api/admin/notifications/history ──────────────────────────────
    if (req.method === 'GET' && url.startsWith('/api/admin/notifications/history')) {
      try {
        const dbInstance = getFirestore();
        const snap = await dbInstance.collection('notificationHistory').orderBy('timestamp', 'desc').limit(100).get();
        const logs = [];
        snap.forEach(docSnap => {
          logs.push({ id: docSnap.id, ...docSnap.data() });
        });
        return sendJson(res, 200, { success: true, logs });
      } catch (err) {
        console.error('[API] GET /api/admin/notifications/history error:', err.message);
        return sendJson(res, 500, { success: false, error: 'Failed to fetch notification history.' });
      }
    }



    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[Server] Unhandled error:', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

// ── Launch & Periodical Scheduler ─────────────────────────────────────────────

async function startBotWithRetry(maxRetries = 5, delayMs = 5000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Starting Elite Force bot (attempt ${attempt}/${maxRetries})...`);
      await bot.launch({ dropPendingUpdates: true });
      console.log('✅ Bot running! Send /start in Telegram to test.');

      console.log('⏱️ Initializing X Task Anti-Fraud Scheduler (15 min interval)...');
      setInterval(() => {
        runXPeriodicMonitoring(sendToUser).catch((err) => {
          console.error('[X Scheduler] Interval execution error:', err.message);
        });
      }, 15 * 60 * 1000);
      return;
    } catch (err) {
      const isConflict = err.message?.includes('409') || err.message?.includes('Conflict');
      if (isConflict && attempt < maxRetries) {
        console.warn(`⚠️ Bot launch 409 Conflict (previous bot instance still shutting down). Retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        console.error('⚠️ Bot launch warning:', err.message);
        break;
      }
    }
  }
}

startBotWithRetry();

server.listen(API_PORT, () => {
  console.log(`🌐 Notification API listening on port ${API_PORT}`);
});

process.on('unhandledRejection', (reason) => {
  const msg = reason?.message || String(reason);
  if (msg.includes('Could not load the default credentials') || msg.includes('NO_ADC_FOUND')) {
    console.warn('⚠️ [Firebase Admin] Unauthenticated mode: GCP ADC credentials not provided. Using default in-memory configuration.');
  } else {
    console.warn('⚠️ [Unhandled Rejection]', msg);
  }
});

process.on('uncaughtException', (err) => {
  console.error('💥 [Uncaught Exception]', err.message || err);
});

process.once('SIGINT', () => { bot.stop('SIGINT'); server.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });
