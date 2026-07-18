#!/usr/bin/env node
/**
 * X (curated accounts) source — a "For You"-style feed built from recent posts
 * of a hand-picked list of high-signal X accounts (AI papers, labs, robotics,
 * security, industry voices). See ../data/x-accounts.json for the list.
 *
 * Mechanism: our own Cloudflare Worker relay (see ../relay/x-relay-worker.js,
 * deployed as `allternit-x-relay`). It proxies X's PUBLIC embed/syndication
 * timeline endpoint and returns slim JSON:
 *   GET {RELAY_URL}/?user=<handle>&token=<X_RELAY_TOKEN>
 *   → { "tweets": [{ id, text, created_at, likes, rts, user, permalink }] }
 *
 * Why a relay: GitHub Actions' datacenter IPs are HTTP 429 rate-limited at
 * syndication.twitter.com (and Cloudflare-challenged on x.com login flows),
 * while Cloudflare edge egress IPs are not. No X login, cookies, or paid API
 * are needed anywhere in this design.
 *
 * Env: X_RELAY_TOKEN (shared secret matching the Worker's RELAY_TOKEN) and
 * optional X_RELAY_URL override. Missing token just means an unauthenticated
 * relay call (the Worker rejects it; the source then warns and returns []).
 *
 * Pinned tweets are dropped by the max-age filter (default 14 days).
 * Accounts are fetched sequentially with a delay; per-account failures warn
 * and continue; any top-level failure returns [] so the relay can never
 * break an edition.
 */

const fs = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.resolve(__dirname, '../data/x-accounts.json');

const DEFAULT_PER_ACCOUNT_LIMIT = 10;
const DEFAULT_TOTAL_LIMIT = 120;
const DEFAULT_DELAY_MS = 1500;
const DEFAULT_MAX_AGE_DAYS = 14;
const FETCH_TIMEOUT_MS = 15000;

const RELAY_URL = (process.env.X_RELAY_URL || 'https://allternit-x-relay.allternitpbc.workers.dev').replace(/\/$/, '');
const RELAY_TOKEN = process.env.X_RELAY_TOKEN || '';

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

async function fetchAccountTimeline(handle, fetchImpl) {
  const url = `${RELAY_URL}/?user=${encodeURIComponent(handle)}${RELAY_TOKEN ? `&token=${encodeURIComponent(RELAY_TOKEN)}` : ''}`;
  const backoffs = [8000, 20000]; // 429s should be rare via the relay; kept as a safety net
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetchImpl(url, { signal: controller.signal });
      if (res.status === 429 && attempt < backoffs.length) {
        const retryAfter = Number(res.headers.get('retry-after')) * 1000;
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : backoffs[attempt]);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(`relay: ${data.error}`);
      return Array.isArray(data.tweets) ? data.tweets : [];
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapTweet(tweet, account) {
  const text = (tweet.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const id = tweet.id;
  if (!id) return null;
  const user = tweet.user || account.handle;
  const engagement = (tweet.likes || 0) + (tweet.rts || 0);
  const created = new Date(tweet.created_at || Date.now());
  return {
    id: `x-${id}`,
    title: text.slice(0, 140) + (text.length > 140 ? '…' : ''),
    url: tweet.permalink ? `https://x.com${tweet.permalink}` : `https://x.com/${user}/status/${id}`,
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
 * Fetch recent posts from every account in the curated list via the relay.
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
  mapTweet,
};
