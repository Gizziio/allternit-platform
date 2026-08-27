import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  outputDir: './test-results/output',
  webServer: {
    command: 'pnpm --dir ../ai.allternit.com exec vite --port 3017 --strictPort',
    url: 'http://localhost:3017',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
