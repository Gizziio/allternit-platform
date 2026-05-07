#!/usr/bin/env node
/**
 * Bookmark Importer — imports Twitter/X (and other) bookmarks into the pipeline.
 *
 * Reads from src/data/bookmarks.json and converts each entry into a pipeline
 * Publication. Safe to run multiple times — skips duplicates by URL.
 *
 * bookmarks.json format:
 * [
 *   {
 *     "url": "https://x.com/someuser/status/1234567890",
 *     "title": "Tweet text or description",
 *     "author": "@someuser",
 *     "source": "twitter",
 *     "tags": ["agentic-ai"],
 *     "note": "Optional personal note"
 *   }
 * ]
 */

const fs = require('fs');
const path = require('path');

const { loadPipeline, savePipeline, buildPublication } = require('./lib/pipeline.cjs');

const BOOKMARKS_FILE = path.resolve(
  __dirname,
  '../../surfaces/ai.allternit.com/src/data/bookmarks.json',
);

const DATA_FILE = path.resolve(
  __dirname,
  '../../surfaces/ai.allternit.com/src/data/discovery-pipeline.json',
);

function loadBookmarks() {
  try {
    if (fs.existsSync(BOOKMARKS_FILE)) {
      return JSON.parse(fs.readFileSync(BOOKMARKS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[Bookmarks] Failed to load:', err.message);
  }
  return [];
}

function normalizeUrl(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\?.*$/, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

function bookmarkToPublication(bm, idx) {
  const now = new Date().toISOString();
  const id = `bookmark-${bm.source || 'web'}-${idx}`;
  const slug = `bookmark-${idx}`;

  const abstract = bm.note
    ? `${bm.note}. Curated from ${bm.source || 'web'}.`
    : `Curated ${bm.source || 'web'} link${bm.author ? ` by ${bm.author}` : ''}.`;

  return buildPublication({
    id,
    slug,
    contentType: 'signal',
    title: bm.title || 'Curated Link',
    subtitle: `${bm.source || 'Web'} · Curated Bookmark`,
    abstract,
    authors: bm.author ? [bm.author] : ['Allternit Signal'],
    teams: ['research'],
    tags: bm.tags || ['curated', bm.source || 'web'],
    keywords: bm.tags || ['curated'],
    createdAt: now,
    updatedAt: now,
    publishedAt: now,
    content: {
      markdown: bm.title
        ? `**${bm.title}**\n\n${bm.author ? `By ${bm.author}` : ''}\n\n${bm.url}`
        : bm.url,
      sources: [
        {
          source: bm.source || 'web',
          title: bm.title || bm.url,
          url: bm.url,
        },
      ],
    },
    readingTime: 1,
    featured: false,
    series: 'Curated Bookmarks',
    metrics: { views: 0, uniqueVisitors: 0, downloads: 0, citationCount: 0 },
  });
}

async function main() {
  const bookmarks = loadBookmarks();
  if (!bookmarks.length) {
    console.log('No bookmarks found. Create src/data/bookmarks.json to get started.');
    console.log('');
    console.log('Example:');
    console.log(JSON.stringify([
      {
        url: 'https://x.com/karpathy/status/1234567890',
        title: 'Great thread on LLM training dynamics',
        author: '@karpathy',
        source: 'twitter',
        tags: ['llm', 'training'],
      },
    ], null, 2));
    return;
  }

  const pipeline = loadPipeline();
  const existingUrls = new Set(
    pipeline
      .flatMap((p) => p.content?.sources || [])
      .map((s) => normalizeUrl(s.url)),
  );

  let added = 0;
  let skipped = 0;

  for (let i = 0; i < bookmarks.length; i++) {
    const bm = bookmarks[i];
    if (!bm.url) {
      console.warn(`Skipping bookmark ${i}: no URL`);
      continue;
    }

    const normUrl = normalizeUrl(bm.url);
    if (existingUrls.has(normUrl)) {
      skipped++;
      continue;
    }

    const pub = bookmarkToPublication(bm, i);
    pipeline.push(pub);
    existingUrls.add(normUrl);
    added++;
  }

  if (added > 0) {
    pipeline.sort(
      (a, b) =>
        new Date(b.publishedAt ?? b.createdAt).getTime() -
        new Date(a.publishedAt ?? a.createdAt).getTime(),
    );
    const trimmed = pipeline.slice(0, 100);
    savePipeline(trimmed);
    console.log(`Added ${added} bookmarks, skipped ${skipped} duplicates. Total: ${trimmed.length}`);
  } else {
    console.log(`No new bookmarks. ${skipped} already in pipeline.`);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
