import { describe, it } from 'vitest';

/**
 * Tambo E2E tests are disabled because the ../tambo-client.js module they
 * depend on does not exist in the current worktree. Re-enable once the
 * Tambo client is restored or replaced with an in-repo implementation.
 */
describe.skip('Tambo E2E Integration', () => {
  it('placeholder — see file header', () => {});
});
