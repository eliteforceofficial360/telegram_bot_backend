// Web Push Notifications (FCM) Service — Elite Force
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import app from './firebase';
import { updateUserDatabaseValues } from './userService';

// User provided Web Push VAPID Public Key Pair
export const VAPID_PUBLIC_KEY = 'BOj4DEtd4T2QFMXUEkvLPNQAUohZMode6QSzEzPGVQZimJsfvSJO-FYQqu5ofthIm52f-TsYIUvW3ARtDnzSHpA';

/**
 * Requests browser Web Push Notification permission and registers VAPID FCM Token in Firestore.
 */
export const requestWebPushPermission = async (telegramId?: number): Promise<string | null> => {
  try {
    const supported = await isSupported();
    if (!supported) return null;

    if (!('Notification' in window)) return null;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Web Push Notification permission was not granted:', permission);
      return null;
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY });

    if (token && telegramId) {
      await updateUserDatabaseValues(telegramId, {
        fcmToken: token,
        fcmUpdatedAt: new Date().toISOString(),
      } as any);
    }
    return token;
  } catch (err) {
    console.error('Web Push Notification token registration error:', err);
    return null;
  }
};

/**
 * Listens for Web Push messages received while the Mini App is open in foreground.
 */
export const listenForegroundMessages = async (onMessageReceived: (payload: any) => void) => {
  try {
    const supported = await isSupported();
    if (!supported) return;
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      onMessageReceived(payload);
    });
  } catch (err) {
    console.error('Foreground Web Push listener error:', err);
  }
};
