#!/usr/bin/env node
/**
 * Allternit Research — Weekly Feature Generator
 *
 * Generates a deep-dive feature article on a trending AI topic,
 * with Allternit Research editorial voice and structured analysis.
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

function buildTopicSelectionPrompt(sourcesText) {
  return `${EDITORIAL_VOICE.research}

From these sources, identify the single most important trending topic in AI/ML for this week.

Criteria:
- Has technical depth (not just a product launch)
- Connects to production AI systems
- Is likely to still matter in 6 months
- Something Allternit's audience (engineers building agentic systems) should understand deeply

Return ONLY the topic title (5-12 words). No explanation.

SOURCES:
${sourcesText}`;
}

function buildFeaturePrompt(topic, sourcesText) {
  return `${EDITORIAL_VOICE.research}

Write a comprehensive weekly feature article on: "${topic}"

TARGET AUDIENCE: Senior engineers and tech leads building production AI systems. They care about what works, what doesn't, and what to watch.

STRUCTURE (strict markdown):
# ${topic}

## The Big Picture
What is happening and why it matters now? 200-300 words. No fluff. Lead with the stakes.

## Technical Breakdown
The core technical details an engineer needs to understand. 400-600 words.
- How it works (architecture, key algorithms, dependencies)
- What problem it actually solves vs. what the marketing claims
- Limitations and edge cases

## Production Implications
What does this mean for teams shipping AI? 300-400 words.
- When should you adopt it? When should you wait?
- Integration complexity and operational concerns
- Cost and performance tradeoffs

## What We're Watching
3-5 specific things to track over the next month. Be concrete: benchmarks, releases, papers, or code commits.

## Sources
Bullet list of all referenced sources with URLs.

RULES:
- Total length: 1500-2500 words
- No hype words: "groundbreaking", "revolutionary", "game-changing", "disruptive"
- Use specifics: model names, latency numbers, benchmark scores, version numbers
- Every technical claim must trace to a source below
- If the sources don't support a strong claim, say "unclear" or "unverified"
- Include the "so what" — why an engineer should care

SOURCES:
${sourcesText}`;
}

function buildMetadataPrompt(markdown) {
  const taxonomyList = Object.entries(TAXONOMY)
    .map(([k, v]) => `${k}: ${v.keywords.slice(0, 4).join(', ')}`)
    .join('\n');

  return `Given this Allternit Research feature article, output ONLY a JSON object with these keys:
- abstract: 3-sentence summary of the article's thesis and key takeaway
- tags: array of 3-5 tags from this taxonomy [${Object.keys(TAXONOMY).join(', ')}]
- keywords: array of 6-10 specific technical keywords
- focusAreas: array of focus areas this article covers
- readingTime: estimated minutes (integer)

TAXONOMY:
${taxonomyList}

ARTICLE:
${markdown.slice(0, 2500)}

OUTPUT ONLY VALID JSON. No markdown fences.`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.KIMI_API_KEY) {
    console.error('Error: KIMI_API_KEY environment variable is required');
    process.exit(1);
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  const dateStr = now.toISOString().slice(0, 10);
  const friendlyDate = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const isoDate = now.toISOString();

  const featureId = `feature-${now.getFullYear()}-w${weekNum}`;
  const slug = `weekly-feature-${now.getFullYear()}-w${weekNum}`;

  // Check if this week's feature already exists
  const pipeline = loadPipeline();
  if (pipeline.some((p) => p.id === featureId)) {
    console.log(`Feature ${featureId} already exists. Skipping.`);
    return;
  }

  // Fetch and filter sources
  const { filtered } = await fetchAllSources({
    hnLimit: 12,
    redditSubs: ['MachineLearning', 'LocalLLaMA', 'artificial'],
    redditLimit: 6,
    arxivCats: ['cs.AI', 'cs.LG', 'cs.CL'],
    arxivLimit: 6,
    githubTopics: ['ai', 'machine-learning', 'llm'],
    githubLimit: 6,
    blogLimit: 4,
  });

  if (!filtered.length) {
    console.log('No relevant sources available. Skipping.');
    return;
  }

  const sourcesText = formatSourcesForPrompt(filtered);

  // Step 1: Select trending topic
  console.log('Selecting trending topic...');
  const topicPrompt = buildTopicSelectionPrompt(sourcesText);
  const topic = await callKimi([{ role: 'user', content: topicPrompt }], 200, 0.3);
  console.log('Topic:', topic);

  // Step 2: Generate feature article
  console.log('Generating feature article...');
  const featurePrompt = buildFeaturePrompt(topic, sourcesText);
  const markdown = await callKimi([{ role: 'user', content: featurePrompt }], 4000, 0.4);

  if (!markdown) {
    console.error('Empty feature response. Skipping.');
    return;
  }

  // Step 3: Extract metadata
  console.log('Extracting metadata...');
  let meta = {};
  try {
    const metaPrompt = buildMetadataPrompt(markdown);
    const metaRaw = await callKimi([{ role: 'user', content: metaPrompt }], 1000, 0.1);
    meta = JSON.parse(metaRaw.replace(/^```json\s*|\s*```$/g, ''));
  } catch (err) {
    console.warn('[Metadata] LLM extraction failed, falling back:', err.message);
    meta = {
      abstract: `Weekly deep-dive on ${topic}. Covering technical breakdown, production implications, and what to watch.`,
      tags: ['weekly-feature', 'ai-research', 'deep-dive'],
      keywords: ['feature', 'analysis', 'trends'],
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

  // Aggregate engagement
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
    id: featureId,
    slug,
    contentType: 'feature',
    title: topic,
    subtitle: `Allternit Research · Weekly Feature · ${friendlyDate}`,
    abstract: meta.abstract,
    authors: ['Allternit Research'],
    teams: ['research'],
    tags: meta.tags || ['weekly-feature', 'ai-research', 'deep-dive'],
    keywords: meta.keywords || ['feature', 'analysis', 'trends'],
    createdAt: isoDate,
    updatedAt: isoDate,
    publishedAt: isoDate,
    content: {
      markdown,
      sources: sourceProvenance,
    },
    readingTime: meta.readingTime || estimateReadingTime(markdown),
    featured: true,
    series: 'Weekly Feature',
    issueNumber: `${now.getFullYear()}-W${weekNum}`,
    metrics: totalEngagement,
  });

  pipeline.push(publication);
  pipeline.sort(
    (a, b) =>
      new Date(b.publishedAt ?? b.createdAt).getTime() -
      new Date(a.publishedAt ?? a.createdAt).getTime(),
  );
  const trimmed = pipeline.slice(0, 100);

  savePipeline(trimmed);
  console.log(`Saved feature ${featureId} to pipeline (${trimmed.length} total items)`);
  console.log(`  Focus areas: ${meta.focusAreas?.join(', ') || 'none detected'}`);
  console.log(`  Sources: ${filtered.length} items`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
