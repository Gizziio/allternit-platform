import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Web build outputs to ../server/public so the server can serve the SPA.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../server/public',
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/commands',
            '@codemirror/language',
            '@codemirror/lang-markdown',
            '@codemirror/theme-one-dark',
          ],
          markdown: [
            'unified',
            'remark-parse',
            'remark-gfm',
            'remark-rehype',
            'rehype-raw',
            'rehype-sanitize',
            'rehype-stringify',
          ],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/auth': 'http://localhost:8787',
      '/public': 'http://localhost:8787',
      '/share': 'http://localhost:8787', // SSR share page is server-rendered even in dev
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
});
