#!/usr/bin/env node
/**
 * X (curated accounts) source — a "For You"-style feed built from recent posts
 * of a hand-picked list of high-signal X accounts (AI papers, labs, robotics,
 * security, industry voices). See ../data/x-accounts.json for the list.
 *
 * Unlike fetchTwitter() in pipeline.cjs (paid X API v2 behind a bearer token),
 * this source uses `@the-convocation/twitter-scraper`, which authenticates as a REAL X
 * ACCOUNT (password login or session cookies) and scrapes public timelines —
 * no paid API required. The dependency is lazy-loaded via dynamic import(), so
 * the pipeline still runs without `npm install` whenever this source is not
 * configured.
 *
 * ⚠️ ToS RISK: account-based scraping violates X's Terms of Service and the
 * account can be rate-limited, locked, or banned. Use a dedicated throwaway /
 * alt account for this — never a personal or brand account. Cookie auth
 * (reusing an existing session) is gentler than a fresh password login.
 *
 * Secrets it reads (first match wins; if none are set the source logs a
 * message and returns [] cleanly, exactly like fetchTwitter's bearer skip):
 *   - TWITTER_COOKIES   JSON array of cookie strings for twitter.com
 *                       (e.g. ["auth_token=…; Domain=.twitter.com; Path=/", …])
 *                       OR a JSON object {"auth_token": "…", "ct0": "…"},
 *                       which is converted to twitter.com cookie strings.
 *                       Note: @the-convocation/twitter-scraper stores cookies against
 *                       https://twitter.com, so Domain must be .twitter.com.
 *   - TWITTER_USERNAME  login username (fallback auth)
 *   - TWITTER_PASSWORD  login password (fallback auth)
 *   - TWITTER_EMAIL     optional; used to resolve login challenges
 *
 * Rate limiting: a single login session is reused for the whole run, accounts
 * are fetched sequentially with a delay in between, each account is capped
 * (default 10 posts) and the source as a whole is capped (default 120 items).
 * Any per-account failure warns and continues; any top-level failure returns
 * [] so a broken login can never break an edition.
 */

const fs = require('fs');
const path = require('path');

const ACCOUNTS_FILE = path.resolve(__dirname, '../data/x-accounts.json');

const DEFAULT_PER_ACCOUNT_LIMIT = 10;
const DEFAULT_TOTAL_LIMIT = 120;
const DEFAULT_DELAY_MS = 1500;

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

// Accepts either a JSON array of cookie strings or {"auth_token","ct0"}.
function parseCookies(raw) {
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed)) {
    if (!parsed.every((c) => typeof c === 'string' && c.includes('='))) {
      throw new Error('cookie array entries must be "name=value" strings');
    }
    return parsed;
  }
  if (parsed && typeof parsed === 'object' && parsed.auth_token && parsed.ct0) {
    return [
      `auth_token=${parsed.auth_token}; Domain=.twitter.com; Path=/; Secure`,
      `ct0=${parsed.ct0}; Domain=.twitter.com; Path=/; Secure`,
    ];
  }
  throw new Error('expected a JSON array of cookie strings or {"auth_token","ct0"}');
}

// Auth precedence: TWITTER_COOKIES -> TWITTER_USERNAME/TWITTER_PASSWORD -> null.
function resolveAuth() {
  const cookiesRaw = (process.env.TWITTER_COOKIES || '').trim();
  if (cookiesRaw) {
    try {
      return { type: 'cookies', cookies: parseCookies(cookiesRaw) };
    } catch (err) {
      console.error(`[X curated] TWITTER_COOKIES is set but invalid (${err.message}) — trying password auth`);
    }
  }
  const username = (process.env.TWITTER_USERNAME || '').trim();
  const password = process.env.TWITTER_PASSWORD || '';
  if (username && password) {
    const email = (process.env.TWITTER_EMAIL || '').trim();
    return { type: 'password', username, password, email: email || undefined };
  }
  return null;
}

function mapTweet(tweet, account) {
  const text = (tweet.text || '').replace(/\s+/g, ' ').trim();
  if (!text || !tweet.id) return null;
  const user = tweet.username || account.handle;
  const engagement = (tweet.likes || 0) + (tweet.retweets || 0);
  const time = tweet.timeParsed instanceof Date && !isNaN(tweet.timeParsed) ? tweet.timeParsed : new Date();
  return {
    id: `x-${tweet.id}`,
    title: text.slice(0, 140) + (text.length > 140 ? '…' : ''),
    url: tweet.permanentUrl || `https://x.com/${user}/status/${tweet.id}`,
    author: `@${user}`,
    summary: text,
    text, // alias read by scoreRelevance / formatSourcesForPrompt
    source: 'x',
    category: account.category,
    engagement,
    score: engagement, // alias read by deduplicateSources / filterSources ordering
    publishedAt: time.toISOString(),
  };
}

/**
 * Fetch recent posts from every account in the curated list.
 * opts:
 *   perAccountLimit  max posts per account (default 10)
 *   totalLimit       max items returned overall (default 120)
 *   delayMs          pause between accounts (default 1500)
 *   accountsFile     path to the accounts JSON (default ../data/x-accounts.json)
 *   loadClient       test seam — () => Promise<@the-convocation/twitter-scraper module>;
 *                    defaults to a lazy dynamic import() of the real package.
 */
async function fetchXCurated(opts = {}) {
  const {
    perAccountLimit = DEFAULT_PER_ACCOUNT_LIMIT,
    totalLimit = DEFAULT_TOTAL_LIMIT,
    delayMs = DEFAULT_DELAY_MS,
    accountsFile = ACCOUNTS_FILE,
    loadClient = () => import('@the-convocation/twitter-scraper'),
  } = opts;

  try {
    const auth = resolveAuth();
    if (!auth) {
      console.log('[X curated] No X credentials configured (TWITTER_COOKIES or TWITTER_USERNAME/TWITTER_PASSWORD) — skipping source');
      return [];
    }

    const accounts = loadAccounts(accountsFile);
    if (!accounts.length) {
      console.log('[X curated] Curated account list is empty — skipping source');
      return [];
    }

    // Lazy-load: the dependency is only required when this source is enabled.
    const { Scraper } = await loadClient();
    const scraper = new Scraper();
    if (auth.type === 'cookies') {
      await scraper.setCookies(auth.cookies);
    } else {
      await scraper.login(auth.username, auth.password, auth.email);
    }

    const all = [];
    for (let i = 0; i < accounts.length && all.length < totalLimit; i++) {
      const account = accounts[i];
      try {
        let fetched = 0;
        for await (const tweet of scraper.getTweets(account.handle, perAccountLimit)) {
          if (fetched >= perAccountLimit || all.length >= totalLimit) break;
          fetched += 1;
          if (tweet.isRetweet) continue; // curated accounts' own posts only
          const item = mapTweet(tweet, account);
          if (item) all.push(item);
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
  parseCookies,
  resolveAuth,
  mapTweet,
};
