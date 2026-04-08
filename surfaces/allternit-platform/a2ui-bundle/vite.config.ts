/**
 * Vite configuration for A2UI Bundle
 * Ported from OpenClaw's A2UI build
 * 
 * This builds a standalone A2UI bundle that can be hosted by the Canvas Host Server.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  root: path.resolve(__dirname, 'src'),
  
  build: {
    // Library mode for standalone bundle
    lib: {
      entry: path.resolve(__dirname, 'src/main.tsx'),
      name: 'A2R',
      formats: ['iife'],
      fileName: () => 'a2ui.bundle.js',
    },
    
    outDir: path.resolve(__dirname, '../dist-a2ui'),
    emptyOutDir: true,
    
    // Minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
    },
    
    rollupOptions: {
      // External dependencies (loaded via CDN or host page)
      external: [],
      output: {
        // Inline all dependencies into the bundle
        inlineDynamicImports: true,
        
        // Global variables (for IIFE format)
        globals: {},
      },
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  
  // CSS handling
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  
  // Development server
  server: {
    port: 3456,
    open: true,
  },
});
