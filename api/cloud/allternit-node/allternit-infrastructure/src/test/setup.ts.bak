/**
 * Test setup file
 * Configures the test environment before running tests
 */

import { vi } from 'vitest';

// Mock child_process for unit tests
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
}));

// Mock fs/promises for unit tests
vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  copyFile: vi.fn(),
  unlink: vi.fn(),
}));

// Global test utilities
declare global {
  // Add any global test types here
}

// Setup test environment
beforeAll(() => {
  // Any global setup
});

afterAll(() => {
  // Any global teardown
});
