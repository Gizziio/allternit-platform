/**
 * A://Labs Content Pipeline
 *
 * Orchestrates Composio-connected data sources + Orbit-style generation
 * to produce live-updating articles and lesson content stored in the
 * Rust backend (source of truth for ALABS data).
 */

import { getStoredTokens, fetchGitHubActivity, fetchLinearIssues, fetchNotionPages } from './design/direct-connectors';
import type { ConnectorApp } from './design/direct-connectors';
import { renderLiveArtifact } from './design/live-artifact';

export interface PipelineSourceData {
  github?: { type: string; title: string; repo: string; author: string; date: string }[];
  linear?: { title: string; state: string; assignee?: string }[];
  notion?: { title: string; lastEdited: string }[];
  fetchedAt: string;
}

export interface PipelineRunResult {
  articleId?: string;
  articleSlug?: string;
  liveArtifactHtml?: string;
  sourcesUsed: string[];
  error?: string;
}

/**
 * Fetch data from all connected Composio/direct-connector sources.
 * Runs client-side because tokens live in localStorage.
 */
export async function fetchPipelineData(sources: ConnectorApp[]): Promise<PipelineSourceData> {
  const tokens = getStoredTokens();
  const data: PipelineSourceData = { fetchedAt: new Date().toISOString() };

  for (const source of sources) {
    const token = tokens.find(t => t.app === source)?.token;
    if (!token) continue;

    try {
      switch (source) {
        case 'github':
          data.github = (await fetchGitHubActivity(token)).map(g => ({
            type: g.type,
            title: g.title,
            repo: g.repo,
            author: g.author,
            date: g.date,
          }));
          break;
        case 'linear':
          data.linear = (await fetchLinearIssues(token)).map(l => ({
            title: l.title,
            state: l.state,
            assignee: l.assignee,
          }));
          break;
        case 'notion':
          data.notion = (await fetchNotionPages(token)).map(n => ({
            title: n.title,
            lastEdited: n.lastEdited,
          }));
          break;
      }
    } catch (err) {
      console.error(`[Pipeline] Failed to fetch ${source}:`, err);
    }
  }

  return data;
}

/**
 * Generate a daily briefing article from pipeline data and push it to
 * the Rust backend (alabs_articles table).
 */
export async function runPipeline(opts: {
  projectName: string;
  sources: ConnectorApp[];
  courseContext?: string;
}): Promise<PipelineRunResult> {
  const data = await fetchPipelineData(opts.sources);
  const sourcesUsed = opts.sources.filter(s => {
    if (s === 'github') return (data.github?.length ?? 0) > 0;
    if (s === 'linear') return (data.linear?.length ?? 0) > 0;
    if (s === 'notion') return (data.notion?.length ?? 0) > 0;
    return false;
  });

  if (sourcesUsed.length === 0) {
    return { sourcesUsed: [], error: 'No connected data sources available' };
  }

  // Build markdown content from real data
  const markdown = buildPipelineMarkdown(opts.projectName, data, opts.courseContext);
  const slug = `briefing-${Date.now()}`;
  const title = `${opts.projectName} — Daily Briefing`;

  // Push article to Rust backend
  try {
    const res = await fetch('/api/v1/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        type: 'report',
        contentType: 'signal',
        status: 'published',
        title,
        subtitle: `Auto-generated from ${sourcesUsed.join(', ')}`,
        abstract: `Daily briefing for ${opts.projectName} with live data from connected sources.`,
        contentMarkdown: markdown,
        readingTime: Math.ceil(markdown.length / 1200),
        featured: false,
        accessLevel: 'public',
        publishedAt: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(`Rust backend rejected article: ${res.status} — ${JSON.stringify(body)}`);
    }

    const result = await res.json();

    // Also build a Live Artifact template for dashboard embedding
    const liveArtifactHtml = buildLiveArtifactTemplate(opts.projectName, data);

    return {
      articleId: result.id,
      articleSlug: slug,
      liveArtifactHtml,
      sourcesUsed,
    };
  } catch (err) {
    console.error('[Pipeline] Failed to push article:', err);
    return { sourcesUsed, error: err instanceof Error ? err.message : String(err) };
  }
}

function buildPipelineMarkdown(projectName: string, data: PipelineSourceData, courseContext?: string): string {
  const lines: string[] = [
    `# ${projectName} — Daily Briefing`,
    `*Generated at ${new Date(data.fetchedAt).toLocaleString()}*`,
    '',
  ];

  if (courseContext) {
    lines.push(`> **Course Context:** ${courseContext}`, '');
  }

  if (data.github?.length) {
    lines.push('## GitHub Activity', '');
    data.github.slice(0, 8).forEach(g => {
      lines.push(`- **[${g.type.toUpperCase()}]** ${g.title} in *${g.repo}* — ${g.author}`);
    });
    lines.push('');
  }

  if (data.linear?.length) {
    lines.push('## Linear Issues', '');
    data.linear.slice(0, 8).forEach(l => {
      lines.push(`- **${l.title}** [${l.state}]${l.assignee ? ` — @${l.assignee}` : ''}`);
    });
    lines.push('');
  }

  if (data.notion?.length) {
    lines.push('## Notion Updates', '');
    data.notion.slice(0, 8).forEach(n => {
      lines.push(`- ${n.title} (updated ${new Date(n.lastEdited).toLocaleDateString()})`);
    });
    lines.push('');
  }

  lines.push('---', '', '*This briefing was auto-generated by the A://Labs pipeline.*');

  return lines.join('\n');
}

function buildLiveArtifactTemplate(projectName: string, data: PipelineSourceData): string {
  const template = `
<div style="font-family:system-ui,sans-serif;padding:24px;background:#0a0a0a;color:#e5e5e5;border-radius:12px;">
  <h2 style="margin:0 0 16px;font-size:20px;">{{projectName}} — Live Dashboard</h2>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
    <div style="background:#141414;padding:16px;border-radius:10px;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;">GitHub</div>
      <div style="font-size:28px;font-weight:700;color:#4ade80;">{{githubCount}}</div>
      <div style="font-size:12px;color:#666;">recent activities</div>
    </div>
    <div style="background:#141414;padding:16px;border-radius:10px;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;">Linear</div>
      <div style="font-size:28px;font-weight:700;color:#a78bfa;">{{linearCount}}</div>
      <div style="font-size:12px;color:#666;">open issues</div>
    </div>
    <div style="background:#141414;padding:16px;border-radius:10px;">
      <div style="font-size:12px;color:#888;text-transform:uppercase;">Notion</div>
      <div style="font-size:28px;font-weight:700;color:#f472b6;">{{notionCount}}</div>
      <div style="font-size:12px;color:#666;">recent updates</div>
    </div>
  </div>
  <p style="margin-top:16px;font-size:12px;color:#666;">Last synced: {{fetchedAt}}</p>
</div>
  `.trim();

  return renderLiveArtifact(template, {
    projectName,
    githubCount: data.github?.length ?? 0,
    linearCount: data.linear?.length ?? 0,
    notionCount: data.notion?.length ?? 0,
    fetchedAt: new Date(data.fetchedAt).toLocaleString(),
  });
}

/**
 * Detect stale content in the Labs catalog.
 * Returns articles/lessons older than the given threshold (default 7 days).
 */
export async function detectStaleContent(thresholdDays = 7): Promise<{
  staleArticles: { id: string; title: string; ageDays: number }[];
  staleLessons: { id: string; title: string; ageDays: number }[];
}> {
  const now = Date.now();
  const threshold = thresholdDays * 24 * 60 * 60 * 1000;

  const [articlesRes, lessonsRes] = await Promise.all([
    fetch('/api/v1/articles?status=published').catch(() => null),
    fetch('/api/v1/lessons?status=published').catch(() => null),
  ]);

  const articles = articlesRes?.ok ? await articlesRes.json() : [];
  const lessons = lessonsRes?.ok ? await lessonsRes.json() : [];

  const staleArticles = (articles as any[])
    .map(a => ({ id: a.id, title: a.title, ageDays: Math.floor((now - new Date(a.updatedAt).getTime()) / (24 * 60 * 60 * 1000)) }))
    .filter(a => a.ageDays > thresholdDays);

  const staleLessons = (lessons as any[])
    .map(l => ({ id: l.id, title: l.title, ageDays: Math.floor((now - new Date(l.updatedAt).getTime()) / (24 * 60 * 60 * 1000)) }))
    .filter(l => l.ageDays > thresholdDays);

  return { staleArticles, staleLessons };
}
