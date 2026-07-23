import createAdHandler from 'monetag-tg-sdk';

const activeHandlers: Record<string, any> = {};

function getHandler(zoneId: string) {
  if (!zoneId || zoneId === '123456') return null;
  const numZone = parseInt(zoneId, 10);
  if (isNaN(numZone)) return null;

  if (!activeHandlers[zoneId]) {
    try {
      activeHandlers[zoneId] = createAdHandler(numZone);
    } catch (e) {
      console.warn('[Monetag] Failed to create ad handler:', e);
      return null;
    }
  }
  return activeHandlers[zoneId];
}

/**
 * Dynamically initializes and preloads the Monetag SDK handler.
 */
export function initMonetag(zoneId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const handler = getHandler(zoneId);
    if (!handler) {
      resolve(false);
      return;
    }
    resolve(true);
  });
}

/**
 * Triggers Monetag SDK Ad directly without custom UI overlays.
 * Calls Monetag's ad handler with proper parameters (handler() / handler('pop')).
 */
export function showRewardedAd(zoneId: string): Promise<boolean> {
  const handler = getHandler(zoneId);
  if (!handler) {
    console.info('[Monetag] No active Monetag zone ID provided.');
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    // Call Monetag SDK handler for Rewarded Interstitial
    handler()
      .then(() => {
        console.log('[Monetag] Rewarded Interstitial ad completed successfully');
        resolve(true);
      })
      .catch((err1: any) => {
        console.warn('[Monetag] Rewarded Interstitial failed or closed, trying Rewarded Pop fallback:', err1);
        // Fallback to Rewarded Pop
        handler('pop')
          .then(() => {
            console.log('[Monetag] Rewarded Pop ad completed successfully');
            resolve(true);
          })
          .catch((err2: any) => {
            console.warn('[Monetag] Rewarded Pop ad failed or closed:', err2);
            // Fallback so user task is not stuck if adblocker is active
            resolve(true);
          });
      });
  });
}

/**
 * Shows an In-App Interstitial directly.
 */
export async function showInAppInterstitial(zoneId: string): Promise<void> {
  const handler = getHandler(zoneId);
  if (!handler) return;

  try {
    await handler({
      type: 'inApp',
      inAppSettings: {
        frequency: 2,
        capping: 0.1,
        interval: 30,
        timeout: 5,
        everyPage: false,
      },
    });
  } catch (err) {
    // silently ignore
  }
}
