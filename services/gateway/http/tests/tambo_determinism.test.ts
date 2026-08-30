import { describe, it } from 'vitest';

/**
 * Tambo determinism tests are disabled because the previous file content was
 * Rust source code embedded in a TypeScript test file and referenced a missing
 * ../tambo-client.js module. Re-enable once the Tambo engine client bindings
 * are available in TypeScript.
 */
describe.skip('Tambo Determinism', () => {
  it('placeholder — see file header', () => {});
});
