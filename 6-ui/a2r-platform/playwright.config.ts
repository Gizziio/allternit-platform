/**
 * Playwright Configuration for A2R Platform UI Audit
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html', { outputFolder: './test-results/html-report' }],
    ['json', { outputFile: './test-results/test-results.json' }],
    ['junit', { outputFile: './test-results/junit.xml' }],
    ['list'],
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions
    baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:5177',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Screenshot on failure
    screenshot: 'only-on-failure',
    
    // Video on failure
    video: 'retain-on-failure',
    
    // Browser context options
    viewport: { width: 1920, height: 1080 },
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Test against mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    
    // Test against branded browsers
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
  
  // Output directory for test results
  outputDir: './test-results/output',
  
  // Timeout for each test
  timeout: 60000,
  
  // Expect timeout
  expect: {
    timeout: 5000,
  },
  
  // Web server configuration (optional - can start dev server automatically)
  // webServer: {
  //   command: 'pnpm dev',
  //   url: 'http://127.0.0.1:5177',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120000,
  // },
});
