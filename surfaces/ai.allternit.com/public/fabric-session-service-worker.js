/* eslint-disable */
// Allternit Fabric Session PWA service worker

const CACHE_NAME = 'allternit-fabric-session-v33';
const DEDICATED_HOSTS = [
  'fabrictransport.allternit.com',
  'fabric-session.allternit.com',
];
const PRECACHE_ASSETS = [
  '/favicon.png',
  '/fabric-session-icon-192.png',
  '/fabric-session-icon-512.png',
  '/manifest.webmanifest',
];

let pushWorkerUrl = null;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        PRECACHE_ASSETS.map((asset) => cache.add(asset).catch(() => undefined))
      );
      await self.skipWaiting();
    })
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
  if (request.method !== 'GET') return;
  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);
  // Never intercept the operator API, Clerk, or dispatch. Claiming this
  // origin would otherwise break Fabric Transport in the desktop shell
  // with TypeError: Failed to fetch.
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/__clerk/')) return;
  if (url.pathname.startsWith('/dispatch/')) return;

  const dedicated = DEDICATED_HOSTS.includes(self.location.hostname);
  const isFabricNav =
    request.mode === 'navigate' &&
    (url.pathname === '/fabric-session.html' ||
      url.pathname === '/fabric-session' ||
      url.pathname === '/fabric-session/' ||
      url.pathname.startsWith('/fabric-session/') ||
      (dedicated && (url.pathname === '/' || url.pathname === '/index.html')));
  // Navigations always hit the network so a stale SW cannot pin "Loading account".
  if (isFabricNav) {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html') || caches.match('/fabric-session.html'))
    );
    return;
  }
  const isFabricAsset =
    url.pathname === '/fabric-session.html' ||
    url.pathname === '/fabric-session' ||
    url.pathname.startsWith('/fabric-session') ||
    PRECACHE_ASSETS.includes(url.pathname);
  if (!isFabricAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).catch(() => {
        if (request.mode === 'navigate') {
          return caches.match('/fabric-session.html');
        }
        return cached || Response.error();
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
  let tag = 'fabric-session';
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
    icon: '/fabric-session-icon-192.png',
    badge: '/fabric-session-icon-192.png',
    requireInteraction: true,
    actions: [{ action: 'open', title: 'Open Dashboard' }],
    data: { type, runtimeId, sessionId },
  });
}

async function showNotification(payload) {
  await self.registration.showNotification(payload.title ?? 'Allternit Remote Control', {
    body: payload.body ?? 'One of your machines needs input.',
    tag: payload.tag ?? 'fabric-session',
    icon: '/fabric-session-icon-192.png',
    badge: '/fabric-session-icon-192.png',
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
  const dedicated = DEDICATED_HOSTS.includes(self.location.hostname);
  const dashboardUrl = new URL(dedicated ? '/' : '/fabric-session/', self.location.origin);
  dashboardUrl.searchParams.set('source', 'notification');
  if (data.runtimeId) dashboardUrl.searchParams.set('runtime', data.runtimeId);
  if (data.sessionId) dashboardUrl.searchParams.set('session', data.sessionId);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          const path = new URL(client.url).pathname;
          if (
            (path === '/fabric-session.html' ||
              path === '/fabric-session' ||
              path === '/fabric-session/' ||
              path.startsWith('/fabric-session/')) &&
            'focus' in client
          ) {
            return client.focus();
          }
        }
        return self.clients.openWindow(dashboardUrl.toString());
      })
  );
});
