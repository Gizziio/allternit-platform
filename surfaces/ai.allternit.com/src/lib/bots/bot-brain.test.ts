import { describe, expect, it, vi } from 'vitest';
import type { Agent } from '@/lib/agents/agent.types';
import type { NativeHarnessInfo, PickupResult } from '@/lib/agents/native-sessions-api';
import {
  BotBrainBindError,
  botBrainLabel,
  defaultBotBrain,
  nativeSessionJoinKey,
  normalizeBotBrain,
  parseBotBrain,
  resolveAgentBrain,
  resumeOrCreateBotBrain,
  type NativeSessionsPort,
} from './bot-brain';

function pickupResult(sessionId: string, harness = 'codex'): PickupResult {
  return {
    session: { id: `allternit-${sessionId}`, title: sessionId },
    source: {
      harness,
      sessionId,
      path: `/tmp/${sessionId}`,
      snapshotHash: 'h',
      snapshotAt: 1,
    },
    warnings: [],
    eventCount: 0,
  };
}

function port(overrides: Partial<NativeSessionsPort> = {}): NativeSessionsPort {
  const harnesses: NativeHarnessInfo[] = [
    {
      id: 'codex',
      label: 'Codex',
      reader: 'codex',
      projectable: true,
      resumeHint: 'codex resume',
      home: '~/.codex',
      present: true,
    },
  ];
  return {
    listHarnesses: vi.fn(async () => harnesses),
    list: vi.fn(async () => []),
    pickup: vi.fn(async ({ sessionId, harness }) => pickupResult(sessionId, harness)),
    ...overrides,
  };
}

describe('bot-brain', () => {
  it('defaults missing brain to allternit_cloud without touching brainId', () => {
    const agent = {
      brainId: 'gizzi-brain-1',
      config: {},
    } as Pick<Agent, 'brain' | 'config'>;
    expect(resolveAgentBrain(agent)).toEqual({ mode: 'allternit_cloud' });
    expect(agent.brainId).toBe('gizzi-brain-1');
  });

  it('reads config.botBrain fallback and ignores Gizzi brainId', () => {
    const agent = {
      brainId: 'gizzi-brain-1',
      config: {
        botBrain: { mode: 'native_harness', harness: 'claude', nativeSessionId: 'ses-1' },
      },
    } as Pick<Agent, 'brain' | 'config'>;
    expect(resolveAgentBrain(agent)).toEqual({
      mode: 'native_harness',
      harness: 'claude',
      nativeSessionId: 'ses-1',
    });
  });

  it('rejects malformed brain payloads', () => {
    expect(parseBotBrain({ mode: 'openai_hosted' })).toBeUndefined();
    expect(parseBotBrain('codex')).toBeUndefined();
  });

  it('labels native / cloud / uhp without using brainId', () => {
    expect(botBrainLabel({ mode: 'native_harness', harness: 'codex' })).toBe('Codex');
    expect(botBrainLabel({ mode: 'allternit_cloud', modelRef: { providerID: 'anthropic', modelID: 'sonnet' } })).toBe(
      'Allternit cloud · sonnet',
    );
    expect(botBrainLabel({ mode: 'uhp_harness', uhpHarnessId: 'uhp-9' })).toBe('UHP · uhp-9');
    expect(botBrainLabel(undefined)).toBe('Allternit cloud');
  });

  it('normalizes native harness and keeps modelRef optional', () => {
    expect(normalizeBotBrain({ mode: 'native_harness' })).toEqual({
      mode: 'native_harness',
      harness: 'codex',
    });
    expect(
      normalizeBotBrain(
        { mode: 'allternit_cloud' },
        { providerID: 'anthropic', modelID: 'sonnet' },
      ),
    ).toEqual({
      mode: 'allternit_cloud',
      modelRef: { providerID: 'anthropic', modelID: 'sonnet' },
    });
  });

  it('resumes native_harness:codex via pickup of the stored session', async () => {
    const ports = port();
    const result = await resumeOrCreateBotBrain(
      { mode: 'native_harness', harness: 'codex', nativeSessionId: 'codex-abc' },
      'bot-1',
      ports,
    );
    expect(ports.pickup).toHaveBeenCalledWith({
      harness: 'codex',
      sessionId: 'codex-abc',
      surface: 'bot',
    });
    expect(result.nativeSessionId).toBe('codex-abc');
    expect(result.mode).toBe('native_harness');
    expect(result.harness).toBe('codex');
  });

  it('creates a tracked native session id when none is stored', async () => {
    const ports = port();
    const result = await resumeOrCreateBotBrain(
      { mode: 'native_harness', harness: 'codex' },
      'agent-99',
      ports,
    );
    expect(ports.pickup).toHaveBeenCalledWith({
      harness: 'codex',
      sessionId: 'bot-agent-99-codex',
      surface: 'bot',
    });
    expect(result.nativeSessionId).toBe('bot-agent-99-codex');
  });

  it('does not fall back to allternit_cloud when the harness is missing', async () => {
    const ports = port({
      listHarnesses: vi.fn(async () => [
        {
          id: 'codex',
          label: 'Codex',
          reader: 'codex',
          projectable: true,
          resumeHint: '',
          home: '',
          present: false,
        },
      ]),
    });
    await expect(
      resumeOrCreateBotBrain({ mode: 'native_harness', harness: 'codex' }, 'bot-1', ports),
    ).rejects.toMatchObject({ code: 'harness_missing' });
    expect(ports.pickup).not.toHaveBeenCalled();
  });

  it('does not fall back when a stored native session cannot be resumed', async () => {
    const ports = port({
      pickup: vi.fn(async () => {
        throw new Error('gone');
      }),
    });
    await expect(
      resumeOrCreateBotBrain(
        { mode: 'native_harness', harness: 'codex', nativeSessionId: 'missing' },
        'bot-1',
        ports,
      ),
    ).rejects.toBeInstanceOf(BotBrainBindError);
    await expect(
      resumeOrCreateBotBrain(
        { mode: 'native_harness', harness: 'codex', nativeSessionId: 'missing' },
        'bot-1',
        ports,
      ),
    ).rejects.toMatchObject({ code: 'session_missing' });
  });

  it('spawns a native CLI session when pickup of the tracked id fails', async () => {
    const spawn = vi.fn(async () => ({ harness: 'codex', sessionId: 'spawned-1', spawned: true }));
    const ports = port({
      pickup: vi.fn(async ({ sessionId }) => {
        if (sessionId === 'bot-agent-1-codex') throw new Error('not on disk');
        return pickupResult(sessionId);
      }),
      spawn,
    });
    const result = await resumeOrCreateBotBrain(
      { mode: 'native_harness', harness: 'codex' },
      'agent-1',
      ports,
    );
    expect(spawn).toHaveBeenCalledWith({ harness: 'codex', sessionId: 'bot-agent-1-codex' });
    expect(result.nativeSessionId).toBe('spawned-1');
  });

  it('does not steal catalog sessions when spawn is missing', async () => {
    const ports = port({
      pickup: vi.fn(async () => {
        throw new Error('not on disk');
      }),
    });
    await expect(
      resumeOrCreateBotBrain({ mode: 'native_harness', harness: 'codex' }, 'bot-1', ports),
    ).rejects.toMatchObject({ code: 'session_missing' });
  });

  it('requires uhpHarnessId and spawns the UHP harness', async () => {
    await expect(
      resumeOrCreateBotBrain({ mode: 'uhp_harness' }, 'bot-1', port()),
    ).rejects.toMatchObject({ code: 'uhp_missing' });
    const uhp = { spawn: vi.fn(async () => ({ sessionId: 'uhp-ses' })) };
    await expect(
      resumeOrCreateBotBrain({ mode: 'uhp_harness', uhpHarnessId: 'chrn_kimi' }, 'bot-1', port(), uhp),
    ).resolves.toEqual({
      mode: 'uhp_harness',
      uhpHarnessId: 'chrn_kimi',
      nativeSessionId: 'uhp-ses',
    });
    expect(uhp.spawn).toHaveBeenCalledWith('chrn_kimi');
  });

  it('passes allternit_cloud through without calling native sessions', async () => {
    const ports = port();
    const brain = defaultBotBrain({ providerID: 'anthropic', modelID: 'sonnet' });
    await expect(resumeOrCreateBotBrain(brain, 'bot-1', ports)).resolves.toEqual(brain);
    expect(ports.listHarnesses).not.toHaveBeenCalled();
  });

  it('exposes nativeSessionId as the visibility join key', () => {
    expect(nativeSessionJoinKey({ mode: 'native_harness', harness: 'codex', nativeSessionId: 'p1' })).toBe('p1');
    expect(nativeSessionJoinKey({ mode: 'allternit_cloud' })).toBeUndefined();
  });
});
