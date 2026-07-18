#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — Shared Library
 *
 * Unified utilities for source fetching, relevance scoring, LLM calls,
 * and Publication construction.
 */

const fs = require('fs');
const path = require('path');
const { fetchXCurated } = require('./x-curated.cjs');

// ─── Configuration ──────────────────────────────────────────────────────────

const KIMI_URL = 'https://api.kimi.com/coding/v1/chat/completions';
const KIMI_MODEL = 'kimi-for-coding';
const KIMI_API_KEY = process.env.KIMI_API_KEY || '';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const DATA_FILE = path.resolve(
  __dirname,
  '../../../surfaces/ai.allternit.com/src/data/discovery-pipeline.json',
);

// ─── Brand Voice & Taxonomy ─────────────────────────────────────────────────

const EDITORIAL_VOICE = {
  signal:
    'You are Allternit News — a concise, production-focused intelligence digest. ' +
    'Tone: sharp, skeptical of hype, focused on what matters for shipping AI systems. ' +
    'Avoid marketing language. Use specifics over superlatives.',
  research:
    'You are A://SUDO Reality — a weekly magazine built around an analytical cover story. ' +
    'Tone: rigorous but accessible, connecting technical details to industry impact. ' +
    'Explain the "so what" for engineering teams building production AI.',
};

const TAXONOMY = {
  'agentic-ai': {
    label: 'Agentic AI',
    keywords: ['agent', 'tool use', 'planning', 'orchestration', 'workflow', 'autonomous', 'multi-agent', 'mcp', 'computer use'],
  },
  infrastructure: {
    label: 'Infrastructure',
    keywords: ['gpu', 'cuda', 'tpu', 'datacenter', 'deployment', 'serving', 'latency', 'throughput', 'mlops', 'inference', 'compute'],
  },
  'local-inference': {
    label: 'Local Inference',
    keywords: ['edge', 'quantization', 'on-device', 'apple silicon', 'mlx', 'gguf', 'ollama', 'local llm', 'embedded'],
  },
  'safety-governance': {
    label: 'Safety & Governance',
    keywords: ['alignment', 'safety', 'bias', 'governance', 'regulation', 'interpretability', 'audit', 'responsible ai'],
  },
  'research-frontier': {
    label: 'Research Frontier',
    keywords: ['novel architecture', 'transformer', 'moe', 'diffusion', 'multimodal', 'reasoning', 'theorem proving', 'undecidability'],
  },
  'product-engineering': {
    label: 'Product & Engineering',
    keywords: ['api', 'sdk', 'integration', 'developer experience', 'notebook', 'canvas', 'plugin', 'extension'],
  },
  robotics: {
    label: 'Robotics',
    keywords: ['humanoid', 'humanoid robot', 'robotics', 'robot', 'cobot', 'ros', 'slam', 'lidar', 'actuator', 'dexterous manipulation', 'drones', 'autonomous vehicle', 'self-driving'],
  },
};

const ALL_TAXONOMY_KEYWORDS = Object.values(TAXONOMY).flatMap((t) => t.keywords);

const FOCUS_AREAS = Object.keys(TAXONOMY);

// ─── Relevance Scoring ──────────────────────────────────────────────────────

function scoreRelevance(item) {
  const text = `${item.title} ${item.text || ''} ${item.excerpt || ''}`.toLowerCase();
  let score = 0;
  let matched = [];

  for (const kw of ALL_TAXONOMY_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) {
      score += 1;
      if (!matched.includes(kw)) matched.push(kw);
    }
  }

  // Bonus for direct AI/ML terms
  const directTerms = ['llm', 'language model', 'foundation model', 'gpt', 'claude', 'gemini', 'openai', 'anthropic', 'deepmind', 'meta ai', 'hugging face', 'figure ai', 'unitree', 'boston dynamics', 'agility robotics', 'tesla optimus'];
  for (const term of directTerms) {
    if (text.includes(term)) score += 2;
  }

  // Penalty for off-topic terms
  const offTopic = ['friendster', 'crypto', 'nft', 'blockchain', 'web3', 'podcast', 'startup funding', 'venture capital'];
  for (const term of offTopic) {
    if (text.includes(term)) score -= 3;
  }

  // Engagement bonus
  if (item.score > 100) score += 1;
  if (item.commentCount > 50) score += 1;
  if (item.stars > 100) score += 2;

  // Normalize to 0-1
  const normalized = Math.min(1, Math.max(0, score / 12));

  // Determine focus areas
  const focusAreas = [];
  for (const [area, config] of Object.entries(TAXONOMY)) {
    if (config.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      focusAreas.push(area);
    }
  }

  return { score: normalized, matched, focusAreas };
}

function filterSources(sources, threshold = 0.35) {
  const scored = sources.map((s) => ({ ...s, relevance: scoreRelevance(s) }));
  const filtered = scored.filter((s) => s.relevance.score >= threshold);
  // Sort by relevance desc, then engagement
  filtered.sort((a, b) => {
    const relDiff = b.relevance.score - a.relevance.score;
    if (Math.abs(relDiff) > 0.05) return relDiff;
    const engA = (a.score || 0) + (a.commentCount || 0) * 2 + (a.stars || 0);
    const engB = (b.score || 0) + (b.commentCount || 0) * 2 + (b.stars || 0);
    return engB - engA;
  });
  return filtered;
}

function deduplicateSources(sources) {
  const seen = new Map(); // normalized title -> best item
  for (const item of sources) {
    const key = normalizeTitle(item.title);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, item);
      continue;
    }
    // Keep the one with higher engagement
    const engA = (item.score || 0) + (item.commentCount || 0) * 2 + (item.stars || 0);
    const engB = (existing.score || 0) + (existing.commentCount || 0) * 2 + (existing.stars || 0);
    if (engA > engB) {
      seen.set(key, item);
    }
  }
  return Array.from(seen.values());
}

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)
    .join(' ');
}

// ─── Source Fetchers ────────────────────────────────────────────────────────

async function fetchHN(limit = 8) {
  try {
    const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = (await topRes.json()).slice(0, limit + 10);
    const items = await Promise.all(
      ids.map(async (id) => {
        const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        return r.json();
      }),
    );
    return items
      .filter((i) => i && !i.deleted && !i.dead && i.title && i.url)
      .slice(0, limit)
      .map((i) => ({
        id: `hn-${i.id}`,
        title: i.title,
        url: i.url,
        author: i.by,
        score: i.score || 0,
        commentCount: i.descendants || 0,
        text: i.text || '',
        source: 'hackernews',
        publishedAt: new Date(i.time * 1000).toISOString(),
      }));
  } catch (err) {
    console.error('[HN] Failed:', err.message);
    return [];
  }
}

async function fetchReddit(subreddits = ['MachineLearning', 'LocalLLaMA', 'artificial'], limitPerSub = 5) {
  const all = [];
  for (const sub of subreddits) {
    try {
      const r = await fetch(`https://www.reddit.com/r/${sub}/hot/.rss?limit=${limitPerSub + 10}`, {
        headers: { 'User-Agent': BROWSER_UA },
      });
      if (!r.ok) continue;
      const xml = await r.text();
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      const items = entries
        .map((entry) => {
          const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
          const linkMatch = entry.match(/<link href="([^"]+)"/);
          const authorMatch = entry.match(/<name>([\s\S]*?)<\/name>/);
          const contentMatch = entry.match(/<content type="html">([\s\S]*?)<\/content>/);
          return {
            id: `reddit-${sub}-${Math.random().toString(36).slice(2, 8)}`,
            title: titleMatch ? unescapeXml(titleMatch[1].trim()) : '',
            url: linkMatch ? linkMatch[1] : '',
            author: authorMatch ? authorMatch[1] : '',
            text: contentMatch ? decodeHtmlEntities(contentMatch[1]) : '',
            source: 'reddit',
            subreddit: sub,
            publishedAt: new Date().toISOString(),
          };
        })
        .filter((i) => i.title && i.url);

      const filtered = items.filter((i) => {
        const t = i.title.toLowerCase();
        const meta = ['self-promotion', "who's hiring", 'weekly', 'monthly', 'moderator', 'deleted'];
        return !meta.some((k) => t.includes(k));
      });

      all.push(...filtered.slice(0, limitPerSub));
    } catch (err) {
      console.error(`[Reddit r/${sub}] Failed:`, err.message);
    }
  }
  return all;
}

async function fetchArxiv(categories = ['cs.AI', 'cs.LG', 'cs.CL'], limit = 6) {
  const all = [];
  for (const cat of categories) {
    try {
      const url =
        `http://export.arxiv.org/api/query?search_query=cat:${cat}` +
        `&sortBy=submittedDate&sortOrder=descending&max_results=${limit}`;
      const r = await fetch(url);
      const xml = await r.text();
      const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      const items = entries
        .map((entry) => {
          const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
          const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
          const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
          const authorMatches = entry.match(/<name>([\s\S]*?)<\/name>/g);
          const authors = authorMatches
            ? authorMatches.map((m) => m.replace(/<\/?name>/g, ''))
            : [];
          const catMatch = entry.match(/<category term="([^"]+)"/);
          return {
            id: `arxiv-${idMatch ? idMatch[1].split('/').pop() : Math.random().toString(36).slice(2)}`,
            title: titleMatch ? titleMatch[1].trim().replace('\n', ' ') : '',
            url: idMatch ? idMatch[1].trim() : '',
            author: authors.join(', ') || 'Unknown',
            text: summaryMatch ? summaryMatch[1].trim() : '',
            source: 'arxiv',
            category: catMatch ? catMatch[1] : cat,
            publishedAt: new Date().toISOString(),
          };
        })
        .filter((i) => i.title && i.url);
      all.push(...items);
    } catch (err) {
      console.error(`[arXiv ${cat}] Failed:`, err.message);
    }
  }
  return all;
}

// NOTE: GitHub Trending only supports *language* filters in the URL path
// (e.g. /trending/python). Topic paths like /trending/ai return an empty
// "blankslate" page with no repo articles, so we scrape the global daily
// page and rely on the relevance filter to keep AI-related repos.
async function fetchGitHubTrending(languages = [''], limit = 8) {
  const all = [];
  for (const lang of languages) {
    try {
      const url = `https://github.com/trending${lang ? `/${encodeURIComponent(lang)}` : ''}?since=daily`;
      const r = await fetch(url, {
        headers: {
          'User-Agent': BROWSER_UA,
          Accept: 'text/html',
        },
      });
      if (!r.ok) continue;
      const html = await r.text();

      // Extract trending repo blocks
      const repoBlocks = html.match(/<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>[\s\S]*?<\/article>/g) || [];
      const items = repoBlocks.slice(0, limit).map((block) => {
        const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/h2>/);
        const descMatch = block.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
        const langMatch = block.match(/itemprop="programmingLanguage">([^<]+)</);
        // Star/fork counts sit in links to /stargazers and /forks, after an
        // inline SVG, formatted with thousands separators (e.g. "526,859").
        const starsMatch = block.match(/href="\/[^"]+\/stargazers"[\s\S]*?<\/svg>\s*([\d,.]+[kKmM]?)\s*<\/a>/);
        const forksMatch = block.match(/href="\/[^"]+\/forks"[\s\S]*?<\/svg>\s*([\d,.]+[kKmM]?)\s*<\/a>/);

        const href = titleMatch ? titleMatch[1] : '';
        // Derive "owner / repo" from the href — the link body contains an
        // inline SVG icon that pollutes any text extraction.
        const title = href.split('/').filter(Boolean).join(' / ');

        return {
          id: `github-${href.replace(/\//g, '-')}`,
          title: `${title} ${langMatch ? `(${langMatch[1].trim()})` : ''}`,
          url: `https://github.com${href}`,
          author: title.split('/')[0]?.trim() || 'Unknown',
          text: descMatch ? decodeHtmlEntities(descMatch[1].replace(/<[^>]+>/g, ' ').trim()) : '',
          source: 'github',
          stars: parseCount(starsMatch ? starsMatch[1] : '0'),
          forks: parseCount(forksMatch ? forksMatch[1] : '0'),
          language: langMatch ? langMatch[1].trim() : '',
          publishedAt: new Date().toISOString(),
        };
      });

      all.push(...items.filter((i) => i.title));
    } catch (err) {
      console.error(`[GitHub ${lang || 'all'}] Failed:`, err.message);
    }
  }
  return all;
}

function parseCount(str) {
  if (!str) return 0;
  const num = parseFloat(str.replace(/,/g, ''));
  if (/k$/i.test(str)) return num * 1000;
  if (/m$/i.test(str)) return num * 1000000;
  return num;
}

async function fetchCompanyBlog(rssUrl, label, limit = 3) {
  try {
    const r = await fetch(rssUrl, {
      headers: { 'User-Agent': BROWSER_UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return [];
    const xml = await r.text();
    const entries = xml.match(/<item>[\s\S]*?<\/item>/g) || xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
    return entries.slice(0, limit).map((entry) => {
      // Strip CDATA wrappers first so the field regexes below see raw text —
      // many feeds (TechCrunch, Robot Report, ...) wrap every field in
      // <![CDATA[...]]>.
      const clean = stripCdata(entry);
      // Tag matchers tolerate attributes (e.g. Atom's <title type="html">).
      const titleMatch = clean.match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const linkMatch = clean.match(/<link[^>]*>([\s\S]*?)<\/link>/) || clean.match(/<link[^>]*href="([^"]+)"/);
      const descMatch = clean.match(/<description[^>]*>([\s\S]*?)<\/description>/) || clean.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
      const dateMatch = clean.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || clean.match(/<published[^>]*>([\s\S]*?)<\/published>/) || clean.match(/<updated[^>]*>([\s\S]*?)<\/updated>/);
      const parsedDate = dateMatch ? new Date(dateMatch[1].trim()) : null;
      return {
        id: `${label}-${Math.random().toString(36).slice(2, 8)}`,
        title: titleMatch ? unescapeXml(titleMatch[1].trim()) : '',
        url: linkMatch ? linkMatch[1].trim() : '',
        author: label,
        text: descMatch ? decodeHtmlEntities(descMatch[1]).slice(0, 400) : '',
        source: label,
        publishedAt: parsedDate && !isNaN(parsedDate) ? parsedDate.toISOString() : new Date().toISOString(),
      };
    }).filter((i) => i.title && i.url);
  } catch (err) {
    console.error(`[${label}] Failed:`, err.message);
    return [];
  }
}

async function fetchTwitter(limit = 8) {
  const bearerToken = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || '';
  if (!bearerToken) {
    console.log('[Twitter] No bearer token configured (X_BEARER_TOKEN or TWITTER_BEARER_TOKEN)');
    return [];
  }

  try {
    // Search for AI/ML tweets from the last 24h, excluding retweets, English only
    const query = encodeURIComponent(
      '(LLM OR "large language model" OR "AI agent" OR "artificial intelligence" OR "machine learning" OR "foundation model") -is:retweet lang:en',
    );
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=${Math.min(limit + 5, 25)}&tweet.fields=public_metrics,created_at,author_id&expansions=author_id&user.fields=username`;

    const r = await fetch(url, {
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'User-Agent': BROWSER_UA,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error(`[Twitter] API error ${r.status}: ${errText.slice(0, 200)}`);
      return [];
    }

    const data = await r.json();
    const tweets = data.data || [];
    const users = new Map((data.includes?.users || []).map((u) => [u.id, u.username]));

    return tweets
      .filter((t) => t.public_metrics?.like_count > 5 || t.public_metrics?.retweet_count > 2)
      .slice(0, limit)
      .map((t) => ({
        id: `twitter-${t.id}`,
        title: t.text.slice(0, 200) + (t.text.length > 200 ? '…' : ''),
        url: `https://x.com/${users.get(t.author_id) || 'i'}/status/${t.id}`,
        author: `@${users.get(t.author_id) || 'unknown'}`,
        text: t.text,
        source: 'twitter',
        score: t.public_metrics?.like_count || 0,
        commentCount: t.public_metrics?.reply_count || 0,
        publishedAt: t.created_at || new Date().toISOString(),
      }));
  } catch (err) {
    console.error('[Twitter] Failed:', err.message);
    return [];
  }
}

// NOTE: public.api.bsky.app is the unauthenticated public instance, but from
// some networks it answers 403 (Bunny CDN block page). api.bsky.app serves the
// same searchPosts XRPC without auth, so we try the public host first and
// fall back per query.
const BSKY_ENDPOINTS = ['https://public.api.bsky.app', 'https://api.bsky.app'];

async function fetchBluesky(
  queries = ['AI agents', 'LLM', 'robotics', 'foundation model'],
  limit = 25,
) {
  const all = [];
  const seen = new Set();
  for (const q of queries) {
    let posts = null;
    for (const base of BSKY_ENDPOINTS) {
      try {
        const url = `${base}/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=${limit}&sort=latest`;
        const r = await fetch(url, {
          headers: { 'User-Agent': BROWSER_UA, Accept: 'application/json' },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) {
          console.error(`[Bluesky] ${base} query "${q}" -> HTTP ${r.status}`);
          continue;
        }
        posts = (await r.json()).posts || [];
        break;
      } catch (err) {
        console.error(`[Bluesky] ${base} query "${q}" failed:`, err.message);
      }
    }
    if (!posts) continue;
    for (const p of posts) {
      const uri = p.uri || '';
      const rkey = uri.split('/').pop();
      const did = p.author?.did || uri.split('/')[2] || '';
      const text = (p.record?.text || '').trim();
      if (!text || !rkey || !did || seen.has(uri)) continue;
      seen.add(uri);
      all.push({
        id: `bluesky-${rkey}`,
        title: text.slice(0, 200) + (text.length > 200 ? '…' : ''),
        url: `https://bsky.app/profile/${did}/post/${rkey}`,
        author: `@${p.author?.handle || did}`,
        text,
        source: 'bluesky',
        score: (p.likeCount || 0) + (p.repostCount || 0),
        commentCount: p.replyCount || 0,
        publishedAt: p.record?.createdAt || p.indexedAt || new Date().toISOString(),
      });
    }
  }
  return all;
}

async function fetchMastodon(accounts = ['arstechnica', 'verge', 'ieeespectrum'], limitPerAccount = 5) {
  const all = [];
  for (const acct of accounts) {
    try {
      const url = `https://mastodon.social/@${acct}.rss`;
      const r = await fetch(url, {
        headers: { 'User-Agent': BROWSER_UA },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) {
        console.warn(`[Mastodon @${acct}] HTTP ${r.status} — skipping account`);
        continue;
      }
      const xml = await r.text();
      const entries = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      const items = entries.slice(0, limitPerAccount).map((entry) => {
        const clean = stripCdata(entry);
        const titleMatch = clean.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        const linkMatch = clean.match(/<link[^>]*>([\s\S]*?)<\/link>/);
        const descMatch = clean.match(/<description[^>]*>([\s\S]*?)<\/description>/);
        const dateMatch = clean.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/);
        const guidMatch = clean.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);
        // Mastodon RSS items have no <title> — the toot text lives in
        // <description> (HTML-escaped), so it backs both title and summary.
        const descText = descMatch ? decodeHtmlEntities(descMatch[1]).replace(/\s+/g, ' ').trim() : '';
        const raw = (titleMatch ? decodeHtmlEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : '') || descText;
        const parsedDate = dateMatch ? new Date(dateMatch[1].trim()) : null;
        return {
          id: `mastodon-${acct}-${guidMatch ? guidMatch[1].trim().split('/').pop() : Math.random().toString(36).slice(2, 8)}`,
          title: raw.slice(0, 200) + (raw.length > 200 ? '…' : ''),
          url: linkMatch ? linkMatch[1].trim() : '',
          author: `@${acct}@mastodon.social`,
          text: (descText || raw).slice(0, 400),
          source: 'mastodon',
          publishedAt: parsedDate && !isNaN(parsedDate) ? parsedDate.toISOString() : new Date().toISOString(),
        };
      }).filter((i) => i.title && i.url);
      all.push(...items);
    } catch (err) {
      console.warn(`[Mastodon @${acct}] Failed: ${err.message} — skipping account`);
    }
  }
  return all;
}

async function fetchAllSources(opts = {}) {
  const {
    hnLimit = 8,
    redditSubs = ['MachineLearning', 'LocalLLaMA', 'artificial'],
    redditLimit = 5,
    arxivCats = ['cs.AI', 'cs.LG', 'cs.CL'],
    arxivLimit = 6,
    githubLanguages = [''],
    githubLimit = 8,
    blogs = [
      { url: 'https://www.anthropic.com/rss.xml', label: 'anthropic' },
      { url: 'https://openai.com/blog/rss.xml', label: 'openai' },
      { url: 'https://blog.google/technology/ai/rss/', label: 'google-ai' },
      { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', label: 'techcrunch-ai' },
      { url: 'https://techcrunch.com/category/robotics/feed/', label: 'techcrunch-robotics' },
      { url: 'https://www.wired.com/feed/rss', label: 'wired' },
      { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', label: 'arstechnica' },
      { url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/', label: 'mit-tech-review' },
      { url: 'https://www.theverge.com/rss/index.xml', label: 'theverge' },
      { url: 'https://venturebeat.com/category/ai/feed/', label: 'venturebeat-ai' },
      { url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss', label: 'ieee-spectrum-ai' },
      { url: 'https://spectrum.ieee.org/feeds/topic/robotics.rss', label: 'ieee-spectrum-robotics' },
      { url: 'https://www.nature.com/subjects/machine-learning.rss', label: 'nature-ml' },
      { url: 'https://www.therobotreport.com/feed/', label: 'robot-report' },
      { url: 'https://robohub.org/feed/', label: 'robohub' },
    ],
    blogLimit = 4,
    twitterLimit = 6,
    includeXCurated = true,
    xCuratedPerAccount = 10,
    xCuratedTotalLimit = 120,
    xCuratedDelayMs = 3000,
    includeBluesky = true,
    blueskyQueries = ['AI agents', 'LLM', 'robotics', 'foundation model'],
    blueskyLimit = 25,
    includeMastodon = true,
    mastodonAccounts = ['arstechnica', 'verge', 'ieeespectrum'],
    mastodonLimit = 5,
  } = opts;

  console.log('Fetching sources...');
  const [
    hn,
    reddit,
    arxiv,
    github,
    twitter,
    xcurated,
    bluesky,
    mastodon,
    ...blogResults
  ] = await Promise.all([
    fetchHN(hnLimit),
    fetchReddit(redditSubs, redditLimit),
    fetchArxiv(arxivCats, arxivLimit),
    fetchGitHubTrending(githubLanguages, githubLimit),
    fetchTwitter(twitterLimit),
    includeXCurated
      ? fetchXCurated({
          perAccountLimit: xCuratedPerAccount,
          totalLimit: xCuratedTotalLimit,
          delayMs: xCuratedDelayMs,
        })
      : Promise.resolve([]),
    includeBluesky ? fetchBluesky(blueskyQueries, blueskyLimit) : Promise.resolve([]),
    includeMastodon ? fetchMastodon(mastodonAccounts, mastodonLimit) : Promise.resolve([]),
    ...blogs.map((b) => fetchCompanyBlog(b.url, b.label, blogLimit)),
  ]);

  const blogsFlat = blogResults.flat();

  console.log(
    `Sources: ${hn.length} HN, ${reddit.length} Reddit, ${arxiv.length} arXiv, ${github.length} GitHub, ${twitter.length} Twitter, ${xcurated.length} X (curated), ${bluesky.length} Bluesky, ${mastodon.length} Mastodon, ${blogsFlat.length} blogs`,
  );

  const all = [...hn, ...reddit, ...arxiv, ...github, ...twitter, ...xcurated, ...bluesky, ...mastodon, ...blogsFlat];
  const deduped = deduplicateSources(all);
  const filtered = filterSources(deduped);

  console.log(`After dedup + relevance filter: ${filtered.length} items`);

  return { hn, reddit, arxiv, github, twitter, xcurated, bluesky, mastodon, blogs: blogsFlat, filtered };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function stripCdata(str) {
  return str.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '');
}

function decodeCodePoint(n) {
  return Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
}

function unescapeXml(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => decodeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => decodeCodePoint(Number(d)));
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => decodeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (m, d) => decodeCodePoint(Number(d)))
    .replace(/<[^>]+>/g, ' ');
}

function formatSourcesForPrompt(sources) {
  const bySource = {};
  for (const s of sources) {
    const key = s.source;
    if (!bySource[key]) bySource[key] = [];
    bySource[key].push(s);
  }

  const lines = [];
  const sourceOrder = [
    'arxiv', 'hackernews', 'reddit', 'twitter', 'x', 'bluesky', 'mastodon', 'github', 'bookmark',
    'anthropic', 'openai', 'google-ai',
    'techcrunch-ai', 'techcrunch-robotics', 'wired', 'arstechnica', 'theverge',
    'mit-tech-review', 'venturebeat-ai', 'ieee-spectrum-ai', 'ieee-spectrum-robotics',
    'nature-ml', 'robot-report', 'robohub',
  ];
  const sourceLabels = {
    arxiv: 'arXiv Papers',
    hackernews: 'Hacker News',
    reddit: 'Reddit',
    twitter: 'X / Twitter',
    x: 'X (curated)',
    bluesky: 'Bluesky',
    mastodon: 'Mastodon',
    github: 'GitHub Trending',
    bookmark: 'Curated Bookmarks',
    anthropic: 'Anthropic Blog',
    openai: 'OpenAI Blog',
    'google-ai': 'Google AI Blog',
    'techcrunch-ai': 'TechCrunch — AI',
    'techcrunch-robotics': 'TechCrunch — Robotics',
    wired: 'Wired',
    arstechnica: 'Ars Technica',
    theverge: 'The Verge',
    'mit-tech-review': 'MIT Technology Review',
    'venturebeat-ai': 'VentureBeat — AI',
    'ieee-spectrum-ai': 'IEEE Spectrum — AI',
    'ieee-spectrum-robotics': 'IEEE Spectrum — Robotics',
    'nature-ml': 'Nature — Machine Learning',
    'robot-report': 'The Robot Report',
    robohub: 'Robohub',
  };

  for (const key of sourceOrder) {
    const items = bySource[key];
    if (!items || !items.length) continue;
    lines.push(`=== ${sourceLabels[key] || key} ===`);
    for (const item of items.slice(0, 6)) {
      lines.push(`Title: ${item.title}`);
      if (item.author && item.author !== key) lines.push(`Author: ${item.author}`);
      if (item.text) lines.push(`Summary: ${item.text.slice(0, 250)}`);
      lines.push(`URL: ${item.url}`);
      if (item.score) lines.push(`Engagement: ${item.score} points`);
      if (item.commentCount) lines.push(`Comments: ${item.commentCount}`);
      if (item.stars) lines.push(`Stars: ${item.stars}`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function estimateReadingTime(text) {
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

// ISO 8601 week date: week 1 is the week containing the year's first Thursday.
// Returns "<isoYear>-w<WW>" (zero-padded), e.g. "2026-w29". Used for the weekly
// publication ids so the briefing and feature generators agree on "this week".
function isoWeekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // shift to this week's Thursday
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${isoYear}-w${String(week).padStart(2, '0')}`;
}

// ─── LLM Call ───────────────────────────────────────────────────────────────

class KimiApiError extends Error {
  constructor(status, body) {
    super(`Kimi API error ${status}: ${body}`);
    this.name = 'KimiApiError';
    this.status = status;
  }
}

async function callKimi(messages, maxTokens = 4000) {
  if (!KIMI_API_KEY) {
    throw new Error('KIMI_API_KEY not set');
  }

  // The kimi-for-coding endpoint rejects any temperature other than 1
  // (HTTP 400: "invalid temperature: only 1 is allowed for this model").
  // KIMI_TEMPERATURE overrides this if the endpoint policy ever changes.
  const envTemp = Number(process.env.KIMI_TEMPERATURE);
  const temperature = Number.isFinite(envTemp) ? envTemp : 1;

  const res = await fetch(KIMI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KIMI_API_KEY}`,
      'User-Agent': 'claude-code/0.1.0',
    },
    body: JSON.stringify({
      model: KIMI_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new KimiApiError(res.status, text);
  }

  const data = await res.json();
  const msg = data.choices?.[0]?.message || {};
  return extractResponse(msg);
}

function extractResponse(msg) {
  if (msg.content) {
    return msg.content.trim();
  }
  if (msg.reasoning_content) {
    const lines = msg.reasoning_content.split('\n');
    let startIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('# ')) {
        startIdx = i;
        break;
      }
    }
    if (startIdx !== -1) {
      const nonContent = ['Wait,', 'Actually,', 'I should', 'I need', 'Let me', 'This looks', 'I will', "I'll", 'Hmm,', 'So,', 'Now,', 'But,', 'However,', 'Instead,', 'Therefore,', 'In summary,', 'To summarize,'];
      let endIdx = lines.length;
      for (let i = lines.length - 1; i >= startIdx; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        if (nonContent.some((p) => line.startsWith(p))) {
          endIdx = i;
        } else {
          break;
        }
      }
      return lines.slice(startIdx, endIdx).join('\n').trim();
    }
    // No H1 anchor in the reasoning stream — the "answer" would be raw
    // planning text. Treat as no usable response rather than publishing it.
    return '';
  }
  return '';
}

// ─── Pipeline IO ────────────────────────────────────────────────────────────

function loadPipeline() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Pipeline] Failed to load:', err.message);
  }
  return [];
}

function savePipeline(pubs) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(pubs, null, 2));
}

// ─── Publication Factory ────────────────────────────────────────────────────

function buildPublication(opts) {
  const {
    id,
    slug,
    type = 'blog',
    contentType,
    status = 'published',
    title,
    subtitle,
    abstract,
    authors,
    teams = ['research'],
    tags = [],
    keywords = [],
    createdAt,
    updatedAt,
    publishedAt,
    content,
    readingTime,
    featured = false,
    series,
    issueNumber,
    metrics,
    license = 'CC BY 4.0',
    accessLevel = 'public',
  } = opts;

  return {
    id,
    slug,
    type,
    contentType,
    status,
    title,
    subtitle,
    abstract,
    authors,
    teams,
    tags,
    keywords,
    createdAt,
    updatedAt,
    publishedAt,
    content,
    readingTime,
    featured,
    series,
    issueNumber,
    metrics: metrics || { views: 0, uniqueVisitors: 0, downloads: 0, citationCount: 0 },
    license,
    accessLevel,
  };
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  // Config
  KIMI_API_KEY,
  KIMI_URL,
  KIMI_MODEL,
  DATA_FILE,

  // Brand / Taxonomy
  EDITORIAL_VOICE,
  TAXONOMY,
  FOCUS_AREAS,

  // Relevance
  scoreRelevance,
  filterSources,
  deduplicateSources,
  normalizeTitle,

  // Fetchers
  fetchHN,
  fetchReddit,
  fetchArxiv,
  fetchGitHubTrending,
  fetchTwitter,
  fetchXCurated,
  fetchBluesky,
  fetchMastodon,
  fetchCompanyBlog,
  fetchAllSources,

  // Helpers
  stripCdata,
  unescapeXml,
  decodeHtmlEntities,
  formatSourcesForPrompt,
  estimateReadingTime,
  isoWeekKey,

  // LLM
  callKimi,
  KimiApiError,
  extractResponse,

  // IO
  loadPipeline,
  savePipeline,

  // Factory
  buildPublication,
};
