/**
 * POST /api/onboarding/validate-key
 *
 * Tests a cloud API key by making a minimal real request to the provider.
 * Returns { valid, models?, error? } so the wizard can show live feedback.
 *
 * Supported providers: anthropic, openai, google
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ValidateKeyBody {
  provider: 'anthropic' | 'openai' | 'google';
  key: string;
}

interface ValidateKeyResult {
  valid: boolean;
  models?: Array<{ id: string; name: string }>;
  error?: string;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Provider validators ──────────────────────────────────────────────────────

async function validateAnthropic(key: string): Promise<ValidateKeyResult> {
  try {
    // Minimal models list request — cheapest way to verify key
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
    });

    if (res.status === 401) return { valid: false, error: 'Invalid API key' };
    if (!res.ok) return { valid: false, error: `Anthropic returned ${res.status}` };

    const json = await res.json() as { data?: Array<{ id: string; display_name?: string }> };
    const models = (json.data ?? [])
      .filter((m) => m.id.startsWith('claude-'))
      .slice(0, 6)
      .map((m) => ({
        id: m.id,
        name: m.display_name ?? m.id
          .replace('claude-', 'Claude ')
          .replace(/-\d{8}$/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
      }));

    return { valid: true, models };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Connection failed';
    if (msg.includes('abort')) return { valid: false, error: 'Request timed out' };
    return { valid: false, error: msg };
  }
}

async function validateOpenAI(key: string): Promise<ValidateKeyResult> {
  try {
    const res = await fetchWithTimeout('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });

    if (res.status === 401) return { valid: false, error: 'Invalid API key' };
    if (!res.ok) return { valid: false, error: `OpenAI returned ${res.status}` };

    const json = await res.json() as { data?: Array<{ id: string }> };
    const WANTED = ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini', 'gpt-4-turbo'];
    const all = (json.data ?? []).map((m) => m.id);
    const models = WANTED
      .filter((id) => all.includes(id))
      .map((id) => ({
        id,
        name: id
          .replace('gpt-', 'GPT-')
          .replace('o1', 'o1')
          .replace(/-mini$/, ' Mini')
          .replace(/-turbo$/, ' Turbo'),
      }));

    return { valid: true, models: models.length ? models : all.slice(0, 6).map((id) => ({ id, name: id })) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Connection failed';
    if (msg.includes('abort')) return { valid: false, error: 'Request timed out' };
    return { valid: false, error: msg };
  }
}

async function validateGoogle(key: string): Promise<ValidateKeyResult> {
  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
      {},
    );

    if (res.status === 400 || res.status === 403) return { valid: false, error: 'Invalid API key' };
    if (!res.ok) return { valid: false, error: `Google returned ${res.status}` };

    const json = await res.json() as { models?: Array<{ name: string; displayName?: string }> };
    const models = (json.models ?? [])
      .filter((m) => m.name.includes('gemini'))
      .slice(0, 6)
      .map((m) => ({
        id: m.name.replace('models/', ''),
        name: m.displayName ?? m.name.replace('models/', '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      }));

    return { valid: true, models };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Connection failed';
    if (msg.includes('abort')) return { valid: false, error: 'Request timed out' };
    return { valid: false, error: msg };
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: ValidateKeyBody;
  try {
    body = await req.json() as ValidateKeyBody;
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid request body' }, { status: 400 });
  }

  const { provider, key } = body;
  if (!provider || !key || typeof key !== 'string' || key.trim().length < 10) {
    return NextResponse.json({ valid: false, error: 'Missing or too-short API key' }, { status: 400 });
  }

  let result: ValidateKeyResult;
  switch (provider) {
    case 'anthropic': result = await validateAnthropic(key.trim()); break;
    case 'openai':    result = await validateOpenAI(key.trim());    break;
    case 'google':    result = await validateGoogle(key.trim());    break;
    default:
      return NextResponse.json({ valid: false, error: 'Unknown provider' }, { status: 400 });
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
