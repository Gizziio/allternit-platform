#!/usr/bin/env node
/**
 * X Bookmark Cache — Active Sync
 *
 * When the extension captures auth headers, this script can actively
 * paginate through bookmarks using X's internal GraphQL API — similar
 * to tweetxvault's approach but simpler.
 *
 * Usage: node sync.js [--full]
 */

import { insertBookmarks, getSyncState, setSyncState, queueMedia } from './db.js';

const API_BASE = 'https://x.com/i/api/graphql';
const PAGE_SIZE = 100;

async function syncBookmarks(opts = {}) {
  const authToken = getSyncState('auth_token');
  const ct0 = getSyncState('ct0');

  if (!authToken) {
    console.log('[Sync] No auth token captured yet. Browse x.com/bookmarks to capture one.');
    return;
  }

  console.log('[Sync] Starting bookmark sync...');
  let cursor = opts.full ? null : (getSyncState('bookmark_cursor') || null);
  let totalNew = 0;
  let pages = 0;

  while (pages < 50) {
    const variables = {
      count: PAGE_SIZE,
      cursor: cursor,
      includePromotedContent: false,
    };

    const url = `${API_BASE}/qToSzfH76b5dG1Oo8r5kPg/BookmarkTimeline?variables=${encodeURIComponent(JSON.stringify(variables))}`;

    try {
      const res = await fetch(url, {
        headers: {
          authorization: authToken,
          'x-csrf-token': ct0 || '',
          'x-twitter-client-language': 'en',
          'x-twitter-active-user': 'yes',
        },
      });

      if (!res.ok) {
        console.error(`[Sync] API error ${res.status}: ${await res.text().catch(() => '')}`);
        break;
      }

      const data = await res.json();
      const instructions = data?.data?.bookmark_timeline_v2?.timeline?.instructions || [];

      let bookmarks = [];
      let nextCursor = null;

      for (const instruction of instructions) {
        if (instruction.type === 'TimelineAddEntries') {
          for (const entry of (instruction.entries || [])) {
            const item = entry.content?.itemContent?.tweet_results?.result;
            if (!item) {
              // Check for cursor
              const cur = entry.content?.value;
              if (cur && entry.entryId?.includes('cursor')) {
                nextCursor = cur;
              }
              continue;
            }

            const legacy = item.legacy;
            const core = item.core?.user_results?.result?.legacy;
            if (!legacy) continue;

            bookmarks.push({
              id: legacy.id_str,
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
              syncSource: 'active',
            });
          }
        }
      }

      if (!bookmarks.length) {
        console.log('[Sync] No new bookmarks on this page. Done.');
        break;
      }

      insertBookmarks(bookmarks);
      totalNew += bookmarks.length;
      pages++;

      for (const bm of bookmarks) {
        if (bm.media && Array.isArray(bm.media)) {
          for (const m of bm.media) {
            const mediaUrl = m.media_url_https || m.media_url;
            if (mediaUrl) queueMedia(bm.tweetId, mediaUrl, m.type);
          }
        }
      }

      console.log(`[Sync] Page ${pages}: +${bookmarks.length} bookmarks (total new: ${totalNew})`);

      if (!nextCursor || nextCursor === cursor) {
        console.log('[Sync] No more pages.');
        break;
      }

      cursor = nextCursor;
      setSyncState('bookmark_cursor', cursor);

      // Rate limit politely
      await new Promise(r => setTimeout(r, 2500));

    } catch (err) {
      console.error('[Sync] Error:', err.message);
      break;
    }
  }

  console.log(`[Sync] Complete. Added ${totalNew} bookmarks across ${pages} pages.`);
}

const full = process.argv.includes('--full');
syncBookmarks({ full });
