// Nexora Labs — Elite Force X Verification Engine v2.0
// Official X (Twitter) OAuth 2.0, API v2 Task Verification, Anti-Fraud Engine & Periodical Scheduler

import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'mini-telegram-app-c0fb4',
  });
}

const db = getFirestore();

const X_CLIENT_ID = process.env.X_CLIENT_ID || 'TTJzVW9MZEFlYXRHRmZTMHR6Si06MTpjaQ';
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET || 'Gud3evcnm97ShMJNYpJe_z1cu5C19Tgsz14gHbP3xKR1_siSJ8';
const X_CALLBACK_URL = process.env.X_CALLBACK_URL || 'https://mini-telegram-app-c0fb4.web.app/auth/x/callback';

// In-memory sessions & rate-limiting maps
const pkceSessions = new Map();
const verificationRateLimits = new Map();

/**
 * Base64URL encoding helper for PKCE
 */
function base64UrlEncode(str) {
  return str
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate PKCE Code Verifier & Challenge (S256)
 */
function generatePKCE() {
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = base64UrlEncode(hash);
  return { codeVerifier, codeChallenge };
}

/**
 * Anti-Fraud Rate Limiter: Max 3 verification requests per 60s per user
 */
function checkRateLimit(telegramId) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 3;

  const userLogs = verificationRateLimits.get(telegramId) || [];
  const validLogs = userLogs.filter(ts => now - ts < windowMs);

  if (validLogs.length >= maxRequests) {
    return false;
  }

  validLogs.push(now);
  verificationRateLimits.set(telegramId, validLogs);
  return true;
}

/**
 * Audit Logger for Security, Verification, Authentication & Fraud Logs
 */
async function writeLog(collectionName, data) {
  try {
    await db.collection(collectionName).add({
      ...data,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn(`[X Engine v2.0] Log write error (${collectionName}):`, err.message);
  }
}

/**
 * Generate OAuth 2.0 PKCE Auth URL
 */
export function getXOAuthAuthUrl(telegramId) {
  if (!telegramId) {
    throw new Error('Telegram User ID is required');
  }

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  // Store session (valid for 15 mins)
  pkceSessions.set(state, {
    telegramId: Number(telegramId),
    codeVerifier,
    createdAt: Date.now(),
  });

  const scope = encodeURIComponent('tweet.read users.read follows.read like.read offline.access');
  const redirectUri = encodeURIComponent(X_CALLBACK_URL);

  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${X_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  writeLog('authenticationLogs', {
    telegramId: Number(telegramId),
    event: 'OAUTH_URL_GENERATED',
    state,
  });

  return { authUrl, state, codeVerifier };
}

/**
 * Handle OAuth 2.0 PKCE Callback & Token Exchange
 */
export async function handleXOAuthCallback(code, state, codeVerifierInput = null) {
  let session = pkceSessions.get(state);
  let codeVerifier = session?.codeVerifier || codeVerifierInput;
  let telegramId = session?.telegramId;

  if (!codeVerifier) {
    throw new Error('Invalid or expired OAuth state session');
  }

  const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');

  const params = new URLSearchParams();
  params.append('code', code);
  params.append('grant_type', 'authorization_code');
  params.append('client_id', X_CLIENT_ID);
  params.append('redirect_uri', X_CALLBACK_URL);
  params.append('code_verifier', codeVerifier);

  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basicAuth}`,
    },
    body: params.toString(),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    console.error('[X Engine v2.0] Token exchange failed:', errText);
    writeLog('fraudLogs', { telegramId, event: 'TOKEN_EXCHANGE_FAILED', details: errText });
    throw new Error(`X OAuth exchange failed: ${tokenRes.statusText}`);
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokenData;

  // Fetch X User profile
  const profileRes = await fetch('https://api.twitter.com/2/users/me', {
    headers: { 'Authorization': `Bearer ${access_token}` },
  });

  if (!profileRes.ok) {
    throw new Error('Failed to fetch X user profile');
  }

  const profileData = await profileRes.json();
  const xUser = profileData.data; // { id, name, username }

  // Fraud Prevention: Check if this X account is already linked to another Telegram account
  if (telegramId) {
    const existingSnap = await db.collection('xUsers').where('xUserId', '==', xUser.id).get();
    for (const doc of existingSnap.docs) {
      if (doc.data().telegramId !== Number(telegramId)) {
        console.warn(`🚨 [Fraud Detection] X account @${xUser.username} (${xUser.id}) is already linked to Telegram user ${doc.data().telegramId}!`);
        await writeLog('fraudLogs', {
          telegramId: Number(telegramId),
          attemptedXUserId: xUser.id,
          attemptedXUsername: xUser.username,
          existingTelegramId: doc.data().telegramId,
          reason: 'MULTIPLE_TELEGRAM_ACCOUNTS_LINKED_TO_ONE_X_ACCOUNT',
        });
        throw new Error('This X account is already linked to another Telegram account.');
      }
    }
  }

  const expiresAt = Date.now() + (expires_in || 7200) * 1000;

  // Store in xUsers collection
  if (telegramId) {
    await db.collection('xUsers').doc(String(telegramId)).set({
      telegramId: Number(telegramId),
      xUserId: xUser.id,
      username: xUser.username,
      displayName: xUser.name,
      accessToken: access_token,
      refreshToken: refresh_token || null,
      expiresAt,
      authTimestamp: FieldValue.serverTimestamp(),
      lastVerificationTimestamp: FieldValue.serverTimestamp(),
      riskScore: 0,
    }, { merge: true });

    // Update user profile socialConnections
    await db.collection('users').doc(String(telegramId)).set({
      socialConnections: {
        x: {
          handle: `@${xUser.username}`,
          connected: true,
          linkedAt: new Date().toISOString(),
          xUserId: xUser.id,
        },
      },
    }, { merge: true });

    await writeLog('authenticationLogs', {
      telegramId: Number(telegramId),
      xUserId: xUser.id,
      xUsername: xUser.username,
      event: 'AUTHENTICATED_SUCCESS',
    });
  }

  if (state) pkceSessions.delete(state);

  return {
    telegramId,
    xUserId: xUser.id,
    xUsername: xUser.username,
    authenticated: true,
  };
}

/**
 * Retrieve Valid Access Token (Auto Token Refresh)
 */
async function getValidXAccessToken(telegramId) {
  const docRef = db.collection('xUsers').doc(String(telegramId));
  const snap = await docRef.get();

  if (!snap.exists) return null;

  const data = snap.data();
  let { accessToken, refreshToken, expiresAt, xUserId } = data;

  if (Date.now() > (expiresAt - 5 * 60 * 1000) && refreshToken) {
    try {
      const basicAuth = Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString('base64');
      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', refreshToken);

      const refreshRes = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: params.toString(),
      });

      if (refreshRes.ok) {
        const freshData = await refreshRes.json();
        accessToken = freshData.access_token;
        refreshToken = freshData.refresh_token || refreshToken;
        expiresAt = Date.now() + (freshData.expires_in || 7200) * 1000;

        await docRef.set({
          accessToken,
          refreshToken,
          expiresAt,
          lastRefreshedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    } catch (err) {
      console.error('[X Engine v2.0] Token refresh error:', err.message);
    }
  }

  return { accessToken, xUserId, data };
}

/**
 * Official X API v2 Verification Helpers
 */

async function verifyFollowOnX(accessToken, xUserId, targetXUserId) {
  try {
    const res = await fetch(`https://api.twitter.com/2/users/${xUserId}/following?max_results=1000`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (res.status === 429 || res.status >= 500) {
      return { verifiable: false, code: 'VERIFICATION_UNAVAILABLE', message: 'X API endpoint rate-limited or unavailable.' };
    }

    if (!res.ok) return { verifiable: true, isDone: false, code: 'FOLLOW_NOT_FOUND', message: 'User is not following the required account.' };

    const json = await res.json();
    const list = json.data || [];
    const isFollowing = list.some(u => u.id === targetXUserId || u.username?.toLowerCase() === targetXUserId?.toLowerCase());

    return {
      verifiable: true,
      isDone: isFollowing,
      code: isFollowing ? 'SUCCESS' : 'FOLLOW_NOT_FOUND',
      message: isFollowing ? 'Follow verified.' : 'User is not following the required account.',
    };
  } catch (err) {
    return { verifiable: false, code: 'VERIFICATION_UNAVAILABLE', message: err.message };
  }
}

async function verifyLikeOnX(accessToken, xUserId, targetTweetId) {
  try {
    const res = await fetch(`https://api.twitter.com/2/users/${xUserId}/liked_tweets?max_results=100`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (res.status === 429 || res.status >= 500) {
      return { verifiable: false, code: 'VERIFICATION_UNAVAILABLE', message: 'X API endpoint rate-limited or unavailable.' };
    }

    if (!res.ok) return { verifiable: true, isDone: false, code: 'LIKE_NOT_FOUND', message: 'User has not liked the required post.' };

    const json = await res.json();
    const list = json.data || [];
    const isLiked = list.some(t => t.id === targetTweetId);

    return {
      verifiable: true,
      isDone: isLiked,
      code: isLiked ? 'SUCCESS' : 'LIKE_NOT_FOUND',
      message: isLiked ? 'Like verified.' : 'User has not liked the required post.',
    };
  } catch (err) {
    return { verifiable: false, code: 'VERIFICATION_UNAVAILABLE', message: err.message };
  }
}

async function verifyRepostOnX(accessToken, xUserId, targetTweetId) {
  try {
    const res = await fetch(`https://api.twitter.com/2/tweets/${targetTweetId}/retweeted_by`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (res.status === 429 || res.status >= 500) {
      return { verifiable: false, code: 'VERIFICATION_UNAVAILABLE', message: 'X API endpoint rate-limited or unavailable.' };
    }

    if (!res.ok) return { verifiable: true, isDone: false, code: 'REPOST_NOT_FOUND', message: 'User has not reposted the required post.' };

    const json = await res.json();
    const list = json.data || [];
    const isReposted = list.some(u => u.id === xUserId);

    return {
      verifiable: true,
      isDone: isReposted,
      code: isReposted ? 'SUCCESS' : 'REPOST_NOT_FOUND',
      message: isReposted ? 'Repost verified.' : 'User has not reposted the required post.',
    };
  } catch (err) {
    return { verifiable: false, code: 'VERIFICATION_UNAVAILABLE', message: err.message };
  }
}

/**
 * Main Task Verification Function — Version 2.0 (Structured Error Codes & Rules)
 */
export async function verifyXTask(telegramId, taskId, taskType, targetId, rewardAmount = 100) {
  // Fraud Prevention: Rate Limit Check
  if (!checkRateLimit(telegramId)) {
    return {
      success: false,
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded. Please wait 60 seconds before trying again.',
    };
  }

  // Ensure Authenticated
  const userTokens = await getValidXAccessToken(telegramId);
  if (!userTokens || !userTokens.accessToken) {
    return {
      success: false,
      code: 'NOT_AUTHENTICATED',
      message: 'User is not authenticated with X OAuth 2.0.',
    };
  }

  const { accessToken, xUserId } = userTokens;

  // Check Duplicate Claim
  const completionDocId = `${telegramId}_x_${taskId}`;
  const completionRef = db.collection('taskCompletions').doc(completionDocId);
  const completionSnap = await completionRef.get();

  if (completionSnap.exists && completionSnap.data()?.isCompleted && !completionSnap.data()?.isRevoked) {
    return {
      success: false,
      code: 'DUPLICATE_CLAIM',
      message: 'Reward has already been claimed for this task.',
    };
  }

  // Execute Verification
  let checkResult = { verifiable: false, isDone: false, code: 'TASK_NOT_COMPLETED', message: 'Task engagement not found.' };

  if (taskType === 'x_follow' || taskType === 'x') {
    checkResult = await verifyFollowOnX(accessToken, xUserId, targetId);
  } else if (taskType === 'x_like') {
    checkResult = await verifyLikeOnX(accessToken, xUserId, targetId);
  } else if (taskType === 'x_repost' || taskType === 'x_retweet') {
    checkResult = await verifyRepostOnX(accessToken, xUserId, targetId);
  } else {
    checkResult = await verifyFollowOnX(accessToken, xUserId, targetId);
  }

  // Handle Verification Unavailable (Rule Compliance)
  if (!checkResult.verifiable) {
    await writeLog('verificationLogs', { telegramId, taskId, taskType, code: checkResult.code, status: 'UNAVAILABLE' });
    return {
      success: false,
      code: 'VERIFICATION_UNAVAILABLE',
      message: 'X API endpoint is temporarily unavailable or rate-limited. Verification skipped.',
    };
  }

  if (!checkResult.isDone) {
    await writeLog('verificationLogs', { telegramId, taskId, taskType, code: checkResult.code, status: 'FAILED' });
    return {
      success: false,
      code: checkResult.code || 'TASK_NOT_COMPLETED',
      message: checkResult.message || 'Required X engagement not found.',
    };
  }

  // Award Points
  const userRef = db.collection('users').doc(String(telegramId));
  await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    const currentPoints = userDoc.exists ? (userDoc.data().points || 0) : 0;
    const newPoints = currentPoints + rewardAmount;

    transaction.set(userRef, { points: newPoints }, { merge: true });

    transaction.set(completionRef, {
      telegramId: Number(telegramId),
      xUserId,
      taskId,
      taskType,
      targetId,
      reward: rewardAmount,
      isCompleted: true,
      isRevoked: false,
      verifiedAt: FieldValue.serverTimestamp(),
    });

    transaction.set(db.collection('pointHistory').doc(), {
      telegramId: Number(telegramId),
      amount: rewardAmount,
      type: 'TASK_REWARD',
      taskId,
      taskType,
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  // Update Last Verification Timestamp
  await db.collection('xUsers').doc(String(telegramId)).set({
    lastVerificationTimestamp: FieldValue.serverTimestamp(),
  }, { merge: true });

  await writeLog('verificationLogs', { telegramId, taskId, taskType, rewardAmount, status: 'SUCCESS' });
  await writeLog('auditLogs', { telegramId, event: 'POINT_AWARDED', amount: rewardAmount, taskId });

  return {
    success: true,
    code: 'SUCCESS',
    reward: rewardAmount,
    message: `✅ Task verified on X API! +${rewardAmount} EFC Points awarded!`,
  };
}

/**
 * Continuous Periodical Verification & Automatic Point Deduction Scheduler
 */
export async function runXPeriodicMonitoring(sendToUserCallback = null) {
  console.log('🔄 [X Scheduler v2.0] Running periodical re-verification check on X tasks...');

  try {
    const completionsSnap = await db.collection('taskCompletions')
      .where('isCompleted', '==', true)
      .where('isRevoked', '==', false)
      .get();

    let checkedCount = 0;
    let deductedCount = 0;

    for (const docSnap of completionsSnap.docs) {
      const data = docSnap.data();
      const { telegramId, taskId, taskType, targetId, reward, xUserId } = data;

      if (!taskType || !taskType.startsWith('x')) continue;

      checkedCount++;

      const userTokens = await getValidXAccessToken(telegramId);
      if (!userTokens || !userTokens.accessToken) continue;

      let checkResult = { verifiable: false, isDone: true };

      if (taskType === 'x_follow' || taskType === 'x') {
        checkResult = await verifyFollowOnX(userTokens.accessToken, xUserId || userTokens.xUserId, targetId);
      } else if (taskType === 'x_like') {
        checkResult = await verifyLikeOnX(userTokens.accessToken, xUserId || userTokens.xUserId, targetId);
      } else if (taskType === 'x_repost' || taskType === 'x_retweet') {
        checkResult = await verifyRepostOnX(userTokens.accessToken, xUserId || userTokens.xUserId, targetId);
      }

      if (!checkResult.verifiable) continue;

      // If action is no longer valid (e.g. unfollowed or unliked) -> Deduct points
      if (!checkResult.isDone) {
        console.warn(`⚠️ [X Scheduler v2.0] Action no longer valid for user ${telegramId} on task ${taskId}. Deducting ${reward} points...`);

        const userRef = db.collection('users').doc(String(telegramId));
        await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          const currentPoints = userDoc.exists ? (userDoc.data().points || 0) : 0;
          const newPoints = Math.max(0, currentPoints - reward);

          transaction.set(userRef, { points: newPoints }, { merge: true });

          transaction.set(docSnap.ref, {
            isRevoked: true,
            isInvalid: true,
            revokedAt: FieldValue.serverTimestamp(),
            revocationReason: checkResult.message || 'Action removed on X (unfollowed/unliked)',
          }, { merge: true });

          transaction.set(db.collection('deductionHistory').doc(), {
            telegramId: Number(telegramId),
            taskId,
            taskType,
            pointsDeducted: reward,
            reason: checkResult.message || 'Action removed on X (unfollowed/unliked)',
            timestamp: FieldValue.serverTimestamp(),
          });
        });

        deductedCount++;

        await writeLog('auditLogs', { telegramId, event: 'POINT_DEDUCTED', amount: reward, taskId, reason: checkResult.code });

        if (typeof sendToUserCallback === 'function') {
          await sendToUserCallback(
            telegramId,
            `⚠️ <b>EFC Points Deducted!</b>\n\nYour X task completion for <b>${taskId}</b> is no longer valid (${checkResult.message}).\n\n🔻 <b>-${reward} EFC Points</b> have been deducted from your balance.`
          ).catch(() => {});
        }
      }

      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`✅ [X Scheduler v2.0] Re-verification complete. Checked: ${checkedCount}, Deductions: ${deductedCount}`);
  } catch (err) {
    console.error('❌ [X Scheduler v2.0] Error during periodical monitoring:', err.message);
  }
}
