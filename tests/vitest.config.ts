import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: {
      '@a2r/runtime': path.resolve(repoRoot, '3-adapters/runtime-adapters/a2r-runtime/dist/index.js'),
      '@a2r/governor': path.resolve(repoRoot, '2-governance/governance-workflows/a2r-governor/dist/index.js'),
      '@a2r/lawlayer': path.resolve(repoRoot, '2-governance/legal-compliance/a2r-lawlayer/dist/index.js'),
      '@a2r/shell': path.resolve(repoRoot, '7-apps/_legacy/shell/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
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
