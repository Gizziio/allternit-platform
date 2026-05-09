export type ConnectorApp = 'github' | 'linear' | 'notion' | 'slack' | 'gmail';

export interface ConnectorToken {
  app: ConnectorApp;
  token: string;
  accountName?: string;
  connectedAt: string;
}

const TOKENS_KEY = 'allternit-design-connector-tokens';

export function getStoredTokens(): ConnectorToken[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveToken(token: ConnectorToken) {
  const existing = getStoredTokens().filter(t => t.app !== token.app);
  const next = [...existing, token];
  localStorage.setItem(TOKENS_KEY, JSON.stringify(next));
}

export function removeToken(app: ConnectorApp) {
  const next = getStoredTokens().filter(t => t.app !== app);
  localStorage.setItem(TOKENS_KEY, JSON.stringify(next));
}

export function hasToken(app: ConnectorApp): boolean {
  return getStoredTokens().some(t => t.app === app);
}

export function getToken(app: ConnectorApp): string | undefined {
  return getStoredTokens().find(t => t.app === app)?.token;
}

// ─── GitHub ─────────────────────────────────────────────────────────────────

export interface GitHubActivity {
  type: 'commit' | 'pr' | 'issue';
  title: string;
  url: string;
  repo: string;
  author: string;
  date: string;
  state?: string;
}

export async function fetchGitHubActivity(token: string, since?: string): Promise<GitHubActivity[]> {
  const res = await fetch('/api/design/connectors/github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, since }),
  });
  if (res.status === 404) throw new Error('GitHub connector unavailable in this deployment. Run locally for live data.');
  if (!res.ok) throw new Error(`GitHub proxy error: ${res.status}`);
  const data = await res.json();
  return data.activities ?? [];
}

// ─── Linear ─────────────────────────────────────────────────────────────────

export interface LinearIssue {
  id: string;
  title: string;
  state: string;
  url: string;
  assignee?: string;
  updatedAt: string;
}

export async function fetchLinearIssues(token: string): Promise<LinearIssue[]> {
  const res = await fetch('/api/design/connectors/linear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (res.status === 404) throw new Error('Linear connector unavailable in this deployment. Run locally for live data.');
  if (!res.ok) throw new Error(`Linear proxy error: ${res.status}`);
  const data = await res.json();
  return data.issues ?? [];
}

// ─── Notion ─────────────────────────────────────────────────────────────────

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  lastEdited: string;
}

export async function fetchNotionPages(token: string): Promise<NotionPage[]> {
  const res = await fetch('/api/design/connectors/notion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (res.status === 404) throw new Error('Notion connector unavailable in this deployment. Run locally for live data.');
  if (!res.ok) throw new Error(`Notion proxy error: ${res.status}`);
  const data = await res.json();
  return data.pages ?? [];
}

// ─── Slack ──────────────────────────────────────────────────────────────────

export interface SlackMessage {
  channel: string;
  text: string;
  timestamp: string;
  user?: string;
}

export async function fetchSlackMessages(token: string): Promise<SlackMessage[]> {
  const res = await fetch('/api/design/connectors/slack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (res.status === 404) throw new Error('Slack connector unavailable in this deployment. Run locally for live data.');
  if (!res.ok) throw new Error(`Slack proxy error: ${res.status}`);
  const data = await res.json();
  return data.messages ?? [];
}

// ─── Orbit data synthesis ───────────────────────────────────────────────────

export interface OrbitDataPayload {
  github?: GitHubActivity[];
  linear?: LinearIssue[];
  notion?: NotionPage[];
  slack?: SlackMessage[];
  generatedAt: string;
}

export async function fetchOrbitData(sources: ConnectorApp[]): Promise<OrbitDataPayload> {
  const payload: OrbitDataPayload = { generatedAt: new Date().toISOString() };

  for (const source of sources) {
    const token = getToken(source);
    if (!token) continue;
    try {
      if (source === 'github') payload.github = await fetchGitHubActivity(token);
      if (source === 'linear') payload.linear = await fetchLinearIssues(token);
      if (source === 'notion') payload.notion = await fetchNotionPages(token);
      if (source === 'slack') payload.slack = await fetchSlackMessages(token);
    } catch (e) {
      console.error(`Orbit fetch failed for ${source}:`, e);
    }
  }

  return payload;
}
