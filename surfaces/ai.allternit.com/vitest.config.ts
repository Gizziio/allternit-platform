import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Playwright e2e specs are run separately; do not collect them under Vitest.
      'tests/**/*.spec.ts',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'crypto': 'node:crypto',
      'path': 'node:path',
      'os': 'node:os',
      'fs': 'node:fs',
      'fs/promises': 'node:fs/promises',
      'js-tiktoken': path.resolve(__dirname, './src/lib/ai/__mocks__/js-tiktoken.ts'),
    },
  },
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api/v1/swarm'),
    'import.meta.env.VITE_Allternit_GATEWAY_URL': JSON.stringify('http://127.0.0.1:8013/api/v1'),
    'import.meta.env.VITE_GATEWAY_BASE_URL': JSON.stringify('http://localhost:8013'),
    'import.meta.env.DEV': 'true',
    'import.meta.env.PROD': 'false',
  },
});
