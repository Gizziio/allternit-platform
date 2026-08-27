/**
 * Tests for the Hermes stack provider.
 */

import { describe, it, expect } from 'vitest';
import { createHermesProvider } from '../hermes-provider';
import type { StackRuntimeClient } from '../runtime-client';

function makeRuntimeClient(
  commands: Map<string, { stdout: string; stderr: string; exitCode: number }>,
): StackRuntimeClient {
  return {
    isAvailable: () => true,
    exec: async (command, args) => {
      const key = `${command} ${args.join(' ')}`;
      const result = commands.get(key);
      if (result) return result;
      return { stdout: '', stderr: 'command not found', exitCode: 1 };
    },
    async *spawn(command, args) {
      const key = `${command} ${args.join(' ')}`;
      if (key === 'hermes -p researcher chat -c session-1 -q "hello"') {
        yield 'Hi from Hermes';
        return;
      }
      yield 'error';
    },
    readFile: async (path) => `contents of ${path}`,
    listDirectory: async (path) => ['skills/research.md'],
  };
}

describe('hermes-provider', () => {
  it('detects installation when hermes --version succeeds', async () => {
    const runtime = makeRuntimeClient(
      new Map([['hermes --version', { stdout: 'hermes 1.0.0', stderr: '', exitCode: 0 }]]),
    );
    const provider = createHermesProvider({ runtimeClient: runtime });
    expect(await provider.isInstalled()).toBe(true);
  });

  it('detects absence when hermes --version fails', async () => {
    const runtime = makeRuntimeClient(new Map());
    const provider = createHermesProvider({ runtimeClient: runtime });
    expect(await provider.isInstalled()).toBe(false);
  });

  it('lists profiles from JSON output', async () => {
    const runtime = makeRuntimeClient(
      new Map([
        ['hermes --version', { stdout: 'hermes 1.0.0', stderr: '', exitCode: 0 }],
        [
          'hermes profile list --json',
          { stdout: JSON.stringify([{ name: 'researcher' }, { name: 'coder' }]), stderr: '', exitCode: 0 },
        ],
      ]),
    );
    const provider = createHermesProvider({ runtimeClient: runtime });
    const agents = await provider.listAgents();
    expect(agents).toHaveLength(2);
    expect(agents[0].externalId).toBe('researcher');
    expect(agents[0].providerId).toBe('hermes');
    expect(agents[1].externalId).toBe('coder');
  });

  it('falls back to directory scan when profile list fails', async () => {
    const runtime: StackRuntimeClient = {
      isAvailable: () => true,
      exec: async (command, args) => {
        const key = `${command} ${args.join(' ')}`;
        if (key === 'hermes --version') {
          return { stdout: 'hermes 1.0.0', stderr: '', exitCode: 0 };
        }
        return { stdout: '', stderr: 'command not found', exitCode: 1 };
      },
      async *spawn() { yield 'error'; },
      readFile: async (path) => `contents of ${path}`,
      listDirectory: async (path) => ['researcher', 'coder'],
    };
    const provider = createHermesProvider({ runtimeClient: runtime });
    const agents = await provider.listAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.externalId)).toContain('researcher');
    expect(agents.map((a) => a.externalId)).toContain('coder');
  });

  it('streams messages', async () => {
    const runtime = makeRuntimeClient(new Map());
    const provider = createHermesProvider({ runtimeClient: runtime });
    const lines: string[] = [];
    for await (const line of provider.sendMessage('researcher', 'session-1', 'hello')) {
      lines.push(line);
    }
    expect(lines).toEqual(['Hi from Hermes']);
  });

  it('syncs memory and skills', async () => {
    const runtime = makeRuntimeClient(
      new Map([
        ['hermes --version', { stdout: 'hermes 1.0.0', stderr: '', exitCode: 0 }],
      ]),
    );
    const provider = createHermesProvider({ runtimeClient: runtime });
    const bundle = await provider.syncMemory!('researcher');
    expect(bundle.entries.length).toBe(3);
    expect(bundle.entries.some((e) => e.source === 'hermes:SOUL.md')).toBe(true);
    expect(bundle.skills?.length).toBe(1);
    expect(bundle.skills?.[0].name).toBe('research');
  });
});
