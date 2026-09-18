import { describe, expect, it } from 'vitest';
import type { Agent } from '@/lib/agents/agent.types';
import {
  agentUpdatesFromPick,
  brainFromModelPick,
  effortLabel,
  engineStatus,
  mergeCurrentProvider,
  parseThreadModelPin,
  providerSupportsEffort,
  resolveBotRuntimeModel,
  runtimeModelIdOf,
  splitProviderRail,
  suggestedModels,
  type BotModeProvider,
} from './bot-mode-model';

const providers: BotModeProvider[] = [
  {
    id: 'claude-cli',
    name: 'Claude Code',
    installed: true,
    available: true,
    version: '2.1.266 (Claude Code)',
    models: [
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', default: true },
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    ],
  },
  {
    id: 'kimi-cli',
    name: 'Kimi CLI',
    installed: false,
    available: false,
    reason: 'kimi not found on PATH. Sign in with `kimi login`',
    models: [{ id: 'kimi-k2.5', name: 'Kimi K2.5' }],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    installed: true,
    available: true,
    models: [{ id: 'llama3.2', name: 'llama3.2' }],
  },
];

describe('bot-mode-model', () => {
  it('labels xhigh as X-High and undefined as Default', () => {
    expect(effortLabel(undefined)).toBe('Default');
    expect(effortLabel('xhigh')).toBe('X-High');
    expect(effortLabel('max')).toBe('Max');
    expect(effortLabel('low')).toBe('Low');
  });

  it('splits Cloud vs Local on the provider rail', () => {
    const { cloud, local } = splitProviderRail(providers);
    expect(cloud.map((p) => p.id)).toEqual(['claude-cli', 'kimi-cli']);
    expect(local.map((p) => p.id)).toEqual(['ollama']);
  });

  it('dims unavailable engines with a status, never throwing', () => {
    expect(engineStatus(providers[1])).toBe('Setup required');
    expect(engineStatus({ ...providers[1], installed: true })).toBe('Sign in required');
    expect(engineStatus(providers[0])).toBe('2.1.266 (Claude Code)');
    expect(providerSupportsEffort('claude-cli')).toBe(true);
    expect(providerSupportsEffort('ollama')).toBe(false);
  });

  it('maps Claude CLI onto native_harness and keeps the session when harness stays', () => {
    const next = brainFromModelPick(
      { mode: 'native_harness', harness: 'claude', nativeSessionId: 'bot-1-claude' },
      'claude-cli',
      'claude-sonnet-4-6',
      'high',
    );
    expect(next).toEqual({
      mode: 'native_harness',
      harness: 'claude',
      nativeSessionId: 'bot-1-claude',
      modelRef: { providerID: 'claude-cli', modelID: 'claude-sonnet-4-6' },
      effort: 'high',
    });
  });

  it('drops the native session when the harness changes', () => {
    const next = brainFromModelPick(
      { mode: 'native_harness', harness: 'claude', nativeSessionId: 'bot-1-claude' },
      'codex-cli',
      'gpt-6-astra',
    );
    expect(next.mode).toBe('native_harness');
    expect(next.harness).toBe('codex');
    expect(next.nativeSessionId).toBeUndefined();
    expect(next.modelRef).toEqual({ providerID: 'codex-cli', modelID: 'gpt-6-astra' });
  });

  it('maps local/API picks onto allternit_cloud modelRef', () => {
    const next = brainFromModelPick(
      { mode: 'native_harness', harness: 'claude', nativeSessionId: 'x' },
      'ollama',
      'llama3.2',
    );
    expect(next).toEqual({
      mode: 'allternit_cloud',
      modelRef: { providerID: 'ollama', modelID: 'llama3.2' },
    });
  });

  it('writes bot-default updates onto brain + runtimeModelId, not Gizzi brainId', () => {
    const bot = {
      brainId: 'gizzi-brain-1',
      brain: { mode: 'allternit_cloud' as const },
      config: { foo: 1 },
      provider: 'anthropic' as const,
      model: 'old',
    };
    const updates = agentUpdatesFromPick(bot, {
      providerId: 'claude-cli',
      modelId: 'claude-sonnet-4-6',
      effort: 'max',
      scope: 'bot',
    });
    expect(updates.brain.mode).toBe('native_harness');
    expect(updates.brain.harness).toBe('claude');
    expect(updates.brain.effort).toBe('max');
    expect(updates.config.runtimeModelId).toBe('claude-cli/claude-sonnet-4-6');
    expect(updates.config.reasoningEffort).toBe('max');
    expect(updates.config.foo).toBe(1);
    expect(bot.brainId).toBe('gizzi-brain-1');
  });

  it('prefers a deliberate thread pin over the bot default', () => {
    const bot = {
      brain: {
        mode: 'allternit_cloud' as const,
        modelRef: { providerID: 'claude-cli', modelID: 'claude-opus-4-6' },
      },
      config: { runtimeModelId: 'claude-cli/claude-opus-4-6' },
      provider: 'anthropic' as const,
      model: 'claude-opus-4-6',
    } as Pick<Agent, 'brain' | 'config' | 'provider' | 'model'>;
    expect(
      resolveBotRuntimeModel({
        threadPin: { providerId: 'codex-cli', modelId: 'gpt-6-astra', effort: 'low' },
        bot,
      }),
    ).toEqual({ providerId: 'codex-cli', modelId: 'gpt-6-astra', effort: 'low' });
    expect(parseThreadModelPin({ providerId: 'x', modelId: 'y', effort: 'nope' })).toEqual({
      providerId: 'x',
      modelId: 'y',
    });
    expect(parseThreadModelPin('stale')).toBeUndefined();
    expect(runtimeModelIdOf('claude-cli', 'claude-sonnet-4-6')).toBe('claude-cli/claude-sonnet-4-6');
  });

  it('keeps a current provider on the rail even if discovery omitted it, marked unavailable', () => {
    const merged = mergeCurrentProvider(providers, 'xai', 'grok-4');
    const saved = merged.find((p) => p.id === 'xai');
    expect(saved).toBeDefined();
    // Never fabricated as installed+available — clearly marked instead.
    expect(saved?.installed).toBe(false);
    expect(saved?.available).toBe(false);
    expect(saved?.reason).toBeTruthy();
    expect(saved?.models).toEqual([{ id: 'grok-4', name: 'grok-4', default: true, providerId: 'xai' }]);
  });

  it('matches a saved alias pick to its canonical row without appending a ghost', () => {
    const merged = mergeCurrentProvider(providers, 'claude', 'claude-sonnet-4-6');
    expect(merged.filter((p) => p.id === 'claude' || p.id === 'claude-cli')).toHaveLength(1);
  });

  it('keeps the current and default models in the compact suggested list', () => {
    const models = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B', default: true },
      { id: 'c', name: 'C' },
      { id: 'd', name: 'D' },
      { id: 'e', name: 'E' },
      { id: 'f', name: 'F' },
    ];
    expect(suggestedModels(models, 'f', 5).map((m) => m.id)).toEqual(['f', 'b', 'a', 'c', 'd']);
  });
});
