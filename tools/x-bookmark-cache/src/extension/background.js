/**
 * X Bookmark Cache — Background Service Worker
 *
 * Relays intercepted bookmark data to the local server.
 * Also handles periodic sync triggers.
 */

const SERVER_URL = 'http://localhost:34100';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'BOOKMARKS_CAPTURED') {
    fetch(`${SERVER_URL}/api/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message.payload),
    }).catch(err => console.warn('[XBC BG] Relay failed:', err.message));
  }
  sendResponse({ ok: true });
  return true;
});

// Health check on startup
chrome.runtime.onStartup.addListener(() => {
  fetch(`${SERVER_URL}/health`).catch(() => {
    console.warn('[XBC BG] Local server not running. Start it with: npm start');
  });
});
