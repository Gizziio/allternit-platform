/**
 * Vitest Configuration
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        'demo.ts',
      ],
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
});
