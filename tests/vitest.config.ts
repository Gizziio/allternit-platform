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
      // Import @allternit/runtime. The packaging bug is fixed (2026-09-18):
      // the tsconfig paths map pulled @allternit/governor source into the
      // program, inflating tsc's computed rootDir so the build emitted
      // dist/services/runtime/adapter/... instead of dist/index.js; dist now
      // matches the package.json entry points and the package resolves. The
      // suites stay excluded anyway: allternit-e2e asserts an API that never
      // existed on RuntimeBridge (option-taking constructor + executeTool),
      // and the two compatibility suites additionally need @allternit/lawlayer
      // (never built/importable) plus gateway mocks — orphaned scaffolds, not
      // loadability problems.
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
