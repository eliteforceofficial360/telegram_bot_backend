import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import http from 'http';
import crypto from 'crypto';
import {
  getXOAuthAuthUrl,
  handleXOAuthCallback,
  verifyXTask,
  runXPeriodicMonitoring,
} from './xVerificationEngine.js';

dotenv.config();

// ── Required env vars — validate BOT_TOKEN ──────
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN is missing from environment variables!');
  process.exit(1);
}

let webAppUrlRaw = (process.env.MINI_APP_URL || 'https://mini-telegram-app-c0fb4.web.app').trim();
const webAppUrl = webAppUrlRaw.endsWith('/') ? webAppUrlRaw.slice(0, -1) : webAppUrlRaw;
const API_PORT = process.env.API_PORT || 4000;
const API_SECRET = process.env.API_SECRET || 'https://elite-force-telegram-app.onrender.com';
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '6d70077319714757c9a96e622b78edc3';
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyA3flAWMnQiYeVAOCv_je0SLExI5Vxol4Y';
const RECAPTCHA_PROJECT_ID = process.env.RECAPTCHA_PROJECT_ID; // e.g. 'balmy-access-465013-m7'
const RECAPTCHA_SITE_KEY = process.env.RECAPTCHA_SITE_KEY;

const bot = new Telegraf(token);

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

/** Resolves any imageUrl (base64 or plain URL) to a URL Telegram can fetch. */
async function resolveImageUrl(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:image/')) {
    return await uploadBase64ToImgbb(imageUrl);
  }
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  return null;
}

/** Send a Telegram HTML message or photo to a specific user. Returns true/false. */
async function sendToUser(telegramId, html, extra = {}, imageUrl = null) {
  try {
    const finalPhotoUrl = await resolveImageUrl(imageUrl);

    if (finalPhotoUrl) {
      try {
        // Telegram caption limit is 1024 chars. If text is longer, send photo then a separate message.
        if (html.length > 1024) {
          await bot.telegram.sendPhoto(telegramId, finalPhotoUrl);
          await bot.telegram.sendMessage(telegramId, html, {
            parse_mode: 'HTML',
            disable_web_page_preview: true,
            ...extra,
          });
        } else {
          await bot.telegram.sendPhoto(telegramId, finalPhotoUrl, {
            caption: html,
            parse_mode: 'HTML',
            ...extra,
          });
        }
        return true;
      } catch (photoErr) {
        console.warn(`[Bot] Failed to send photo to ${telegramId}, falling back to text:`, photoErr.message);
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
  const finalPhotoUrl = await resolveImageUrl(imageUrl); // convert once, reuse per recipient

  for (const id of ids) {
    const ok = await sendToUser(id, html, extra, finalPhotoUrl);
    ok ? sent++ : failed++;
    if (ids.length > 20) await new Promise((r) => setTimeout(r, delayMs));
  }
  return { sent, failed };
}

/** Reads and JSON-parses a request body. Throws on invalid JSON. */
async function readJsonBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
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
  const username = ctx.from.first_name || 'Force Agent';
  const payload = ctx.startPayload || '';
  const finalUrl = payload ? `${webAppUrl}?tgWebAppStartParam=${encodeURIComponent(payload)}` : webAppUrl;

  const welcomeMsg =
`🔥 <b>ELITE FORCE — EForce Token</b> 🔥

👋 Welcome, <b>${escapeHTML(username)}</b>!

You've just entered the <b>next-generation Web3 mining ecosystem</b>. Elite Force rewards you for every action.

━━━━━━━━━━━━━━━━━━━━
⛏️  <b>Mine</b> EForce tokens passively
✅  <b>Complete missions</b> & earn rewards
🏆  <b>Climb</b> the global leaderboard
👥  <b>Refer friends</b> and earn commissions
💸  <b>Withdraw</b> USDT to your BEP-20 wallet
━━━━━━━━━━━━━━━━━━━━

🚀 Tap the button below to launch your dashboard!`;

  await ctx.replyWithHTML(
    welcomeMsg,
    Markup.inlineKeyboard([
      [Markup.button.webApp('🔥  Launch Elite Force App  🔥', finalUrl)],
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
          { reply_markup: Markup.inlineKeyboard([[Markup.button.webApp('📊 View Referrals', webAppUrl)]]).reply_markup }
        );

        await ctx.replyWithHTML(
          `🔗 <b>Referral Linked!</b>\n\nYou joined under sponsor <b>${escapeHTML(inviterName)}</b> (${inviterDisplay}). Welcome to the Elite Force team!\n\n⛏️ Start mining to activate your account!`
        ).catch(() => {});
      } catch (err) {
        console.error('Referral notification error:', err);
      }
    }
  }
});

bot.command('app', (ctx) => {
  ctx.reply('Opening Elite Force...', Markup.inlineKeyboard([
    [Markup.button.webApp('🚀 Open App', webAppUrl)],
  ]));
});

bot.command('status', async (ctx) => {
  await ctx.replyWithHTML(`⚡ <b>Elite Force Bot</b> is online!\n\n🌐 App: ${webAppUrl}\n🤖 Bot: @${ctx.me}`);
});

// ── HTTP Notification API ─────────────────────────────────────────────────────
// All endpoints (except the two explicitly marked public) require:
// Authorization: Bearer <API_SECRET>

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url?.split('?')[0];

  try {
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

    // ── PUBLIC: POST /upload-profile-photo ───────────────────────────────────
    if (req.method === 'POST' && url === '/upload-profile-photo') {
      let uploadData;
      try {
        uploadData = await readJsonBody(req);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }

      const { telegramId, photoUrl } = uploadData;
      if (!isValidTelegramId(telegramId) || !photoUrl) {
        return sendJson(res, 400, { error: 'valid telegramId and photoUrl required' });
      }

      try {
        const { v2: cloudinary } = await import('cloudinary');
        const uploadResult = await cloudinary.uploader.upload(photoUrl, {
          folder: 'telegram_profiles',
          public_id: `user_${telegramId}`,
          overwrite: true,
        });
        return sendJson(res, 200, { secureUrl: uploadResult.secure_url });
      } catch (err) {
        console.error('[Cloudinary] Upload error:', err);
        return sendJson(res, 500, { error: 'Cloudinary upload failed' });
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

      const { telegramId, chatId } = checkData;
      if (!isValidTelegramId(telegramId) || !chatId) {
        return sendJson(res, 400, { error: 'valid telegramId and chatId required' });
      }

      try {
        let targetChat = String(chatId).trim();
        if (!targetChat.startsWith('@') && !targetChat.startsWith('-100') && isNaN(Number(targetChat))) {
          targetChat = `@${targetChat}`;
        }

        const member = await bot.telegram.getChatMember(targetChat, Number(telegramId));
        const validStatuses = ['creator', 'administrator', 'member', 'restricted'];
        const isMember = validStatuses.includes(member.status) && (member.status !== 'restricted' || member.is_member !== false);

        return sendJson(res, 200, { isMember, status: member.status });
      } catch (err) {
        console.warn(`[Bot] Membership check failed for ${telegramId} in ${chatId}:`, err.message);
        // NOTE: previously defaulted to isMember: true on failure, which let anyone bypass
        // the join-check simply by making the lookup fail (e.g. bot not admin, wrong chat id,
        // transient API error). Since this endpoint exists specifically to gate task rewards,
        // failing open defeats its purpose — default to false and surface the failure instead.
        return sendJson(res, 200, { isMember: false, warning: 'Chat check unavailable', details: err.message });
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

    // ── POST /upload-branding ────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/upload-branding') {
      const { image, filename } = data;
      if (!image) return sendJson(res, 400, { error: 'image data required' });

      const hasCloudinary =
        process.env.CLOUDINARY_URL ||
        (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

      if (hasCloudinary) {
        try {
          const { v2: cloudinary } = await import('cloudinary');
          if (!process.env.CLOUDINARY_URL && process.env.CLOUDINARY_CLOUD_NAME) {
            cloudinary.config({
              cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
              api_key: process.env.CLOUDINARY_API_KEY,
              api_secret: process.env.CLOUDINARY_API_SECRET,
            });
          }
          const uploadResult = await cloudinary.uploader.upload(image, {
            folder: 'branding',
            public_id: filename || `brand_${Date.now()}`,
            overwrite: true,
          });
          if (uploadResult?.secure_url) {
            return sendJson(res, 200, { secureUrl: uploadResult.secure_url });
          }
        } catch (err) {
          console.warn('[Cloudinary] Upload failed, proceeding to fallback:', err.message);
        }
      }

      const imgbbUrl = await uploadBase64ToImgbb(image);
      if (imgbbUrl) return sendJson(res, 200, { secureUrl: imgbbUrl });

      if (typeof image === 'string' && image.startsWith('data:image/')) {
        return sendJson(res, 200, { secureUrl: image });
      }

      return sendJson(res, 400, { error: 'Image processing failed' });
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
      const { telegramId, status, amount, asset, adminNote } = data;
      if (!isValidTelegramId(telegramId) || !status) {
        return sendJson(res, 400, { error: 'valid telegramId and status required' });
      }
      const assetLabel = asset === 'token' ? 'EForce Token' : 'USDT';
      let html = '';
      if (status === 'Approved') {
        html = `✅ <b>Withdrawal Approved!</b>\n\n💰 Amount: <b>${escapeHTML(String(amount))} ${assetLabel}</b>\n\n🎉 Your withdrawal has been approved and is being processed.${adminNote ? `\n\n📝 Note/TxID: <code>${escapeHTML(adminNote)}</code>` : ''}\n\nFunds will arrive in your BEP-20 wallet shortly.\n\n<i>Thank you for being part of Elite Force!</i>`;
      } else if (status === 'Rejected') {
        html = `❌ <b>Withdrawal Rejected</b>\n\n💰 Amount: <b>${escapeHTML(String(amount))} ${assetLabel}</b>\n\n${adminNote ? `📝 Reason: <i>${escapeHTML(adminNote)}</i>\n\n` : ''}Please check your wallet address and balance, then try again.\n\n<a href="${webAppUrl}">Open App</a>`;
      } else if (status === 'Banned') {
        html = `🚫 <b>Account Suspended</b>\n\nYour withdrawal request has been flagged.${adminNote ? `\n\n📝 Reason: <i>${escapeHTML(adminNote)}</i>\n\n` : '\n\n'}Your account has been suspended pending review. Contact support if you believe this is an error.`;
      }
      if (html) {
        const ok = await sendToUser(telegramId, html);
        return sendJson(res, 200, { ok });
      }
      return sendJson(res, 400, { error: 'Unknown status' });
    }

    // ── POST /notify/referral ────────────────────────────────────────────────
    if (req.method === 'POST' && url === '/notify/referral') {
      const { referrerId, refereeName, refereeUsername } = data;
      if (!isValidTelegramId(referrerId)) {
        return sendJson(res, 400, { error: 'valid referrerId required' });
      }
      const display = refereeUsername ? `@${escapeHTML(refereeUsername)}` : escapeHTML(refereeName || 'A new user');
      const ok = await sendToUser(
        referrerId,
        `🎉 <b>Referral Reward Unlocked!</b>\n\n👤 <b>${display}</b> just started mining using your referral link!\n\n💵 Your referral commission has been added to your account.\n\n🔥 Keep sharing your link to earn more rewards!`,
        { reply_markup: Markup.inlineKeyboard([[Markup.button.webApp('💼 Open Wallet', webAppUrl)]]).reply_markup }
      );
      return sendJson(res, 200, { ok });
    }

    // ── X (TWITTER) OAUTH & VERIFICATION ENGINE ENDPOINTS ────────────────────

    if (req.method === 'GET' && url.startsWith('/api/x/auth-url')) {
      const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
      const telegramId = urlParams.get('telegramId');
      if (!isValidTelegramId(telegramId)) {
        return sendJson(res, 400, { error: 'telegramId is required' });
      }
      const authData = getXOAuthAuthUrl(telegramId);
      return sendJson(res, 200, { ok: true, ...authData });
    }

    if (req.method === 'POST' && url === '/api/x/callback') {
      const { code, state, codeVerifier } = data;
      if (!code) return sendJson(res, 400, { error: 'OAuth code is required' });
      const result = await handleXOAuthCallback(code, state, codeVerifier);
      return sendJson(res, 200, { ok: true, ...result });
    }

    if (req.method === 'POST' && url === '/api/x/verify-task') {
      const { telegramId, taskId, taskType, targetId, rewardAmount } = data;
      if (!isValidTelegramId(telegramId) || !taskId) {
        return sendJson(res, 400, { error: 'valid telegramId and taskId required' });
      }
      const result = await verifyXTask(telegramId, taskId, taskType, targetId, rewardAmount || 100);
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error('[Server] Unhandled error:', err);
    return sendJson(res, 500, { error: 'Internal Server Error' });
  }
});

// ── Launch & Periodical Scheduler ─────────────────────────────────────────────

console.log('Starting Elite Force bot...');
bot.launch().then(() => {
  console.log('✅ Bot running! Send /start in Telegram to test.');

  console.log('⏱️ Initializing X Task Anti-Fraud Scheduler (15 min interval)...');
  setInterval(() => {
    runXPeriodicMonitoring(sendToUser).catch((err) => {
      console.error('[X Scheduler] Interval execution error:', err.message);
    });
  }, 15 * 60 * 1000);
}).catch((err) => {
  console.error('Error starting bot:', err);
});

server.listen(API_PORT, () => {
  console.log(`🌐 Notification API listening on port ${API_PORT}`);
});

process.once('SIGINT', () => { bot.stop('SIGINT'); server.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });
