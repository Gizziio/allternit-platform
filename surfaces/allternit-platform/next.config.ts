import fs from 'fs';
import type { NextConfig } from 'next';
import path from 'path';
import webpack from 'webpack';

const workspaceRoot = path.join(__dirname, '../../');
const clerkPackageInstalled = [
  path.join(__dirname, 'node_modules/@clerk/nextjs/package.json'),
  path.join(workspaceRoot, 'node_modules/@clerk/nextjs/package.json'),
].some((packagePath) => fs.existsSync(packagePath));

const useClerkFallback =
  process.env.ALLTERNIT_PLATFORM_DISABLE_CLERK === '1' ||
  process.env.NEXT_PUBLIC_ALLTERNIT_PLATFORM_DISABLE_CLERK === '1' ||
  !clerkPackageInstalled;

// Absolute paths for webpack (which requires them)
const resolveAliases = {
  '@allternit/runtime': path.resolve(__dirname, '../../services/runtime/adapter/allternit-runtime/src/index.ts'),
  '@allternit/visual-state': path.resolve(__dirname, '../../packages/@allternit/visual-state/src/index.ts'),
  '@allternit/visual-state/types': path.resolve(__dirname, '../../packages/@allternit/visual-state/src/types/index.ts'),
  '@allternit/visual-state/inference': path.resolve(__dirname, '../../packages/@allternit/visual-state/src/inference/index.ts'),
  '@allternit/avatar-adapters': path.resolve(__dirname, '../../packages/@allternit/avatar-adapters/src/index.ts'),
};

// Relative paths for Turbopack (which doesn't support absolute paths in resolveAlias)
const turboResolveAliases = {
  '@allternit/visual-state/types': '../../packages/@allternit/visual-state/src/types/index.ts',
  '@allternit/visual-state/inference': '../../packages/@allternit/visual-state/src/inference/index.ts',
};

const clerkAliases = useClerkFallback ? {
  // Local Electron shell: Clerk is not installed — use full stubs so the app
  // boots without authentication (local-user passthrough).
  '@clerk/nextjs': path.resolve(__dirname, 'src/stubs/clerk/nextjs.tsx'),
  '@clerk/nextjs/server': path.resolve(__dirname, 'src/stubs/clerk/nextjs-server.ts'),
  '@clerk/clerk-react': path.resolve(__dirname, 'src/stubs/clerk/nextjs.tsx'),
} : process.env.CLOUDFLARE_PAGES === '1' ? {
  // Cloudflare Pages static export: API routes are excluded from the build so
  // @clerk/nextjs/server is never called at runtime, but webpack must still be
  // able to resolve the import at build time — stub only the server package.
  // The client packages (@clerk/nextjs, @clerk/clerk-react) use the real
  // implementation so users go through the actual Clerk auth flow.
  '@clerk/nextjs/server': path.resolve(__dirname, 'src/stubs/clerk/nextjs-server.ts'),
} : {};

const turboClerkAliases = useClerkFallback ? {
  '@clerk/nextjs': './src/stubs/clerk/nextjs.tsx',
  '@clerk/nextjs/server': './src/stubs/clerk/nextjs-server.ts',
  '@clerk/clerk-react': './src/stubs/clerk/nextjs.tsx',
} : process.env.CLOUDFLARE_PAGES === '1' ? {
  '@clerk/nextjs/server': './src/stubs/clerk/nextjs-server.ts',
} : {};

function normalizeAppRoute(routePath: string): string | null {
  const withoutGroups = routePath.replace(/\/\([^/]+\)/g, '');

  if (withoutGroups === '/page') return '/';
  if (withoutGroups === '/_not-found/page') return '/_not-found';
  if (withoutGroups.endsWith('/page')) {
    return withoutGroups.slice(0, -'/page'.length) || '/';
  }
  if (withoutGroups.endsWith('/route')) {
    return withoutGroups.slice(0, -'/route'.length) || '/';
  }
  return null;
}

class AppPathRoutesManifestPlugin {
  apply(compiler: webpack.Compiler) {
    const writeManifest = () => {
      const serverOutputPath = compiler.options.output.path;
      if (!serverOutputPath) return;

      const appPathsManifestPath = path.join(serverOutputPath, 'app-paths-manifest.json');
      const appPathRoutesManifestPath = path.join(serverOutputPath, '..', 'app-path-routes-manifest.json');
      if (!fs.existsSync(appPathsManifestPath)) return;

      const appPathsManifest = JSON.parse(fs.readFileSync(appPathsManifestPath, 'utf8')) as Record<string, string>;
      const generatedManifest = Object.fromEntries(
        Object.keys(appPathsManifest)
          .map((routeKey) => {
            const normalized = normalizeAppRoute(routeKey);
            return normalized ? [routeKey, normalized] : null;
          })
          .filter((entry): entry is [string, string] => entry !== null),
      );

      const existingManifest = fs.existsSync(appPathRoutesManifestPath)
        ? JSON.parse(fs.readFileSync(appPathRoutesManifestPath, 'utf8')) as Record<string, string>
        : {};
      const routesManifest = {
        ...existingManifest,
        ...generatedManifest,
      };

      fs.writeFileSync(appPathRoutesManifestPath, JSON.stringify(routesManifest, null, 2));

      const pagesDir = path.join(serverOutputPath, 'pages');
      const pagesManifestPath = path.join(serverOutputPath, 'pages-manifest.json');
      if (fs.existsSync(pagesDir)) {
        const generatedPagesManifest = Object.fromEntries(
          fs.readdirSync(pagesDir)
            .filter((entry) => entry.endsWith('.js'))
            .map((entry) => [`/${entry.replace(/\.js$/, '')}`, `pages/${entry}`]),
        );
        const existingPagesManifest = fs.existsSync(pagesManifestPath)
          ? JSON.parse(fs.readFileSync(pagesManifestPath, 'utf8')) as Record<string, string>
          : {};
        fs.writeFileSync(
          pagesManifestPath,
          JSON.stringify({ ...existingPagesManifest, ...generatedPagesManifest }, null, 2),
        );
      }
    };

    compiler.hooks.afterEmit.tap('AppPathRoutesManifestPlugin', writeManifest);
    compiler.hooks.done.tap('AppPathRoutesManifestPlugin', writeManifest);
  }
}

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
    optimizePackageImports: [
      ...(process.env.ALLTERNIT_BUILD_MODE === 'desktop' ? [] : [
        '@phosphor-icons/react',
        'lucide-react',
        'recharts',
        'antd',
      ]),
      '@radix-ui/react-icons',
    ],
  },

  // Turbopack config (used by `next dev --turbo`)
  // Note: Turbopack resolveAlias values must be relative paths (not absolute)
  turbopack: {
    resolveAlias: {
      ...turboResolveAliases,
      ...turboClerkAliases,
    },
  },

  webpack: (config, { isServer }) => {
    const isDesktopStandaloneBuild = process.env.ALLTERNIT_BUILD_MODE === 'desktop';

    // Cap filesystem cache memory usage
    if (config.cache && typeof config.cache === 'object' && config.cache.type === 'filesystem') {
      (config.cache as any).maxMemoryGenerations = 1;
      (config.cache as any).memoryCacheUnaffected = false;
    }

    // Handle .js imports resolving to .ts files (ESM pattern in monorepo)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };

    // Exclude native node addons from webpack bundling
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        if (!isDesktopStandaloneBuild) {
          config.externals.push('ssh2', 'cpu-features', 'node-ssh');
        }
      }
    }

    // FIXME: These fallbacks are needed because MCP client code imports server-only
    // modules (postgres, net, tls, etc.) into client components.
    // Proper fix: Move all MCP operations to API routes, client should only use fetch()
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, path: false, crypto: false, os: false, url: false,
        net: false, tls: false, http: false, https: false, stream: false,
        zlib: false, buffer: false, util: false, querystring: false,
        events: false, string_decoder: false, timers: false, vm: false,
        assert: false, constants: false, punycode: false, process: false,
        dns: false, dgram: false, cluster: false, module: false,
        readline: false, repl: false, sys: false, perf_hooks: false,
        async_hooks: false, diagnostics_channel: false, worker_threads: false,
        'node:fs': false, 'node:path': false, 'node:crypto': false, 'node:os': false,
        'node:url': false, 'node:net': false, 'node:tls': false, 'node:http': false,
        'node:https': false, 'node:stream': false, 'node:zlib': false, 'node:buffer': false,
        'node:util': false, 'node:querystring': false, 'node:events': false,
        'node:string_decoder': false, 'node:timers': false, 'node:vm': false,
        'node:assert': false, 'node:constants': false, 'node:punycode': false,
        'node:process': false, 'node:dns': false, 'node:dgram': false,
        'node:cluster': false, 'node:module': false, 'node:readline': false,
        'node:repl': false, 'node:sys': false, 'node:perf_hooks': false,
        'node:async_hooks': false, 'node:diagnostics_channel': false, 'node:worker_threads': false,
      };
    }

    // Add aliases for monorepo packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@allternit/runtime': resolveAliases['@allternit/runtime'],
      '@allternit/visual-state$': resolveAliases['@allternit/visual-state'],
      '@allternit/visual-state/types$': resolveAliases['@allternit/visual-state/types'],
      '@allternit/visual-state/inference$': resolveAliases['@allternit/visual-state/inference'],
      '@allternit/avatar-adapters$': resolveAliases['@allternit/avatar-adapters'],
      'react$': path.resolve(__dirname, 'node_modules/react'),
      'react-dom$': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime$': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      ...(useClerkFallback ? {
        '@clerk/nextjs$': clerkAliases['@clerk/nextjs'],
        '@clerk/nextjs/server$': clerkAliases['@clerk/nextjs/server'],
        '@clerk/clerk-react$': clerkAliases['@clerk/clerk-react'],
      } : process.env.CLOUDFLARE_PAGES === '1' ? {
        '@clerk/nextjs/server$': clerkAliases['@clerk/nextjs/server'],
        '@clerk/nextjs$': clerkAliases['@clerk/nextjs'],
        '@clerk/clerk-react$': clerkAliases['@clerk/clerk-react'],
      } : {}),
    };

    // Shim any remaining import.meta.env references (webpack builds only)
    const isDev = process.env.NODE_ENV !== 'production';

    // The packaged desktop app serves the platform from localhost only.
    // Minimization is enabled to ensure build stability in Next.js 15.
    if (isDesktopStandaloneBuild) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
      };
    }

    config.plugins.push(new webpack.DefinePlugin({
      'import.meta.env.DEV': JSON.stringify(isDev),
      'import.meta.env.PROD': JSON.stringify(!isDev),
      'import.meta.env.MODE': JSON.stringify(isDev ? 'development' : 'production'),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_API_BASE_URL || null),
      'import.meta.env.VITE_ALLTERNIT_BASE_URL': JSON.stringify(process.env.NEXT_PUBLIC_ALLTERNIT_BASE_URL || null),
      'import.meta.env.VITE_ALLTERNIT_GATEWAY_URL': JSON.stringify(process.env.NEXT_PUBLIC_ALLTERNIT_GATEWAY_URL || null),
      'import.meta.env.VITE_ENABLE_SESSION_BRIDGE': JSON.stringify(process.env.NEXT_PUBLIC_ENABLE_SESSION_BRIDGE || null),
      'import.meta.env.VITE_SESSION_BRIDGE_DEBUG': JSON.stringify(process.env.NEXT_PUBLIC_SESSION_BRIDGE_DEBUG || null),
      'import.meta.env.VITE_LOG_VALIDATION_ERRORS': JSON.stringify(process.env.NEXT_PUBLIC_LOG_VALIDATION_ERRORS || null),
      'import.meta.env.VITE_META_SWARM_API_URL': JSON.stringify(process.env.NEXT_PUBLIC_META_SWARM_API_URL || null),
      'import.meta.env.VITE_META_SWARM_HTTP_URL': JSON.stringify(process.env.NEXT_PUBLIC_META_SWARM_HTTP_URL || null),
    }));

    if (isServer) {
      config.plugins.push(new AppPathRoutesManifestPlugin());
    }

    return config;
  },

  serverExternalPackages: [
    'ssh2',
    'cpu-features',
    'node-ssh',
    'better-sqlite3',
    // node-pty: native binary used by terminal API routes
    'node-pty',
  ],

  // Exclude large binaries from output file tracing to reduce .next size
  outputFileTracingExcludes: {
    '*': [
      '../../node_modules/.pnpm/electron*/**',
      '../../node_modules/.pnpm/@swc*/**',
      '../../node_modules/.pnpm/esbuild*/**',
      '../../node_modules/.pnpm/rollup*/**',
      '../../node_modules/.pnpm/webpack*/**',
    ],
  },

  transpilePackages: [
    '@allternit/runtime',
    '@allternit/kernel',
    ...(process.env.ALLTERNIT_BUILD_MODE === 'desktop' ? [
      '@phosphor-icons/react',
      'lucide-react',
      'recharts',
      'antd',
      'mermaid',
      'motion',
      'jszip',
      '@opentelemetry/api',
    ] : [])
  ],

  output: process.env.ALLTERNIT_BUILD_MODE === 'desktop' ? 'standalone' : process.env.CLOUDFLARE_PAGES === '1' ? 'export' : undefined,
  distDir: process.env.CLOUDFLARE_PAGES === '1' ? 'out' : '.next',

  outputFileTracingRoot: path.join(__dirname, '../../'),

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
