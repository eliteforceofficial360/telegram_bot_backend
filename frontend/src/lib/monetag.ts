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
    // Preload by calling handler with type 'preload' or 'start'
    handler({ type: 'preload' })
      .then(() => resolve(true))
      .catch(() => {
        // Fallback to start if preload fails
        handler({ type: 'start' })
          .then(() => resolve(true))
          .catch(() => resolve(false));
      });
  });
}

/**
 * Triggers a Rewarded Popup ad (pop format).
 * Resolves true when the user watches/closes.
 * If the ad fails to load or is blocked, it falls back to a 3-second simulation.
 */
export function showRewardedAd(zoneId: string): Promise<boolean> {
  const handler = getHandler(zoneId);
  if (!handler) {
    console.info('[Monetag] Simulation mode (No real zone ID) — 3s delay');
    return new Promise((resolve) => setTimeout(() => resolve(true), 3000));
  }

  return new Promise((resolve) => {
    handler({ type: 'pop' })
      .then(() => {
        console.log('[Monetag] Ad completed successfully');
        resolve(true);
      })
      .catch((err: any) => {
        console.warn('[Monetag] Ad failed or dismissed, using simulation fallback:', err);
        // Fallback to simulation so the user is not stuck on blocker errors
        setTimeout(() => resolve(true), 3000);
      });
  });
}

/**
 * Shows an In-App Interstitial (no reward required).
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
