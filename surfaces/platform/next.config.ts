import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // Handle .js imports resolving to .ts files (ESM pattern in monorepo)
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    
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
      '@a2r/runtime': path.resolve(__dirname, '../../3-adapters/runtime-adapters/a2r-runtime/dist'),
    };
    
    return config;
  },
  
  transpilePackages: [
    '@a2r/runtime',
    '@a2r/kernel',
  ],
  
  typescript: {
    ignoreBuildErrors: true,
  },
  
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
