#!/usr/bin/env node
/**
 * A://SUDO Reality — Weekly Magazine Generator
 *
 * Generates a cover-story deep-dive on a trending AI/robotics topic,
 * plus "This Week" departments (ls -la, rm -rf, git push, pwned, Ctrl + Z)
 * that bundle the current week's Allternit News edition when available.
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
const { writeCover } = require('./lib/cover.cjs');
const { writeEditionArtifact } = require('./lib/edition-artifact.cjs');

// ─── Prompt Templates ───────────────────────────────────────────────────────

function buildTopicSelectionPrompt(sourcesText) {
  return `${EDITORIAL_VOICE.research}

From these sources, identify the single most important trending topic in AI/ML or robotics — this week's A://SUDO Reality cover story.

Criteria:
- Has technical depth (not just a product launch)
- Connects to production AI systems
- Is likely to still matter in 6 months
- Something Allternit's audience (engineers building agentic systems) should understand deeply

Return ONLY the topic title (5-12 words). No explanation.

SOURCES:
${sourcesText}`;
}

function buildFeaturePrompt(topic, sourcesText, newsHighlights) {
  return `${EDITORIAL_VOICE.research}

Write this week's A://SUDO Reality cover story on: "${topic}"

TARGET AUDIENCE: Senior engineers and tech leads building production AI systems. They care about what works, what doesn't, and what to watch.

STRUCTURE (strict markdown):
# ${topic}

## Cover Story
What is happening and why it matters now? 350-500 words. No fluff. Lead with the stakes.

## Technical Breakdown
The core technical details an engineer needs to understand. 500-700 words.
- How it works (architecture, key algorithms, dependencies)
- What problem it actually solves vs. what the marketing claims
- Limitations and edge cases

## Production Implications
What does this mean for teams shipping AI? 350-500 words.
- When should you adopt it? When should you wait?
- Integration complexity and operational concerns
- Cost and performance tradeoffs

## This Week
Compact magazine versions of this week's Allternit News departments — 120-200 words each, using these exact headings, in this order:
### ls -la — the full listing: the week's AI/robotics events, by category and relevance
### rm -rf — what got deleted this week: deprecated APIs, sunset products, dead projects, layoffs, removed features
### git push — trending GitHub projects worth a look
### pwned — security: jailbreaks, exploits, breaches, espionage, model distillation/theft, adversarial research
### Ctrl + Z — run it back: follow-ups, corrections, and second-look updates to previous stories
${newsHighlights
    ? "This week's Allternit News edition is provided below — condense its department highlights. "
    : "No Allternit News edition is available for this week — compile these departments from the fresh sources below. "}
If a department has zero relevant items, OMIT it entirely rather than padding.

## What We're Watching
3-5 specific things to track over the next month. Be concrete: benchmarks, releases, papers, or code commits.

## Sources
Bullet list of all referenced sources with URLs.

RULES:
- Total length: 2200-3200 words
- Include exactly one pull quote (a markdown blockquote, a line starting with "> "): the sharpest single sentence of the piece, drawn from its own analysis. Place it in the Cover Story section.
- No hype words: "groundbreaking", "revolutionary", "game-changing", "disruptive"
- Use specifics: model names, latency numbers, benchmark scores, version numbers
- Every technical claim must trace to a source below
- If the sources don't support a strong claim, say "unclear" or "unverified"
- Include the "so what" — why an engineer should care
${newsHighlights ? `
THIS WEEK'S NEWS (Allternit News edition — department highlights to bundle):
${newsHighlights}
` : ''}
SOURCES:
${sourcesText}`;
}

function buildMetadataPrompt(markdown) {
  const taxonomyList = Object.entries(TAXONOMY)
    .map(([k, v]) => `${k}: ${v.keywords.slice(0, 4).join(', ')}`)
    .join('\n');

  return `Given this A://SUDO Reality magazine article (cover story plus "This Week" departments: ls -la, rm -rf, git push, pwned, Ctrl + Z), output ONLY a JSON object with these keys:
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

// Locate the current week's Allternit News edition (id `news-<isoYear>-w<WW>`)
// so the magazine can bundle its department highlights.
function findWeeklyNews(pipeline, date = new Date()) {
  const newsId = `news-${isoWeekKey(date)}`;
  return pipeline.find((p) => p.id === newsId && p.contentType === 'signal') || null;
}

async function main() {
  if (!process.env.KIMI_API_KEY) {
    console.error('Error: KIMI_API_KEY environment variable is required');
    process.exit(1);
  }

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
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
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  // Load this week's Allternit News edition (if the news workflow already ran)
  // so the magazine can bundle its department highlights.
  const weeklyNews = findWeeklyNews(pipeline, now);
  let newsHighlights = null;
  if (weeklyNews?.content?.markdown) {
    newsHighlights = weeklyNews.content.markdown.slice(0, 3000);
    console.log(`Bundling this week's news edition: ${weeklyNews.id}`);
  } else {
    console.log(`No news edition found for this week (news-${isoWeekKey(now)}) — departments compile from fresh sources.`);
  }

  // Fetch and filter sources
  const { filtered } = await fetchAllSources({
    hnLimit: 12,
    redditSubs: ['MachineLearning', 'LocalLLaMA', 'artificial'],
    redditLimit: 6,
    arxivCats: ['cs.AI', 'cs.LG', 'cs.CL'],
    arxivLimit: 6,
    githubLanguages: [''],
    githubLimit: 6,
    blogLimit: 6,
  });

  if (!filtered.length) {
    console.log('No relevant sources available. Skipping.');
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  const sourcesText = formatSourcesForPrompt(filtered);

  // Step 1: Select trending topic
  console.log('Selecting trending topic...');
  const topicPrompt = buildTopicSelectionPrompt(sourcesText);
  // Reasoning models consume thinking tokens from the max_tokens budget —
  // a small budget comes back empty (observed in production as an empty
  // topic, which then emptied the title and the newsletter subject).
  let topic = (
    (await callKimi([{ role: 'user', content: topicPrompt }], 4000)) || ''
  ).trim();
  if (!topic) {
    console.warn('Empty topic from Kimi — retrying with explicit instruction...');
    topic = (
      (await callKimi(
        [
          {
            role: 'system',
            content:
              'You are an editor. Return only the requested title, nothing else.',
          },
          { role: 'user', content: topicPrompt },
        ],
        4000,
      )) || ''
    ).trim();
  }
  console.log('Topic:', topic);

  // Step 2: Generate feature article
  console.log('Generating feature article...');
  const featurePrompt = buildFeaturePrompt(topic, sourcesText, newsHighlights);
  const markdown = await callKimi([{ role: 'user', content: featurePrompt }], 16000);

  if (!markdown) {
    console.error('Empty feature response. Skipping.');
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  // Last-resort title: take the article's own H1 when the topic selection
  // came back empty, so the publication title (and newsletter subject) is
  // never blank.
  if (!topic) {
    const h1 = markdown.match(/^#\s+(.+)$/m);
    topic = h1
      ? h1[1].trim()
      : `A://SUDO Reality — ${friendlyDate}`;
    console.log('Topic recovered from article H1:', topic);
  }

  // Step 3: Extract metadata
  console.log('Extracting metadata...');
  let meta = {};
  try {
    const metaPrompt = buildMetadataPrompt(markdown);
    const metaRaw = await callKimi([{ role: 'user', content: metaPrompt }], 1000);
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
    subtitle: `A://SUDO Reality · Weekly Magazine · ${friendlyDate}`,
    abstract: meta.abstract,
    authors: ['A://SUDO Reality'],
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
    series: 'A://SUDO Reality',
    issueNumber: `${now.getFullYear()}-W${weekNum}`,
    metrics: totalEngagement,
  });

  // Generate the cover image and attach its public URL before persisting
  publication.imageUrl = writeCover(publication);
  publication.artifactUrl = writeEditionArtifact(publication);

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

  // Newsletter send (clean-skip when NEWSLETTER_SEND_TOKEN is unset).
  const { sendNewsletter } = require('./lib/newsletter.cjs');
  await sendNewsletter(publication);
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

module.exports = { buildTopicSelectionPrompt, buildFeaturePrompt, buildMetadataPrompt, findWeeklyNews };
