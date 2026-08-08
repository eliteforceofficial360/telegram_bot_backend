// Firebase Cloud Messaging Service Worker for Web Push Notifications — Elite Force
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDMsN_z5Wn6fZkHeWt5dsfHIJt8bJb3czg',
  authDomain: 'elite-force-844d0.firebaseapp.com',
  projectId: 'elite-force-844d0',
  storageBucket: 'elite-force-844d0.firebasestorage.app',
  messagingSenderId: '230856129702',
  appId: '1:230856129702:web:1baa7bd1bf0af496be4867',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background Web Push message: ', payload);
  const title = payload.notification?.title || payload.data?.title || '⚡ Elite Force Notification';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'New message from Elite Force Network',
    icon: '/loading-logo.png',
    badge: '/loading-logo.png',
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});
