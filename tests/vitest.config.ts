import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  resolve: {
    alias: {},
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
      // Workspace UI tests live in Gizziio/allternit-ai now.
      'integration/cowork-team.test.ts',
      'integration/intelli-schedule.test.ts',
      // Imports @allternit/shell, which has never been a package in this repo
      // — the file cannot load (orphaned scaffold from the 2026-03 reorg).
      'e2e/workflow.test.ts',
      // Import @allternit/runtime, whose package main points at
      // ./dist/index.js but its tsc build emits a
      // dist/services/runtime/adapter/allternit-runtime/src/... layout
      // (pre-existing packaging bug; dist is gitignored), so the entry never
      // resolves on a fresh checkout.
      'integration/allternit-e2e.test.ts',
      'integration/allternit-runtime-compatibility.test.ts',
      'integration/runtime-bridge-compatibility.test.ts',
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
