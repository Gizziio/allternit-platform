import { describe, expect, it } from 'vitest';
import { LocalPlaywrightProvider } from './local-provider.js';

describe('LocalPlaywrightProvider', () => {
  it('declares the canonical local capability contract', () => {
    const provider = new LocalPlaywrightProvider();
    expect(provider.capabilities.provider).toBe('local-playwright');
    expect(provider.capabilities.capabilities).toContain('observe.accessibility');
    expect(provider.capabilities.supportsPrivateNetwork).toBe(true);
  });

  it('fails closed for an unbound session', async () => {
    const provider = new LocalPlaywrightProvider();
    await expect(provider.observe('missing')).rejects.toThrow('No local browser binding');
  });
});
