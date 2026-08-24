/* eslint-disable */
// Allternit Remote Control PWA service worker

let pushWorkerUrl = null;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_PUSH_WORKER_URL') {
    pushWorkerUrl = event.data.url;
  }
});

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

function getPendingUrl() {
  return pushWorkerUrl ? new URL('/pending', pushWorkerUrl) : new URL('/pending', self.location.origin);
}

async function showGenericNotification() {
  const subscription = await self.registration.pushManager.getSubscription();
  let title = 'Allternit Remote Control';
  let body = 'One of your machines needs input.';
  let tag = 'remote-control';

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
      }
    } catch {
      // Fall back to generic notification.
    }
  }

  await self.registration.showNotification(title, {
    body,
    tag,
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    requireInteraction: true,
    actions: [{ action: 'open', title: 'Open Dashboard' }],
  });
}

async function showNotification(payload) {
  await self.registration.showNotification(payload.title ?? 'Allternit Remote Control', {
    body: payload.body ?? 'One of your machines needs input.',
    tag: payload.tag ?? 'remote-control',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    requireInteraction: true,
    actions: [{ action: 'open', title: 'Open Dashboard' }],
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const dashboardUrl = new URL('/', self.location.origin).toString();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === dashboardUrl && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(dashboardUrl);
      })
  );
});
