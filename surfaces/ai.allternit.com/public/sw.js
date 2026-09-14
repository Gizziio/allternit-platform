/**
 * Allternit Platform Service Worker
 *
 * Enables installability as a PWA and handles background push notifications
 * for remote approval requests and session events.
 *
 * Navigations, HTML, and unhashed boot files are network-first. Cache-first
 * index.html after a Vite hashed deploy 404s lazy chunks (ShellPage, ShellApp)
 * and pins returning visitors on the dark "Loading Allternit Platform" screen.
 * Same class of bug as the fabric-session SW, which already network-firsts
 * navigations so a stale worker cannot pin "Loading account".
 */

const CACHE_NAME = 'allternit-platform-v2';
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/favicon.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.all(PRECACHE_ASSETS.map((asset) => cache.add(asset).catch(() => undefined)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then((clients) =>
        Promise.all(
          clients.map((client) => {
            if (typeof client.navigate === 'function') {
              return client.navigate(client.url);
            }
            return undefined;
          })
        )
      )
  );
});

function isNetworkFirst(request, url) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  const path = url.pathname;
  return (
    path === '/' ||
    path === '/index.html' ||
    path === '/boot.js' ||
    path.endsWith('.html')
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET, opaque, API, and Clerk proxy requests. Clerk's Frontend
  // API (/__clerk) must never be served from cache; a stale /v1/client
  // response makes the sign-in flow lose its in-flight sign_in_attempt and
  // bounce between /sign-in and /sign-in/factor-one.
  if (request.method !== 'GET') return;
  if (request.url.startsWith('chrome-extension://')) return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/dispatch/')) return;
  if (url.pathname.startsWith('/__clerk/')) return;

  // Never cache Vite's development module graph. Vite's URLs include
  // cache-busting query parameters (e.g. ?v=...) that change whenever
  // dependencies are re-optimized. Caching them cache-first has led to
  // mismatched React/React-DOM chunks and "Cannot read properties of null
  // (reading 'useState' / 'useContext')" crashes when stale and fresh chunks
  // are served together.
  if (url.pathname.startsWith('/node_modules/.vite/')) return;
  if (url.pathname.startsWith('/src/')) return;
  if (url.pathname.startsWith('/@fs/')) return;
  if (url.pathname.startsWith('/@vite/')) return;

  // Let the browser handle SW updates; caching sw.js pins an old worker.
  if (url.pathname === '/sw.js') return;

  if (isNetworkFirst(request, url)) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => networkResponse)
        .catch(() => caches.match(request))
    );
    return;
  }

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
