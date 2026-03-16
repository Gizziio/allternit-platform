import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

// Custom plugin to copy manifest, HTML files, and icons
const copyAssetsPlugin = () => ({
  name: 'copy-assets',
  writeBundle() {
    // Ensure dist directory exists
    if (!existsSync('dist')) {
      mkdirSync('dist', { recursive: true });
    }
    
    // Copy manifest
    try {
      copyFileSync('manifest.json', 'dist/manifest.json');
      console.log('✅ manifest.json copied');
    } catch (e) {
      console.error('❌ Failed to copy manifest.json:', e);
    }
    
    // Copy popup HTML
    try {
      copyFileSync('src/popup/popup.html', 'dist/popup.html');
      console.log('✅ popup.html copied');
    } catch (e) {
      console.error('❌ Failed to copy popup.html:', e);
    }
    
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
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].chunk.js',
      },
    },
  },
  plugins: [copyAssetsPlugin()],
});
