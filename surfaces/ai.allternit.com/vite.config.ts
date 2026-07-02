import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    process.env.ANALYZE === '1' && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    }),
  ].filter(Boolean as any),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
  },
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@allternit/visual-state/types': path.resolve(__dirname, './adapters-ts/allternit-visual-state/src/types/index.ts'),
      '@allternit/visual-state': path.resolve(__dirname, './adapters-ts/allternit-visual-state/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.SOURCEMAP === '1',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      external: [
        /.*domains\/agent\/allternit-agent-workspace\/pkg.*/,
        'better-sqlite3',
        /^better-sqlite3(\/.+)?$/,
      ],
      output: {
        manualChunks(id) {
          if (id.includes('tldraw')) return 'tldraw'
          if (id.includes('cytoscape')) return 'cytoscape'
          if (id.includes('pdfjs-dist')) return 'pdfjs'
          if (id.includes('pptxgenjs')) return 'pptxgen'
          if (id.includes('recharts')) return 'recharts'
          if (id.includes('leaflet')) return 'leaflet'
        },
      },
    },
  },
  server: {
    port: 3013,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
      '/viz': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
      '/sandbox': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
      '/vm-session': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
      '/rails': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
      '/stream': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
      '/terminal': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
      '/status': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:8013',
        changeOrigin: true,
      },
    },
  },
})
