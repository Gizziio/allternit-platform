import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Unit tests exercise the enabled code paths. Production stays fail-closed
    // except namespaces turned on in `.env.production`.
    env: {
      NEXT_PUBLIC_ALLTERNIT_RAILS_API: '1',
      NEXT_PUBLIC_ALLTERNIT_RUNTIME_API: '1',
      NEXT_PUBLIC_ALLTERNIT_AGENT_SESSIONS_API: '1',
    },
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
    'import.meta.env.NEXT_PUBLIC_ALLTERNIT_RAILS_API': JSON.stringify('1'),
    'import.meta.env.NEXT_PUBLIC_ALLTERNIT_RUNTIME_API': JSON.stringify('1'),
    'import.meta.env.NEXT_PUBLIC_ALLTERNIT_AGENT_SESSIONS_API': JSON.stringify('1'),
  },
});
