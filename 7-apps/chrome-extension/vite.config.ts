import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync } from 'fs';

// Custom plugin to copy manifest and icons
const copyAssetsPlugin = () => ({
  name: 'copy-assets',
  closeBundle() {
    // Copy manifest
    copyFileSync('manifest.json', 'dist/manifest.json');
    
    // Ensure icons directory exists
    try {
      mkdirSync('dist/icons', { recursive: true });
    } catch {}
    
    console.log('✅ Assets copied to dist/');
  },
});

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/service-worker.ts'),
        content: resolve(__dirname, 'src/content/content-script.ts'),
        popup: resolve(__dirname, 'src/popup/popup.ts'),
        options: resolve(__dirname, 'src/options/options.ts'),
        injected: resolve(__dirname, 'src/content/injected.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].chunk.js',
      },
    },
  },
  plugins: [copyAssetsPlugin()],
});
