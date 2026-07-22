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
    handler({ type: 'preload' })
      .then(() => resolve(true))
      .catch(() => {
        handler({ type: 'start' })
          .then(() => resolve(true))
          .catch(() => resolve(false));
      });
  });
}

/**
 * Triggers Monetag SDK Ad directly without custom UI overlays.
 * Directly calls Monetag's ad handler.
 */
export function showRewardedAd(zoneId: string): Promise<boolean> {
  const handler = getHandler(zoneId);
  if (!handler) {
    console.info('[Monetag] No active Monetag zone ID provided.');
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    // Directly call Monetag SDK handler
    handler({ type: 'pop' })
      .then(() => {
        console.log('[Monetag] Direct ad completed successfully');
        resolve(true);
      })
      .catch((err: any) => {
        console.warn('[Monetag] Direct ad error / closed:', err);
        // Fallback to resolve true so user task is not stuck if Monetag domain is blocked by user ad-blocker
        resolve(true);
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
