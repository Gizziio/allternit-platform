/**
 * Vitest Workspace Configuration
 *
 * Defines the test workspace for all Allternit packages.
 */

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Integration and E2E tests
  'tests/vitest.config.ts',
]);
