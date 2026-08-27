/* eslint-disable */
// Allternit Remote Control PWA service worker

const CACHE_NAME = 'allternit-remote-control-v1';
const PRECACHE_ASSETS = [
  '/remote-control.html',
  '/remote-control.webmanifest',
  '/favicon.svg',
  '/remote-control-icon-192.png',
  '/remote-control-icon-512.png',
  '/remote-control-splash-1170x2532.png',
];

let pushWorkerUrl = null;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only intercept same-origin navigation and asset requests.
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        // If the network fails on a navigation request, serve the app shell
        // so the React app can render its own offline/error state.
        if (request.mode === 'navigate') {
          return caches.match('/remote-control.html');
        }
        throw new Error('Network request failed and no cache entry exists');
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_PUSH_WORKER_URL') {
    pushWorkerUrl = event.data.url;
  }
});

function getPendingUrl() {
  return pushWorkerUrl ? new URL('/pending', pushWorkerUrl) : new URL('/pending', self.location.origin);
}

self.addEventListener('push', (event) => {
  if (!event.data) {
    event.waitUntil(showGenericNotification());
    return;
  }

  try {
    const payload = event.data.json();
    event.waitUntil(showNotification(payload));
  } catch {
    event.waitUntil(showGenericNotification());
  }
});

async function showGenericNotification() {
  const subscription = await self.registration.pushManager.getSubscription();
  let title = 'Allternit Remote Control';
  let body = 'One of your machines needs input.';
  let tag = 'remote-control';
  let type = 'permission';
  let runtimeId = '';
  let sessionId = '';

  if (subscription) {
    try {
      const url = getPendingUrl();
      url.searchParams.set('endpoint', subscription.endpoint);
      const res = await fetch(url.toString());
      if (res.ok) {
        const payload = await res.json();
        title = payload.title ?? title;
        body = payload.body ?? body;
        tag = payload.tag ?? tag;
        type = payload.type ?? type;
        runtimeId = payload.runtimeId ?? runtimeId;
        sessionId = payload.sessionId ?? sessionId;
      }
    } catch {
      // Fall back to generic notification.
    }
  }

  await self.registration.showNotification(title, {
    body,
    tag,
    icon: '/remote-control-icon-192.png',
    badge: '/remote-control-icon-192.png',
    requireInteraction: true,
    actions: [{ action: 'open', title: 'Open Dashboard' }],
    data: { type, runtimeId, sessionId },
  });
}

async function showNotification(payload) {
  await self.registration.showNotification(payload.title ?? 'Allternit Remote Control', {
    body: payload.body ?? 'One of your machines needs input.',
    tag: payload.tag ?? 'remote-control',
    icon: '/remote-control-icon-192.png',
    badge: '/remote-control-icon-192.png',
    requireInteraction: true,
    actions: [{ action: 'open', title: 'Open Dashboard' }],
    data: {
      type: payload.type ?? 'permission',
      runtimeId: payload.runtimeId ?? '',
      sessionId: payload.sessionId ?? '',
    },
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};
  const dashboardUrl = new URL('/remote-control.html', self.location.origin);
  dashboardUrl.searchParams.set('source', 'notification');
  if (data.runtimeId) dashboardUrl.searchParams.set('runtime', data.runtimeId);
  if (data.sessionId) dashboardUrl.searchParams.set('session', data.sessionId);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).pathname === '/remote-control.html' && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(dashboardUrl.toString());
      })
  );
});
