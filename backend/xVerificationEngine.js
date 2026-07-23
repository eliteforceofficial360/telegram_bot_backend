// Nexora Labs — Official X (Twitter) OAuth 2.0 & Task Verification Engine
// Implements strict OAuth 2.0 PKCE, API v2 Task Verification, Periodical Anti-Fraud Monitoring & Automatic Point Deductions

import crypto from 'crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'mini-telegram-app-c0fb4',
  });
}

const db = getFirestore();

const X_CLIENT_ID = process.env.X_CLIENT_ID || 'TTJzVW9MZEFlYXRHRmZTMHR6Si06MTpjaQ';
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET || 'Gud3evcnm97ShMJNYpJe_z1cu5C19Tgsz14gHbP3xKR1_siSJ8';
const X_CALLBACK_URL = process.env.X_CALLBACK_URL || 'https://mini-telegram-app-c0fb4.web.app';

// In-memory PKCE state & rate limiting
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
 * Rate Limiting Check: Max 3 verification requests per 60s per user
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
 * Write Audit Log to Firestore
 */
async function writeVerificationLog(telegramId, action, details, status = 'success') {
  try {
    await db.collection('verificationLogs').add({
      telegramId,
      action,
      details,
      status,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('[X Engine] Failed to write verification log:', err.message);
  }
}

/**
 * Rule 1 & 8: Generate X OAuth 2.0 PKCE Authorization URL
 */
export function getXOAuthAuthUrl(telegramId) {
  if (!telegramId) throw new Error('Telegram User ID is required');

  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');

  // Store PKCE session (expires in 15 mins)
  pkceSessions.set(state, {
    telegramId,
    codeVerifier,
    createdAt: Date.now(),
  });

  const scope = encodeURIComponent('tweet.read users.read follows.read like.read offline.access');
  const redirectUri = encodeURIComponent(X_CALLBACK_URL);

  const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${X_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

  return { authUrl, state, codeVerifier };
}

/**
 * Exchange Authorization Code for Access Token & Store User Tokens in Firestore
 */
export async function handleXOAuthCallback(code, state, codeVerifierInput = null) {
  let session = pkceSessions.get(state);
  let codeVerifier = session?.codeVerifier || codeVerifierInput;
  let telegramId = session?.telegramId;

  if (!codeVerifier) {
    throw new Error('Invalid or expired OAuth state session');
  }

  // Basic Auth header for X API Token Endpoint
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
    const errorText = await tokenRes.text();
    console.error('[X Engine] OAuth Token exchange failed:', errorText);
    throw new Error(`X OAuth exchange failed: ${tokenRes.statusText}`);
  }

  const tokenData = await tokenRes.json();
  const { access_token, refresh_token, expires_in } = tokenData;

  // Fetch X User Profile
  const profileRes = await fetch('https://api.twitter.com/2/users/me', {
    headers: {
      'Authorization': `Bearer ${access_token}`,
    },
  });

  if (!profileRes.ok) {
    throw new Error('Failed to fetch X user profile');
  }

  const profileData = await profileRes.json();
  const xUser = profileData.data; // { id, name, username }

  const expiresAt = Date.now() + (expires_in || 7200) * 1000;

  // Store in Firestore xUsers collection (Rule 3 & 9)
  if (telegramId) {
    await db.collection('xUsers').doc(String(telegramId)).set({
      telegramId: Number(telegramId),
      xUserId: xUser.id,
      xUsername: xUser.username,
      xName: xUser.name,
      accessToken: access_token,
      refreshToken: refresh_token || null,
      expiresAt,
      authTimestamp: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Update main user profile social connections
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

    await writeVerificationLog(telegramId, 'X_OAUTH_AUTHENTICATED', { xUserId: xUser.id, xUsername: xUser.username });
  }

  // Clean up session
  if (state) pkceSessions.delete(state);

  return {
    telegramId,
    xUserId: xUser.id,
    xUsername: xUser.username,
    authenticated: true,
  };
}

/**
 * Retrieve Valid X Access Token (with Automatic Token Refresh)
 */
async function getValidXAccessToken(telegramId) {
  const docRef = db.collection('xUsers').doc(String(telegramId));
  const snap = await docRef.get();

  if (!snap.exists) return null;

  const data = snap.data();
  let { accessToken, refreshToken, expiresAt, xUserId } = data;

  // Check if token is expired or expiring in < 5 minutes
  if (Date.now() > (expiresAt - 5 * 60 * 1000) && refreshToken) {
    try {
      console.log(`[X Engine] Refreshing expired token for user ${telegramId}...`);
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
      console.error('[X Engine] Token refresh error:', err.message);
    }
  }

  return { accessToken, xUserId, data };
}

/**
 * Official X API v2 Verification Helpers (Rules 4, 5, 11, 12)
 */

// 1. Verify Follow
async function verifyFollowOnX(accessToken, xUserId, targetXUserId) {
  try {
    const res = await fetch(`https://api.twitter.com/2/users/${xUserId}/following?max_results=1000`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (res.status === 429 || res.status >= 500) {
      return { verifiable: false, reason: 'X API rate limit or service unavailable' };
    }

    if (!res.ok) return { verifiable: true, isDone: false };

    const json = await res.json();
    const followingList = json.data || [];

    const isFollowing = followingList.some(u => u.id === targetXUserId || u.username?.toLowerCase() === targetXUserId?.toLowerCase());
    return { verifiable: true, isDone: isFollowing };
  } catch (err) {
    return { verifiable: false, reason: err.message };
  }
}

// 2. Verify Like
async function verifyLikeOnX(accessToken, xUserId, targetTweetId) {
  try {
    const res = await fetch(`https://api.twitter.com/2/users/${xUserId}/liked_tweets?max_results=100`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (res.status === 429 || res.status >= 500) {
      return { verifiable: false, reason: 'X API rate limit or service unavailable' };
    }

    if (!res.ok) return { verifiable: true, isDone: false };

    const json = await res.json();
    const likedTweets = json.data || [];

    const isLiked = likedTweets.some(t => t.id === targetTweetId);
    return { verifiable: true, isDone: isLiked };
  } catch (err) {
    return { verifiable: false, reason: err.message };
  }
}

// 3. Verify Repost (Retweet)
async function verifyRepostOnX(accessToken, xUserId, targetTweetId) {
  try {
    const res = await fetch(`https://api.twitter.com/2/tweets/${targetTweetId}/retweeted_by`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (res.status === 429 || res.status >= 500) {
      return { verifiable: false, reason: 'X API rate limit or service unavailable' };
    }

    if (!res.ok) return { verifiable: true, isDone: false };

    const json = await res.json();
    const retweeters = json.data || [];

    const isReposted = retweeters.some(u => u.id === xUserId);
    return { verifiable: true, isDone: isReposted };
  } catch (err) {
    return { verifiable: false, reason: err.message };
  }
}

/**
 * Main Task Verification Function (Rule 5 & 12)
 */
export async function verifyXTask(telegramId, taskId, taskType, targetId, rewardAmount = 100) {
  // Anti-fraud Rule 7: Rate Limit Check
  if (!checkRateLimit(telegramId)) {
    return {
      success: false,
      status: 'RATE_LIMITED',
      reason: 'Rate limit exceeded. Please wait 60 seconds before trying again.',
    };
  }

  // Rule 1 & 5: Ensure User Authenticated via OAuth
  const userTokens = await getValidXAccessToken(telegramId);
  if (!userTokens || !userTokens.accessToken) {
    return {
      success: false,
      status: 'UNAUTHENTICATED',
      reason: 'You must authenticate your X account with OAuth 2.0 first.',
    };
  }

  const { accessToken, xUserId } = userTokens;

  // Check for duplicate completion (Rule 5)
  const completionDocId = `${telegramId}_x_${taskId}`;
  const completionRef = db.collection('taskCompletions').doc(completionDocId);
  const completionSnap = await completionRef.get();

  if (completionSnap.exists && completionSnap.data()?.isCompleted && !completionSnap.data()?.isRevoked) {
    return {
      success: false,
      status: 'DUPLICATE',
      reason: 'Task has already been completed and rewarded.',
    };
  }

  // Verify Action using official X API (Rule 4 & 11)
  let checkResult = { verifiable: false, isDone: false };

  if (taskType === 'x_follow' || taskType === 'x') {
    checkResult = await verifyFollowOnX(accessToken, xUserId, targetId);
  } else if (taskType === 'x_like') {
    checkResult = await verifyLikeOnX(accessToken, xUserId, targetId);
  } else if (taskType === 'x_repost' || taskType === 'x_retweet') {
    checkResult = await verifyRepostOnX(accessToken, xUserId, targetId);
  } else {
    // Default fallback verification for general X tasks
    checkResult = await verifyFollowOnX(accessToken, xUserId, targetId);
  }

  // Rule 12: If X API endpoint is unavailable or rate limited, DO NOT award/deduct points
  if (!checkResult.verifiable) {
    await writeVerificationLog(telegramId, 'TASK_VERIFICATION_UNAVAILABLE', { taskId, taskType, reason: checkResult.reason }, 'warning');
    return {
      success: false,
      status: 'Verification Unavailable',
      reason: 'X API endpoint is temporarily unavailable or rate-limited. Points will be awarded once verification is restored.',
    };
  }

  if (!checkResult.isDone) {
    await writeVerificationLog(telegramId, 'TASK_VERIFICATION_FAILED', { taskId, taskType, targetId }, 'rejected');
    return {
      success: false,
      status: 'FAILED',
      reason: `Required action not detected on X. Please complete the action on X and try again.`,
    };
  }

  // Award Points in Firestore (Rule 5 & 9)
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

  await writeVerificationLog(telegramId, 'TASK_VERIFIED_SUCCESS', { taskId, taskType, rewardAmount }, 'success');

  return {
    success: true,
    status: 'VERIFIED',
    reward: rewardAmount,
    message: `✅ Task verified on X API! +${rewardAmount} EFC Points awarded!`,
  };
}

/**
 * Periodical Monitoring & Automatic Point Deduction Scheduler (Rules 6 & 10)
 * Re-verifies all active completed X tasks. If user unfollowed/unliked, deducts points immediately.
 */
export async function runXPeriodicMonitoring(sendToUserCallback = null) {
  console.log('🔄 [X Scheduler] Running periodical re-verification check on X tasks...');

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

      // Skip non-X tasks
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

      // If unverifiable (API limit/down), DO NOT deduct (Rule 12)
      if (!checkResult.verifiable) continue;

      // If action is no longer valid (e.g., user unfollowed or unliked) -> Deduct points! (Rules 6 & 10)
      if (!checkResult.isDone) {
        console.warn(`⚠️ [X Scheduler] Action no longer valid for user ${telegramId} on task ${taskId}. Deducting ${reward} points...`);

        const userRef = db.collection('users').doc(String(telegramId));
        await db.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userRef);
          const currentPoints = userDoc.exists ? (userDoc.data().points || 0) : 0;
          const newPoints = Math.max(0, currentPoints - reward);

          transaction.set(userRef, { points: newPoints }, { merge: true });

          // Mark task as revoked
          transaction.set(docSnap.ref, {
            isRevoked: true,
            revokedAt: FieldValue.serverTimestamp(),
            revocationReason: 'Action removed on X (unfollowed/unliked)',
          }, { merge: true });

          // Store Deduction History (Rule 9)
          transaction.set(db.collection('deductionHistory').doc(), {
            telegramId: Number(telegramId),
            taskId,
            taskType,
            pointsDeducted: reward,
            reason: 'Action removed on X (unfollowed/unliked)',
            timestamp: FieldValue.serverTimestamp(),
          });
        });

        deductedCount++;

        // Notify user via Telegram Bot (Rule 6)
        if (typeof sendToUserCallback === 'function') {
          await sendToUserCallback(
            telegramId,
            `⚠️ <b>EFC Points Deducted!</b>\n\nYour X task completion for <b>${taskId}</b> is no longer valid because the follow/like/repost was removed.\n\n🔻 <b>-${reward} EFC Points</b> have been deducted from your balance.`
          ).catch(() => {});
        }
      }

      // Pause briefly to respect rate limits
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`✅ [X Scheduler] Periodical re-verification complete. Checked: ${checkedCount}, Deductions: ${deductedCount}`);
  } catch (err) {
    console.error('❌ [X Scheduler] Error during periodical monitoring:', err.message);
  }
}
