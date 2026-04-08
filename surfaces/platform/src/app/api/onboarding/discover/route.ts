/**
 * GET /api/onboarding/discover
 *
 * Probes the local machine (same host as the Next.js server process) for:
 *  - Ollama running on :11434
 *  - LM Studio running on :1234
 *  - AI CLI tools installed in PATH (claude, codex, gemini, aider, goose, kimi, qwen)
 *
 * Returns structured results so the onboarding wizard can surface
 * "Found on your machine" entries without hardcoded model names.
 *
 * All probes use a tight 2-second timeout so the wizard never hangs.
 */

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DiscoveredModel {
  id: string;          // unique ID for this entry
  modelId: string;     // raw model ID to pass to the runtime
  name: string;        // human-readable label
  provider: string;    // 'ollama' | 'lmstudio' | 'cli'
  source: string;      // 'ollama' | 'lmstudio' | 'claude-cli' | 'codex' | etc.
  badge?: string;      // optional "Most private", "Free" etc.
  size?: string;       // e.g. "7B" from Ollama metadata
}

export interface DiscoveryResult {
  ollama: { running: boolean; models: DiscoveredModel[] };
  lmstudio: { running: boolean; models: DiscoveredModel[] };
  cli: DiscoveredModel[];
  scannedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, ms = 2000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function isCliAvailable(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe', timeout: 2000 });
    return true;
  } catch {
    return false;
  }
}

function ollamaModelSize(details: Record<string, unknown> | undefined): string | undefined {
  if (!details) return undefined;
  const pCount = details.parameter_count ?? details.parameters;
  if (typeof pCount === 'number') {
    if (pCount >= 1e9) return `${(pCount / 1e9).toFixed(0)}B`;
    if (pCount >= 1e6) return `${(pCount / 1e6).toFixed(0)}M`;
  }
  const family = details.family ?? details.parameter_size;
  if (typeof family === 'string' && /\d/.test(family)) return family;
  return undefined;
}

// ─── Probes ───────────────────────────────────────────────────────────────────

async function probeOllama(): Promise<DiscoveryResult['ollama']> {
  try {
    const res = await fetchWithTimeout('http://localhost:11434/api/tags');
    if (!res.ok) return { running: false, models: [] };

    const json = await res.json() as { models?: Array<{ name: string; details?: Record<string, unknown> }> };
    const raw = json.models ?? [];

    const models: DiscoveredModel[] = raw.map((m) => {
      const name = m.name; // e.g. "llama3.3:latest"
      const displayName = name
        .replace(/:latest$/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        id: `ollama::${name}`,
        modelId: name,
        name: displayName,
        provider: 'ollama',
        source: 'ollama',
        badge: 'Local · private',
        size: ollamaModelSize(m.details),
      };
    });

    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

async function probeLmStudio(): Promise<DiscoveryResult['lmstudio']> {
  try {
    const res = await fetchWithTimeout('http://localhost:1234/v1/models');
    if (!res.ok) return { running: false, models: [] };

    const json = await res.json() as { data?: Array<{ id: string }> };
    const raw = json.data ?? [];

    const models: DiscoveredModel[] = raw.map((m) => {
      const displayName = m.id
        .split('/').pop()!
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      return {
        id: `lmstudio::${m.id}`,
        modelId: m.id,
        name: displayName,
        provider: 'lmstudio',
        source: 'lmstudio',
        badge: 'LM Studio · local',
      };
    });

    return { running: true, models };
  } catch {
    return { running: false, models: [] };
  }
}

const CLI_TOOLS: Array<{ cmd: string; source: string; name: string; provider: string; badge?: string }> = [
  { cmd: 'claude',  source: 'claude-cli',  name: 'Claude Code CLI',   provider: 'anthropic', badge: 'CLI agent' },
  { cmd: 'codex',   source: 'codex',       name: 'Codex CLI',         provider: 'openai',    badge: 'CLI agent' },
  { cmd: 'gemini',  source: 'gemini-cli',  name: 'Gemini CLI',        provider: 'google',    badge: 'CLI agent' },
  { cmd: 'aider',   source: 'aider',       name: 'Aider',             provider: 'aider',     badge: 'CLI agent' },
  { cmd: 'goose',   source: 'goose',       name: 'Goose',             provider: 'block',     badge: 'CLI agent · free' },
  { cmd: 'kimi',    source: 'kimi-cli',    name: 'Kimi CLI',          provider: 'moonshot',  badge: 'CLI agent' },
];

function probeCli(): DiscoveredModel[] {
  return CLI_TOOLS
    .filter((t) => isCliAvailable(t.cmd))
    .map((t) => ({
      id: `cli::${t.source}`,
      modelId: t.source,
      name: t.name,
      provider: t.provider,
      source: t.source,
      badge: t.badge,
    }));
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const [ollama, lmstudio] = await Promise.all([probeOllama(), probeLmStudio()]);
  const cli = probeCli();

  const result: DiscoveryResult = {
    ollama,
    lmstudio,
    cli,
    scannedAt: new Date().toISOString(),
  };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
