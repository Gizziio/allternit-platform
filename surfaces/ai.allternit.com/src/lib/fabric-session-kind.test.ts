import { describe, expect, it } from 'vitest';
import { fabricKindSurface, fabricSessionKind } from './fabric-session-kind';

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
  });
});
