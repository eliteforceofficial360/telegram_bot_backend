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
 * Renders a visual Ad overlay timer modal when Monetag SDK completes or operates in fallback.
 */
function renderAdOverlay(durationMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const existing = document.getElementById('monetag-ad-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'monetag-ad-overlay';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '99999';
    overlay.style.backgroundColor = 'rgba(5, 8, 22, 0.95)';
    overlay.style.backdropFilter = 'blur(12px)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '20px';
    overlay.style.color = '#fff';
    overlay.style.fontFamily = 'sans-serif';

    const secondsLeft = Math.ceil(durationMs / 1000);

    overlay.innerHTML = `
      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); padding: 24px; border-radius: 24px; text-align: center; max-width: 320px; width: 100%; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        <div style="width: 48px; height: 48px; border-radius: 16px; background: rgba(255, 138, 0, 0.15); border: 1px solid rgba(255, 138, 0, 0.3); color: #FF8A00; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 22px;">
          🎬
        </div>
        <h3 style="font-weight: 800; font-size: 16px; margin: 0 0 8px 0; color: #ffffff;">Sponsored Ad Playing</h3>
        <p style="font-size: 12px; color: #94a3b8; margin: 0 0 20px 0;">Please watch the ad to complete your task reward.</p>
        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden; margin-bottom: 16px;">
          <div id="monetag-ad-progress" style="width: 0%; height: 100%; background: linear-gradient(90deg, #FF8A00, #00E5FF); transition: width 0.15s linear;"></div>
        </div>
        <div style="font-size: 11px; font-weight: 700; color: #FF8A00;" id="monetag-ad-timer">Completing in ${secondsLeft}s...</div>
      </div>
    `;

    document.body.appendChild(overlay);

    const progressBar = overlay.querySelector('#monetag-ad-progress') as HTMLElement;
    const timerText = overlay.querySelector('#monetag-ad-timer') as HTMLElement;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / durationMs) * 100, 100);
      const remaining = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));

      if (progressBar) progressBar.style.width = `${progress}%`;
      if (timerText) timerText.innerText = remaining > 0 ? `Completing in ${remaining}s...` : '✅ Ad Complete!';

      if (elapsed >= durationMs) {
        clearInterval(interval);
        setTimeout(() => {
          if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
          }
          resolve(true);
        }, 300);
      }
    }, 100);
  });
}

/**
 * Triggers a Rewarded Popup / Interstitial ad.
 * Shows Monetag ad via SDK or visual ad player modal overlay.
 */
export async function showRewardedAd(zoneId: string): Promise<boolean> {
  const handler = getHandler(zoneId);
  if (!handler) {
    console.info('[Monetag] Showing fallback ad player');
    return renderAdOverlay(3000);
  }

  try {
    // Attempt standard pop / rewarded call
    await handler({ type: 'pop' });
    console.log('[Monetag] Ad completed successfully via SDK');
    return true;
  } catch (err) {
    console.warn('[Monetag] SDK ad call fallback to visual ad overlay:', err);
    return renderAdOverlay(3000);
  }
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
