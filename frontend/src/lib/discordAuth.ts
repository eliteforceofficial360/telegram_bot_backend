/**
 * Discord OpenID Connect & OAuth2 Authentication Service
 * Production Ready for Firebase v11+ & Telegram Mini Apps
 * Provider ID: oidc.discord (Custom OIDC in Firebase Console)
 */

import {
  OAuthProvider,
  signInWithPopup,
  signOut,
  type UserCredential,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

export interface DiscordUserProfile {
  id: string;
  username: string;
  globalName?: string;
  avatar?: string;
  avatarUrl?: string;
  email?: string;
}

/**
 * Initialize Firebase OAuthProvider for Discord OpenID Connect
 */
export const createDiscordProvider = (): OAuthProvider => {
  const provider = new OAuthProvider('oidc.discord');

  // Required OpenID Connect scopes
  provider.addScope('openid');
  provider.addScope('identify');
  provider.addScope('email');

  provider.setCustomParameters({
    prompt: 'consent',
  });

  return provider;
};

/**
 * Perform Discord OAuth Login (Telegram Webview & Browser Compatible)
 */
export const loginWithDiscord = async (): Promise<{
  user: User;
  profile: DiscordUserProfile;
  credential: UserCredential;
}> => {
  const provider = createDiscordProvider();
  let credential: UserCredential;

  try {
    credential = await signInWithPopup(auth, provider);
  } catch (popupErr: any) {
    console.warn('[Discord Auth] Popup flow fallback needed:', popupErr?.message);

    const isTelegram = !!(window as any).Telegram?.WebApp;
    if (isTelegram || popupErr?.code === 'auth/popup-blocked' || popupErr?.code === 'auth/popup-closed-by-user') {
      const clientId = '1529919990235529397';
      const redirectUri = encodeURIComponent('https://mini-telegram-app-c0fb4.web.app/auth/discord/callback');
      const scope = encodeURIComponent('openid identify email');
      const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;

      if (isTelegram) {
        (window as any).Telegram.WebApp.openLink(discordAuthUrl);
      } else {
        window.location.href = discordAuthUrl;
      }
      throw new Error('REDIRECT_LAUNCHED');
    }
    throw popupErr;
  }

  const user = credential.user;
  const providerData = user.providerData.find((p) => p.providerId === 'oidc.discord') || user.providerData[0];

  const profile: DiscordUserProfile = {
    id: user.uid,
    username: providerData?.displayName || user.displayName || 'DiscordUser',
    email: user.email || undefined,
    avatarUrl: user.photoURL || undefined,
  };

  return { user, profile, credential };
};

/**
 * Logout from Session
 */
export const logoutDiscord = async (): Promise<boolean> => {
  try {
    await signOut(auth);
    return true;
  } catch (err) {
    console.error('[Discord Auth] Logout error:', err);
    return false;
  }
};
