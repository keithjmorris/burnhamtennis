importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBPDxnd2nGvxHC5Aig3ZeeFlpmOzP6E9Nk",
  authDomain: "tenniscompetitionapp.firebaseapp.com",
  projectId: "tenniscompetitionapp",
  storageBucket: "tenniscompetitionapp.firebasestorage.app",
  messagingSenderId: "924063493946",
  appId: "1:924063493946:web:02fd16ac2c991f72666a03"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const title = payload.data?.title || 'Burnham Tennis';
    const body = payload.data?.body || '';
    self.registration.showNotification(title, { body, icon: '/icon-192.png' });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});