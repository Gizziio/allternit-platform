/**
 * X Bookmark Cache — Content Script
 *
 * Intercepts XMLHttpRequest and fetch on x.com to capture bookmark
 * GraphQL responses. Inspired by TBD's passive interception approach
 * and xarchive's auth header capture.
 */

(function () {
  'use strict';

  const SERVER_URL = 'http://localhost:34100';
  let authHeaders = null;

  // ─── Capture Auth Headers ─────────────────────────────────────────────────

  function captureAuthHeaders(headers) {
    const auth = headers.get('authorization') || headers.get('Authorization');
    const ct0 = headers.get('x-csrf-token') || headers.get('X-Csrf-Token') ||
                headers.get('x-twitter-client-language');
    if (auth) {
      authHeaders = { auth, ct0 };
    }
  }

  // ─── Extract Bookmarks from GraphQL Response ──────────────────────────────

  function extractBookmarks(data) {
    const bookmarks = [];
    try {
      // X.com uses various GraphQL query IDs; we check common response shapes
      const timeline = data?.data?.bookmark_timeline_v2?.timeline?.instructions ||
                       data?.data?.bookmark_timeline?.timeline?.instructions ||
                       data?.data?.viewer?.bookmarks?.timeline?.instructions;
      if (!timeline) return bookmarks;

      for (const instruction of timeline) {
        const entries = instruction.entries || instruction.moduleItems;
        if (!entries) continue;
        for (const entry of entries) {
          const item = entry.content?.itemContent?.tweet_results?.result ||
                       entry.content?.timelineModule?.items?.[0]?.item?.itemContent?.tweet_results?.result;
          if (!item) continue;

          const legacy = item.legacy || item.tweet?.legacy;
          const core = item.core?.user_results?.result?.legacy || item.core?.user_results?.result;
          if (!legacy) continue;

          bookmarks.push({
            id: legacy.id_str || legacy.conversation_id_str,
            tweetId: legacy.id_str,
            conversationId: legacy.conversation_id_str,
            text: legacy.full_text || legacy.text,
            createdAt: legacy.created_at,
            author: {
              id: core?.id_str,
              name: core?.name,
              handle: core?.screen_name,
            },
            metrics: {
              likes: legacy.favorite_count,
              retweets: legacy.retweet_count,
              replies: legacy.reply_count,
              quotes: legacy.quote_count,
            },
            entities: legacy.entities,
            media: legacy.extended_entities?.media || legacy.entities?.media,
            url: `https://x.com/${core?.screen_name}/status/${legacy.id_str}`,
            capturedAt: new Date().toISOString(),
          });
        }
      }
    } catch (err) {
      console.error('[XBC] Parse error:', err);
    }
    return bookmarks;
  }

  // ─── Send to Local Server ─────────────────────────────────────────────────

  async function sendToServer(bookmarks) {
    if (!bookmarks.length) return;
    try {
      await fetch(`${SERVER_URL}/api/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarks, authHeaders }),
      });
    } catch (err) {
      console.warn('[XBC] Server unreachable:', err.message);
    }
  }

  // ─── Hook XMLHttpRequest ──────────────────────────────────────────────────

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._xbcUrl = url;
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const xhr = this;
    const url = xhr._xbcUrl || '';

    if (url.includes('BookmarkTimeline') || url.includes('bookmark')) {
      const originalOnReady = xhr.onreadystatechange;
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
          try {
            const data = JSON.parse(xhr.responseText);
            const bookmarks = extractBookmarks(data);
            if (bookmarks.length) sendToServer(bookmarks);
          } catch { /* ignore non-JSON */ }
        }
        if (originalOnReady) originalOnReady.apply(this, arguments);
      };
    }
    return originalXHRSend.apply(this, arguments);
  };

  // ─── Hook Fetch ───────────────────────────────────────────────────────────

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const [url, init] = args;
    const urlStr = url.toString ? url.toString() : url;

    // Capture auth from outgoing requests
    if (init?.headers) {
      try {
        const h = new Headers(init.headers);
        captureAuthHeaders(h);
      } catch { /* ignore */ }
    }

    const response = await originalFetch.apply(this, args);

    // Clone so we don't consume the original
    if (urlStr.includes('BookmarkTimeline') || urlStr.includes('bookmark')) {
      response.clone().json().then(data => {
        const bookmarks = extractBookmarks(data);
        if (bookmarks.length) sendToServer(bookmarks);
      }).catch(() => {});
    }

    return response;
  };

  console.log('[XBC] Interceptor active on x.com');
})();
