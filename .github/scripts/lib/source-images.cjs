#!/usr/bin/env node
/**
 * Allternit Discovery Pipeline — Source Image Harvester
 *
 * Finds the real photo behind each story a publication links to, so photo
 * editions show the thing the story is actually about:
 *
 *   - Bluesky posts resolve through the public, unauthenticated AT Protocol
 *     API. Posts that share an article reveal that article's URL, whose
 *     og:image is then harvested; posts with attached photos yield the
 *     full-size image directly.
 *   - Ordinary web articles (TechCrunch, Verge, MIT TR, vendor blogs, ...)
 *     yield their og:image / twitter:image.
 *   - arXiv abs pages and x.com are documented dead ends (logo-only og:image
 *     / no HTML version for recent papers; X blocks scraping) and are
 *     skipped — those stories fall back to Codex-generated art or no photo.
 *
 * Zero dependencies (global fetch), never throws on a bad source. Downloaded
 * images land as <outDir>/story-<n>.<ext> and the returned mapping links each
 * file back to the source URL it came from:
 *
 *   [{ sourceUrl, file, host }]
 */

const fs = require('fs');
const path = require('path');

const FETCH_TIMEOUT_MS = 10000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ─── HTTP helpers ───────────────────────────────────────────────────────────

async function fetchText(url, redirects = 0) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'text/html,*/*' },
      redirect: 'manual',
    });
    if (res.status >= 300 && res.status < 400 && redirects < MAX_REDIRECTS) {
      const loc = res.headers.get('location');
      if (loc) return fetchText(new URL(loc, url).href, redirects + 1);
    }
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.includes('text') && !type.includes('html') && !type.includes('json')) {
      return null;
    }
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const IMAGE_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

async function downloadImage(url, destPath) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
    });
    if (!res.ok) return null;
    const type = (res.headers.get('content-type') || '').split(';')[0].trim();
    const ext = IMAGE_EXT[type] || '.jpg';
    const length = Number(res.headers.get('content-length') || 0);
    if (length > MAX_IMAGE_BYTES) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_IMAGE_BYTES || buf.length < 4096) return null;
    const finalPath = destPath + ext;
    fs.writeFileSync(finalPath, buf);
    return finalPath;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Extraction helpers ─────────────────────────────────────────────────────

function extractOgImage(html) {
  if (!html) return null;
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1] && /^https?:\/\//i.test(m[1])) return m[1];
  }
  return null;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// Harvest the og:image of an ordinary article page.
async function ogImageOf(articleUrl) {
  const html = await fetchText(articleUrl);
  if (!html) return null;
  const image = extractOgImage(html);
  if (!image) return null;
  return new URL(image, articleUrl).href;
}

// Resolve a Bluesky post to image candidates via the public API.
// Returns [{ imageUrl, articleUrl? }] — articleUrl marks og:image follow-ups.
async function bskyCandidates(postUrl) {
  const m = postUrl.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/);
  if (!m) return [];
  const uri = `at://${m[1]}/app.bsky.feed.post/${m[2]}`;
  const api =
    'https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=' +
    encodeURIComponent(uri);
  const body = await fetchText(api);
  if (!body) return [];
  let post;
  try {
    post = JSON.parse(body).posts[0];
  } catch {
    return [];
  }
  if (!post) return [];

  const did = post.author && post.author.did;
  const embed = (post.record && post.record.embed) || post.embed || {};
  const out = [];

  // Attached photos: full-size blobs.
  const images =
    embed.$type === 'app.bsky.embed.images'
      ? embed.images
      : embed.media && embed.media.$type === 'app.bsky.embed.images'
        ? embed.media.images
        : null;
  if (images && images.length && did) {
    for (const img of images.slice(0, 1)) {
      const ref = img.image && img.image.ref && img.image.ref.$link;
      if (ref) {
        out.push({
          imageUrl: `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${ref}@jpeg`,
        });
      }
    }
  }

  // Shared article: the real story URL — harvest its og:image.
  const external =
    embed.$type === 'app.bsky.embed.external'
      ? embed.external
      : embed.media && embed.media.$type === 'app.bsky.embed.external'
        ? embed.media.external
        : null;
  if (external && external.uri) {
    out.push({ articleUrl: external.uri });
    const thumbRef =
      external.thumb && external.thumb.ref && external.thumb.ref.$link;
    if (thumbRef && did) {
      out.push({
        imageUrl: `https://cdn.bsky.app/img/feed_fullsize/plain/${did}/${thumbRef}@jpeg`,
      });
    }
  }
  return out;
}

// ─── Main ───────────────────────────────────────────────────────────────────

/**
 * Harvest one representative image per harvestable source of a publication.
 * Returns [{ sourceUrl, file, host }] for the sources that yielded one.
 */
async function harvestSourceImages(publication, outDir, { log = () => {} } = {}) {
  const sources =
    publication.content && Array.isArray(publication.content.sources)
      ? publication.content.sources
      : [];
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  let n = 0;

  for (const s of sources) {
    const url = s && s.url;
    if (!url) continue;

    // Documented dead ends — see module header.
    if (/arxiv\.org/i.test(url)) continue;
    if (/(^|\.)(x|twitter)\.com/i.test(hostOf(url))) continue;

    try {
      const candidates = /bsky\.app/i.test(url)
        ? await bskyCandidates(url)
        : [{ articleUrl: url }];

      let file = null;
      for (const cand of candidates) {
        let imageUrl = cand.imageUrl || null;
        if (!imageUrl && cand.articleUrl) {
          imageUrl = await ogImageOf(cand.articleUrl);
        }
        if (!imageUrl) continue;
        file = await downloadImage(imageUrl, path.join(outDir, `story-${n}`));
        if (file) break;
      }

      if (file) {
        results.push({ sourceUrl: url, file, host: hostOf(url) });
        log(`  ✓ ${hostOf(url)} → ${path.basename(file)}`);
        n += 1;
      }
    } catch (err) {
      log(`  ✗ ${hostOf(url)}: ${err && err.message ? err.message : err}`);
    }
  }

  return results;
}

module.exports = { harvestSourceImages };
