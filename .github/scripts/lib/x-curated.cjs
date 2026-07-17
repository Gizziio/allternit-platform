#!/usr/bin/env node
/**
 * X (curated accounts) source — a "For You"-style feed built from recent posts
 * of a hand-picked list of high-signal X accounts (AI papers, labs, robotics,
 * security, industry voices). See ../data/x-accounts.json for the list.
 *
 * Mechanism: X's PUBLIC embed/syndication endpoint
 *   https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}
 * — the same endpoint X's own embedded-timeline widgets use. It requires NO
 * login, NO cookies, and NO paid API, and (unlike x.com's login flow) it is
 * not Cloudflare-gated for datacenter IPs, so it works from GitHub Actions.
 *
 * The response is HTML with an embedded `<script id="__NEXT_DATA__">` JSON
 * blob; recent timeline entries live at
 *   props.pageProps.timeline.entries[].content.tweet
 * with legacy-shaped fields (full_text, created_at, favorite_count,
 * retweet_count, user.screen_name, id_str).
 *
 * Notes:
 * - Pinned tweets are returned too; the max-age filter (default 14 days)
 *   keeps only fresh posts, which also drops stale pins.
 * - No credentials are read. Courtesy: accounts are fetched sequentially
 *   with a delay between requests.
 * - Any per-account failure warns and continues; any top-level failure
 *   returns [] so a bad feed can never break an edition.
 */

const fs = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.resolve(__dirname, '../data/x-accounts.json');

const DEFAULT_PER_ACCOUNT_LIMIT = 10;
const DEFAULT_TOTAL_LIMIT = 120;
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_MAX_AGE_DAYS = 14;
const FETCH_TIMEOUT_MS = 10000;

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadAccounts(accountsFile) {
  try {
    const raw = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
    if (!Array.isArray(raw)) throw new Error('expected a JSON array');
    return raw
      .filter((a) => a && typeof a.handle === 'string' && a.handle.trim())
      .map((a) => ({
        handle: a.handle.trim().replace(/^@/, ''),
        category: typeof a.category === 'string' && a.category.trim() ? a.category.trim() : 'general',
      }));
  } catch (err) {
    console.error(`[X curated] Failed to load accounts from ${accountsFile}: ${err.message}`);
    return [];
  }
}

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error('no __NEXT_DATA__ block (endpoint changed?)');
  return JSON.parse(match[1]);
}

function timelineTweets(nextData) {
  const entries = nextData?.props?.pageProps?.timeline?.entries;
  if (!Array.isArray(entries)) return [];
  const tweets = [];
  for (const entry of entries) {
    const tweet = entry?.content?.tweet;
    if (tweet && typeof tweet.full_text === 'string' && tweet.full_text.trim()) tweets.push(tweet);
  }
  return tweets;
}

async function fetchAccountTimeline(handle, fetchImpl) {
  const url = `https://syndication.twitter.com/srv/timeline-profile/screen-name/${encodeURIComponent(handle)}?dnt=true`;
  // The endpoint rate-limits bursts per IP; back off politely on 429.
  const backoffs = [8000, 20000];
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, {
        headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
        signal: controller.signal,
      });
      if (res.status === 429 && attempt < backoffs.length) {
        const retryAfter = Number(res.headers.get('retry-after')) * 1000;
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : backoffs[attempt]);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return timelineTweets(extractNextData(await res.text()));
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapTweet(tweet, account) {
  const text = (tweet.full_text || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const id = tweet.id_str || tweet.id;
  if (!id) return null;
  const user = tweet.user?.screen_name || account.handle;
  const engagement = (tweet.favorite_count || 0) + (tweet.retweet_count || 0);
  const created = new Date(tweet.created_at || Date.now());
  return {
    id: `x-${id}`,
    title: text.slice(0, 140) + (text.length > 140 ? '…' : ''),
    url: tweet.permalink || `https://x.com/${user}/status/${id}`,
    author: `@${user}`,
    summary: text,
    text, // alias read by scoreRelevance / formatSourcesForPrompt
    source: 'x',
    category: account.category,
    engagement,
    score: engagement, // alias read by deduplicateSources / filterSources ordering
    publishedAt: (isNaN(created) ? new Date() : created).toISOString(),
  };
}

/**
 * Fetch recent posts from every account in the curated list.
 * opts:
 *   perAccountLimit  max posts per account (default 10)
 *   totalLimit       max items returned overall (default 120)
 *   delayMs          pause between accounts (default 1500)
 *   maxAgeDays       drop posts older than this (default 14; drops stale pins)
 *   accountsFile     path to the accounts JSON (default ../data/x-accounts.json)
 *   fetchImpl        test seam — defaults to global fetch.
 */
async function fetchXCurated(opts = {}) {
  const {
    perAccountLimit = DEFAULT_PER_ACCOUNT_LIMIT,
    totalLimit = DEFAULT_TOTAL_LIMIT,
    delayMs = DEFAULT_DELAY_MS,
    maxAgeDays = DEFAULT_MAX_AGE_DAYS,
    accountsFile = ACCOUNTS_FILE,
    fetchImpl = fetch,
  } = opts;

  try {
    const accounts = loadAccounts(accountsFile);
    if (!accounts.length) {
      console.log('[X curated] Curated account list is empty — skipping source');
      return [];
    }

    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
    const all = [];
    for (let i = 0; i < accounts.length && all.length < totalLimit; i++) {
      const account = accounts[i];
      try {
        const tweets = await fetchAccountTimeline(account.handle, fetchImpl);
        let kept = 0;
        for (const tweet of tweets) {
          if (kept >= perAccountLimit || all.length >= totalLimit) break;
          const created = Date.parse(tweet.created_at || '');
          if (!isNaN(created) && created < cutoff) continue; // stale / pinned
          const item = mapTweet(tweet, account);
          if (item) {
            all.push(item);
            kept += 1;
          }
        }
      } catch (err) {
        console.warn(`[X curated @${account.handle}] Failed: ${err.message} — skipping account`);
      }
      if (delayMs > 0 && i < accounts.length - 1) await sleep(delayMs);
    }

    console.log(`[X curated] ${all.length} posts from ${accounts.length} accounts`);
    return all.slice(0, totalLimit);
  } catch (err) {
    console.error('[X curated] Source failed:', err.message);
    return [];
  }
}

module.exports = {
  fetchXCurated,
  // Exported for tests / tooling only.
  ACCOUNTS_FILE,
  loadAccounts,
  extractNextData,
  timelineTweets,
  mapTweet,
};
