#!/usr/bin/env node
/**
 * Allternit Blog — Weekly Builder's Notebook Generator
 *
 * Collects the week's real repository activity (git log + latest GitHub
 * release) and has Kimi write an honest, engineering-focused notebook post
 * about what shipped and why it matters.
 */

const { execSync } = require('child_process');
const path = require('path');
const {
  estimateReadingTime,
  callKimi,
  KimiApiError,
  loadPipeline,
  savePipeline,
  buildPublication,
} = require('./lib/pipeline.cjs');
const { writeCover } = require('./lib/cover.cjs');
const { writeEditionArtifact } = require('./lib/edition-artifact.cjs');

const REPO_ROOT = path.resolve(__dirname, '../..');

// ─── Repo Activity Collection ───────────────────────────────────────────────

function collectGitLog() {
  try {
    return execSync('git log --since="7 days ago" --pretty=format:"%h %s" --no-merges | head -80', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (err) {
    console.warn('[Blog] git log unavailable:', err.message);
    return '';
  }
}

function collectLatestRelease() {
  try {
    const raw = execSync('gh release view --json tagName,name,publishedAt,body', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const rel = JSON.parse(raw);
    return [
      `Tag: ${rel.tagName}`,
      `Name: ${rel.name || rel.tagName}`,
      `Published: ${rel.publishedAt}`,
      `Notes:\n${(rel.body || '').slice(0, 2000)}`,
    ].join('\n');
  } catch (err) {
    console.warn('[Blog] gh release view unavailable:', err.message);
    return '';
  }
}

// ─── Prompt ─────────────────────────────────────────────────────────────────

function buildBlogPrompt(gitLog, release, friendlyDate) {
  return `You write the "Builder's Notebook" for Allternit Blog — an engineering log written by the people building the product, for engineers.

Your task: write this week's builder's notebook post (${friendlyDate}) from the repository activity below.

VOICE:
- Honest, engineering-focused, first-person plural ("we shipped", "we fixed")
- Explain what changed and why it matters to people using or building on the system
- Plain language, specific details from the commit data
- NO marketing superlatives ("amazing", "revolutionary", "best-in-class")
- NO invented claims: discuss only what the commit data below shows. If a commit message is too terse to interpret, omit it rather than guess.

STRUCTURE (strict markdown):
# <short title capturing the week's theme>

## What shipped
Group related commits into 2-4 themes; bullet the notable changes under each.

## Why it matters
1-2 short paragraphs connecting the week's work to real usage.

## What's next
Only if the commit data suggests in-progress work; otherwise omit this section entirely.

LENGTH: 600-900 words.

COMMITS (last 7 days):
${gitLog || '(none)'}

LATEST RELEASE (may predate this week — treat as context only):
${release || '(none available)'}`;
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
  const friendlyDate = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const isoDate = now.toISOString();

  const blogId = `blog-${now.getFullYear()}-w${weekNum}`;
  const slug = `builders-notebook-${now.getFullYear()}-w${weekNum}`;

  // One notebook post per week
  const pipeline = loadPipeline();
  if (pipeline.some((p) => p.id === blogId)) {
    console.log(`Blog post ${blogId} already exists. Skipping.`);
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  // Collect the week's real activity
  const gitLog = collectGitLog();
  const release = collectLatestRelease();
  console.log(
    `Collected ${gitLog ? gitLog.split('\n').length : 0} commits${release ? ' + release notes' : ''}`,
  );

  if (!gitLog && !release) {
    console.log('No repo activity found for the past week. Skipping.');
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  console.log('Writing notebook post with Kimi...');
  const prompt = buildBlogPrompt(gitLog, release, friendlyDate);
  const markdown = await callKimi([{ role: 'user', content: prompt }], 16000);

  if (!markdown) {
    console.error('Empty response from Kimi. Skipping.');
    console.log('No new items added to discovery-pipeline.json.');
    return;
  }

  // Title from the first markdown heading; abstract from the first real line
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : `Builder's Notebook — ${friendlyDate}`;
  const firstLine =
    markdown
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))[0] || '';

  const publication = buildPublication({
    id: blogId,
    slug,
    type: 'blog',
    contentType: 'blog',
    title,
    subtitle: `Allternit Blog · Builder's Notebook · ${friendlyDate}`,
    abstract: firstLine.slice(0, 280),
    authors: ['Allternit Blog'],
    teams: ['research'],
    tags: ['builders-notebook', 'engineering', 'weekly-recap'],
    keywords: ['changelog', 'engineering', 'notebook', 'release-notes'],
    createdAt: isoDate,
    updatedAt: isoDate,
    publishedAt: isoDate,
    content: {
      markdown,
      sources: [],
    },
    readingTime: estimateReadingTime(markdown),
    featured: false,
    series: 'Allternit Blog',
    issueNumber: `${now.getFullYear()}-W${weekNum}`,
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
  console.log(`Saved blog post ${blogId} to pipeline (${trimmed.length} total items)`);

  // Newsletter send (clean-skip when NEWSLETTER_SEND_TOKEN is unset).
  const { sendNewsletter } = require('./lib/newsletter.cjs');
  await sendNewsletter(publication);
}

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
