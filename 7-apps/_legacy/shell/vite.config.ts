import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      'a2ui-types': path.resolve(__dirname, '../../types/a2ui-types'),
      'capsule-spec': path.resolve(__dirname, '../../types/capsule-spec'),
      '@ui-tars': path.resolve(__dirname, '../../packages/ui-tars/src'),
      '@executor-core': path.resolve(__dirname, '../../packages/executor-core/src'),
      '@executor-superconductor': path.resolve(__dirname, '../../packages/executor-superconductor/src'),
      '@parallel-run': path.resolve(__dirname, '../../packages/parallel-run/src'),
      '@a2rchitech/openwork': path.resolve(__dirname, '../openwork/src'),
    },
  },
  server: {
    host: '0.0.0.0',  // Bind to all interfaces for cloudflare tunnel
    port: 5173,
    allowedHosts: ['.trycloudflare.com'],
    fs: {
      allow: [".."]
    },
    proxy: {
      '/api/frameworks': {
        target: 'http://127.0.0.1:3003',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/api/v1': {
        target: 'http://127.0.0.1:3004',
        changeOrigin: true,
        ws: true,  // Enable WebSocket support for API routes
        rewrite: (path) => path.replace(/^\/api\/v1/, '/v1')
      },
      '/v1/terminal/ws': {
        target: 'http://127.0.0.1:3004',
        changeOrigin: true,
        ws: true,  // Enable WebSocket support for terminal
        logLevel: 'debug'
      },
      '/v1/orchestrator/ws': {
        target: 'http://127.0.0.1:3004',
        changeOrigin: true,
        ws: true,  // Enable WebSocket support for orchestrator
        logLevel: 'debug'
      },
      '/v1/embodiment': {
        target: 'http://127.0.0.1:3004',
        changeOrigin: true,
        ws: true,  // Enable WebSocket proxying if needed
        logLevel: 'debug'
      },
      '/api/comfyui': {
        target: 'http://127.0.0.1:8188',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/comfyui/, '')
      },
      '/api/browser': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/browser/, '')
      },
      '/api/agui': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/agui/, '')
      },
      '/api/copilot': {
        target: 'http://127.0.0.1:8011',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/api\/copilot/, '')
      },
      '/api/a2a': {
        target: 'http://127.0.0.1:8012',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/a2a/, '')
      }
    }
  }
});
