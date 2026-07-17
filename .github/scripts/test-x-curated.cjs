#!/usr/bin/env node
/**
 * Dry-run harness for lib/x-curated.cjs — NOT run in CI, performs NO real X
 * login. Verifies:
 *   1. No credentials configured -> clean [] (agent-twitter-client never loaded).
 *   2. Stubbed agent-twitter-client (injected via the loadClient seam) with
 *      password auth -> item mapping, per-account cap, total cap, RT filtering.
 *   3. TWITTER_COOKIES={"auth_token","ct0"} -> setCookies path (no login call).
 *
 * Run: node .github/scripts/test-x-curated.cjs
 */

const assert = require('assert');
const { fetchXCurated } = require('./lib/x-curated.cjs');

const ENV_KEYS = ['TWITTER_COOKIES', 'TWITTER_USERNAME', 'TWITTER_PASSWORD', 'TWITTER_EMAIL'];
const savedEnv = {};
for (const k of ENV_KEYS) savedEnv[k] = process.env[k];

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

function restoreEnv() {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

// ─── Stub agent-twitter-client ──────────────────────────────────────────────

let lastScraper = null;

function makeTweet(user, i) {
  const text = `Mock post ${i} from @${user}: new LLM agent benchmark results for robotics and reasoning `.repeat(2);
  return {
    id: `${user}-status-${i}`,
    text,
    username: user,
    likes: 10 + i,
    retweets: 5 + i,
    replies: i,
    timeParsed: new Date('2026-07-15T12:00:00Z'),
    permanentUrl: `https://x.com/${user}/status/${user}-status-${i}`,
  };
}

class MockScraper {
  constructor() {
    this.calls = { setCookies: [], login: [], getTweets: [] };
    lastScraper = this;
  }
  async setCookies(cookies) {
    this.calls.setCookies.push(cookies);
  }
  async login(username, password, email) {
    this.calls.login.push([username, password, email]);
  }
  async *getTweets(user, maxTweets) {
    this.calls.getTweets.push([user, maxTweets]);
    // Over-offer 25 posts so the per-account cap has to do the cutting.
    for (let i = 0; i < 25; i++) {
      if (user === 'arankomatsuzaki' && i === 0) {
        yield { ...makeTweet(user, 999), isRetweet: true }; // must be skipped
        continue;
      }
      if (user === 'arankomatsuzaki' && i === 1) {
        yield { ...makeTweet(user, 998), text: '' }; // no text -> must be dropped
        continue;
      }
      yield makeTweet(user, i);
    }
  }
}

const loadMockClient = async () => ({ Scraper: MockScraper });

// ─── Tests ──────────────────────────────────────────────────────────────────

async function testNoCreds() {
  clearEnv();
  let loadAttempted = false;
  const items = await fetchXCurated({
    loadClient: async () => {
      loadAttempted = true;
      throw new Error('agent-twitter-client should never be loaded without creds');
    },
  });
  assert.deepStrictEqual(items, [], 'no-creds run must return []');
  assert.strictEqual(loadAttempted, false, 'client must not load without creds');
  console.log('PASS 1) no credentials -> clean [] (lazy import never attempted)');
}

async function testMappingAndCaps() {
  clearEnv();
  process.env.TWITTER_USERNAME = 'alt_account';
  process.env.TWITTER_PASSWORD = 'hunter2';
  process.env.TWITTER_EMAIL = 'alt@example.com';

  lastScraper = null;
  const items = await fetchXCurated({
    loadClient: loadMockClient,
    perAccountLimit: 10,
    totalLimit: 120,
    delayMs: 0,
  });

  // Login happened exactly once, session reused (single Scraper instance).
  assert.ok(lastScraper, 'scraper instance should exist');
  assert.deepStrictEqual(lastScraper.calls.login, [['alt_account', 'hunter2', 'alt@example.com']]);
  assert.strictEqual(lastScraper.calls.setCookies.length, 0, 'setCookies must not run under password auth');

  // Total cap: 22 accounts x 10 offered-capped posts would be >120 without the cap.
  assert.strictEqual(items.length, 120, `total cap 120, got ${items.length}`);

  // Per-account cap: first account contributes exactly 10 items even though 25 were offered.
  const firstAccountItems = items.filter((i) => i.id.startsWith('x-_akhaliq-status-'));
  assert.strictEqual(firstAccountItems.length, 10, `per-account cap 10, got ${firstAccountItems.length}`);

  // getTweets was asked for the capped amount per account.
  assert.ok(lastScraper.calls.getTweets.every(([, max]) => max === 10));

  // Item shape / mapping.
  const item = firstAccountItems[0];
  assert.strictEqual(item.source, 'x');
  assert.strictEqual(item.author, '@_akhaliq');
  assert.strictEqual(item.category, 'papers');
  assert.ok(item.title.length <= 141, `title ~140 chars (got ${item.title.length})`);
  assert.ok(item.title.endsWith('…'), 'long post truncated with ellipsis');
  assert.strictEqual(item.url, 'https://x.com/_akhaliq/status/_akhaliq-status-0');
  assert.strictEqual(item.engagement, 15, 'engagement = likes + retweets (10 + 5)');
  assert.strictEqual(item.score, item.engagement, 'score aliases engagement for dedupe/sort');
  assert.strictEqual(item.text, item.summary, 'text aliases summary for relevance scoring');
  assert.strictEqual(item.publishedAt, '2026-07-15T12:00:00.000Z');

  // Retweet + textless post from account #2 were filtered out.
  assert.ok(!items.some((i) => i.id.includes('status-999')), 'retweets skipped');
  assert.ok(!items.some((i) => i.id.includes('status-998')), 'textless posts skipped');

  console.log('PASS 2) mocked client -> mapping, per-account cap (10), total cap (120), RT/empty filtering');
}

async function testCookieAuth() {
  clearEnv();
  process.env.TWITTER_COOKIES = JSON.stringify({ auth_token: 'AAA', ct0: 'BBB' });

  lastScraper = null;
  const items = await fetchXCurated({
    loadClient: loadMockClient,
    perAccountLimit: 2,
    totalLimit: 4,
    delayMs: 0,
  });

  assert.ok(lastScraper, 'scraper instance should exist');
  assert.strictEqual(lastScraper.calls.login.length, 0, 'login must not run under cookie auth');
  assert.deepStrictEqual(lastScraper.calls.setCookies, [[
    'auth_token=AAA; Domain=.twitter.com; Path=/; Secure',
    'ct0=BBB; Domain=.twitter.com; Path=/; Secure',
  ]]);
  assert.strictEqual(items.length, 4, `small total cap 4, got ${items.length}`);

  console.log('PASS 3) cookie-pair auth -> setCookies with twitter.com cookie strings, login skipped');
}

(async () => {
  try {
    await testNoCreds();
    await testMappingAndCaps();
    await testCookieAuth();
    console.log('\nAll x-curated harness checks passed.');
  } finally {
    restoreEnv();
  }
})().catch((err) => {
  restoreEnv();
  console.error('HARNESS FAILED:', err);
  process.exit(1);
});
