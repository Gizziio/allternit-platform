import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'src/renderer/auth'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist/renderer/auth'),
    emptyOutDir: true,
    minify: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/renderer/auth/index.html'),
    },
  },
  plugins: [react()],
});
