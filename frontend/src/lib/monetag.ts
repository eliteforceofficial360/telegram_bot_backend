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
 * Preloads the Monetag SDK script tag into DOM.
 */
export function initMonetag(zoneId: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!zoneId || zoneId === '123456') {
      resolve(false);
      return;
    }

    // Pre-inject Monetag script tag into head if not already present
    const scriptId = `monetag-sdk-${zoneId}`;
    if (typeof document !== 'undefined' && !document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://yoszi.com/sdk.js';
      script.dataset.zone = zoneId;
      script.dataset.sdk = `show_${zoneId}`;
      script.async = true;
      document.head.appendChild(script);
    }

    const handler = getHandler(zoneId);
    if (!handler) {
      resolve(false);
      return;
    }
    resolve(true);
  });
}

/**
 * Triggers Monetag SDK Ad.
 * Tries global window.show_ZONEID(), Monetag TG SDK handler(), Rewarded Pop, and Direct Link fallback.
 */
export function showRewardedAd(zoneId: string, directLink?: string): Promise<boolean> {
  if (!zoneId || zoneId === '123456') {
    if (directLink) {
      return openDirectAdLink(directLink);
    }
    console.info('[Monetag] No active Monetag zone ID provided.');
    return Promise.resolve(true);
  }

  const sdkFuncName = `show_${zoneId}`;

  return new Promise((resolve, reject) => {
    const globalShowFn = (window as any)[sdkFuncName];

    const fallbackHandler = () => {
      const handler = getHandler(zoneId);
      if (!handler) {
        if (directLink) return openDirectAdLink(directLink).then(resolve).catch(reject);
        return resolve(true);
      }

      // Try Rewarded Interstitial first
      handler()
        .then(() => {
          console.log('[Monetag] Rewarded Interstitial ad completed');
          resolve(true);
        })
        .catch((err1: any) => {
          console.warn('[Monetag] Rewarded Interstitial failed/closed, trying Rewarded Pop:', err1);
          // Try Rewarded Pop
          handler('pop')
            .then(() => {
              console.log('[Monetag] Rewarded Pop ad completed');
              resolve(true);
            })
            .catch((err2: any) => {
              console.warn('[Monetag] Rewarded Pop failed/closed:', err2);
              if (directLink) {
                openDirectAdLink(directLink).then(resolve);
              } else {
                resolve(false);
              }
            });
        });
    };

    if (typeof globalShowFn === 'function') {
      try {
        globalShowFn()
          .then(() => resolve(true))
          .catch(() => fallbackHandler());
      } catch (e) {
        fallbackHandler();
      }
    } else {
      fallbackHandler();
    }
  });
}

function openDirectAdLink(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      if ((window as any).Telegram?.WebApp?.openLink) {
        (window as any).Telegram.WebApp.openLink(url);
      } else {
        window.open(url, '_blank');
      }
      resolve(true);
    } catch (e) {
      resolve(false);
    }
  });
}

/**
 * Shows an In-App Interstitial.
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
