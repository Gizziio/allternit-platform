import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Node liveness may poll GET /api/v1/runtime-devices.
 * Harness/session-worker/ACI must not run on a timer — that burns
 * relay quota and looks like an agent heartbeat.
 */
const FORBIDDEN = [
  'src/components/dispatch/FabricSessionPanel.tsx',
  'src/components/dispatch/useFabricPendingCounts.ts',
  'src/components/dispatch/useRemotePendingCounts.ts',
  'src/components/dispatch/RemoteSessionPanel.tsx',
];

const AGENT_TIMERS = [
  /setInterval\(\s*fetchSessions/,
  /setInterval\(\s*fetchPendingActions/,
  /setInterval\(\s*fetchCounts/,
  /setInterval\(\s*poll/,
];

describe('Fabric Transport does not heartbeat the agent', () => {
  it('keeps harness/session-worker work off timers', () => {
    const root = path.resolve(__dirname, '../../..');
    for (const file of FORBIDDEN) {
      const src = readFileSync(path.join(root, file), 'utf8');
      for (const pattern of AGENT_TIMERS) {
        expect(src, `${file} must not ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('still allows the node catalog poll in useRuntimes', () => {
    const src = readFileSync(
      path.resolve(__dirname, '../../..', 'src/components/dispatch/useRuntimes.ts'),
      'utf8',
    );
    expect(src).toMatch(/setInterval\(fetchRuntimes/);
  });
});
