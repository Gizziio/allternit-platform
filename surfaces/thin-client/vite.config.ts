import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: path.join(__dirname, 'src/renderer'),
  base: './',
  build: {
    outDir: path.join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.join(__dirname, 'src/renderer/index.html'),
      },
    },
  },
  server: {
    port: 5178,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src/renderer/src'),
    },
  },
  css: {
    devSourcemap: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-markdown', 'react-syntax-highlighter'],
  },
});
