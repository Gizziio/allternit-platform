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

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true,
  },

  webpack: (config, { isServer }) => {
    // Handle .js imports resolving to .ts files (ESM pattern in monorepo)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    
    // Exclude native node addons from webpack bundling
    config.externals = config.externals || [];
    if (Array.isArray(config.externals)) {
      config.externals.push('ssh2', 'cpu-features', 'node-ssh');
    }
    
    // FIXME: These fallbacks are needed because MCP client code imports server-only
    // modules (postgres, net, tls, etc.) into client components. 
    // Proper fix: Move all MCP operations to API routes, client should only use fetch()
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // Node.js built-ins that shouldn't be bundled for client
        fs: false,
        path: false,
        crypto: false,
        os: false,
        url: false,
        net: false,
        tls: false,
        http: false,
        https: false,
        stream: false,
        zlib: false,
        buffer: false,
        util: false,
        querystring: false,
        events: false,
        string_decoder: false,
        timers: false,
        vm: false,
        assert: false,
        constants: false,
        punycode: false,
        process: false,
        dns: false,
        dgram: false,
        cluster: false,
        module: false,
        readline: false,
        repl: false,
        sys: false,
        perf_hooks: false,
        async_hooks: false,
        diagnostics_channel: false,
        worker_threads: false,
        // Handle node: prefix
        'node:fs': false,
        'node:path': false,
        'node:crypto': false,
        'node:os': false,
        'node:url': false,
        'node:net': false,
        'node:tls': false,
        'node:http': false,
        'node:https': false,
        'node:stream': false,
        'node:zlib': false,
        'node:buffer': false,
        'node:util': false,
        'node:querystring': false,
        'node:events': false,
        'node:string_decoder': false,
        'node:timers': false,
        'node:vm': false,
        'node:assert': false,
        'node:constants': false,
        'node:punycode': false,
        'node:process': false,
        'node:dns': false,
        'node:dgram': false,
        'node:cluster': false,
        'node:module': false,
        'node:readline': false,
        'node:repl': false,
        'node:sys': false,
        'node:perf_hooks': false,
        'node:async_hooks': false,
        'node:diagnostics_channel': false,
        'node:worker_threads': false,
      };
    }
    
    // Add aliases for monorepo packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@allternit/runtime': path.resolve(__dirname, '../../3-adapters/runtime-adapters/allternit-runtime/dist'),
      '@allternit/visual-state$': path.resolve(__dirname, '../../packages/@allternit/visual-state/src/index.ts'),
      '@allternit/visual-state/types$': path.resolve(__dirname, '../../packages/@allternit/visual-state/src/types/index.ts'),
      '@allternit/visual-state/inference$': path.resolve(__dirname, '../../packages/@allternit/visual-state/src/inference/index.ts'),
      '@allternit/avatar-adapters$': path.resolve(__dirname, '../../packages/@allternit/avatar-adapters/src/index.ts'),
      'react$': path.resolve(__dirname, 'node_modules/react'),
      'react-dom$': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime$': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
    };

    if (useClerkFallback) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@clerk/nextjs$': path.resolve(__dirname, 'src/stubs/clerk/nextjs.tsx'),
        '@clerk/nextjs/server$': path.resolve(__dirname, 'src/stubs/clerk/nextjs-server.ts'),
      };
    }

    // Shim Vite's import.meta.env for Next.js compatibility
    const isDev = process.env.NODE_ENV !== 'production';
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

    return config;
  },
  
  // Exclude native node addons (.node binaries) from webpack — ssh2/cpu-features ship
  // compiled C++ binaries that webpack can't parse; keep them as server-side externals.
  serverExternalPackages: ['ssh2', 'cpu-features', 'node-ssh'],

  transpilePackages: [
    '@allternit/runtime',
    '@allternit/kernel',
  ],
  
  // standalone: generates .next/standalone/ — a minimal Node.js server that can be
  // shipped inside the Electron app without a separate node_modules directory.
  // The desktop spawns `node .next/standalone/server.js` as a subprocess.
  output: process.env.ALLTERNIT_BUILD_MODE === 'desktop' ? 'standalone' : 'export',
  distDir: process.env.ALLTERNIT_BUILD_MODE === 'desktop' ? '.next' : 'dist',
  
  // Exclude API routes from static export (they run on backend VPS)
  exportPathMap: async function(defaultPathMap, { dev, dir, outDir, distDir, buildId }) {
    // Filter out API routes for static export
    const pathMap: Record<string, { page: string }> = {};
    for (const [path, config] of Object.entries(defaultPathMap)) {
      if (!path.startsWith('/api/')) {
        pathMap[path] = config as { page: string };
      }
    }
    return pathMap;
  },

  // Fix standalone output path in monorepo — ensures all local package deps are traced
  outputFileTracingRoot: path.join(__dirname, '../../'),

  typescript: {
    ignoreBuildErrors: true,
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
