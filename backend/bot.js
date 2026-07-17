import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const token     = process.env.BOT_TOKEN;
const webAppUrl = process.env.MINI_APP_URL || 'http://localhost:5173';
const API_PORT  = process.env.API_PORT || 4000;
const API_SECRET = process.env.API_SECRET || 'elite_force_secret_2024';

if (!token) {
  console.error('BOT_TOKEN is not defined in env variables!');
  process.exit(1);
}

const bot = new Telegraf(token);

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeHTML(text = '') {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Send a Telegram HTML message or Photo to a specific user, silently fail on error. */
async function sendToUser(telegramId, html, extra = {}, imageUrl = null) {
  try {
    if (imageUrl && imageUrl.trim()) {
      await bot.telegram.sendPhoto(telegramId, imageUrl, {
        caption: html,
        parse_mode: 'HTML',
        ...extra,
      });
    } else {
      await bot.telegram.sendMessage(telegramId, html, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...extra,
      });
    }
    return true;
  } catch (err) {
    console.error(`[Bot] Failed to send to ${telegramId}:`, err.message);
    return false;
  }
}

/** Send a message/photo to a list of Telegram IDs (announcement). */
async function broadcast(ids, html, extra = {}, imageUrl = null, delayMs = 60) {
  let sent = 0, failed = 0;
  for (const id of ids) {
    const ok = await sendToUser(id, html, extra, imageUrl);
    ok ? sent++ : failed++;
    // Telegram rate limit — ~30 msgs/sec per bot allowed
    if (ids.length > 20) await new Promise(r => setTimeout(r, delayMs));
  }
  return { sent, failed };
}

// ── Bot commands ──────────────────────────────────────────────────────────────

bot.start(async (ctx) => {
  const username = ctx.from.first_name || 'Force Agent';
  const payload  = ctx.startPayload || '';
  const finalUrl = payload ? `${webAppUrl}?tgWebAppStartParam=${payload}` : webAppUrl;

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
  ).catch(err => console.error('Error replying start welcome:', err));

  // Handle referral notification if payload is a referral link
  if (payload.startsWith('ref_')) {
    const inviterId = parseInt(payload.replace('ref_', ''), 10);
    if (!isNaN(inviterId) && inviterId !== ctx.from.id) {
      try {
        const inviterChat    = await ctx.telegram.getChat(inviterId).catch(() => null);
        const inviterName    = inviterChat ? (inviterChat.first_name || inviterChat.username || 'your sponsor') : 'your sponsor';
        const inviterDisplay = inviterChat?.username ? `@${escapeHTML(inviterChat.username)}` : escapeHTML(inviterName);

        const inviteeName    = ctx.from.first_name || 'A user';
        const inviteeDisplay = ctx.from.username ? `@${escapeHTML(ctx.from.username)}` : escapeHTML(inviteeName);

        // Notify referrer
        await sendToUser(
          inviterId,
          `🎉 <b>New Referral!</b>\n\nUser <b>${inviteeDisplay}</b> joined using your referral link!\n\n💰 You'll receive your referral reward once they start mining!\n\n🚀 Keep sharing your link to earn more!`,
          { reply_markup: Markup.inlineKeyboard([[Markup.button.webApp('📊 View Referrals', webAppUrl)]]).reply_markup }
        );

        // Notify invitee
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
    [Markup.button.webApp('🚀 Open App', webAppUrl)]
  ]));
});

bot.command('status', async (ctx) => {
  await ctx.replyWithHTML(`⚡ <b>Elite Force Bot</b> is online!\n\n🌐 App: ${webAppUrl}\n🤖 Bot: @${ctx.me}`);
});

// ── HTTP Notification API ─────────────────────────────────────────────────────
// All endpoints require: Authorization: Bearer <API_SECRET>

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  // Auth check
  const auth = req.headers['authorization'] || '';
  if (auth !== `Bearer ${API_SECRET}`) {
    res.writeHead(401); res.end(JSON.stringify({ error: 'Unauthorized' })); return;
  }

  // Parse body
  let body = '';
  for await (const chunk of req) body += chunk;
  let data = {};
  try { data = JSON.parse(body); } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }

  const url = req.url?.split('?')[0];

  // ── POST /notify/message — send custom message to one user ──────────────────
  if (req.method === 'POST' && url === '/notify/message') {
    const { telegramId, message, imageUrl, btnText, btnUrl } = data;
    if (!telegramId || !message) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'telegramId and message required' })); return;
    }
    const extra: any = {};
    if (btnText && btnUrl) {
      extra.reply_markup = Markup.inlineKeyboard([[Markup.button.url(btnText, btnUrl)]]).reply_markup;
    }
    const ok = await sendToUser(
      telegramId,
      `📩 <b>Message from Elite Force Admin</b>\n\n${escapeHTML(message)}`,
      extra,
      imageUrl
    );
    res.writeHead(200); res.end(JSON.stringify({ ok })); return;
  }

  // ── POST /notify/announcement — broadcast to all users ─────────────────────
  if (req.method === 'POST' && url === '/notify/announcement') {
    const { message, telegramIds, imageUrl, btnText, btnUrl } = data;
    if (!message || !Array.isArray(telegramIds) || telegramIds.length === 0) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'message and telegramIds[] required' })); return;
    }
    const extra: any = {};
    if (btnText && btnUrl) {
      extra.reply_markup = Markup.inlineKeyboard([[Markup.button.url(btnText, btnUrl)]]).reply_markup;
    }
    const html = `📢 <b>Elite Force Announcement</b>\n\n${escapeHTML(message)}\n\n<i>— Elite Force Team</i>`;
    const result = await broadcast(telegramIds, html, extra, imageUrl);
    res.writeHead(200); res.end(JSON.stringify({ ok: true, ...result })); return;
  }

  // ── POST /notify/withdraw — notify user of withdrawal status ───────────────
  if (req.method === 'POST' && url === '/notify/withdraw') {
    const { telegramId, status, amount, asset, adminNote } = data;
    if (!telegramId || !status) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'telegramId and status required' })); return;
    }
    const assetLabel = asset === 'token' ? 'EForce Token' : 'USDT';
    let html = '';
    if (status === 'Approved') {
      html = `✅ <b>Withdrawal Approved!</b>\n\n💰 Amount: <b>${amount} ${assetLabel}</b>\n\n🎉 Your withdrawal has been approved and is being processed. Funds will arrive in your BEP-20 wallet shortly.\n\n<i>Thank you for being part of Elite Force!</i>`;
    } else if (status === 'Rejected') {
      html = `❌ <b>Withdrawal Rejected</b>\n\n💰 Amount: <b>${amount} ${assetLabel}</b>\n\n${adminNote ? `📝 Reason: <i>${escapeHTML(adminNote)}</i>\n\n` : ''}Please check your wallet address and balance, then try again.\n\n<a href="${webAppUrl}">Open App</a>`;
    } else if (status === 'Banned') {
      html = `🚫 <b>Account Suspended</b>\n\nYour withdrawal request has been flagged. Your account has been suspended pending review.\n\nContact support if you believe this is an error.`;
    }
    if (html) {
      const ok = await sendToUser(telegramId, html);
      res.writeHead(200); res.end(JSON.stringify({ ok }));
    } else {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Unknown status' }));
    }
    return;
  }

  // ── POST /notify/referral — notify referrer of new referral ────────────────
  if (req.method === 'POST' && url === '/notify/referral') {
    const { referrerId, refereeName, refereeUsername } = data;
    if (!referrerId) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'referrerId required' })); return;
    }
    const display = refereeUsername ? `@${escapeHTML(refereeUsername)}` : escapeHTML(refereeName || 'A new user');
    const ok = await sendToUser(
      referrerId,
      `🎉 <b>Referral Reward Unlocked!</b>\n\n👤 <b>${display}</b> just started mining using your referral link!\n\n💵 Your referral commission has been added to your account.\n\n🔥 Keep sharing your link to earn more rewards!`,
      { reply_markup: Markup.inlineKeyboard([[Markup.button.webApp('💼 Open Wallet', webAppUrl)]]).reply_markup }
    );
    res.writeHead(200); res.end(JSON.stringify({ ok })); return;
  }

  res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
});

// ── Launch ────────────────────────────────────────────────────────────────────

console.log('Starting Elite Force bot...');
bot.launch().then(() => {
  console.log('✅ Bot running! Send /start in Telegram to test.');
}).catch(err => {
  console.error('Error starting bot:', err);
});

server.listen(API_PORT, () => {
  console.log(`🌐 Notification API listening on port ${API_PORT}`);
});

process.once('SIGINT',  () => { bot.stop('SIGINT');  server.close(); });
process.once('SIGTERM', () => { bot.stop('SIGTERM'); server.close(); });
