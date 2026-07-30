// Nexora Labs — Elite Force X Verification Engine v3.0
// Username-Based Verification | App-Only Bearer Token | No OAuth Required

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function getFirebaseAdminCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const parsed = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
      return cert(parsed);
    } catch (e) {
      console.warn('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    }
  }
  if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
      return cert({
        projectId: process.env.FIREBASE_PROJECT_ID || 'mini-telegram-app-c0fb4',
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      });
    } catch (e) {
      console.warn('[Firebase Admin] Failed to parse clientEmail/privateKey:', e.message);
    }
  }
  try {
    const searchDirs = [process.cwd(), path.join(process.cwd(), 'backend')];
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        const saFile = files.find(f => f.includes('firebase-adminsdk') && f.endsWith('.json'));
        if (saFile) {
          const content = fs.readFileSync(path.join(dir, saFile), 'utf8');
          return cert(JSON.parse(content));
        }
      }
    }
  } catch (e) { /* silent */ }
  return null;
}

if (!getApps().length) {
  try {
    const credential = getFirebaseAdminCredential();
    if (credential) {
      initializeApp({ credential });
      console.log('✅ [Firebase Admin] Initialized with Service Account Credentials!');
    } else {
      initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'mini-telegram-app-c0fb4' });
      console.log('⚠️ [Firebase Admin] Initialized with Project ID only.');
    }
  } catch (err) {
    console.warn('[Firebase Admin] Initialization warning:', err.message);
  }
}

const db = getFirestore();
const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN || '';
const verificationRateLimits = new Map();
const USERNAME_REGEX = /^[A-Za-z0-9_]{1,15}$/;

function normalizeUsername(raw) {
  return raw.trim().replace(/^@/, '').toLowerCase();
}

function isValidUsername(username) {
  return USERNAME_REGEX.test(username);
}

function checkRateLimit(telegramId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 5;
  const userLogs = verificationRateLimits.get(telegramId) || [];
  const validLogs = userLogs.filter(ts => now - ts < windowMs);
  if (validLogs.length >= maxRequests) return false;
  validLogs.push(now);
  verificationRateLimits.set(telegramId, validLogs);
  return true;
}

async function writeLog(collectionName, data) {
  try {
    await db.collection(collectionName).add({ ...data, timestamp: FieldValue.serverTimestamp() });
  } catch (err) {
    console.warn(`[X Engine v3.0] Log write error (${collectionName}):`, err.message);
  }
}

async function xApiGet(endpoint) {
  if (!X_BEARER_TOKEN) {
    console.warn('[X Engine v3.0] X_BEARER_TOKEN is not set. Verification unavailable.');
    return { ok: false, status: 0, error: 'X_BEARER_TOKEN not configured' };
  }
  try {
    const res = await fetch(`https://api.twitter.com/2/${endpoint}`, {
      headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
    });
    let data = null;
    try { data = await res.json(); } catch { /* non-JSON */ }
    return { ok: res.ok, status: res.status, data, error: data?.errors?.[0]?.message || null };
  } catch (err) {
    return { ok: false, status: 0, error: err.message };
  }
}

async function resolveXUserId(twitterUsername) {
  const snap = await db.collection('xUserIds').doc(twitterUsername).get();
  if (snap.exists && snap.data().xUserId) return snap.data().xUserId;
  const result = await xApiGet(`users/by/username/${encodeURIComponent(twitterUsername)}?user.fields=id,username,name`);
  if (!result.ok) {
    if (result.status === 404) throw new Error(`X account @${twitterUsername} not found.`);
    if (result.status === 403) throw new Error('X API access denied. Bearer Token may be invalid.');
    throw new Error(`X API error (HTTP ${result.status}): ${result.error || 'Unknown error'}`);
  }
  const xUserId = result.data?.data?.id;
  if (!xUserId) throw new Error(`Could not resolve X user ID for @${twitterUsername}`);
  await db.collection('xUserIds').doc(twitterUsername).set({ xUserId, username: twitterUsername, cachedAt: FieldValue.serverTimestamp() });
  return xUserId;
}

async function verifyFollowByUserId(xUserId, targetUserId) {
  const result = await xApiGet(`users/${xUserId}/following?max_results=1000`);
  if (result.status === 403 || result.status === 401) return { verifiable: false, isDone: false, code: 'PLAN_RESTRICTION', message: 'Follow verification requires X Basic API plan.' };
  if (result.status === 429 || result.status >= 500) return { verifiable: false, isDone: false, code: 'RATE_LIMITED', message: 'X API rate limited. Try again later.' };
  if (!result.ok) return { verifiable: false, isDone: false, code: 'VERIFICATION_UNAVAILABLE', message: result.error || 'X API unavailable.' };
  const list = result.data?.data || [];
  const isFollowing = list.some(u => u.id === targetUserId);
  return { verifiable: true, isDone: isFollowing, code: isFollowing ? 'SUCCESS' : 'FOLLOW_NOT_FOUND', message: isFollowing ? 'Follow verified.' : 'Not following the required account.' };
}

async function verifyLikeByUserId(xUserId, targetTweetId) {
  const result = await xApiGet(`users/${xUserId}/liked_tweets?max_results=100`);
  if (result.status === 403 || result.status === 401) return { verifiable: false, isDone: false, code: 'PLAN_RESTRICTION', message: 'Like verification requires X Basic API plan.' };
  if (result.status === 429 || result.status >= 500) return { verifiable: false, isDone: false, code: 'RATE_LIMITED', message: 'X API rate limited. Try again later.' };
  if (!result.ok) return { verifiable: false, isDone: false, code: 'VERIFICATION_UNAVAILABLE', message: result.error || 'X API unavailable.' };
  const list = result.data?.data || [];
  const isLiked = list.some(t => t.id === targetTweetId);
  return { verifiable: true, isDone: isLiked, code: isLiked ? 'SUCCESS' : 'LIKE_NOT_FOUND', message: isLiked ? 'Like verified.' : 'Tweet not found in liked tweets.' };
}

async function verifyRepostByTweetId(targetTweetId, xUserId) {
  const result = await xApiGet(`tweets/${targetTweetId}/retweeted_by?max_results=100`);
  if (result.status === 403 || result.status === 401) return { verifiable: false, isDone: false, code: 'PLAN_RESTRICTION', message: 'Repost verification unavailable.' };
  if (result.status === 429 || result.status >= 500) return { verifiable: false, isDone: false, code: 'RATE_LIMITED', message: 'X API rate limited. Try again later.' };
  if (!result.ok) return { verifiable: false, isDone: false, code: 'VERIFICATION_UNAVAILABLE', message: result.error || 'X API unavailable.' };
  const list = result.data?.data || [];
  const isReposted = list.some(u => u.id === xUserId);
  return { verifiable: true, isDone: isReposted, code: isReposted ? 'SUCCESS' : 'REPOST_NOT_FOUND', message: isReposted ? 'Repost verified.' : 'User has not reposted the required tweet.' };
}

async function verifyCommentByUsername(twitterUsername, targetTweetId, requiredKeyword) {
  let query = `from:${twitterUsername} conversation_id:${targetTweetId}`;
  if (requiredKeyword) query += ` ${requiredKeyword}`;
  const result = await xApiGet(`tweets/search/recent?query=${encodeURIComponent(query)}&max_results=10`);
  if (result.status === 403 || result.status === 401) return { verifiable: false, isDone: false, code: 'PLAN_RESTRICTION', message: 'Comment verification unavailable.' };
  if (!result.ok) return { verifiable: false, isDone: false, code: 'VERIFICATION_UNAVAILABLE', message: result.error || 'X API unavailable.' };
  const list = result.data?.data || [];
  const isDone = list.length > 0;
  return { verifiable: true, isDone, code: isDone ? 'SUCCESS' : 'COMMENT_NOT_FOUND', message: isDone ? 'Comment verified.' : 'No matching comment found.' };
}

export async function saveXUsername(telegramId, rawUsername) {
  const numId = Number(telegramId);
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) return { ok: false, error: 'Invalid X username. Use 1–15 letters, numbers, or underscores.' };
  const existingDoc = await db.collection('xUsers').doc(String(numId)).get();
  if (existingDoc.exists) {
    const existing = existingDoc.data();
    if (existing.locked && existing.twitterUsername !== username) {
      return { ok: false, error: `Your X account (@${existing.twitterUsername}) is locked. Contact admin to change.`, locked: true, twitterUsername: existing.twitterUsername };
    }
  }
  const duplicateSnap = await db.collection('xUsers').where('twitterUsername', '==', username).get();
  for (const doc of duplicateSnap.docs) {
    if (doc.data().telegramId !== numId) {
      await writeLog('fraudLogs', { telegramId: numId, attemptedUsername: username, existingTelegramId: doc.data().telegramId, reason: 'DUPLICATE_USERNAME_ACROSS_ACCOUNTS' });
      return { ok: false, error: `@${username} is already linked to another account.` };
    }
  }
  await db.collection('xUsers').doc(String(numId)).set({
    telegramId: numId, twitterUsername: username,
    verified: existingDoc.exists ? (existingDoc.data().verified || false) : false,
    verifiedAt: existingDoc.exists ? (existingDoc.data().verifiedAt || null) : null,
    locked: existingDoc.exists ? (existingDoc.data().locked || false) : false,
    linkedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await db.collection('users').doc(String(numId)).set({
    socialConnections: { x: { handle: `@${username}`, connected: true, linkedAt: new Date().toISOString(), verified: existingDoc.exists ? (existingDoc.data().verified || false) : false } },
  }, { merge: true });
  await writeLog('authenticationLogs', { telegramId: numId, twitterUsername: username, event: 'USERNAME_SAVED' });
  console.log(`✅ [X Engine v3.0] @${username} saved for telegramId=${numId}`);
  return { ok: true, twitterUsername: username, locked: existingDoc.exists ? (existingDoc.data().locked || false) : false };
}

export async function verifyXTask(telegramId, taskId, taskType, targetId, rewardAmount = 100, requiredKeyword = '') {
  const numId = Number(telegramId);
  if (!checkRateLimit(numId)) return { success: false, code: 'RATE_LIMITED', message: 'Rate limit exceeded. Wait 60 seconds before retrying.' };
  const xUserDoc = await db.collection('xUsers').doc(String(numId)).get();
  if (!xUserDoc.exists || !xUserDoc.data().twitterUsername) return { success: false, code: 'NO_USERNAME', message: 'Connect your X account first (Profile → Connections → X).' };
  const { twitterUsername } = xUserDoc.data();
  const completionDocId = `${numId}_x_${taskId}`;
  const completionRef = db.collection('taskCompletions').doc(completionDocId);
  const completionSnap = await completionRef.get();
  if (completionSnap.exists && completionSnap.data()?.isCompleted && !completionSnap.data()?.isRevoked) return { success: false, code: 'DUPLICATE_CLAIM', message: 'Reward already claimed for this task.' };
  let xUserId;
  try { xUserId = await resolveXUserId(twitterUsername); }
  catch (err) {
    await writeLog('verificationLogs', { telegramId: numId, taskId, taskType, status: 'USERNAME_RESOLVE_FAILED', error: err.message });
    return { success: false, code: 'USERNAME_NOT_FOUND', message: err.message };
  }
  let checkResult = { verifiable: false, isDone: false, code: 'TASK_NOT_COMPLETED', message: 'Task engagement not found.' };
  if (taskType === 'x_follow' || taskType === 'x') checkResult = await verifyFollowByUserId(xUserId, targetId);
  else if (taskType === 'x_like') checkResult = await verifyLikeByUserId(xUserId, targetId);
  else if (taskType === 'x_repost' || taskType === 'x_retweet') checkResult = await verifyRepostByTweetId(targetId, xUserId);
  else if (taskType === 'x_comment') checkResult = await verifyCommentByUsername(twitterUsername, targetId, requiredKeyword);
  else checkResult = await verifyFollowByUserId(xUserId, targetId);
  if (!checkResult.verifiable) {
    await writeLog('verificationLogs', { telegramId: numId, taskId, taskType, twitterUsername, code: checkResult.code, status: 'UNAVAILABLE' });
    return { success: false, code: checkResult.code || 'VERIFICATION_UNAVAILABLE', message: checkResult.message || 'X API temporarily unavailable.' };
  }
  if (!checkResult.isDone) {
    await writeLog('verificationLogs', { telegramId: numId, taskId, taskType, twitterUsername, code: checkResult.code, status: 'FAILED' });
    return { success: false, code: checkResult.code || 'TASK_NOT_COMPLETED', message: checkResult.message || 'Required X engagement not found.' };
  }
  const userRef = db.collection('users').doc(String(numId));
  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const currentPoints = userDoc.exists ? (userDoc.data().points || 0) : 0;
    transaction.set(userRef, { points: currentPoints + rewardAmount }, { merge: true });
    transaction.set(completionRef, { telegramId: numId, twitterUsername, xUserId, taskId, taskType, targetId, reward: rewardAmount, isCompleted: true, isRevoked: false, verifiedAt: FieldValue.serverTimestamp() });
    transaction.set(db.collection('pointHistory').doc(), { telegramId: numId, amount: rewardAmount, type: 'TASK_REWARD', taskId, taskType, timestamp: FieldValue.serverTimestamp() });
  });
  await db.collection('xUsers').doc(String(numId)).set({ verified: true, verifiedAt: FieldValue.serverTimestamp(), locked: true, lastVerificationTimestamp: FieldValue.serverTimestamp() }, { merge: true });
  await db.collection('users').doc(String(numId)).set({ socialConnections: { x: { verified: true } } }, { merge: true });
  await writeLog('verificationLogs', { telegramId: numId, taskId, taskType, twitterUsername, rewardAmount, status: 'SUCCESS' });
  await writeLog('auditLogs', { telegramId: numId, event: 'POINT_AWARDED', amount: rewardAmount, taskId });
  return { success: true, code: 'SUCCESS', reward: rewardAmount, twitterUsername, message: `✅ Task verified! +${rewardAmount} EFC Points awarded!` };
}

export async function runXPeriodicMonitoring(sendToUserCallback = null) {
  console.log('🔄 [Reward Reversal Engine v3.0] Running automated task audit...');
  try {
    let adminSettings = { rewardReversalEnabled: true, gracePeriodHours: 24, reversalDeductionType: 'full', autoReVerificationEnabled: true };
    try { const snap = await db.collection('adminSettings').doc('config').get(); if (snap.exists) adminSettings = { ...adminSettings, ...snap.data() }; } catch (e) { /* fallback */ }
    if (adminSettings.rewardReversalEnabled === false) { console.log('ℹ️ Reversal disabled by Admin.'); return; }
    const GRACE_PERIOD_MS = (adminSettings.gracePeriodHours ?? 24) * 3600 * 1000;
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const now = Date.now();
    const completionsSnap = await db.collection('taskCompletions').where('isCompleted', '==', true).get();
    let checkedCount = 0; let evaluatedCount = 0;
    for (const docSnap of completionsSnap.docs) {
      const data = docSnap.data();
      const { telegramId, taskId, taskType, targetId, reward, verifiedAt, twitterUsername, xUserId, retentionChecked, retentionDeducted } = data;
      if (!taskType || !taskType.startsWith('x')) continue;
      checkedCount++;
      const completionTime = verifiedAt?.toDate ? verifiedAt.toDate().getTime() : (typeof verifiedAt === 'number' ? verifiedAt : now - (11 * 60 * 1000));
      const elapsedTime = now - completionTime;
      let isCurrentlyValid = true;
      if (twitterUsername && xUserId && adminSettings.autoReVerificationEnabled !== false) {
        let checkResult = { verifiable: false, isDone: true };
        if (taskType === 'x_follow' || taskType === 'x') checkResult = await verifyFollowByUserId(xUserId, targetId);
        else if (taskType === 'x_like') checkResult = await verifyLikeByUserId(xUserId, targetId);
        else if (taskType === 'x_repost' || taskType === 'x_retweet') checkResult = await verifyRepostByTweetId(targetId, xUserId);
        if (checkResult.verifiable) isCurrentlyValid = checkResult.isDone;
      }
      const userRef = db.collection('users').doc(String(telegramId));
      if (!retentionChecked && elapsedTime >= TEN_MINUTES_MS) {
        await db.runTransaction(async (t) => {
          const ud = await t.get(userRef);
          const cur = ud.exists ? (ud.data().points || 0) : 0;
          if (!isCurrentlyValid) {
            t.set(docSnap.ref, { retentionChecked: true, unfollowedWithin10Min: true, retentionDeducted: false, checkedAt: FieldValue.serverTimestamp() }, { merge: true });
            if (typeof sendToUserCallback === 'function') await sendToUserCallback(telegramId, `📋 <b>Task Status</b>\n<b>${taskId}</b> ✅\nAction removed → <b>No deduction</b>\nBalance: <b>${cur} pts</b>`).catch(() => {});
          } else {
            const newPts = Math.max(0, cur - 5);
            t.set(userRef, { points: newPts }, { merge: true });
            t.set(docSnap.ref, { retentionChecked: true, unfollowedWithin10Min: false, retentionDeducted: true, pointsDeducted: 5, checkedAt: FieldValue.serverTimestamp() }, { merge: true });
            t.set(db.collection('deductionHistory').doc(), { telegramId: Number(telegramId), taskId, taskType, pointsDeducted: 5, reason: '10-minute retention rule', timestamp: FieldValue.serverTimestamp() });
            if (typeof sendToUserCallback === 'function') await sendToUserCallback(telegramId, `📋 <b>Task Status</b>\n<b>${taskId}</b> ✅\nStill following → <b>-5 pts</b>\nBalance: <b>${newPts} pts</b>`).catch(() => {});
          }
        });
        evaluatedCount++; continue;
      }
      if (retentionChecked && !isCurrentlyValid) {
        if (!data.inGracePeriod) {
          await docSnap.ref.set({ inGracePeriod: true, gracePeriodStart: FieldValue.serverTimestamp() }, { merge: true });
          if (typeof sendToUserCallback === 'function') await sendToUserCallback(telegramId, `⚠️ <b>Action Removed!</b>\nRestore for <b>${taskId}</b> within ${adminSettings.gracePeriodHours ?? 24}h.`).catch(() => {});
        } else {
          const graceStart = data.gracePeriodStart?.toDate ? data.gracePeriodStart.toDate().getTime() : (data.gracePeriodStart || now);
          if (now - graceStart >= GRACE_PERIOD_MS) {
            const ded = adminSettings.reversalDeductionType === 'partial' ? Math.round((reward || 100) / 2) : (reward || 100);
            await db.runTransaction(async (t) => {
              const ud = await t.get(userRef);
              const cur = ud.exists ? (ud.data().points || 0) : 0;
              t.set(userRef, { points: Math.max(0, cur - ded) }, { merge: true });
              t.set(docSnap.ref, { isCompleted: false, isRevoked: true, isInvalid: true, inGracePeriod: false, revokedAt: FieldValue.serverTimestamp(), revocationReason: 'Action removed — grace expired' }, { merge: true });
              t.set(db.collection('deductionHistory').doc(), { telegramId: Number(telegramId), taskId, taskType, pointsDeducted: ded, reason: 'Task Verification Failed', timestamp: FieldValue.serverTimestamp() });
            });
            if (typeof sendToUserCallback === 'function') await sendToUserCallback(telegramId, `⚠️ <b>Reward Revoked</b>\n<b>${taskId}</b>\n🔻 -${ded} EFP`).catch(() => {});
          }
        }
      } else if (data.inGracePeriod && isCurrentlyValid) {
        await docSnap.ref.set({ inGracePeriod: false, gracePeriodStart: null }, { merge: true });
      }
      await new Promise(r => setTimeout(r, 150));
    }
    console.log(`✅ [Reward Reversal Engine v3.0] Done. Evaluated: ${evaluatedCount}/${checkedCount}`);
  } catch (err) {
    console.error('❌ [Reward Reversal Engine v3.0] Error:', err.message);
  }
}
