import { describe, expect, it, vi } from 'vitest';
import {
  domainMatches,
  originMatches,
  SiteToolRegistry,
  type SiteTool,
  type SiteToolResult,
} from '../registry.js';

function fakeTool(overrides: Partial<SiteTool> = {}): SiteTool {
  return {
    descriptor: {
      name: 'test.tool',
      description: 'A test tool',
      inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
    },
    allowedDomains: ['example.com'],
    blockedActions: ['delete_everything'],
    actions: ['do_thing'],
    handler: vi.fn(async (): Promise<SiteToolResult> => ({ ok: true, summary: 'done' })),
    ...overrides,
  };
}

describe('domain matching', () => {
  it('matches exact hostnames', () => {
    expect(domainMatches('github.com', 'github.com')).toBe(true);
    expect(domainMatches('github.com', 'api.github.com')).toBe(false);
  });

  it('matches one leading wildcard label', () => {
    expect(domainMatches('*.github.com', 'api.github.com')).toBe(true);
    expect(domainMatches('*.github.com', 'deep.sub.github.com')).toBe(true);
    expect(domainMatches('*.github.com', 'github.com')).toBe(true);
    expect(domainMatches('*.github.com', 'notgithub.com')).toBe(false);
    expect(domainMatches('*.github.com', 'github.com.evil.test')).toBe(false);
  });

  it('originMatches parses the origin URL hostname', () => {
    expect(originMatches('https://mail.google.com/mail/u/0/', ['mail.google.com'])).toBe(true);
    expect(originMatches('https://mail.google.com.evil.test/', ['mail.google.com'])).toBe(false);
    expect(originMatches(null, ['example.com'])).toBe(false);
    expect(originMatches('not a url', ['example.com'])).toBe(false);
  });
});

describe('SiteToolRegistry', () => {
  it('lists tools and filters by origin', () => {
    const registry = new SiteToolRegistry();
    registry.register(fakeTool());
    registry.register(fakeTool({
      descriptor: { name: 'other.tool', description: 'Other', inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false } },
      allowedDomains: ['other.test'],
    }));
    expect(registry.descriptors().map((descriptor) => descriptor.name)).toEqual(['test.tool', 'other.tool']);
    expect(registry.toolsForOrigin('https://example.com/page').map((tool) => tool.descriptor.name)).toEqual(['test.tool']);
    expect(registry.toolsForOrigin('https://unrelated.site/')).toEqual([]);
  });

  it('refuses a blocked action without calling the handler', async () => {
    const registry = new SiteToolRegistry();
    const tool = fakeTool();
    registry.register(tool);
    const result = await registry.invoke('test.tool', { requestedAction: 'delete_everything' }, { cdpUrl: '', targetId: '' });
    expect(result).toMatchObject({ ok: false, refused: true });
    expect(result.reason).toContain('delete_everything');
    expect(tool.handler).not.toHaveBeenCalled();
  });

  it('allows the tool’s own action set', async () => {
    const registry = new SiteToolRegistry();
    const tool = fakeTool();
    registry.register(tool);
    const result = await registry.invoke('test.tool', { requestedAction: 'do_thing' }, { cdpUrl: '', targetId: '' });
    expect(result.ok).toBe(true);
    expect(tool.handler).toHaveBeenCalledTimes(1);
  });

  it('refuses unknown tools with a structured result', async () => {
    const registry = new SiteToolRegistry();
    const result = await registry.invoke('nope.missing', {}, { cdpUrl: '', targetId: '' });
    expect(result).toMatchObject({ ok: false, refused: true });
    expect(result.reason).toContain('nope.missing');
  });

  it('rejects tools whose declared actions overlap the plugin blocked list', () => {
    const registry = new SiteToolRegistry();
    expect(() => registry.register(fakeTool({ actions: ['do_thing', 'delete_everything'] }))).toThrow(/blocked/);
  });

  it('rejects duplicate registrations', () => {
    const registry = new SiteToolRegistry();
    registry.register(fakeTool());
    expect(() => registry.register(fakeTool())).toThrow(/already registered/);
  });
});
