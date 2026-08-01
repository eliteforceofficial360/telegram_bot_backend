// Real-Time Live Support Chat Service — Elite Force (EForce)
// Firestore-backed bidirectional messaging between Users and Admin

import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';

export interface SupportChatMessage {
  id: string;
  sender: 'user' | 'admin';
  senderName: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
  read: boolean;
}

export interface SupportChatThread {
  userTelegramId: number;
  userName: string;
  userPhotoUrl?: string;
  lastMessage: string;
  lastMessageSender: 'user' | 'admin';
  lastMessageAt: string;
  unreadByAdmin: number;
  unreadByUser: number;
  updatedAt: string;
}

const CHATS_COLLECTION = 'support_chats';

/**
 * User: Send a message to support.
 * Admin name is hidden when displayed, but user's name/ID are stored in thread.
 */
export const sendUserSupportMessage = async (
  telegramId: number,
  userName: string,
  userPhotoUrl: string,
  text: string,
  imageUrl?: string
): Promise<boolean> => {
  const targetId = telegramId || 88888888;
  if (!isFirebaseConfigured() || (!text.trim() && !imageUrl)) return false;

  try {
    const threadRef = doc(db, CHATS_COLLECTION, String(targetId));
    const messagesCol = collection(db, CHATS_COLLECTION, String(targetId), 'messages');
    const now = new Date().toISOString();

    // Fetch existing thread to update unread count
    const threadSnap = await getDoc(threadRef);
    const existingData = threadSnap.exists() ? threadSnap.data() : null;
    const currentUnread = existingData?.unreadByAdmin || 0;

    // 1. Add message doc
    const msgPayload = {
      sender: 'user',
      senderName: userName || `User ${telegramId}`,
      text: text.trim(),
      imageUrl: imageUrl || '',
      createdAt: now,
      read: false,
    };
    await addDoc(messagesCol, msgPayload);

    // 2. Set/Update thread doc
    const threadPayload: SupportChatThread = {
      userTelegramId: Number(telegramId),
      userName: userName || `User ${telegramId}`,
      userPhotoUrl: userPhotoUrl || '',
      lastMessage: text.trim() || (imageUrl ? '📷 Image attachment' : ''),
      lastMessageSender: 'user',
      lastMessageAt: now,
      unreadByAdmin: currentUnread + 1,
      unreadByUser: 0,
      updatedAt: now,
    };

    await setDoc(threadRef, threadPayload, { merge: true });
    return true;
  } catch (err) {
    console.error('[SupportService] Error sending user message:', err);
    return false;
  }
};

/**
 * Admin: Send a response message to user.
 * Admin identity is hidden on user side (display name: 'Elite Force Support').
 */
export const sendAdminSupportMessage = async (
  userTelegramId: number,
  text: string,
  imageUrl?: string
): Promise<boolean> => {
  if (!isFirebaseConfigured() || !userTelegramId || (!text.trim() && !imageUrl)) return false;

  try {
    const threadRef = doc(db, CHATS_COLLECTION, String(userTelegramId));
    const messagesCol = collection(db, CHATS_COLLECTION, String(userTelegramId), 'messages');
    const now = new Date().toISOString();

    const threadSnap = await getDoc(threadRef);
    const existingData = threadSnap.exists() ? threadSnap.data() : null;
    const currentUnreadUser = existingData?.unreadByUser || 0;

    // 1. Add admin message doc (Sender name hidden from user, displayed as Elite Force Support)
    const msgPayload = {
      sender: 'admin',
      senderName: 'Elite Force Support',
      text: text.trim(),
      imageUrl: imageUrl || '',
      createdAt: now,
      read: false,
    };
    await addDoc(messagesCol, msgPayload);

    // 2. Update thread doc
    await setDoc(threadRef, {
      lastMessage: text.trim() || (imageUrl ? '📷 Image attachment' : ''),
      lastMessageSender: 'admin',
      lastMessageAt: now,
      unreadByAdmin: 0,
      unreadByUser: currentUnreadUser + 1,
      updatedAt: now,
    }, { merge: true });

    return true;
  } catch (err) {
    console.error('[SupportService] Error sending admin message:', err);
    return false;
  }
};

/**
 * Subscribe to real-time messages for a specific user's chat thread.
 */
export const subscribeToUserSupportMessages = (
  telegramId: number,
  callback: (messages: SupportChatMessage[]) => void
): (() => void) => {
  const targetId = telegramId || 88888888;
  if (!isFirebaseConfigured()) {
    callback([]);
    return () => {};
  }

  const messagesCol = collection(db, CHATS_COLLECTION, String(targetId), 'messages');
  const q = query(messagesCol, orderBy('createdAt', 'asc'), limit(200));

  return onSnapshot(
    q,
    (snap) => {
      const list: SupportChatMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          sender: data.sender || 'user',
          senderName: data.senderName || (data.sender === 'admin' ? 'Elite Force Support' : 'User'),
          text: data.text || '',
          imageUrl: data.imageUrl || '',
          createdAt: data.createdAt || new Date().toISOString(),
          read: data.read ?? false,
        };
      });
      callback(list);
    },
    (err) => {
      console.warn('[SupportService] Realtime messages error:', err);
      callback([]);
    }
  );
};

/**
 * Admin: Subscribe to all support chat threads in real time.
 */
export const subscribeToAllSupportChats = (
  callback: (threads: SupportChatThread[]) => void
): (() => void) => {
  if (!isFirebaseConfigured()) {
    callback([]);
    return () => {};
  }

  const colRef = collection(db, CHATS_COLLECTION);
  const q = query(colRef, orderBy('lastMessageAt', 'desc'), limit(100));

  return onSnapshot(
    q,
    (snap) => {
      const list: SupportChatThread[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          userTelegramId: Number(data.userTelegramId || d.id),
          userName: data.userName || `User ${d.id}`,
          userPhotoUrl: data.userPhotoUrl || '',
          lastMessage: data.lastMessage || '',
          lastMessageSender: data.lastMessageSender || 'user',
          lastMessageAt: data.lastMessageAt || new Date().toISOString(),
          unreadByAdmin: Number(data.unreadByAdmin || 0),
          unreadByUser: Number(data.unreadByUser || 0),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      });
      callback(list);
    },
    (err) => {
      console.warn('[SupportService] Realtime threads error:', err);
      callback([]);
    }
  );
};

/**
 * Admin: Mark a chat thread as read by admin.
 */
export const markChatAsReadByAdmin = async (telegramId: number): Promise<void> => {
  if (!isFirebaseConfigured() || !telegramId) return;
  try {
    const threadRef = doc(db, CHATS_COLLECTION, String(telegramId));
    await updateDoc(threadRef, { unreadByAdmin: 0 });
  } catch (err) {
    /* ignore */
  }
};

/**
 * User: Mark a chat thread as read by user.
 */
export const markChatAsReadByUser = async (telegramId: number): Promise<void> => {
  if (!isFirebaseConfigured() || !telegramId) return;
  try {
    const threadRef = doc(db, CHATS_COLLECTION, String(telegramId));
    await updateDoc(threadRef, { unreadByUser: 0 });
  } catch (err) {
    /* ignore */
  }
};
