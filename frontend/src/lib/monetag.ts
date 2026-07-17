// Monetag SDK helper for Elite Force Telegram Mini App
// Zone ID: 11271101 · SDK: libtl.com/sdk.js

declare global {
  interface Window {
    [key: string]: any;
  }
}

/**
 * Dynamically injects and loads the Monetag SDK from libtl.com.
 * @param zoneId The Monetag Zone ID (e.g. '11271101').
 */
export function initMonetag(zoneId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const placeholder = !zoneId || zoneId === '123456';
    if (placeholder) {
      console.warn('Monetag: No real Zone ID set — using simulation mode.');
      resolve(false);
      return;
    }

    const scriptId = `monetag-sdk-${zoneId}`;
    // Already injected — resolve immediately
    if (document.getElementById(scriptId)) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = `//libtl.com/sdk.js`;          // official Monetag CDN
    script.setAttribute('data-zone', zoneId);
    script.setAttribute('data-sdk', `show_${zoneId}`);
    script.async = true;

    script.onload = () => {
      console.log(`[Monetag] SDK loaded for zone ${zoneId}`);
      resolve(true);
    };
    script.onerror = () => {
      console.warn(`[Monetag] SDK failed to load (ad-blocker?), using simulation.`);
      resolve(false); // Don't reject — fall back to simulation
    };

    document.head.appendChild(script);
  });
}

/**
 * Triggers a Rewarded Popup ad (best format for mini-apps).
 * Resolves true when the user watches/closes, rejects if an error occurs.
 * Falls back to a 3-second simulation if the SDK is unavailable.
 *
 * @param zoneId  Monetag Zone ID ('11271101')
 */
export async function showRewardedAd(zoneId: string): Promise<boolean> {
  const loaded = await initMonetag(zoneId);

  const fn = window[`show_${zoneId}`];

  if (!loaded || typeof fn !== 'function') {
    // ── Simulation fallback (ad-blocker / dev / no zone ID) ──
    console.info('[Monetag] Simulation mode — 3 s delay');
    await new Promise(resolve => setTimeout(resolve, 3000));
    return true;
  }

  try {
    // Rewarded Popup: show_XXXXXX('pop')
    // Resolves after user watches ad or dismisses the interstitial.
    await fn('pop');
    console.log('[Monetag] Ad completed ✓');
    return true;
  } catch (err) {
    console.error('[Monetag] Ad error:', err);
    throw new Error('Watch the complete ad to earn your reward.');
  }
}

/**
 * Shows an In-App Interstitial (no reward required — background ads).
 * Call this on page mount / navigation events.
 *
 * @param zoneId  Monetag Zone ID
 */
export async function showInAppInterstitial(zoneId: string): Promise<void> {
  const loaded = await initMonetag(zoneId);
  const fn = window[`show_${zoneId}`];
  if (!loaded || typeof fn !== 'function') return;

  fn({
    type: 'inApp',
    inAppSettings: {
      frequency: 2,
      capping: 0.1,
      interval: 30,
      timeout: 5,
      everyPage: false,
    },
  }).catch(() => {/* silently ignore */});
}
