// Monetag SDK helper for Elite Force Telegram Mini App

declare global {
  interface Window {
    [key: string]: any;
  }
}

/**
 * Dynamically injects and loads the Monetag SDK.
 * @param zoneId The Monetag Zone ID.
 */
export function initMonetag(zoneId: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!zoneId || zoneId === '123456') {
      console.warn("Monetag: Default or empty Zone ID configured.");
      resolve(false);
      return;
    }

    const scriptId = `monetag-sdk-${zoneId}`;
    if (document.getElementById(scriptId)) {
      resolve(true);
      return;
    }

    // Determine domain (usually sdk.js or similar from Monetag dashboard)
    // Monetag custom scripts typically look like: https://alwingulla.com/act/files/micro.tag.js
    // Or we use their dynamic loader. Monetag provides unique script URL or tag code.
    // For general integration, the standard Monetag script tag is used:
    // <script src="https://alwingulla.com/act/files/micro.tag.js" data-zone="ZONE_ID" data-sdk="show_ZONE_ID"></script>
    
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://alwingulla.com/act/files/micro.tag.js';
    script.setAttribute('data-zone', zoneId);
    script.setAttribute('data-sdk', `show_${zoneId}`);
    script.async = true;

    script.onload = () => {
      console.log(`Monetag SDK loaded successfully for Zone ${zoneId}`);
      resolve(true);
    };

    script.onerror = (err) => {
      console.error(`Failed to load Monetag SDK for Zone ${zoneId}`, err);
      resolve(false);
    };

    document.head.appendChild(script);
  });
}

/**
 * Triggers a Rewarded Ad session.
 * @param zoneId The Monetag Zone ID.
 * @returns A Promise resolving when the user watches/completes the ad.
 */
export async function showRewardedAd(zoneId: string): Promise<boolean> {
  // Ensure the SDK is injected
  await initMonetag(zoneId);

  const adFunctionName = `show_${zoneId}`;
  const adFunction = window[adFunctionName];

  if (typeof adFunction !== 'function') {
    // Simulate reward fallback if script is blocked or in development/test mode
    console.info("Monetag: Running simulated ad fallback (3 seconds)...");
    await new Promise(resolve => setTimeout(resolve, 3000));
    return true;
  }

  try {
    // Monetag's show_xxxx function returns a Promise or handles callbacks
    // Standard execution signature is show_xxxx({ type: 'reward' or similar })
    const result = await adFunction({
      type: 'end', // show after task/action or end
      requestVar: 'eforce_reward',
    });
    
    console.log("Monetag Ad Result:", result);
    return true; // Resolved means success/watched
  } catch (err) {
    console.error("Monetag Ad dismissed or failed:", err);
    throw new Error("You must watch the advertisement completely to claim the reward.");
  }
}
