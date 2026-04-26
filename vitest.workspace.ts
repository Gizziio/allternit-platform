/**
 * Vitest Workspace Configuration
 *
 * Defines the test workspace for all Allternit packages.
 */

import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  // Governance and runtime packages
  '2-governance/allternit-governor/vitest.config.ts',
  '2-governance/allternit-lawlayer/vitest.config.ts',
  '3-adapters/allternit-runtime/vitest.config.ts',

  // Integration and E2E tests
  'tests/vitest.config.ts',
]);
