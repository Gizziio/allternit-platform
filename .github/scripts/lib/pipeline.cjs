#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — Shared Library
 *
 * Unified utilities for source fetching, relevance scoring, LLM calls,
 * and Publication construction.
 */

const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────────────

const KIMI_URL = 'https://api.kimi.com/coding/v1/chat/completions';
const KIMI_MODEL = 'kimi-for-coding';
const KIMI_API_KEY = process.env.KIMI_API_KEY || '';

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

const DATA_FILE = path.resolve(
  __dirname,
  '../../surfaces/ai.allternit.com/src/data/discovery-pipeline.json',
);

// ─── Brand Voice & Taxonomy ─────────────────────────────────────────────────

const EDITORIAL_VOICE = {
  signal:
    'You are Allternit Signal — a concise, production-focused intelligence digest. ' +
    'Tone: sharp, skeptical of hype, focused on what matters for shipping AI systems. ' +
    'Avoid marketing language. Use specifics over superlatives.',
  research:
    'You are Allternit Research — an analytical deep-dive publication. ' +
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
  const directTerms = ['llm', 'language model', 'foundation model', 'gpt', 'claude', 'gemini', 'openai', 'anthropic', 'deepmind', 'meta ai', 'hugging face'];
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

async function fetchGitHubTrending(topics = ['ai', 'machine-learning', 'llm'], limit = 5) {
  const all = [];
  for (const topic of topics) {
    try {
      const url = `https://github.com/trending/${topic}?since=daily`;
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
        const starsMatch = block.match(/(\d+[KM]?) stars?/i);
        const forksMatch = block.match(/(\d+[KM]?) forks?/i);

        const rawTitle = titleMatch ? titleMatch[2].replace(/\s+/g, ' ').trim() : '';
        const href = titleMatch ? titleMatch[1] : '';
        const title = rawTitle.replace(/\//g, ' / ').trim();

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
      console.error(`[GitHub ${topic}] Failed:`, err.message);
    }
  }
  return all;
}

function parseCount(str) {
  if (!str) return 0;
  const num = parseFloat(str.replace(/,/g, ''));
  if (str.endsWith('K')) return num * 1000;
  if (str.endsWith('M')) return num * 1000000;
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
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = entry.match(/<link>([\s\S]*?)<\/link>/) || entry.match(/<link[^>]*href="([^"]+)"/);
      const descMatch = entry.match(/<description>([\s\S]*?)<\/description>/) || entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const dateMatch = entry.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || entry.match(/<published>([\s\S]*?)<\/published>/);
      return {
        id: `${label}-${Math.random().toString(36).slice(2, 8)}`,
        title: titleMatch ? unescapeXml(titleMatch[1].trim()) : '',
        url: linkMatch ? linkMatch[1].trim() : '',
        author: label,
        text: descMatch ? decodeHtmlEntities(descMatch[1]).slice(0, 400) : '',
        source: label,
        publishedAt: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
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

async function fetchAllSources(opts = {}) {
  const {
    hnLimit = 8,
    redditSubs = ['MachineLearning', 'LocalLLaMA', 'artificial'],
    redditLimit = 5,
    arxivCats = ['cs.AI', 'cs.LG', 'cs.CL'],
    arxivLimit = 6,
    githubTopics = ['ai', 'machine-learning', 'llm'],
    githubLimit = 5,
    blogs = [
      { url: 'https://www.anthropic.com/rss.xml', label: 'anthropic' },
      { url: 'https://openai.com/blog/rss.xml', label: 'openai' },
      { url: 'https://blog.google/technology/ai/rss/', label: 'google-ai' },
    ],
    blogLimit = 3,
    twitterLimit = 6,
  } = opts;

  console.log('Fetching sources...');
  const [
    hn,
    reddit,
    arxiv,
    github,
    twitter,
    ...blogResults
  ] = await Promise.all([
    fetchHN(hnLimit),
    fetchReddit(redditSubs, redditLimit),
    fetchArxiv(arxivCats, arxivLimit),
    fetchGitHubTrending(githubTopics, githubLimit),
    fetchTwitter(twitterLimit),
    ...blogs.map((b) => fetchCompanyBlog(b.url, b.label, blogLimit)),
  ]);

  const blogsFlat = blogResults.flat();

  console.log(
    `Sources: ${hn.length} HN, ${reddit.length} Reddit, ${arxiv.length} arXiv, ${github.length} GitHub, ${twitter.length} Twitter, ${blogsFlat.length} blogs`,
  );

  const all = [...hn, ...reddit, ...arxiv, ...github, ...twitter, ...blogsFlat];
  const deduped = deduplicateSources(all);
  const filtered = filterSources(deduped);

  console.log(`After dedup + relevance filter: ${filtered.length} items`);

  return { hn, reddit, arxiv, github, twitter, blogs: blogsFlat, filtered };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function unescapeXml(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
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
  const sourceOrder = ['arxiv', 'hackernews', 'reddit', 'twitter', 'github', 'bookmark', 'anthropic', 'openai', 'google-ai'];
  const sourceLabels = {
    arxiv: 'arXiv Papers',
    hackernews: 'Hacker News',
    reddit: 'Reddit',
    twitter: 'X / Twitter',
    github: 'GitHub Trending',
    bookmark: 'Curated Bookmarks',
    anthropic: 'Anthropic Blog',
    openai: 'OpenAI Blog',
    'google-ai': 'Google AI Blog',
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

// ─── LLM Call ───────────────────────────────────────────────────────────────

async function callKimi(messages, maxTokens = 4000, temperature = 0.3) {
  if (!KIMI_API_KEY) {
    throw new Error('KIMI_API_KEY not set');
  }

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
    throw new Error(`Kimi API error ${res.status}: ${text}`);
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
    return msg.reasoning_content.trim();
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
  fetchCompanyBlog,
  fetchAllSources,

  // Helpers
  unescapeXml,
  decodeHtmlEntities,
  formatSourcesForPrompt,
  estimateReadingTime,

  // LLM
  callKimi,
  extractResponse,

  // IO
  loadPipeline,
  savePipeline,

  // Factory
  buildPublication,
};
