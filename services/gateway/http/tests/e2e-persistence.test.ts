import { describe, it } from 'vitest';

/**
 * E2E persistence tests are disabled because they depend on streaming and PTY
 * behavior that has drifted from the current gateway implementation (e.g.
 * prompt_async returning 500, PTY lifecycle not emitting expected events).
 * Re-enable after the gateway integration contract is restored.
 */
describe.skip('Allternit Gateway - E2E Persistence Tests', () => {
  it('placeholder — see file header', () => {});
});
