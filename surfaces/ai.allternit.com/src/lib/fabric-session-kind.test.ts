import { describe, expect, it } from 'vitest';
import { fabricAppModeKind, fabricKindAppMode, fabricKindSurface, fabricSessionKind } from './fabric-session-kind';

describe('fabricSessionKind', () => {
  it('classifies code, ACI, bot, and chat sessions', () => {
    expect(fabricSessionKind({ title: 'Repo work', surface: 'code', directory: '/src' })).toBe('code');
    expect(fabricSessionKind({ title: 'gizzi-203-claude', directory: '/' })).toBe('code');
    expect(fabricSessionKind({ title: 'cli-grok-pong', directory: '/' })).toBe('code');
    expect(fabricSessionKind({ title: 'ACI browse', surface: 'browser', directory: '/' })).toBe('aci');
    expect(fabricSessionKind({ title: 'Support bot', agentID: 'bot-support', directory: '/' })).toBe('bot');
    expect(fabricSessionKind({ title: 'New session', surface: 'chat', directory: '/' })).toBe('chat');
  });

  it('maps drive tabs to create-session surfaces', () => {
    expect(fabricKindSurface('code')).toBe('code');
    expect(fabricKindSurface('aci')).toBe('browser');
    expect(fabricKindSurface('bot')).toBe('bot');
    expect(fabricKindSurface('chat')).toBe('chat');
    expect(fabricKindSurface('desktop')).toBe('desktop');
  });
});

describe('fabricKindAppMode', () => {
  it('maps drive kinds to the platform app mode desktop views expect', () => {
    expect(fabricKindAppMode('chat')).toBe('chat');
    expect(fabricKindAppMode('bot')).toBe('bot');
    expect(fabricKindAppMode('code')).toBe('code');
    expect(fabricKindAppMode('aci')).toBe('browser');
    expect(fabricKindAppMode('desktop')).toBe('browser');
  });
});

describe('fabricAppModeKind', () => {
  it('maps switch-mode events back onto fabric drive kinds', () => {
    expect(fabricAppModeKind('chat')).toBe('chat');
    expect(fabricAppModeKind('cowork')).toBe('chat');
    expect(fabricAppModeKind('bot')).toBe('bot');
    expect(fabricAppModeKind('code')).toBe('code');
    expect(fabricAppModeKind('browser')).toBe('aci');
  });

  it('ignores modes with no fabric rail', () => {
    expect(fabricAppModeKind('design')).toBeNull();
    expect(fabricAppModeKind('unknown')).toBeNull();
  });
});
