import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(repoRoot, 'surfaces/ai.allternit.com/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./setup-localstorage.ts'],
    include: [
      'integration/**/*.test.ts',
      'e2e/**/*.test.ts',
    ],
    exclude: [
      'node_modules',
      'dist',
    ],
    testTimeout: 30000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.config.ts',
      ],
    },
  },
});
