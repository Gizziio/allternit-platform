import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, join } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir } from 'os';
import { visualizer } from 'rollup-plugin-visualizer';

const platformSrc = resolve(__dirname, '../../../6-ui/a2r-platform/src');

type OpenClawConfig = {
  token: string | null;
  port: number;
  apiBaseUrl: string;
  gatewayUrl: string;
  gatewayWsUrl: string;
  controlUiUrl: string;
};

function toWsUrl(httpUrl: string): string {
  return httpUrl
    .replace(/^http:\/\//i, 'ws://')
    .replace(/^https:\/\//i, 'wss://')
    .replace(/\/+$/, '');
}

function normalizeGatewayUrl(url: string): string {
  return url
    .trim()
    .replace(/\/api\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function readOpenClawConfig(): OpenClawConfig {
  const defaultPort = Number(
    process.env.A2R_OPENCLAW_HOST_PORT
      || process.env.A2R_PORT
      || process.env.OPENCLAW_PORT
      || 18789
  );
  const defaultHost = normalizeGatewayUrl(
    process.env.A2R_OPENCLAW_HOST_URL?.trim()
    || process.env.OPENCLAW_HOST_URL?.trim()
    || `http://127.0.0.1:${defaultPort}`
  );
  const defaultWs = process.env.A2R_OPENCLAW_GATEWAY_WS_URL?.trim()
    || process.env.OPENCLAW_GATEWAY_WS_URL?.trim()
    || toWsUrl(defaultHost);

  try {
    const envPath = resolve(__dirname, '../../.openclaw.env');
    const envContent = readFileSync(envPath, 'utf8');
    const readKey = (key: string): string | undefined => {
      const match = envContent.match(new RegExp(`^${key}=([^\\r\n]+)$`, 'm'));
      return match?.[1]?.trim().replace(/^['"]|['"]$/g, '');
    };

    const token = readKey('A2R_GATEWAY_TOKEN')
      || readKey('OPENCLAW_GATEWAY_TOKEN')
      || null;

    const configuredPort = Number(
      readKey('A2R_OPENCLAW_HOST_PORT')
        || readKey('A2R_PORT')
        || readKey('OPENCLAW_PORT')
        || defaultPort
    );
    const port = Number.isFinite(configuredPort) && configuredPort > 0
      ? configuredPort
      : defaultPort;

    const gatewayUrl = normalizeGatewayUrl(
      readKey('A2R_OPENCLAW_HOST_URL')
      || readKey('OPENCLAW_HOST_URL')
      || `http://127.0.0.1:${port}`
    );

    const apiBaseUrl = readKey('A2R_API_BASE_URL')
      || readKey('OPENCLAW_API_BASE_URL')
      || `${gatewayUrl}/api/v1`;

    const gatewayWsUrl = readKey('A2R_OPENCLAW_GATEWAY_WS_URL')
      || readKey('OPENCLAW_GATEWAY_WS_URL')
      || toWsUrl(gatewayUrl);

    const controlUiUrl = readKey('A2R_OPENCLAW_CONTROL_UI_URL')
      || readKey('OPENCLAW_CONTROL_UI_URL')
      || `${gatewayUrl.replace(/\/+$/, '')}/`;

    return {
      token,
      port,
      apiBaseUrl,
      gatewayUrl,
      gatewayWsUrl,
      controlUiUrl,
    };
  } catch {
    const gatewayUrl = normalizeGatewayUrl(defaultHost);
    return {
      token: null,
      port: defaultPort,
      apiBaseUrl: `${gatewayUrl}/api/v1`,
      gatewayUrl,
      gatewayWsUrl: defaultWs,
      controlUiUrl: `${gatewayUrl}/`,
    };
  }
}

type OpenClawDiscoveryRecord = {
  agent_id: string;
  display_name: string;
  agent_dir: string;
  workspace_path: string | null;
  session_count: number;
  auth_providers: string[];
  models: string[];
  primary_model: string | null;
  primary_provider: string | null;
  files: {
    models: boolean;
    auth_profiles: boolean;
    sessions_store: boolean;
  };
  registered_agent_id: null;
};

function humanizeAgentId(agentId: string): string {
  const words = agentId
    .trim()
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return words.length > 0 ? words.join(' ') : 'OpenClaw Agent';
}

function readJsonFile(path: string): any {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readOpenClawAgentDiscovery(): {
  agents: OpenClawDiscoveryRecord[];
  total: number;
  unregistered: number;
  state_dir: string;
  workspace_path: string | null;
  gateway_port: number | null;
} {
  const stateDir = join(homedir(), '.openclaw');
  const rootConfig = readJsonFile(join(stateDir, 'openclaw.json')) || {};
  const workspacePath = rootConfig?.agents?.defaults?.workspace || null;
  const gatewayPort = typeof rootConfig?.gateway?.port === 'number'
    ? rootConfig.gateway.port
    : null;
  const agentsDir = join(stateDir, 'agents');

  if (!existsSync(agentsDir)) {
    return {
      agents: [],
      total: 0,
      unregistered: 0,
      state_dir: stateDir,
      workspace_path: workspacePath,
      gateway_port: gatewayPort,
    };
  }

  const agents = readdirSync(agentsDir)
    .map((entry) => join(agentsDir, entry))
    .filter((agentDir) => {
      try {
        return statSync(agentDir).isDirectory();
      } catch {
        return false;
      }
    })
    .map((agentDir) => {
      const agentId = agentDir.split('/').pop() || 'agent';
      const modelsPath = join(agentDir, 'agent', 'models.json');
      const authProfilesPath = join(agentDir, 'agent', 'auth-profiles.json');
      const sessionsStorePath = join(agentDir, 'sessions', 'sessions.json');
      const modelsJson = readJsonFile(modelsPath) || {};
      const authProfilesJson = readJsonFile(authProfilesPath) || {};

      const models = Object.entries(modelsJson?.providers || {}).flatMap(
        ([providerId, providerData]) =>
          Array.isArray((providerData as any)?.models)
            ? (providerData as any).models
                .map((model: any) => typeof model?.id === 'string'
                  ? `${providerId}/${model.id}`
                  : null)
                .filter(Boolean)
            : [],
      );
      const authProviders = Array.from(new Set(
        Object.values(authProfilesJson?.profiles || {})
          .map((profile: any) => profile?.provider)
          .filter((provider: unknown): provider is string => typeof provider === 'string' && provider.trim().length > 0),
      )).sort();
      const primaryModel = rootConfig?.agents?.defaults?.model?.primary || models[0] || null;
      const primaryProvider = typeof primaryModel === 'string'
        ? primaryModel.split('/')[0] || null
        : null;
      const sessionCount = existsSync(join(agentDir, 'sessions'))
        ? readdirSync(join(agentDir, 'sessions')).filter((name) => name.endsWith('.jsonl') && !name.includes('.deleted.')).length
        : 0;

      return {
        agent_id: agentId,
        display_name: humanizeAgentId(agentId),
        agent_dir: agentDir,
        workspace_path: workspacePath,
        session_count: sessionCount,
        auth_providers: authProviders,
        models,
        primary_model: primaryModel,
        primary_provider: primaryProvider,
        files: {
          models: existsSync(modelsPath),
          auth_profiles: existsSync(authProfilesPath),
          sessions_store: existsSync(sessionsStorePath),
        },
        registered_agent_id: null,
      } satisfies OpenClawDiscoveryRecord;
    });

  return {
    agents,
    total: agents.length,
    unregistered: agents.length,
    state_dir: stateDir,
    workspace_path: workspacePath,
    gateway_port: gatewayPort,
  };
}

const openclawConfig = readOpenClawConfig();
const openclawProxyTarget = openclawConfig.gatewayUrl;

// Custom plugin to resolve @/ imports from @a2r/platform
function platformAliasPlugin(): Plugin {
  // Exact matches take priority
  const exactAliases: Record<string, string> = {
    '@/lib/auth': resolve(platformSrc, 'lib/auth-browser.ts'),
    '@/lib/env': resolve(platformSrc, 'lib/env-browser.ts'),
  };
  
  // Prefix matches for directories
  const aliasPrefixes: Record<string, string> = {
    '@/lib': resolve(platformSrc, 'lib'),
    '@/components': resolve(platformSrc, 'components'),
    '@/providers': resolve(platformSrc, 'providers'),
    '@/services': resolve(platformSrc, 'services'),
    '@/hooks': resolve(platformSrc, 'hooks'),
    '@/shell': resolve(platformSrc, 'shell'),
    '@/views': resolve(platformSrc, 'views'),
    '@/nav': resolve(platformSrc, 'nav'),
    '@/capsules': resolve(platformSrc, 'capsules'),
    '@/drawers': resolve(platformSrc, 'drawers'),
    '@/dock': resolve(platformSrc, 'dock'),
    '@/runner': resolve(platformSrc, 'runner'),
    '@/design': resolve(platformSrc, 'design'),
    '@/integration': resolve(platformSrc, 'integration'),
    '@/vendor': resolve(platformSrc, 'vendor'),
    '@/qa': resolve(platformSrc, 'qa'),
    '@/state': resolve(platformSrc, 'state'),
    '@/surfaces': resolve(platformSrc, 'surfaces'),
    '@/types': resolve(platformSrc, 'types'),
    '@/app': resolve(platformSrc, 'app'),
    '@/stores': resolve(platformSrc, 'stores'),
    '@/agent-workspace': resolve(platformSrc, 'agent-workspace'),
    '@/dev': resolve(platformSrc, 'dev'),
  };

  function resolveWithExtensions(basePath: string): string | null {
    const extensions = ['.tsx', '.ts', '.jsx', '.js'];
    
    // First try direct file with extensions
    for (const ext of extensions) {
      const tryPath = basePath + ext;
      if (existsSync(tryPath)) {
        return tryPath;
      }
    }
    
    // Then try as directory with index files
    const indexExtensions = ['/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
    for (const ext of indexExtensions) {
      const tryPath = basePath + ext;
      if (existsSync(tryPath)) {
        return tryPath;
      }
    }
    
    return null;
  }

  return {
    name: 'platform-alias',
    enforce: 'pre',
    resolveId(id: string, importer?: string) {
      if (!id.startsWith('@/')) return null;
      
      // Check exact matches first
      if (exactAliases[id]) {
        const resolved = exactAliases[id];
        if (existsSync(resolved)) {
          return resolved;
        }
      }
      
      // Then check prefix matches
      for (const [prefix, replacement] of Object.entries(aliasPrefixes)) {
        if (id === prefix) {
          // Exact match to a directory - try to resolve as directory
          const resolved = resolveWithExtensions(replacement);
          if (resolved) return resolved;
          return replacement;
        }
        if (id.startsWith(prefix + '/')) {
          // Get the path after the prefix
          const subPath = id.slice(prefix.length + 1); // +1 for the '/'
          const basePath = join(replacement, subPath);
          
          const resolved = resolveWithExtensions(basePath);
          if (resolved) return resolved;
          
          return null;
        }
      }
      return null;
    },
  };
}

// Plugin to serve OpenClaw config
function openclawConfigPlugin(): Plugin {
  return {
    name: 'openclaw-config',
    configureServer(server) {
      const handler = (_req: unknown, res: { setHeader: (k: string, v: string) => void; end: (body: string) => void }) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          ...openclawConfig,
          apiBaseUrl: '/a2r-api',
        }));
      };

      // Keep legacy and new paths to avoid UI/version mismatches.
      server.middlewares.use('/openclaw-config.json', handler);
      server.middlewares.use('/a2r-config.json', handler);
      server.middlewares.use('/api/dev/openclaw/agents/discovery', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(readOpenClawAgentDiscovery()));
      });
    },
  };
}

// Check if we should enable bundle analyzer
const isAnalyzeMode = process.env.ANALYZE === 'true';

export default defineConfig({
  plugins: [
    platformAliasPlugin(),
    openclawConfigPlugin(),
    react(),
    // Bundle analyzer - only enabled when ANALYZE=true
    isAnalyzeMode && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: './dist/stats.html',
    }),
  ].filter(Boolean),
  define: {
    'process.env': {},
    'process.versions': { node: '20.0.0' },
    'global': 'window',
    '__A2R_GATEWAY_URL__': JSON.stringify(process.env.VITE_A2R_GATEWAY_URL || 'http://127.0.0.1:8013'),
    // Inject OpenClaw token at build time as well
    '__OPENCLAW_CONFIG__': JSON.stringify(openclawConfig),
    // Terminal Server URL for AI Model Gateway
    '__TERMINAL_SERVER_URL__': JSON.stringify(process.env.VITE_TERMINAL_SERVER_URL || 'http://127.0.0.1:4096'),
  },
  server: {
    // Pin IPv4 localhost so clients using 127.0.0.1 do not fail when Vite
    // binds IPv6 localhost (::1) by default.
    host: '127.0.0.1',
    port: 5177,
    strictPort: true,
    proxy: {
      // Health path used by legacy/quarantine OpenClaw panels.
      '/a2r-api/health': {
        target: openclawProxyTarget,
        changeOrigin: true,
        rewrite: () => '/health',
      },
      // Dedicated OpenClaw host proxy path to avoid browser CORS.
      '/a2r-api': {
        target: openclawProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/a2r-api/, '/api/v1'),
      },
      // Proxy Gateway API v1 calls to Terminal Server (fallback since Gateway not running)
      '/api/v1/providers': {
        target: 'http://127.0.0.1:4096',
        changeOrigin: true,
        rewrite: () => '/provider',
      },
      '/api/v1/sessions': {
        target: 'http://127.0.0.1:4096',
        changeOrigin: true,
        rewrite: () => '/session',
      },
      '/api/v1/providers/auth/status': {
        target: 'http://127.0.0.1:4096',
        changeOrigin: true,
        rewrite: () => '/health',
      },
      '/api/v1/agents': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      // Proxy chat API calls to Terminal Server (port 4096)
      '/api/chat': {
        target: 'http://127.0.0.1:4096',
        changeOrigin: true,
        rewrite: (path) => {
          // Map /api/chat?chatId=xxx to /session/xxx/message for Terminal Server
          const url = new URL(path, 'http://localhost');
          const chatId = url.searchParams.get('chatId');
          if (chatId) {
            return `/session/${chatId}/message`;
          }
          return path;
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite Proxy] Chat Error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[Vite Proxy] Chat Request:', req.method, req.url, '->', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[Vite Proxy] Chat Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      // Proxy session management calls to Terminal Server
      '/session': {
        target: 'http://127.0.0.1:4096',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite Proxy] Session Error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('[Vite Proxy] Session Request:', req.method, req.url, '->', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('[Vite Proxy] Session Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/web-proxy': {
        target: 'http://127.0.0.1:4096',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Manual chunking for code splitting
        manualChunks: {
          // Core vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          'vendor-state': ['zustand', '@reduxjs/toolkit', 'react-redux'],
          'vendor-utils': ['date-fns', 'clsx', 'tailwind-merge'],
          'vendor-icons': ['lucide-react', '@phosphor-icons/react'],
        },
        // Ensure chunks don't get too large
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || '';
          if (/\.css$/.test(info)) {
            return 'assets/css/[name]-[hash][extname]';
          }
          if (/\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.webp$/.test(info)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // Enable minification with terser-like settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    // Chunk size warning
    chunkSizeWarningLimit: 500,
    // Source maps for production debugging
    sourcemap: true,
    // CSS optimization
    cssMinify: true,
    // Target modern browsers for smaller bundles
    target: 'es2020',
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json'],
    alias: {
      '@a2r/platform': resolve(__dirname, '../../../6-ui/a2r-platform/src/index.ts'),
      // NOTE: We don't define '@' here because it's handled by platformAliasPlugin
      // to properly resolve to the platform package when imported from there
      '@a2r/runtime': resolve(__dirname, 'src/shims/runtime.ts'),
      '@a2r/engine': resolve(__dirname, 'src/shims/empty.ts'),
      'node:fs/promises': resolve(__dirname, 'src/shims/empty.ts'),
      'node:fs': resolve(__dirname, 'src/shims/empty.ts'),
      'node:path': resolve(__dirname, 'src/shims/empty.ts'),
      'node:process': resolve(__dirname, 'src/shims/empty.ts'),
    },
  },
  optimizeDeps: {
    // Prevent stale prebundled snapshots of workspace source packages.
    exclude: ['@a2r/platform'],
  },
  // Performance hints
  esbuild: {
    logOverride: { 'this-is-undefined-in-esm': 'silent' },
  },
});
