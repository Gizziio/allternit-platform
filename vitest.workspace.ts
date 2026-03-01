/**
 * Vitest Workspace Configuration
 *
 * Defines the test workspace for all A2R packages.
 */

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Governance and runtime packages
  '2-governance/a2r-governor/vitest.config.ts',
  '2-governance/a2r-lawlayer/vitest.config.ts',
  '3-adapters/a2r-runtime/vitest.config.ts',

  // Integration and E2E tests
  'tests/vitest.config.ts',
]);
