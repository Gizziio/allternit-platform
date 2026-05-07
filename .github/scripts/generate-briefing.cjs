#!/usr/bin/env node
/**
 * Allternit Signal — Daily Briefing Generator
 *
 * Fetches live sources, filters by relevance, calls Kimi API for
 * structured briefing generation with Allternit editorial voice.
 */

const {
  EDITORIAL_VOICE,
  TAXONOMY,
  fetchAllSources,
  formatSourcesForPrompt,
  estimateReadingTime,
  callKimi,
  loadPipeline,
  savePipeline,
  buildPublication,
} = require('./lib/pipeline.cjs');

// ─── Prompt Templates ───────────────────────────────────────────────────────

function buildBriefingPrompt(sourcesText, dateStr) {
  return `${EDITORIAL_VOICE.signal}

Your task: write today's Allternit Signal briefing for ${dateStr}.

STRUCTURE (strict markdown):
## Signal
1-2 sentences on the single most important development today. What should a production AI team actually care about?

## Research
arXiv papers that matter. For each:
- **Title** — link the URL
- 2-3 sentence summary with the actual technical contribution
- "Why it matters" — connect to production implications

## Industry
Company blog posts, product launches, policy news. For each:
- **Title** — link the URL
- What happened and why it changes the landscape

## Code
GitHub repos/tools trending today. For each:
- **Name** — link the URL
- What it does and who should use it

## Numbers
 engagement stats table (source, top item, score/comments/stars)

RULES:
- Skip meta threads, hiring posts, pure VC/funding news
- No hype words: "groundbreaking", "revolutionary", "game-changing"
- Use specifics: model names, latency numbers, benchmark scores
- Every claim must trace to a source below
- Total length: 400-800 words

SOURCES:
${sourcesText}`;
}

function buildMetadataPrompt(markdown, sources) {
  const taxonomyList = Object.entries(TAXONOMY)
    .map(([k, v]) => `${k}: ${v.keywords.slice(0, 4).join(', ')}`)
    .join('\n');

  return `Given this Allternit Signal briefing, output ONLY a JSON object with these keys:
- abstract: 2-sentence summary of the briefing (not source counts)
- tags: array of 3-5 tags from this taxonomy [${Object.keys(TAXONOMY).join(', ')}]
- keywords: array of 5-8 specific technical keywords
- focusAreas: array of focus areas this briefing covers
- readingTime: estimated minutes (integer)

TAXONOMY:
${taxonomyList}

BRIEFING:
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
  const dateStr = now.toISOString().slice(0, 10);
  const friendlyDate = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const isoDate = now.toISOString();

  const briefingId = `signal-${dateStr}-daily-brief`;
  const slug = `daily-brief-${dateStr}`;

  // Check if today's briefing already exists
  const pipeline = loadPipeline();
  if (pipeline.some((p) => p.id === briefingId)) {
    console.log(`Briefing ${briefingId} already exists. Skipping.`);
    return;
  }

  // Fetch and filter sources
  const { filtered, hn, reddit, arxiv, github, blogs } = await fetchAllSources({
    hnLimit: 10,
    redditSubs: ['MachineLearning', 'LocalLLaMA', 'artificial'],
    redditLimit: 5,
    arxivCats: ['cs.AI', 'cs.LG', 'cs.CL'],
    arxivLimit: 5,
    githubTopics: ['ai', 'machine-learning', 'llm'],
    githubLimit: 5,
    blogLimit: 3,
  });

  if (!filtered.length) {
    console.log('No relevant sources available. Skipping.');
    return;
  }

  const sourcesText = formatSourcesForPrompt(filtered);

  // Step 1: Generate briefing markdown
  console.log('Generating briefing with Kimi...');
  const prompt = buildBriefingPrompt(sourcesText, friendlyDate);
  const markdown = await callKimi([{ role: 'user', content: prompt }], 4000, 0.3);

  if (!markdown) {
    console.error('Empty response from Kimi. Skipping.');
    return;
  }

  // Step 2: Extract metadata via LLM
  console.log('Extracting metadata...');
  let meta = {};
  try {
    const metaPrompt = buildMetadataPrompt(markdown, filtered);
    const metaRaw = await callKimi([{ role: 'user', content: metaPrompt }], 1000, 0.1);
    meta = JSON.parse(metaRaw.replace(/^```json\s*|\s*```$/g, ''));
  } catch (err) {
    console.warn('[Metadata] LLM extraction failed, falling back:', err.message);
    meta = {
      abstract: `Daily intelligence for ${friendlyDate}. Covering ${filtered.length} curated sources across research, industry, and open source.`,
      tags: ['daily-brief', 'ai-news', 'curated'],
      keywords: ['briefing', 'curated', 'intelligence'],
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
    title: `Daily AI Brief: ${friendlyDate}`,
    subtitle: 'Allternit Signal · Curated Intelligence',
    abstract: meta.abstract,
    authors: ['Allternit Signal'],
    teams: ['research'],
    tags: meta.tags || ['daily-brief', 'ai-news', 'curated'],
    keywords: meta.keywords || ['briefing', 'curated', 'intelligence'],
    createdAt: isoDate,
    updatedAt: isoDate,
    publishedAt: isoDate,
    content: {
      markdown,
      sources: sourceProvenance,
    },
    readingTime: meta.readingTime || estimateReadingTime(markdown),
    featured: false,
    series: 'Daily AI Brief',
    issueNumber: dateStr,
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
  console.log(`Saved briefing ${briefingId} to pipeline (${trimmed.length} total items)`);
  console.log(`  Focus areas: ${meta.focusAreas?.join(', ') || 'none detected'}`);
  console.log(`  Sources: ${filtered.length} items`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
