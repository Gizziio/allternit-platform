/**
 * Playwright configuration for Allternit Desktop Electron e2e tests.
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Electron launches a real app; give it room and never run tests in parallel.
  timeout: 180000,
  retries: 0,
  workers: 1,

  reporter: [['list']],

  outputDir: './test-results/output',

  // The docs window loads the platform surface (/docs) — start its dev server.
  webServer: {
    command: 'pnpm --dir ../ai.allternit.com exec vite --port 3013 --strictPort',
    url: 'http://localhost:3013',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
