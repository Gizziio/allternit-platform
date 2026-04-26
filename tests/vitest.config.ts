import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: {
      '@allternit/runtime': path.resolve(repoRoot, '3-adapters/runtime-adapters/allternit-runtime/dist/index.js'),
      '@allternit/governor': path.resolve(repoRoot, '2-governance/governance-workflows/allternit-governor/dist/index.js'),
      '@allternit/lawlayer': path.resolve(repoRoot, '2-governance/legal-compliance/allternit-lawlayer/dist/index.js'),
      '@allternit/shell': path.resolve(repoRoot, '7-apps/_legacy/shell/src/index.ts'),
      '@': path.resolve(repoRoot, 'surfaces/allternit-platform/src'),
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
      'upstream',
    ],
    testTimeout: 30000,
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        'upstream/',
        'tests/',
        '**/*.config.ts',
      ],
    },
  },
});
