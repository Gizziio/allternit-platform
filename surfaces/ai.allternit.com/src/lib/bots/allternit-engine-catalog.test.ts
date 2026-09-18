import { describe, expect, it } from 'vitest';
import type { ModelOption } from '@/components/prompt-kit/prompt-model-selector';
import type {
  ProviderAuthStatus,
  ProviderInfo,
  UsageSummary,
} from '@/integration/api-client';
import type { InferenceRouterProvider } from '@/views/chat/hooks/useInferenceRouterCliStatus';
import {
  buildAllternitEngineCatalog,
  engineEffectiveStatus,
  formatEngineUsageLine,
  stripOneProviderPrefix,
} from './allternit-engine-catalog';

function authRow(overrides: Partial<ProviderAuthStatus> = {}): ProviderAuthStatus {
  return {
    provider_id: 'claude-cli',
    status: 'ok',
    authenticated: true,
    auth_profile_id: null,
    chat_profile_ids: [],
    ...overrides,
  };
}

function runtimeRow(overrides: Partial<ProviderInfo> = {}): ProviderInfo {
  return {
    id: 'claude-cli',
    name: 'Claude CLI',
    models: [],
    ...overrides,
  };
}

function model(id: string, providerId: string, name?: string): ModelOption {
  return { id, providerId, name: name ?? id };
}

function cliRow(overrides: Partial<InferenceRouterProvider> = {}): InferenceRouterProvider {
  return { id: 'claude-cli', name: 'Claude CLI', installed: true, available: true, ...overrides };
}

describe('engineEffectiveStatus', () => {
  it('mirrors model-picker getEffectiveStatus decision order', () => {
    // Runtime registry status wins when not unknown.
    expect(engineEffectiveStatus(authRow(), 'missing_key', 'cli')).toBe('missing_key');
    expect(engineEffectiveStatus(undefined, 'active', 'api')).toBe('active');
    // Authenticated wins when runtime status is unknown/absent.
    expect(engineEffectiveStatus(authRow({ authenticated: true }), undefined, 'cli')).toBe('active');
    // API missing/expired → missing_key; else unconfigured.
    expect(engineEffectiveStatus(authRow({ authenticated: false, status: 'expired' }), undefined, 'api')).toBe('missing_key');
    expect(engineEffectiveStatus(authRow({ authenticated: false, status: 'unknown' }), undefined, 'api')).toBe('unconfigured');
    // CLI ok → active; missing/expired → missing_key; else offline.
    expect(engineEffectiveStatus(authRow({ authenticated: false, status: 'ok' }), undefined, 'cli')).toBe('active');
    expect(engineEffectiveStatus(authRow({ authenticated: false, status: 'missing' }), undefined, 'cli')).toBe('missing_key');
    expect(engineEffectiveStatus(authRow({ authenticated: false, status: 'unknown' }), undefined, 'cli')).toBe('offline');
    // Local → unknown.
    expect(engineEffectiveStatus(undefined, undefined, 'local')).toBe('unknown');
  });
});

describe('stripOneProviderPrefix', () => {
  it('removes exactly one matching provider prefix and keeps nested slashes', () => {
    expect(stripOneProviderPrefix('claude-cli/claude-sonnet-4-6', 'claude-cli')).toBe('claude-sonnet-4-6');
    expect(stripOneProviderPrefix('openrouter/anthropic/claude-sonnet', 'openrouter')).toBe(
      'anthropic/claude-sonnet',
    );
    expect(stripOneProviderPrefix('kimi-k3', 'kimi-cli')).toBe('kimi-k3');
    // Case-insensitive prefix match.
    expect(stripOneProviderPrefix('Claude-CLI/model-x', 'claude-cli')).toBe('model-x');
  });
});

describe('buildAllternitEngineCatalog', () => {
  it('does not dim a discovery-authenticated Gizzi/cloud CLI just because the binary probe failed', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [authRow({ provider_id: 'claude-cli', authenticated: true, status: 'ok' })],
      runtimeProviders: [],
      brainModels: [model('claude-cli/claude-sonnet-4-6', 'claude-cli', 'Claude Sonnet 4.6')],
      // Binary probe says missing — enrichment must not hide the authed provider.
      cliRows: [cliRow({ installed: false, available: false, reason: 'claude not found on PATH' })],
    });
    const claude = rows.find((row) => row.id === 'claude-cli');
    expect(claude).toBeDefined();
    expect(claude?.installed).toBe(true);
    expect(claude?.available).toBe(true);
    expect(claude?.reason).toBeUndefined();
    expect(claude?.models.map((m) => m.id)).toEqual(['claude-sonnet-4-6']);
  });

  it('lists kimi-cli from discovery even when cli-status omits it entirely', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [authRow({ provider_id: 'kimi-cli', authenticated: true, status: 'ok' })],
      runtimeProviders: [],
      brainModels: [model('kimi-cli/kimi-k3', 'kimi-cli', 'Kimi K3')],
      cliRows: [cliRow({ id: 'claude-cli' })],
    });
    const kimi = rows.find((row) => row.id === 'kimi-cli');
    expect(kimi).toBeDefined();
    expect(kimi?.available).toBe(true);
    expect(kimi?.transport).toBe('cli');
  });

  it('folds alias ids into one row while model rows keep executable provider ids', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [
        authRow({ provider_id: 'claude', authenticated: true, status: 'ok', chat_profile_ids: ['claude-chat-1'] }),
        authRow({ provider_id: 'claude-cli', authenticated: true, status: 'ok' }),
      ],
      runtimeProviders: [],
      brainModels: [
        model('claude/claude-opus-4-6', 'claude', 'Claude Opus 4.6'),
        model('claude-cli/claude-sonnet-4-6', 'claude-cli', 'Claude Sonnet 4.6'),
      ],
      cliRows: [],
    });
    const claudeRows = rows.filter((row) => row.id === 'claude' || row.id === 'claude-cli');
    expect(claudeRows).toHaveLength(1);
    const row = claudeRows[0];
    // Every model row keeps the executable provider id it was discovered with.
    const byId = new Map(row.models.map((m) => [m.id, m]));
    expect(byId.get('claude-opus-4-6')?.providerId).toBe('claude');
    expect(byId.get('claude-sonnet-4-6')?.providerId).toBe('claude-cli');
    // Account line comes from the real chat profile id.
    expect(row.account).toBe('claude-chat-1');
  });

  it('derives short model ids from nested ids containing slashes', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [],
      runtimeProviders: [],
      brainModels: [model('openrouter/anthropic/claude-sonnet', 'openrouter', 'Claude Sonnet')],
    });
    const row = rows.find((r) => r.id === 'openrouter');
    expect(row?.models).toEqual([
      { id: 'anthropic/claude-sonnet', name: 'Claude Sonnet', providerId: 'openrouter' },
    ]);
  });

  it('treats failed auth discovery as unknown, never ready, even with cached models', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [],
      runtimeProviders: [],
      brainModels: [model('anthropic/claude-sonnet-4-6', 'anthropic', 'Claude Sonnet 4.6')],
      authError: true,
    });
    const anthropic = rows.find((row) => row.id === 'anthropic');
    expect(anthropic).toBeDefined();
    expect(anthropic?.installed).toBe(false);
    expect(anthropic?.available).toBe(false);
  });

  it('keeps a saved model missing from discovery visible and clearly unavailable', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [authRow({ provider_id: 'claude-cli' })],
      runtimeProviders: [],
      brainModels: [model('claude-cli/claude-sonnet-4-6', 'claude-cli')],
      current: { providerId: 'xai', modelId: 'grok-4' },
    });
    const saved = rows.find((row) => row.id === 'xai');
    expect(saved).toBeDefined();
    // Never fabricated as installed+available.
    expect(saved?.installed).toBe(false);
    expect(saved?.available).toBe(false);
    expect(saved?.reason).toBeTruthy();
    expect(saved?.models).toEqual([{ id: 'grok-4', name: 'grok-4', default: true, providerId: 'xai' }]);
  });

  it('matches a saved pick to its canonical row instead of appending a ghost', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [authRow({ provider_id: 'claude-cli' })],
      runtimeProviders: [],
      brainModels: [model('claude-cli/claude-sonnet-4-6', 'claude-cli')],
      current: { providerId: 'claude', modelId: 'claude-sonnet-4-6' },
    });
    expect(rows.filter((row) => row.id === 'claude' || row.id === 'claude-cli')).toHaveLength(1);
  });

  it('marks an API provider without a key missing_key with a reason', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [authRow({ provider_id: 'anthropic', authenticated: false, status: 'missing' })],
      runtimeProviders: [],
      brainModels: [],
    });
    const anthropic = rows.find((row) => row.id === 'anthropic');
    expect(anthropic?.available).toBe(false);
    expect(anthropic?.installed).toBe(false);
    expect(anthropic?.reason).toBe('API key required');
    expect(anthropic?.transport).toBe('cloud');
  });

  it('marks a CLI that is installed but not signed in as unavailable with the login hint', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [authRow({ provider_id: 'claude-cli', authenticated: false, status: 'missing' })],
      runtimeProviders: [],
      brainModels: [],
      cliRows: [cliRow({ installed: true, available: false, reason: 'Sign in with `claude login`' })],
    });
    const claude = rows.find((row) => row.id === 'claude-cli');
    expect(claude?.installed).toBe(true);
    expect(claude?.available).toBe(false);
    expect(claude?.reason).toBe('Sign in with `claude login`');
  });

  it('treats local runtimes with live models as available and puts them on the local transport', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [],
      runtimeProviders: [runtimeRow({ id: 'ollama', provider_type: 'local', status: 'active' })],
      brainModels: [model('ollama/llama3.2', 'ollama', 'llama3.2')],
    });
    const ollama = rows.find((row) => row.id === 'ollama');
    expect(ollama?.installed).toBe(true);
    expect(ollama?.available).toBe(true);
    expect(ollama?.transport).toBe('local');
  });

  it('never invents an account line when discovery exposes no profile ids', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [authRow({ provider_id: 'claude-cli', auth_profile_id: null, chat_profile_ids: [] })],
      runtimeProviders: [],
      brainModels: [model('claude-cli/m', 'claude-cli')],
    });
    expect(rows.find((row) => row.id === 'claude-cli')?.account).toBeUndefined();
  });

  it('prefers auth_profile_id for the account line when no chat profiles exist', () => {
    const rows = buildAllternitEngineCatalog({
      authProviders: [authRow({ provider_id: 'claude-cli', auth_profile_id: 'claude-auth-9' })],
      runtimeProviders: [],
      brainModels: [model('claude-cli/m', 'claude-cli')],
    });
    expect(rows.find((row) => row.id === 'claude-cli')?.account).toBe('claude-auth-9');
  });
});

describe('formatEngineUsageLine', () => {
  const base: UsageSummary = {
    requests: 12_400,
    tokens: { input: 1_000, output: 500, total: 1_500 },
    cost: 1.2,
    currency: 'USD',
  };

  it('renders requests, tokens, and cost like model-picker', () => {
    expect(formatEngineUsageLine(base)).toBe('12,400 requests · 1.5k tokens · $1.20');
  });

  it('renders the plan + credits line when present', () => {
    expect(
      formatEngineUsageLine({ ...base, plan: 'plus', creditsRemaining: 4.5, monthlyLimit: 10 }),
    ).toBe('Allternit Plus · $4.50 remaining of $10.00');
  });

  it('returns null when metering is unavailable — no fake $0', () => {
    expect(formatEngineUsageLine({ ...base, meteringAvailable: false })).toBeNull();
    expect(formatEngineUsageLine(null)).toBeNull();
    expect(formatEngineUsageLine(undefined)).toBeNull();
  });
});
