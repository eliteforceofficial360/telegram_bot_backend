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
 * Triggers Monetag SDK Ad instantly.
 * Enforces mandatory 6.5-second minimum watch duration so users backing out early get 0 rewards.
 */
export function showRewardedAd(zoneId: string, directLink?: string): Promise<boolean> {
  const startTime = Date.now();
  const MIN_WATCH_TIME_MS = 6500; // Minimum 6.5 seconds watch requirement

  const isWatchedLongEnough = () => (Date.now() - startTime) >= MIN_WATCH_TIME_MS;

  const verifyWatchAndResolve = (success: boolean): boolean => {
    if (!success) return false;
    if (!isWatchedLongEnough()) {
      console.warn('[Monetag] User backed out too quickly! Reward denied.');
      return false;
    }
    return true;
  };

  if (!zoneId || zoneId === '123456') {
    if (directLink) {
      return openDirectAdLink(directLink, MIN_WATCH_TIME_MS);
    }
    console.info('[Monetag] No active Monetag zone ID provided.');
    return Promise.resolve(true);
  }

  const sdkFuncName = `show_${zoneId}`;

  return new Promise((resolve) => {
    const globalShowFn = (window as any)[sdkFuncName];

    const fallbackHandler = () => {
      const handler = getHandler(zoneId);
      if (!handler) {
        if (directLink) {
          return openDirectAdLink(directLink, MIN_WATCH_TIME_MS).then(resolve);
        }
        return resolve(false);
      }

      // Try Rewarded Interstitial
      handler()
        .then(() => {
          resolve(verifyWatchAndResolve(true));
        })
        .catch((err1: any) => {
          console.warn('[Monetag] Rewarded Interstitial failed/closed:', err1);
          // Try Rewarded Pop
          handler('pop')
            .then(() => {
              resolve(verifyWatchAndResolve(true));
            })
            .catch((err2: any) => {
              console.warn('[Monetag] Rewarded Pop failed/closed:', err2);
              if (directLink) {
                openDirectAdLink(directLink, MIN_WATCH_TIME_MS).then(resolve);
              } else {
                resolve(false);
              }
            });
        });
    };

    if (typeof globalShowFn === 'function') {
      try {
        globalShowFn()
          .then(() => resolve(verifyWatchAndResolve(true)))
          .catch(() => fallbackHandler());
      } catch (e) {
        fallbackHandler();
      }
    } else {
      fallbackHandler();
    }
  });
}

function openDirectAdLink(url: string, minWatchTimeMs: number = 6500): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    try {
      if ((window as any).Telegram?.WebApp?.openLink) {
        (window as any).Telegram.WebApp.openLink(url);
      } else {
        window.open(url, '_blank');
      }
    } catch (e) {
      resolve(false);
      return;
    }

    // Monitor when user switches back to the app window/tab
    let resolved = false;

    const checkAndResolve = () => {
      if (resolved) return;
      resolved = true;
      cleanup();

      const elapsed = Date.now() - startTime;
      if (elapsed < minWatchTimeMs) {
        console.warn(`[Monetag] Direct link closed in ${elapsed}ms (<${minWatchTimeMs}ms). Reward denied.`);
        resolve(false);
      } else {
        resolve(true);
      }
    };

    const handleFocus = () => {
      setTimeout(checkAndResolve, 300);
    };

    const cleanup = () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Safety timeout fallback (e.g. 10 seconds)
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        const elapsed = Date.now() - startTime;
        resolve(elapsed >= minWatchTimeMs);
      }
    }, 10000);
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
