/**
 * Tests for the AgentStackProvider registry.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerStackProvider,
  unregisterStackProvider,
  clearStackProviders,
  getStackProvider,
  listStackProviderIds,
  discoverInstalledProviders,
} from '../registry';
import type { AgentStackProvider } from '../types';

function fakeProvider(id: string, installed: boolean): AgentStackProvider {
  return {
    id,
    name: id,
    isInstalled: async () => installed,
    listAgents: async () => [],
    sendMessage: async function* () {},
    getStatus: async () => 'idle',
  };
}

beforeEach(() => {
  clearStackProviders();
});

describe('stack-provider registry', () => {
  it('registers and retrieves a provider', () => {
    registerStackProvider('fake', () => fakeProvider('fake', true));
    const provider = getStackProvider('fake');
    expect(provider).toBeDefined();
    expect(provider?.id).toBe('fake');
  });

  it('lists registered provider ids', () => {
    registerStackProvider('a', () => fakeProvider('a', true));
    registerStackProvider('b', () => fakeProvider('b', true));
    expect(listStackProviderIds()).toEqual(['a', 'b']);
  });

  it('unregisters a provider', () => {
    registerStackProvider('fake', () => fakeProvider('fake', true));
    unregisterStackProvider('fake');
    expect(getStackProvider('fake')).toBeUndefined();
  });

  it('reuses the same provider instance', () => {
    registerStackProvider('fake', () => fakeProvider('fake', true));
    const first = getStackProvider('fake');
    const second = getStackProvider('fake');
    expect(first).toBe(second);
  });

  it('discovers only installed providers', async () => {
    registerStackProvider('installed', () => fakeProvider('installed', true));
    registerStackProvider('missing', () => fakeProvider('missing', false));
    const installed = await discoverInstalledProviders();
    expect(installed.map((p) => p.id)).toEqual(['installed']);
  });

  it('survives a provider that throws during installation check', async () => {
    registerStackProvider('good', () => fakeProvider('good', true));
    registerStackProvider('bad', () => ({
      ...fakeProvider('bad', false),
      isInstalled: async () => {
        throw new Error('boom');
      },
    }));
    const installed = await discoverInstalledProviders();
    expect(installed.map((p) => p.id)).toEqual(['good']);
  });
});
