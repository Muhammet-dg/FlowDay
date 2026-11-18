// ─────────────────────────────────────────────────────────────────────────────
// push-sw.js — FlowDay Web Push & Bildirim Yardımcı Service Worker Betiği
// VitePWA (generateSW) tarafından üretilen /sw.js içine importScripts ile dahil edilir.
// ─────────────────────────────────────────────────────────────────────────────

const SW_VERSION = '2.1.0';
const APP_NAME = 'FlowDay';

// Yeni sürüm bildirimi "Yenile" butonundan gelen SKIP_WAITING mesajını dinle
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Push ──────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {
    title: APP_NAME,
    body: 'Yeni bir hatırlatıcınız var.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'flowday-reminder',
    data: { url: '/' },
  };

  if (event.data) {
    try {
      const incoming = event.data.json();
      payload = { ...payload, ...incoming };
    } catch {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: payload.icon,
    badge: payload.badge,
    tag: payload.tag,
    data: payload.data,
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// ── Notification Click ────────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          const clientPath = new URL(client.url).pathname;
          if (clientPath === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ── Notification Close ────────────────────────────────────────────────────────
self.addEventListener('notificationclose', (event) => {
  console.log(`[SW ${SW_VERSION}] Bildirim kapatıldı:`, event.notification.tag);
});

// ── Push Subscription Change ──────────────────────────────────────────────────
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: event.oldSubscription?.options?.applicationServerKey ?? null,
      })
      .then((newSub) => {
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) =>
            client.postMessage({
              type: 'SW_SUBSCRIPTION_RENEWED',
              subscription: newSub.toJSON(),
            })
          );
        });
      })
      .catch((err) => {
        console.error(`[SW ${SW_VERSION}] Abonelik yenilenemedi:`, err);
      })
  );
});
