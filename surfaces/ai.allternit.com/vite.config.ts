import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import os from 'os'
import { createRequire } from 'node:module'
import { visualizer } from 'rollup-plugin-visualizer'
import pkg from './package.json'
import { designSkillsPlugin } from './src/lib/design/design-skills-plugin'

const require = createRequire(import.meta.url)
const blocksuiteIconsLit = require.resolve('@blocksuite/icons/lit')
// Force Univer to use the same @univerjs/core that office-sheets-app depends
// on. Without this, the platform surface's legacy design-mode editor pins
// @univerjs/core@0.21.1, which conflicts with office-sheets-app's 0.25.x
// plugins and silently breaks the grid render.
const univerCoreEntry = require.resolve('@univerjs/core', {
  paths: [path.resolve(__dirname, '../../packages/@allternit/office-sheets-app')],
})
// require.resolve returns lib/{cjs|es}/index.js; the alias must point at the
// package root so subpath imports like @univerjs/core/facade still resolve.
const univerCore = path.dirname(path.dirname(path.dirname(univerCoreEntry)))

/**
 * Development-only dispatch handoff endpoints.
 *
 * Production builds must replace this with a real backend implementation
 * (e.g. /api/v1/dispatch/claim and /api/v1/dispatch/status backed by Redis/SQLite).
 */
/**
 * Dev-only: Vite's MPA server matches `/remote-control` to `remote-control.html`
 * because of the rollup input key. The platform route `/remote-control` must
 * serve `index.html` (the SPA shell) so the hub page renders, while
 * `/remote-control.html` continues to serve the standalone dashboard entry.
 */
function remoteControlRoutePlugin(): Plugin {
  return {
    name: 'allternit-remote-control-route',
    configureServer(server) {
      server.middlewares.use('/remote-control', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const url = req.url ?? '/';
        // Only rewrite the exact hub path (with optional query string), not
        // static assets under /remote-control/ or the standalone entrypoint.
        if (url !== '/' && !url.startsWith('?')) return next();
        // Rewrite to the platform SPA shell so Vite injects the React refresh
        // preamble and processes the HTML transform pipeline.
        req.url = '/index.html' + (url.startsWith('?') ? url : '');
        next();
      });
    },
  };
}

function dispatchHandoffPlugin(): Plugin {
  const claims = new Map<string, { claimedAt: number; device?: string }>();

  function getLanAddress(port: number): string | null {
    const interfaces = os.networkInterfaces();
    for (const list of Object.values(interfaces)) {
      for (const iface of list ?? []) {
        if (iface.family === 'IPv4' && !iface.internal && iface.address) {
          return `http://${iface.address}:${port}`;
        }
      }
    }
    return null;
  }

  return {
    name: 'allternit-dispatch-handoff',
    configureServer(server) {
      server.middlewares.use('/dispatch/handoff/claim', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const { token } = JSON.parse(body || '{}') as { token?: string };
            if (typeof token !== 'string' || !token) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'token required' }));
              return;
            }
            claims.set(token, { claimedAt: Date.now(), device: req.headers['user-agent'] });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'invalid body' }));
          }
        });
      });

      server.middlewares.use('/dispatch/handoff/status', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const url = new URL(req.url || '/', `http://localhost`);
        const token = url.searchParams.get('token');
        if (!token) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'token required' }));
          return;
        }
        const claim = claims.get(token);
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            claimed: Boolean(claim),
            claimedAt: claim?.claimedAt,
            device: claim?.device,
          })
        );
      });

      server.middlewares.use('/dispatch/handoff/address', (req, res, next) => {
        if (req.method !== 'GET') return next();
        const url = getLanAddress(server.config.server.port ?? 3013);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ url: url || `http://localhost:${server.config.server.port ?? 3013}` }));
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    remoteControlRoutePlugin(),
    dispatchHandoffPlugin(),
    designSkillsPlugin(),
    process.env.ANALYZE === '1' && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html',
    }),
  ].filter(Boolean as any),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // This surface was migrated from Next.js and intentionally keeps its
  // NEXT_PUBLIC_* deployment contract. Expose only public prefixes; never
  // broaden this to arbitrary process environment variables.
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // The workspace root can resolve React 19 (e.g. from framer-motion dev
      // dependencies) while this surface pins React 18. Without explicit
      // aliases, transitive workspace imports can pull in the root React
      // instance alongside the surface's React 18, which breaks the hook
      // dispatcher and produces "Cannot read properties of null (reading
      // 'useState' / 'useContext')" crashes. Force every react/react-dom
      // import to this surface's copy.
      { find: /^react$/, replacement: path.resolve(__dirname, './node_modules/react/index.js') },
      { find: /^react\/jsx-runtime$/, replacement: path.resolve(__dirname, './node_modules/react/jsx-runtime.js') },
      { find: /^react\/jsx-dev-runtime$/, replacement: path.resolve(__dirname, './node_modules/react/jsx-dev-runtime.js') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, './node_modules/react-dom/index.js') },
      { find: /^react-dom\/client$/, replacement: path.resolve(__dirname, './node_modules/react-dom/client.js') },
      // Force Univer to use the same @univerjs/core@0.25.1 that
      // office-sheets-app depends on. The bare import and every subpath
      // (e.g. @univerjs/core/facade, @univerjs/core/lib/facade) must be
      // rewritten to the ESM build or preserved under lib/ respectively.
      { find: /^@univerjs\/core$/, replacement: path.resolve(univerCore, 'lib/es/index.js') },
      // Both @univerjs/core/facade and the legacy @univerjs/core/lib/facade
      // must resolve to the same module instance, or Univer's facade mixin
      // extensions (e.g. getActiveWorkbook) are applied to the wrong FUniver
      // class and the sheets renderer crashes at runtime.
      { find: /^@univerjs\/core\/lib\/(.+)$/, replacement: `${univerCore}/lib/es/$1` },
      { find: /^@univerjs\/core\/(.+)$/, replacement: `${univerCore}/lib/es/$1` },
      // @blocksuite/data-view@0.19.5 imports a misspelled icon name that was
      // removed from @blocksuite/icons. Keep the workaround in source so a
      // clean frozen-lockfile CI install behaves exactly like local builds.
      { find: '@blocksuite/icons/lit', replacement: path.resolve(__dirname, './src/shims/blocksuite-icons-lit.ts') },
      { find: 'virtual:allternit-blocksuite-icons-lit-original', replacement: blocksuiteIconsLit },
    ],
    // Force a single copy of packages that break when duplicated across the
    // workspace graph (e.g. office-slides-app on React 18 must resolve the
    // same react as the platform surface; Univer plugins must all share one
    // @univerjs/core instance).
    dedupe: ['react', 'react-dom', '@univerjs/core'],
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.SOURCEMAP === '1',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'remote-control': path.resolve(__dirname, 'remote-control.html'),
      },
      external: [
        /.*domains\/agent\/allternit-agent-workspace\/pkg.*/,
        'better-sqlite3',
        /^better-sqlite3(\/.+)?$/,
        // The allternit-office-suite workspace package and its subpaths depend on
        // office-app assets that are not yet bundled correctly into the platform
        // surface. Keep them external so the platform shell, auth, and remote
        // control builds deploy while the office integration is finished.
        '@allternit/allternit-office-suite',
        /^@allternit\/allternit-office-suite\/.+$/,
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
    host: true,
    proxy: {
      // Dev-only model access: same-origin path to the model-proxy sidecar
      // (scripts/model-proxy.mjs). Browser-direct calls to ai-gateway.vercel.sh
      // are CORS-blocked, so getLanguageModel routes here when
      // VITE_LOCAL_AI_BASE_URL is set (see src/lib/ai/providers.ts).
      '/local-ai': {
        target: 'http://127.0.0.1:8090',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/local-ai/, ''),
      },
      // Chat streaming is handled by the local gizzi runtime in dev; the
      // allternit-api backend does not yet implement /agent-chat.
      '/api/agent-chat': {
        target: 'http://127.0.0.1:4096',
        changeOrigin: true,
      },
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
