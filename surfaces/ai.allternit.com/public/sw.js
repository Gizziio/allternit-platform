/**
 * Allternit Platform Service Worker
 *
 * Enables installability as a PWA and handles background push notifications
 * for fabric-session approvals and session events.
 */

const CACHE_NAME = 'allternit-platform-v1';
const PRECACHE_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icons/icon-192x192.png', '/icons/icon-512x512.png'];

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

  // Skip non-GET, opaque, and API requests.
  if (request.method !== 'GET') return;
  if (request.url.startsWith('chrome-extension://')) return;
  if (request.url.includes('/api/')) return;
  if (request.url.includes('/dispatch/')) return;

  // Never cache Vite's development module graph. Vite's URLs include
  // cache-busting query parameters (e.g. ?v=...) that change whenever
  // dependencies are re-optimized. Caching them cache-first has led to
  // mismatched React/React-DOM chunks and "Cannot read properties of null
  // (reading 'useState' / 'useContext')" crashes when stale and fresh chunks
  // are served together.
  const url = new URL(request.url);
  if (url.pathname.startsWith('/node_modules/.vite/')) return;
  if (url.pathname.startsWith('/src/')) return;
  if (url.pathname.startsWith('/@fs/')) return;
  if (url.pathname.startsWith('/@vite/')) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Allternit', body: 'Your remote session needs attention.' };
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: 'Allternit', body: event.data.text() };
    }
  }

  const title = payload.title ?? 'Allternit';
  const options = {
    body: payload.body ?? 'Your remote session needs attention.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: payload.tag ?? 'allternit-remote',
    data: payload.data ?? {},
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  if (event.action === 'dismiss') return;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const url = data.url ?? '/';
        const existing = clientList.find((c) => c.url === url && 'focus' in c);
        if (existing) {
          return existing.focus();
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
