#!/usr/bin/env node
/**
 * Allternit News — Weekly News Edition Generator
 *
 * Fetches live sources, filters by relevance, calls Kimi API for
 * structured news generation with Allternit editorial voice.
 * Organized into five "CLI departments": ls -la, rm -rf, git push,
 * pwned, Ctrl + Z.
 */

const {
  EDITORIAL_VOICE,
  TAXONOMY,
  fetchAllSources,
  formatSourcesForPrompt,
  estimateReadingTime,
  isoWeekKey,
  callKimi,
  KimiApiError,
  loadPipeline,
  savePipeline,
  buildPublication,
} = require('./lib/pipeline.cjs');

// ─── Prompt Templates ───────────────────────────────────────────────────────

function buildBriefingPrompt(sourcesText, weekLabel) {
  return `${EDITORIAL_VOICE.signal}

Your task: write this week's Allternit News edition — ${weekLabel}.

DEPARTMENTS (strict markdown — use these exact headings, in this order):

## ls -la
The full listing: the week's events in the AI/robotics space, organized by category and relevance. This is the comprehensive section. For each item:
- **Title** — link the URL
- 1-2 sentences: what happened, and why a production AI team should care

## rm -rf
What got deleted this week: deprecated APIs, sunset products, dead startups/projects, abandoned models, layoffs, removed features. For each:
- **Title** — link the URL
- What was killed, and what replaces it (if anything)

## git push
Trending GitHub projects, drawn from the GitHub Trending sources below. For each:
- **owner / repo** — link the URL
- What it does, star/fork momentum, and why it's worth a look

## pwned
Security: jailbreaks, exploits, breaches, espionage, model distillation/theft, adversarial research. For each:
- **Title** — link the URL
- The attack surface or exposure, and who needs to patch or pay attention

## Ctrl + Z
Run it back: follow-ups, corrections, and second-look updates to stories covered previously. For each:
- **Title** — link the URL
- What changed since the original coverage

RULES:
- Write ALL FIVE departments. Only omit one if its source material is literally zero (e.g. no security stories exist at all). A short department beats a missing one.
- The git push department is MANDATORY whenever GitHub Trending sources appear below — never skip it.
- Budget: ls -la gets at most ~40% of the edition; each other department gets 100-150 words with 3-5 items.
- Skip meta threads, hiring posts, pure VC/funding news
- No hype words: "groundbreaking", "revolutionary", "game-changing"
- Use specifics: model names, latency numbers, benchmark scores
- Every claim must trace to a source below
- Total length: 600-1000 words

SOURCES:
${sourcesText}`;
}

function buildMetadataPrompt(markdown, sources) {
  const taxonomyList = Object.entries(TAXONOMY)
    .map(([k, v]) => `${k}: ${v.keywords.slice(0, 4).join(', ')}`)
    .join('\n');

  return `Given this Allternit News weekly edition (departments: ls -la, rm -rf, git push, pwned, Ctrl + Z), output ONLY a JSON object with these keys:
- abstract: 2-sentence summary of the edition (not source counts)
- tags: array of 3-5 tags from this taxonomy [${Object.keys(TAXONOMY).join(', ')}]
- keywords: array of 5-8 specific technical keywords
- focusAreas: array of focus areas this edition covers
- readingTime: estimated minutes (integer)

TAXONOMY:
${taxonomyList}

EDITION:
${markdown.slice(0, 2000)}

OUTPUT ONLY VALID JSON. No markdown fences.`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.KIMI_API_KEY) {
    console.error('Error: KIMI_API_KEY environment variable is required');
    process.exit(1);
  }

  const now = new Date();
  const weekKey = isoWeekKey(now); // e.g. "2026-w29"
  const friendlyDate = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const weekLabel = `week of ${friendlyDate} (ISO week ${weekKey.replace('-w', '-W')})`;
  const isoDate = now.toISOString();

  const briefingId = `news-${weekKey}`;
  const slug = `weekly-news-${weekKey}`;

  // Check if this week's edition already exists
  const pipeline = loadPipeline();
  if (pipeline.some((p) => p.id === briefingId)) {
    console.log(`News edition ${briefingId} already exists. Skipping.`);
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  // Fetch and filter sources
  const { filtered, hn, reddit, arxiv, github, blogs } = await fetchAllSources({
    hnLimit: 10,
    redditSubs: ['MachineLearning', 'LocalLLaMA', 'artificial'],
    redditLimit: 5,
    arxivCats: ['cs.AI', 'cs.LG', 'cs.CL'],
    arxivLimit: 5,
    githubLanguages: [''],
    githubLimit: 5,
    blogLimit: 5,
  });

  if (!filtered.length) {
    console.log('No relevant sources available. Skipping.');
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  const sourcesText = formatSourcesForPrompt(filtered);

  // Step 1: Generate news edition markdown
  console.log('Generating news edition with Kimi...');
  const prompt = buildBriefingPrompt(sourcesText, weekLabel);
  // Reasoning models consume thinking tokens from this budget — give it
  // headroom or the final answer comes back empty.
  const markdown = await callKimi([{ role: 'user', content: prompt }], 16000);

  if (!markdown) {
    console.error('Empty response from Kimi. Skipping.');
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  // Guard: never publish a reasoning/planning trace as an edition.
  if (!markdown.includes('# Allternit News')) {
    console.error('Kimi returned a planning trace, not an edition (missing "# Allternit News" title). Skipping.');
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  // Step 2: Extract metadata via LLM
  console.log('Extracting metadata...');
  let meta = {};
  try {
    const metaPrompt = buildMetadataPrompt(markdown, filtered);
    const metaRaw = await callKimi([{ role: 'user', content: metaPrompt }], 1000);
    meta = JSON.parse(metaRaw.replace(/^```json\s*|\s*```$/g, ''));
  } catch (err) {
    console.warn('[Metadata] LLM extraction failed, falling back:', err.message);
    meta = {
      abstract: `The week's AI + robotics desk for the ${weekLabel}. Covering ${filtered.length} curated sources across research, industry, and open source.`,
      tags: ['weekly-news', 'ai-news', 'curated'],
      keywords: ['weekly', 'curated', 'intelligence'],
      focusAreas: [],
      readingTime: estimateReadingTime(markdown),
    };
  }

  // Build source provenance
  const sourceProvenance = filtered.map((s) => ({
    source: s.source,
    title: s.title,
    url: s.url,
    engagement: {
      score: s.score,
      commentCount: s.commentCount,
      stars: s.stars,
      forks: s.forks,
    },
    relevanceScore: s.relevance?.score ?? 0,
    focusAreas: s.relevance?.focusAreas ?? [],
  }));

  // Aggregate engagement metrics
  const totalEngagement = filtered.reduce(
    (acc, s) => ({
      views: acc.views + (s.score || 0),
      uniqueVisitors: acc.uniqueVisitors + (s.commentCount || 0),
      downloads: acc.downloads + (s.stars || 0),
      citationCount: acc.citationCount,
    }),
    { views: 0, uniqueVisitors: 0, downloads: 0, citationCount: 0 },
  );

  const publication = buildPublication({
    id: briefingId,
    slug,
    contentType: 'signal',
    title: `Allternit News Weekly — ${weekLabel}`,
    subtitle: "The week's AI + robotics desk, in one edition",
    abstract: meta.abstract,
    authors: ['Allternit News'],
    teams: ['research'],
    tags: meta.tags || ['weekly-news', 'ai-news', 'curated'],
    keywords: meta.keywords || ['weekly', 'curated', 'intelligence'],
    createdAt: isoDate,
    updatedAt: isoDate,
    publishedAt: isoDate,
    content: {
      markdown,
      sources: sourceProvenance,
    },
    readingTime: meta.readingTime || estimateReadingTime(markdown),
    featured: false,
    series: 'Allternit News',
    issueNumber: weekKey.replace('-w', '-W'),
    metrics: totalEngagement,
  });

  // Update pipeline: append, sort by date desc, trim to 100
  pipeline.push(publication);
  pipeline.sort(
    (a, b) =>
      new Date(b.publishedAt ?? b.createdAt).getTime() -
      new Date(a.publishedAt ?? a.createdAt).getTime(),
  );
  const trimmed = pipeline.slice(0, 100);

  savePipeline(trimmed);
  console.log(`Saved news edition ${briefingId} to pipeline (${trimmed.length} total items)`);
  console.log(`  Focus areas: ${meta.focusAreas?.join(', ') || 'none detected'}`);
  console.log(`  Sources: ${filtered.length} items`);
}

if (require.main === module) {
  main().catch((err) => {
    if (err instanceof KimiApiError && err.status === 403) {
      // Subscription quota exhausted — transient, not a pipeline bug. Exit 0 so
      // the workflow succeeds; the commit step finds no changes and skips.
      console.error('Kimi API quota exhausted (403 usage limit). Skipping this run without failing the workflow.');
      console.log('No new items added to discovery-pipeline.json.');
      process.exit(0);
    }
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = { buildBriefingPrompt, buildMetadataPrompt };
