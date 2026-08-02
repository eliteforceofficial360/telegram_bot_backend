// Telegram WebApp User Parser
// Extracts real user data from Telegram WebApp SDK

export interface TelegramUser {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  photoUrl: string;
  languageCode: string;
  isPremium: boolean;
  isBot: boolean;
}

export interface TelegramWebAppData {
  user: TelegramUser | null;
  platform: string;
  version: string;
  colorScheme: 'light' | 'dark';
  isReady: boolean;
  initData: string;
}

// Default mock user for development/testing without Telegram
const DEV_MOCK_USER: TelegramUser = {
  id: 89741000,
  firstName: 'Sourav',
  lastName: 'Sanyal',
  username: 'sourav_eforce',
  photoUrl: '',
  languageCode: 'en',
  isPremium: true,
  isBot: false,
};

/**
 * Parses Telegram WebApp initDataUnsafe to extract user profile.
 * Falls back to mock data in dev/browser environments.
 */
export const getTelegramWebAppData = (): TelegramWebAppData => {
  const tg = (window as any).Telegram?.WebApp;

  if (!tg) {
    return {
      user: DEV_MOCK_USER,
      platform: 'unknown',
      version: '0',
      colorScheme: 'dark',
      isReady: false,
      initData: '',
    };
  }

  // Tell Telegram the app is ready to display
  tg.ready?.();
  tg.expand?.();

  const rawUser = tg.initDataUnsafe?.user;
  const user: TelegramUser | null = rawUser
    ? {
        id: rawUser.id ?? 0,
        firstName: rawUser.first_name ?? '',
        lastName: rawUser.last_name ?? '',
        username: rawUser.username ?? '',
        photoUrl: rawUser.photo_url ?? '',
        languageCode: rawUser.language_code ?? 'en',
        isPremium: rawUser.is_premium === true,
        isBot: rawUser.is_bot === true,
      }
    : DEV_MOCK_USER;

  return {
    user,
    platform: tg.platform ?? 'unknown',
    version: tg.version ?? '0',
    colorScheme: tg.colorScheme ?? 'dark',
    isReady: true,
    initData: tg.initData ?? '',
  };
};

/**
 * Returns a display name from a TelegramUser.
 */
export const getDisplayName = (
  user: TelegramUser | null,
  dbUser?: { firstName?: string; lastName?: string; username?: string } | null
): string => {
  if (dbUser?.firstName || dbUser?.lastName) {
    return `${dbUser.firstName || ''} ${dbUser.lastName || ''}`.trim();
  }
  if (!user) return 'EForce Member';
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  if (user.username) return `@${user.username}`;
  return 'EForce Member';
};

/**
 * Returns a short name (first name only) for greeting banners.
 */
export const getShortName = (
  user: TelegramUser | null,
  dbUser?: { firstName?: string; username?: string } | null
): string => {
  if (dbUser?.firstName) return dbUser.firstName;
  if (!user) return 'Member';
  return user.firstName || user.username || 'Member';
};

/**
 * Generates a Telegram CDN avatar URL or empty string.
 */
export const getAvatarUrl = (user: TelegramUser | null): string => {
  return user?.photoUrl ?? '';
};
