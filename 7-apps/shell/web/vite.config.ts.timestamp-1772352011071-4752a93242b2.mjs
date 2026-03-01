// vite.config.ts
import { defineConfig } from "file:///sessions/trusting-tender-davinci/mnt/a2rchitech/node_modules/.pnpm/vite@5.4.21_@types+node@20.19.33/node_modules/vite/dist/node/index.js";
import react from "file:///sessions/trusting-tender-davinci/mnt/a2rchitech/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@20.19.33_/node_modules/@vitejs/plugin-react/dist/index.js";
import { resolve, join } from "path";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { visualizer } from "file:///sessions/trusting-tender-davinci/mnt/a2rchitech/node_modules/.pnpm/rollup-plugin-visualizer@7.0.0_rolldown@1.0.0-rc.1_rollup@4.55.1/node_modules/rollup-plugin-visualizer/dist/plugin/index.js";
var __vite_injected_original_dirname = "/sessions/trusting-tender-davinci/mnt/a2rchitech/7-apps/shell/web";
var platformSrc = resolve(__vite_injected_original_dirname, "../../../6-ui/a2r-platform/src");
function toWsUrl(httpUrl) {
  return httpUrl.replace(/^http:\/\//i, "ws://").replace(/^https:\/\//i, "wss://").replace(/\/+$/, "");
}
function normalizeGatewayUrl(url) {
  return url.trim().replace(/\/api\/v1\/?$/i, "").replace(/\/+$/, "");
}
function readOpenClawConfig() {
  const defaultPort = Number(
    process.env.A2R_OPENCLAW_HOST_PORT || process.env.A2R_PORT || process.env.OPENCLAW_PORT || 18789
  );
  const defaultHost = normalizeGatewayUrl(
    process.env.A2R_OPENCLAW_HOST_URL?.trim() || process.env.OPENCLAW_HOST_URL?.trim() || `http://127.0.0.1:${defaultPort}`
  );
  const defaultWs = process.env.A2R_OPENCLAW_GATEWAY_WS_URL?.trim() || process.env.OPENCLAW_GATEWAY_WS_URL?.trim() || toWsUrl(defaultHost);
  try {
    const envPath = resolve(__vite_injected_original_dirname, "../../.openclaw.env");
    const envContent = readFileSync(envPath, "utf8");
    const readKey = (key) => {
      const match = envContent.match(new RegExp(`^${key}=([^\\r
]+)$`, "m"));
      return match?.[1]?.trim().replace(/^['"]|['"]$/g, "");
    };
    const token = readKey("A2R_GATEWAY_TOKEN") || readKey("OPENCLAW_GATEWAY_TOKEN") || null;
    const configuredPort = Number(
      readKey("A2R_OPENCLAW_HOST_PORT") || readKey("A2R_PORT") || readKey("OPENCLAW_PORT") || defaultPort
    );
    const port = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : defaultPort;
    const gatewayUrl = normalizeGatewayUrl(
      readKey("A2R_OPENCLAW_HOST_URL") || readKey("OPENCLAW_HOST_URL") || `http://127.0.0.1:${port}`
    );
    const apiBaseUrl = readKey("A2R_API_BASE_URL") || readKey("OPENCLAW_API_BASE_URL") || `${gatewayUrl}/api/v1`;
    const gatewayWsUrl = readKey("A2R_OPENCLAW_GATEWAY_WS_URL") || readKey("OPENCLAW_GATEWAY_WS_URL") || toWsUrl(gatewayUrl);
    const controlUiUrl = readKey("A2R_OPENCLAW_CONTROL_UI_URL") || readKey("OPENCLAW_CONTROL_UI_URL") || `${gatewayUrl.replace(/\/+$/, "")}/`;
    return {
      token,
      port,
      apiBaseUrl,
      gatewayUrl,
      gatewayWsUrl,
      controlUiUrl
    };
  } catch {
    const gatewayUrl = normalizeGatewayUrl(defaultHost);
    return {
      token: null,
      port: defaultPort,
      apiBaseUrl: `${gatewayUrl}/api/v1`,
      gatewayUrl,
      gatewayWsUrl: defaultWs,
      controlUiUrl: `${gatewayUrl}/`
    };
  }
}
function humanizeAgentId(agentId) {
  const words = agentId.trim().replace(/[-_]+/g, " ").split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return words.length > 0 ? words.join(" ") : "OpenClaw Agent";
}
function readJsonFile(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}
function readOpenClawAgentDiscovery() {
  const stateDir = join(homedir(), ".openclaw");
  const rootConfig = readJsonFile(join(stateDir, "openclaw.json")) || {};
  const workspacePath = rootConfig?.agents?.defaults?.workspace || null;
  const gatewayPort = typeof rootConfig?.gateway?.port === "number" ? rootConfig.gateway.port : null;
  const agentsDir = join(stateDir, "agents");
  if (!existsSync(agentsDir)) {
    return {
      agents: [],
      total: 0,
      unregistered: 0,
      state_dir: stateDir,
      workspace_path: workspacePath,
      gateway_port: gatewayPort
    };
  }
  const agents = readdirSync(agentsDir).map((entry) => join(agentsDir, entry)).filter((agentDir) => {
    try {
      return statSync(agentDir).isDirectory();
    } catch {
      return false;
    }
  }).map((agentDir) => {
    const agentId = agentDir.split("/").pop() || "agent";
    const modelsPath = join(agentDir, "agent", "models.json");
    const authProfilesPath = join(agentDir, "agent", "auth-profiles.json");
    const sessionsStorePath = join(agentDir, "sessions", "sessions.json");
    const modelsJson = readJsonFile(modelsPath) || {};
    const authProfilesJson = readJsonFile(authProfilesPath) || {};
    const models = Object.entries(modelsJson?.providers || {}).flatMap(
      ([providerId, providerData]) => Array.isArray(providerData?.models) ? providerData.models.map((model) => typeof model?.id === "string" ? `${providerId}/${model.id}` : null).filter(Boolean) : []
    );
    const authProviders = Array.from(new Set(
      Object.values(authProfilesJson?.profiles || {}).map((profile) => profile?.provider).filter((provider) => typeof provider === "string" && provider.trim().length > 0)
    )).sort();
    const primaryModel = rootConfig?.agents?.defaults?.model?.primary || models[0] || null;
    const primaryProvider = typeof primaryModel === "string" ? primaryModel.split("/")[0] || null : null;
    const sessionCount = existsSync(join(agentDir, "sessions")) ? readdirSync(join(agentDir, "sessions")).filter((name) => name.endsWith(".jsonl") && !name.includes(".deleted.")).length : 0;
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
        sessions_store: existsSync(sessionsStorePath)
      },
      registered_agent_id: null
    };
  });
  return {
    agents,
    total: agents.length,
    unregistered: agents.length,
    state_dir: stateDir,
    workspace_path: workspacePath,
    gateway_port: gatewayPort
  };
}
var openclawConfig = readOpenClawConfig();
var openclawProxyTarget = openclawConfig.gatewayUrl;
function platformAliasPlugin() {
  const exactAliases = {
    "@/lib/auth": resolve(platformSrc, "lib/auth-browser.ts"),
    "@/lib/env": resolve(platformSrc, "lib/env-browser.ts")
  };
  const aliasPrefixes = {
    "@/lib": resolve(platformSrc, "lib"),
    "@/components": resolve(platformSrc, "components"),
    "@/providers": resolve(platformSrc, "providers"),
    "@/services": resolve(platformSrc, "services"),
    "@/hooks": resolve(platformSrc, "hooks"),
    "@/shell": resolve(platformSrc, "shell"),
    "@/views": resolve(platformSrc, "views"),
    "@/nav": resolve(platformSrc, "nav"),
    "@/capsules": resolve(platformSrc, "capsules"),
    "@/drawers": resolve(platformSrc, "drawers"),
    "@/dock": resolve(platformSrc, "dock"),
    "@/runner": resolve(platformSrc, "runner"),
    "@/design": resolve(platformSrc, "design"),
    "@/integration": resolve(platformSrc, "integration"),
    "@/vendor": resolve(platformSrc, "vendor"),
    "@/qa": resolve(platformSrc, "qa"),
    "@/state": resolve(platformSrc, "state"),
    "@/surfaces": resolve(platformSrc, "surfaces"),
    "@/types": resolve(platformSrc, "types"),
    "@/app": resolve(platformSrc, "app"),
    "@/stores": resolve(platformSrc, "stores"),
    "@/agent-workspace": resolve(platformSrc, "agent-workspace"),
    "@/dev": resolve(platformSrc, "dev")
  };
  function resolveWithExtensions(basePath) {
    const extensions = [".tsx", ".ts", ".jsx", ".js"];
    for (const ext of extensions) {
      const tryPath = basePath + ext;
      if (existsSync(tryPath)) {
        return tryPath;
      }
    }
    const indexExtensions = ["/index.tsx", "/index.ts", "/index.jsx", "/index.js"];
    for (const ext of indexExtensions) {
      const tryPath = basePath + ext;
      if (existsSync(tryPath)) {
        return tryPath;
      }
    }
    return null;
  }
  return {
    name: "platform-alias",
    enforce: "pre",
    resolveId(id, importer) {
      if (!id.startsWith("@/")) return null;
      if (exactAliases[id]) {
        const resolved = exactAliases[id];
        if (existsSync(resolved)) {
          return resolved;
        }
      }
      for (const [prefix, replacement] of Object.entries(aliasPrefixes)) {
        if (id === prefix) {
          const resolved = resolveWithExtensions(replacement);
          if (resolved) return resolved;
          return replacement;
        }
        if (id.startsWith(prefix + "/")) {
          const subPath = id.slice(prefix.length + 1);
          const basePath = join(replacement, subPath);
          const resolved = resolveWithExtensions(basePath);
          if (resolved) return resolved;
          return null;
        }
      }
      return null;
    }
  };
}
function openclawConfigPlugin() {
  return {
    name: "openclaw-config",
    configureServer(server) {
      const handler = (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({
          ...openclawConfig,
          apiBaseUrl: "/a2r-api"
        }));
      };
      server.middlewares.use("/openclaw-config.json", handler);
      server.middlewares.use("/a2r-config.json", handler);
      server.middlewares.use("/api/dev/openclaw/agents/discovery", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(readOpenClawAgentDiscovery()));
      });
    }
  };
}
var isAnalyzeMode = process.env.ANALYZE === "true";
var vite_config_default = defineConfig({
  plugins: [
    platformAliasPlugin(),
    openclawConfigPlugin(),
    react(),
    // Bundle analyzer - only enabled when ANALYZE=true
    isAnalyzeMode && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: "./dist/stats.html"
    })
  ].filter(Boolean),
  define: {
    "process.env": {},
    "process.versions": { node: "20.0.0" },
    "global": "window",
    "__A2R_GATEWAY_URL__": JSON.stringify(process.env.VITE_A2R_GATEWAY_URL || "http://127.0.0.1:8013"),
    // Inject OpenClaw token at build time as well
    "__OPENCLAW_CONFIG__": JSON.stringify(openclawConfig),
    // Terminal Server URL for AI Model Gateway
    "__TERMINAL_SERVER_URL__": JSON.stringify(process.env.VITE_TERMINAL_SERVER_URL || "http://127.0.0.1:4096")
  },
  server: {
    // Pin IPv4 localhost so clients using 127.0.0.1 do not fail when Vite
    // binds IPv6 localhost (::1) by default.
    host: "127.0.0.1",
    port: 5177,
    strictPort: true,
    proxy: {
      // Health path used by legacy/quarantine OpenClaw panels.
      "/a2r-api/health": {
        target: openclawProxyTarget,
        changeOrigin: true,
        rewrite: () => "/health"
      },
      // Dedicated OpenClaw host proxy path to avoid browser CORS.
      "/a2r-api": {
        target: openclawProxyTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/a2r-api/, "/api/v1")
      },
      // Proxy Gateway API v1 calls to Terminal Server (fallback since Gateway not running)
      "/api/v1/providers": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
        rewrite: () => "/provider"
      },
      "/api/v1/sessions": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
        rewrite: () => "/session"
      },
      "/api/v1/providers/auth/status": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
        rewrite: () => "/health"
      },
      "/api/v1/agents": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      },
      // Proxy chat API calls to Terminal Server (port 4096)
      "/api/chat": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, "http://localhost");
          const chatId = url.searchParams.get("chatId");
          if (chatId) {
            return `/session/${chatId}/message`;
          }
          return path;
        },
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("[Vite Proxy] Chat Error:", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("[Vite Proxy] Chat Request:", req.method, req.url, "->", proxyReq.path);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log("[Vite Proxy] Chat Response:", proxyRes.statusCode, req.url);
          });
        }
      },
      // Proxy session management calls to Terminal Server
      "/session": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("[Vite Proxy] Session Error:", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("[Vite Proxy] Session Request:", req.method, req.url, "->", proxyReq.path);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log("[Vite Proxy] Session Response:", proxyRes.statusCode, req.url);
          });
        }
      },
      "/web-proxy": {
        target: "http://127.0.0.1:4096",
        changeOrigin: true
      },
      "/health": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Manual chunking for code splitting
        manualChunks: {
          // Core vendor chunks
          "vendor-react": ["react", "react-dom"],
          "vendor-ui": ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu", "@radix-ui/react-tabs"],
          "vendor-state": ["zustand", "@reduxjs/toolkit", "react-redux"],
          "vendor-utils": ["date-fns", "clsx", "tailwind-merge"],
          "vendor-icons": ["lucide-react", "@phosphor-icons/react"]
        },
        // Ensure chunks don't get too large
        chunkFileNames: "assets/js/[name]-[hash].js",
        entryFileNames: "assets/js/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name || "";
          if (/\.css$/.test(info)) {
            return "assets/css/[name]-[hash][extname]";
          }
          if (/\.png$|\.jpg$|\.jpeg$|\.gif$|\.svg$|\.webp$/.test(info)) {
            return "assets/images/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        }
      }
    },
    // Enable minification with terser-like settings
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug", "console.trace"]
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false
      }
    },
    // Chunk size warning
    chunkSizeWarningLimit: 500,
    // Source maps for production debugging
    sourcemap: true,
    // CSS optimization
    cssMinify: true,
    // Target modern browsers for smaller bundles
    target: "es2020"
  },
  resolve: {
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    alias: {
      "@a2r/platform": resolve(__vite_injected_original_dirname, "../../../6-ui/a2r-platform/src/index.ts"),
      // NOTE: We don't define '@' here because it's handled by platformAliasPlugin
      // to properly resolve to the platform package when imported from there
      "@a2r/runtime": resolve(__vite_injected_original_dirname, "src/shims/runtime.ts"),
      "@a2r/engine": resolve(__vite_injected_original_dirname, "src/shims/empty.ts"),
      "node:fs/promises": resolve(__vite_injected_original_dirname, "src/shims/empty.ts"),
      "node:fs": resolve(__vite_injected_original_dirname, "src/shims/empty.ts"),
      "node:path": resolve(__vite_injected_original_dirname, "src/shims/empty.ts"),
      "node:process": resolve(__vite_injected_original_dirname, "src/shims/empty.ts")
    }
  },
  optimizeDeps: {
    // Prevent stale prebundled snapshots of workspace source packages.
    exclude: ["@a2r/platform"]
  },
  // Performance hints
  esbuild: {
    logOverride: { "this-is-undefined-in-esm": "silent" }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvc2Vzc2lvbnMvdHJ1c3RpbmctdGVuZGVyLWRhdmluY2kvbW50L2EycmNoaXRlY2gvNy1hcHBzL3NoZWxsL3dlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3RydXN0aW5nLXRlbmRlci1kYXZpbmNpL21udC9hMnJjaGl0ZWNoLzctYXBwcy9zaGVsbC93ZWIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL3RydXN0aW5nLXRlbmRlci1kYXZpbmNpL21udC9hMnJjaGl0ZWNoLzctYXBwcy9zaGVsbC93ZWIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIFBsdWdpbiB9IGZyb20gJ3ZpdGUnO1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0JztcbmltcG9ydCB7IHJlc29sdmUsIGpvaW4gfSBmcm9tICdwYXRoJztcbmltcG9ydCB7IGV4aXN0c1N5bmMsIHJlYWRGaWxlU3luYywgcmVhZGRpclN5bmMsIHN0YXRTeW5jIH0gZnJvbSAnZnMnO1xuaW1wb3J0IHsgaG9tZWRpciB9IGZyb20gJ29zJztcbmltcG9ydCB7IHZpc3VhbGl6ZXIgfSBmcm9tICdyb2xsdXAtcGx1Z2luLXZpc3VhbGl6ZXInO1xuXG5jb25zdCBwbGF0Zm9ybVNyYyA9IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vLi4vLi4vNi11aS9hMnItcGxhdGZvcm0vc3JjJyk7XG5cbnR5cGUgT3BlbkNsYXdDb25maWcgPSB7XG4gIHRva2VuOiBzdHJpbmcgfCBudWxsO1xuICBwb3J0OiBudW1iZXI7XG4gIGFwaUJhc2VVcmw6IHN0cmluZztcbiAgZ2F0ZXdheVVybDogc3RyaW5nO1xuICBnYXRld2F5V3NVcmw6IHN0cmluZztcbiAgY29udHJvbFVpVXJsOiBzdHJpbmc7XG59O1xuXG5mdW5jdGlvbiB0b1dzVXJsKGh0dHBVcmw6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBodHRwVXJsXG4gICAgLnJlcGxhY2UoL15odHRwOlxcL1xcLy9pLCAnd3M6Ly8nKVxuICAgIC5yZXBsYWNlKC9eaHR0cHM6XFwvXFwvL2ksICd3c3M6Ly8nKVxuICAgIC5yZXBsYWNlKC9cXC8rJC8sICcnKTtcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplR2F0ZXdheVVybCh1cmw6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiB1cmxcbiAgICAudHJpbSgpXG4gICAgLnJlcGxhY2UoL1xcL2FwaVxcL3YxXFwvPyQvaSwgJycpXG4gICAgLnJlcGxhY2UoL1xcLyskLywgJycpO1xufVxuXG5mdW5jdGlvbiByZWFkT3BlbkNsYXdDb25maWcoKTogT3BlbkNsYXdDb25maWcge1xuICBjb25zdCBkZWZhdWx0UG9ydCA9IE51bWJlcihcbiAgICBwcm9jZXNzLmVudi5BMlJfT1BFTkNMQVdfSE9TVF9QT1JUXG4gICAgICB8fCBwcm9jZXNzLmVudi5BMlJfUE9SVFxuICAgICAgfHwgcHJvY2Vzcy5lbnYuT1BFTkNMQVdfUE9SVFxuICAgICAgfHwgMTg3ODlcbiAgKTtcbiAgY29uc3QgZGVmYXVsdEhvc3QgPSBub3JtYWxpemVHYXRld2F5VXJsKFxuICAgIHByb2Nlc3MuZW52LkEyUl9PUEVOQ0xBV19IT1NUX1VSTD8udHJpbSgpXG4gICAgfHwgcHJvY2Vzcy5lbnYuT1BFTkNMQVdfSE9TVF9VUkw/LnRyaW0oKVxuICAgIHx8IGBodHRwOi8vMTI3LjAuMC4xOiR7ZGVmYXVsdFBvcnR9YFxuICApO1xuICBjb25zdCBkZWZhdWx0V3MgPSBwcm9jZXNzLmVudi5BMlJfT1BFTkNMQVdfR0FURVdBWV9XU19VUkw/LnRyaW0oKVxuICAgIHx8IHByb2Nlc3MuZW52Lk9QRU5DTEFXX0dBVEVXQVlfV1NfVVJMPy50cmltKClcbiAgICB8fCB0b1dzVXJsKGRlZmF1bHRIb3N0KTtcblxuICB0cnkge1xuICAgIGNvbnN0IGVudlBhdGggPSByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uLy5vcGVuY2xhdy5lbnYnKTtcbiAgICBjb25zdCBlbnZDb250ZW50ID0gcmVhZEZpbGVTeW5jKGVudlBhdGgsICd1dGY4Jyk7XG4gICAgY29uc3QgcmVhZEtleSA9IChrZXk6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiB7XG4gICAgICBjb25zdCBtYXRjaCA9IGVudkNvbnRlbnQubWF0Y2gobmV3IFJlZ0V4cChgXiR7a2V5fT0oW15cXFxcclxcbl0rKSRgLCAnbScpKTtcbiAgICAgIHJldHVybiBtYXRjaD8uWzFdPy50cmltKCkucmVwbGFjZSgvXlsnXCJdfFsnXCJdJC9nLCAnJyk7XG4gICAgfTtcblxuICAgIGNvbnN0IHRva2VuID0gcmVhZEtleSgnQTJSX0dBVEVXQVlfVE9LRU4nKVxuICAgICAgfHwgcmVhZEtleSgnT1BFTkNMQVdfR0FURVdBWV9UT0tFTicpXG4gICAgICB8fCBudWxsO1xuXG4gICAgY29uc3QgY29uZmlndXJlZFBvcnQgPSBOdW1iZXIoXG4gICAgICByZWFkS2V5KCdBMlJfT1BFTkNMQVdfSE9TVF9QT1JUJylcbiAgICAgICAgfHwgcmVhZEtleSgnQTJSX1BPUlQnKVxuICAgICAgICB8fCByZWFkS2V5KCdPUEVOQ0xBV19QT1JUJylcbiAgICAgICAgfHwgZGVmYXVsdFBvcnRcbiAgICApO1xuICAgIGNvbnN0IHBvcnQgPSBOdW1iZXIuaXNGaW5pdGUoY29uZmlndXJlZFBvcnQpICYmIGNvbmZpZ3VyZWRQb3J0ID4gMFxuICAgICAgPyBjb25maWd1cmVkUG9ydFxuICAgICAgOiBkZWZhdWx0UG9ydDtcblxuICAgIGNvbnN0IGdhdGV3YXlVcmwgPSBub3JtYWxpemVHYXRld2F5VXJsKFxuICAgICAgcmVhZEtleSgnQTJSX09QRU5DTEFXX0hPU1RfVVJMJylcbiAgICAgIHx8IHJlYWRLZXkoJ09QRU5DTEFXX0hPU1RfVVJMJylcbiAgICAgIHx8IGBodHRwOi8vMTI3LjAuMC4xOiR7cG9ydH1gXG4gICAgKTtcblxuICAgIGNvbnN0IGFwaUJhc2VVcmwgPSByZWFkS2V5KCdBMlJfQVBJX0JBU0VfVVJMJylcbiAgICAgIHx8IHJlYWRLZXkoJ09QRU5DTEFXX0FQSV9CQVNFX1VSTCcpXG4gICAgICB8fCBgJHtnYXRld2F5VXJsfS9hcGkvdjFgO1xuXG4gICAgY29uc3QgZ2F0ZXdheVdzVXJsID0gcmVhZEtleSgnQTJSX09QRU5DTEFXX0dBVEVXQVlfV1NfVVJMJylcbiAgICAgIHx8IHJlYWRLZXkoJ09QRU5DTEFXX0dBVEVXQVlfV1NfVVJMJylcbiAgICAgIHx8IHRvV3NVcmwoZ2F0ZXdheVVybCk7XG5cbiAgICBjb25zdCBjb250cm9sVWlVcmwgPSByZWFkS2V5KCdBMlJfT1BFTkNMQVdfQ09OVFJPTF9VSV9VUkwnKVxuICAgICAgfHwgcmVhZEtleSgnT1BFTkNMQVdfQ09OVFJPTF9VSV9VUkwnKVxuICAgICAgfHwgYCR7Z2F0ZXdheVVybC5yZXBsYWNlKC9cXC8rJC8sICcnKX0vYDtcblxuICAgIHJldHVybiB7XG4gICAgICB0b2tlbixcbiAgICAgIHBvcnQsXG4gICAgICBhcGlCYXNlVXJsLFxuICAgICAgZ2F0ZXdheVVybCxcbiAgICAgIGdhdGV3YXlXc1VybCxcbiAgICAgIGNvbnRyb2xVaVVybCxcbiAgICB9O1xuICB9IGNhdGNoIHtcbiAgICBjb25zdCBnYXRld2F5VXJsID0gbm9ybWFsaXplR2F0ZXdheVVybChkZWZhdWx0SG9zdCk7XG4gICAgcmV0dXJuIHtcbiAgICAgIHRva2VuOiBudWxsLFxuICAgICAgcG9ydDogZGVmYXVsdFBvcnQsXG4gICAgICBhcGlCYXNlVXJsOiBgJHtnYXRld2F5VXJsfS9hcGkvdjFgLFxuICAgICAgZ2F0ZXdheVVybCxcbiAgICAgIGdhdGV3YXlXc1VybDogZGVmYXVsdFdzLFxuICAgICAgY29udHJvbFVpVXJsOiBgJHtnYXRld2F5VXJsfS9gLFxuICAgIH07XG4gIH1cbn1cblxudHlwZSBPcGVuQ2xhd0Rpc2NvdmVyeVJlY29yZCA9IHtcbiAgYWdlbnRfaWQ6IHN0cmluZztcbiAgZGlzcGxheV9uYW1lOiBzdHJpbmc7XG4gIGFnZW50X2Rpcjogc3RyaW5nO1xuICB3b3Jrc3BhY2VfcGF0aDogc3RyaW5nIHwgbnVsbDtcbiAgc2Vzc2lvbl9jb3VudDogbnVtYmVyO1xuICBhdXRoX3Byb3ZpZGVyczogc3RyaW5nW107XG4gIG1vZGVsczogc3RyaW5nW107XG4gIHByaW1hcnlfbW9kZWw6IHN0cmluZyB8IG51bGw7XG4gIHByaW1hcnlfcHJvdmlkZXI6IHN0cmluZyB8IG51bGw7XG4gIGZpbGVzOiB7XG4gICAgbW9kZWxzOiBib29sZWFuO1xuICAgIGF1dGhfcHJvZmlsZXM6IGJvb2xlYW47XG4gICAgc2Vzc2lvbnNfc3RvcmU6IGJvb2xlYW47XG4gIH07XG4gIHJlZ2lzdGVyZWRfYWdlbnRfaWQ6IG51bGw7XG59O1xuXG5mdW5jdGlvbiBodW1hbml6ZUFnZW50SWQoYWdlbnRJZDogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3Qgd29yZHMgPSBhZ2VudElkXG4gICAgLnRyaW0oKVxuICAgIC5yZXBsYWNlKC9bLV9dKy9nLCAnICcpXG4gICAgLnNwbGl0KC9cXHMrLylcbiAgICAuZmlsdGVyKEJvb2xlYW4pXG4gICAgLm1hcCgod29yZCkgPT4gd29yZC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHdvcmQuc2xpY2UoMSkpO1xuXG4gIHJldHVybiB3b3Jkcy5sZW5ndGggPiAwID8gd29yZHMuam9pbignICcpIDogJ09wZW5DbGF3IEFnZW50Jztcbn1cblxuZnVuY3Rpb24gcmVhZEpzb25GaWxlKHBhdGg6IHN0cmluZyk6IGFueSB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKHBhdGgsICd1dGY4JykpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5mdW5jdGlvbiByZWFkT3BlbkNsYXdBZ2VudERpc2NvdmVyeSgpOiB7XG4gIGFnZW50czogT3BlbkNsYXdEaXNjb3ZlcnlSZWNvcmRbXTtcbiAgdG90YWw6IG51bWJlcjtcbiAgdW5yZWdpc3RlcmVkOiBudW1iZXI7XG4gIHN0YXRlX2Rpcjogc3RyaW5nO1xuICB3b3Jrc3BhY2VfcGF0aDogc3RyaW5nIHwgbnVsbDtcbiAgZ2F0ZXdheV9wb3J0OiBudW1iZXIgfCBudWxsO1xufSB7XG4gIGNvbnN0IHN0YXRlRGlyID0gam9pbihob21lZGlyKCksICcub3BlbmNsYXcnKTtcbiAgY29uc3Qgcm9vdENvbmZpZyA9IHJlYWRKc29uRmlsZShqb2luKHN0YXRlRGlyLCAnb3BlbmNsYXcuanNvbicpKSB8fCB7fTtcbiAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IHJvb3RDb25maWc/LmFnZW50cz8uZGVmYXVsdHM/LndvcmtzcGFjZSB8fCBudWxsO1xuICBjb25zdCBnYXRld2F5UG9ydCA9IHR5cGVvZiByb290Q29uZmlnPy5nYXRld2F5Py5wb3J0ID09PSAnbnVtYmVyJ1xuICAgID8gcm9vdENvbmZpZy5nYXRld2F5LnBvcnRcbiAgICA6IG51bGw7XG4gIGNvbnN0IGFnZW50c0RpciA9IGpvaW4oc3RhdGVEaXIsICdhZ2VudHMnKTtcblxuICBpZiAoIWV4aXN0c1N5bmMoYWdlbnRzRGlyKSkge1xuICAgIHJldHVybiB7XG4gICAgICBhZ2VudHM6IFtdLFxuICAgICAgdG90YWw6IDAsXG4gICAgICB1bnJlZ2lzdGVyZWQ6IDAsXG4gICAgICBzdGF0ZV9kaXI6IHN0YXRlRGlyLFxuICAgICAgd29ya3NwYWNlX3BhdGg6IHdvcmtzcGFjZVBhdGgsXG4gICAgICBnYXRld2F5X3BvcnQ6IGdhdGV3YXlQb3J0LFxuICAgIH07XG4gIH1cblxuICBjb25zdCBhZ2VudHMgPSByZWFkZGlyU3luYyhhZ2VudHNEaXIpXG4gICAgLm1hcCgoZW50cnkpID0+IGpvaW4oYWdlbnRzRGlyLCBlbnRyeSkpXG4gICAgLmZpbHRlcigoYWdlbnREaXIpID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBzdGF0U3luYyhhZ2VudERpcikuaXNEaXJlY3RvcnkoKTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSlcbiAgICAubWFwKChhZ2VudERpcikgPT4ge1xuICAgICAgY29uc3QgYWdlbnRJZCA9IGFnZW50RGlyLnNwbGl0KCcvJykucG9wKCkgfHwgJ2FnZW50JztcbiAgICAgIGNvbnN0IG1vZGVsc1BhdGggPSBqb2luKGFnZW50RGlyLCAnYWdlbnQnLCAnbW9kZWxzLmpzb24nKTtcbiAgICAgIGNvbnN0IGF1dGhQcm9maWxlc1BhdGggPSBqb2luKGFnZW50RGlyLCAnYWdlbnQnLCAnYXV0aC1wcm9maWxlcy5qc29uJyk7XG4gICAgICBjb25zdCBzZXNzaW9uc1N0b3JlUGF0aCA9IGpvaW4oYWdlbnREaXIsICdzZXNzaW9ucycsICdzZXNzaW9ucy5qc29uJyk7XG4gICAgICBjb25zdCBtb2RlbHNKc29uID0gcmVhZEpzb25GaWxlKG1vZGVsc1BhdGgpIHx8IHt9O1xuICAgICAgY29uc3QgYXV0aFByb2ZpbGVzSnNvbiA9IHJlYWRKc29uRmlsZShhdXRoUHJvZmlsZXNQYXRoKSB8fCB7fTtcblxuICAgICAgY29uc3QgbW9kZWxzID0gT2JqZWN0LmVudHJpZXMobW9kZWxzSnNvbj8ucHJvdmlkZXJzIHx8IHt9KS5mbGF0TWFwKFxuICAgICAgICAoW3Byb3ZpZGVySWQsIHByb3ZpZGVyRGF0YV0pID0+XG4gICAgICAgICAgQXJyYXkuaXNBcnJheSgocHJvdmlkZXJEYXRhIGFzIGFueSk/Lm1vZGVscylcbiAgICAgICAgICAgID8gKHByb3ZpZGVyRGF0YSBhcyBhbnkpLm1vZGVsc1xuICAgICAgICAgICAgICAgIC5tYXAoKG1vZGVsOiBhbnkpID0+IHR5cGVvZiBtb2RlbD8uaWQgPT09ICdzdHJpbmcnXG4gICAgICAgICAgICAgICAgICA/IGAke3Byb3ZpZGVySWR9LyR7bW9kZWwuaWR9YFxuICAgICAgICAgICAgICAgICAgOiBudWxsKVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoQm9vbGVhbilcbiAgICAgICAgICAgIDogW10sXG4gICAgICApO1xuICAgICAgY29uc3QgYXV0aFByb3ZpZGVycyA9IEFycmF5LmZyb20obmV3IFNldChcbiAgICAgICAgT2JqZWN0LnZhbHVlcyhhdXRoUHJvZmlsZXNKc29uPy5wcm9maWxlcyB8fCB7fSlcbiAgICAgICAgICAubWFwKChwcm9maWxlOiBhbnkpID0+IHByb2ZpbGU/LnByb3ZpZGVyKVxuICAgICAgICAgIC5maWx0ZXIoKHByb3ZpZGVyOiB1bmtub3duKTogcHJvdmlkZXIgaXMgc3RyaW5nID0+IHR5cGVvZiBwcm92aWRlciA9PT0gJ3N0cmluZycgJiYgcHJvdmlkZXIudHJpbSgpLmxlbmd0aCA+IDApLFxuICAgICAgKSkuc29ydCgpO1xuICAgICAgY29uc3QgcHJpbWFyeU1vZGVsID0gcm9vdENvbmZpZz8uYWdlbnRzPy5kZWZhdWx0cz8ubW9kZWw/LnByaW1hcnkgfHwgbW9kZWxzWzBdIHx8IG51bGw7XG4gICAgICBjb25zdCBwcmltYXJ5UHJvdmlkZXIgPSB0eXBlb2YgcHJpbWFyeU1vZGVsID09PSAnc3RyaW5nJ1xuICAgICAgICA/IHByaW1hcnlNb2RlbC5zcGxpdCgnLycpWzBdIHx8IG51bGxcbiAgICAgICAgOiBudWxsO1xuICAgICAgY29uc3Qgc2Vzc2lvbkNvdW50ID0gZXhpc3RzU3luYyhqb2luKGFnZW50RGlyLCAnc2Vzc2lvbnMnKSlcbiAgICAgICAgPyByZWFkZGlyU3luYyhqb2luKGFnZW50RGlyLCAnc2Vzc2lvbnMnKSkuZmlsdGVyKChuYW1lKSA9PiBuYW1lLmVuZHNXaXRoKCcuanNvbmwnKSAmJiAhbmFtZS5pbmNsdWRlcygnLmRlbGV0ZWQuJykpLmxlbmd0aFxuICAgICAgICA6IDA7XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGFnZW50X2lkOiBhZ2VudElkLFxuICAgICAgICBkaXNwbGF5X25hbWU6IGh1bWFuaXplQWdlbnRJZChhZ2VudElkKSxcbiAgICAgICAgYWdlbnRfZGlyOiBhZ2VudERpcixcbiAgICAgICAgd29ya3NwYWNlX3BhdGg6IHdvcmtzcGFjZVBhdGgsXG4gICAgICAgIHNlc3Npb25fY291bnQ6IHNlc3Npb25Db3VudCxcbiAgICAgICAgYXV0aF9wcm92aWRlcnM6IGF1dGhQcm92aWRlcnMsXG4gICAgICAgIG1vZGVscyxcbiAgICAgICAgcHJpbWFyeV9tb2RlbDogcHJpbWFyeU1vZGVsLFxuICAgICAgICBwcmltYXJ5X3Byb3ZpZGVyOiBwcmltYXJ5UHJvdmlkZXIsXG4gICAgICAgIGZpbGVzOiB7XG4gICAgICAgICAgbW9kZWxzOiBleGlzdHNTeW5jKG1vZGVsc1BhdGgpLFxuICAgICAgICAgIGF1dGhfcHJvZmlsZXM6IGV4aXN0c1N5bmMoYXV0aFByb2ZpbGVzUGF0aCksXG4gICAgICAgICAgc2Vzc2lvbnNfc3RvcmU6IGV4aXN0c1N5bmMoc2Vzc2lvbnNTdG9yZVBhdGgpLFxuICAgICAgICB9LFxuICAgICAgICByZWdpc3RlcmVkX2FnZW50X2lkOiBudWxsLFxuICAgICAgfSBzYXRpc2ZpZXMgT3BlbkNsYXdEaXNjb3ZlcnlSZWNvcmQ7XG4gICAgfSk7XG5cbiAgcmV0dXJuIHtcbiAgICBhZ2VudHMsXG4gICAgdG90YWw6IGFnZW50cy5sZW5ndGgsXG4gICAgdW5yZWdpc3RlcmVkOiBhZ2VudHMubGVuZ3RoLFxuICAgIHN0YXRlX2Rpcjogc3RhdGVEaXIsXG4gICAgd29ya3NwYWNlX3BhdGg6IHdvcmtzcGFjZVBhdGgsXG4gICAgZ2F0ZXdheV9wb3J0OiBnYXRld2F5UG9ydCxcbiAgfTtcbn1cblxuY29uc3Qgb3BlbmNsYXdDb25maWcgPSByZWFkT3BlbkNsYXdDb25maWcoKTtcbmNvbnN0IG9wZW5jbGF3UHJveHlUYXJnZXQgPSBvcGVuY2xhd0NvbmZpZy5nYXRld2F5VXJsO1xuXG4vLyBDdXN0b20gcGx1Z2luIHRvIHJlc29sdmUgQC8gaW1wb3J0cyBmcm9tIEBhMnIvcGxhdGZvcm1cbmZ1bmN0aW9uIHBsYXRmb3JtQWxpYXNQbHVnaW4oKTogUGx1Z2luIHtcbiAgLy8gRXhhY3QgbWF0Y2hlcyB0YWtlIHByaW9yaXR5XG4gIGNvbnN0IGV4YWN0QWxpYXNlczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAnQC9saWIvYXV0aCc6IHJlc29sdmUocGxhdGZvcm1TcmMsICdsaWIvYXV0aC1icm93c2VyLnRzJyksXG4gICAgJ0AvbGliL2Vudic6IHJlc29sdmUocGxhdGZvcm1TcmMsICdsaWIvZW52LWJyb3dzZXIudHMnKSxcbiAgfTtcbiAgXG4gIC8vIFByZWZpeCBtYXRjaGVzIGZvciBkaXJlY3Rvcmllc1xuICBjb25zdCBhbGlhc1ByZWZpeGVzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge1xuICAgICdAL2xpYic6IHJlc29sdmUocGxhdGZvcm1TcmMsICdsaWInKSxcbiAgICAnQC9jb21wb25lbnRzJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ2NvbXBvbmVudHMnKSxcbiAgICAnQC9wcm92aWRlcnMnOiByZXNvbHZlKHBsYXRmb3JtU3JjLCAncHJvdmlkZXJzJyksXG4gICAgJ0Avc2VydmljZXMnOiByZXNvbHZlKHBsYXRmb3JtU3JjLCAnc2VydmljZXMnKSxcbiAgICAnQC9ob29rcyc6IHJlc29sdmUocGxhdGZvcm1TcmMsICdob29rcycpLFxuICAgICdAL3NoZWxsJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ3NoZWxsJyksXG4gICAgJ0Avdmlld3MnOiByZXNvbHZlKHBsYXRmb3JtU3JjLCAndmlld3MnKSxcbiAgICAnQC9uYXYnOiByZXNvbHZlKHBsYXRmb3JtU3JjLCAnbmF2JyksXG4gICAgJ0AvY2Fwc3VsZXMnOiByZXNvbHZlKHBsYXRmb3JtU3JjLCAnY2Fwc3VsZXMnKSxcbiAgICAnQC9kcmF3ZXJzJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ2RyYXdlcnMnKSxcbiAgICAnQC9kb2NrJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ2RvY2snKSxcbiAgICAnQC9ydW5uZXInOiByZXNvbHZlKHBsYXRmb3JtU3JjLCAncnVubmVyJyksXG4gICAgJ0AvZGVzaWduJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ2Rlc2lnbicpLFxuICAgICdAL2ludGVncmF0aW9uJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ2ludGVncmF0aW9uJyksXG4gICAgJ0AvdmVuZG9yJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ3ZlbmRvcicpLFxuICAgICdAL3FhJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ3FhJyksXG4gICAgJ0Avc3RhdGUnOiByZXNvbHZlKHBsYXRmb3JtU3JjLCAnc3RhdGUnKSxcbiAgICAnQC9zdXJmYWNlcyc6IHJlc29sdmUocGxhdGZvcm1TcmMsICdzdXJmYWNlcycpLFxuICAgICdAL3R5cGVzJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ3R5cGVzJyksXG4gICAgJ0AvYXBwJzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ2FwcCcpLFxuICAgICdAL3N0b3Jlcyc6IHJlc29sdmUocGxhdGZvcm1TcmMsICdzdG9yZXMnKSxcbiAgICAnQC9hZ2VudC13b3Jrc3BhY2UnOiByZXNvbHZlKHBsYXRmb3JtU3JjLCAnYWdlbnQtd29ya3NwYWNlJyksXG4gICAgJ0AvZGV2JzogcmVzb2x2ZShwbGF0Zm9ybVNyYywgJ2RldicpLFxuICB9O1xuXG4gIGZ1bmN0aW9uIHJlc29sdmVXaXRoRXh0ZW5zaW9ucyhiYXNlUGF0aDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gICAgY29uc3QgZXh0ZW5zaW9ucyA9IFsnLnRzeCcsICcudHMnLCAnLmpzeCcsICcuanMnXTtcbiAgICBcbiAgICAvLyBGaXJzdCB0cnkgZGlyZWN0IGZpbGUgd2l0aCBleHRlbnNpb25zXG4gICAgZm9yIChjb25zdCBleHQgb2YgZXh0ZW5zaW9ucykge1xuICAgICAgY29uc3QgdHJ5UGF0aCA9IGJhc2VQYXRoICsgZXh0O1xuICAgICAgaWYgKGV4aXN0c1N5bmModHJ5UGF0aCkpIHtcbiAgICAgICAgcmV0dXJuIHRyeVBhdGg7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIC8vIFRoZW4gdHJ5IGFzIGRpcmVjdG9yeSB3aXRoIGluZGV4IGZpbGVzXG4gICAgY29uc3QgaW5kZXhFeHRlbnNpb25zID0gWycvaW5kZXgudHN4JywgJy9pbmRleC50cycsICcvaW5kZXguanN4JywgJy9pbmRleC5qcyddO1xuICAgIGZvciAoY29uc3QgZXh0IG9mIGluZGV4RXh0ZW5zaW9ucykge1xuICAgICAgY29uc3QgdHJ5UGF0aCA9IGJhc2VQYXRoICsgZXh0O1xuICAgICAgaWYgKGV4aXN0c1N5bmModHJ5UGF0aCkpIHtcbiAgICAgICAgcmV0dXJuIHRyeVBhdGg7XG4gICAgICB9XG4gICAgfVxuICAgIFxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAncGxhdGZvcm0tYWxpYXMnLFxuICAgIGVuZm9yY2U6ICdwcmUnLFxuICAgIHJlc29sdmVJZChpZDogc3RyaW5nLCBpbXBvcnRlcj86IHN0cmluZykge1xuICAgICAgaWYgKCFpZC5zdGFydHNXaXRoKCdALycpKSByZXR1cm4gbnVsbDtcbiAgICAgIFxuICAgICAgLy8gQ2hlY2sgZXhhY3QgbWF0Y2hlcyBmaXJzdFxuICAgICAgaWYgKGV4YWN0QWxpYXNlc1tpZF0pIHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBleGFjdEFsaWFzZXNbaWRdO1xuICAgICAgICBpZiAoZXhpc3RzU3luYyhyZXNvbHZlZCkpIHtcbiAgICAgICAgICByZXR1cm4gcmVzb2x2ZWQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gVGhlbiBjaGVjayBwcmVmaXggbWF0Y2hlc1xuICAgICAgZm9yIChjb25zdCBbcHJlZml4LCByZXBsYWNlbWVudF0gb2YgT2JqZWN0LmVudHJpZXMoYWxpYXNQcmVmaXhlcykpIHtcbiAgICAgICAgaWYgKGlkID09PSBwcmVmaXgpIHtcbiAgICAgICAgICAvLyBFeGFjdCBtYXRjaCB0byBhIGRpcmVjdG9yeSAtIHRyeSB0byByZXNvbHZlIGFzIGRpcmVjdG9yeVxuICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gcmVzb2x2ZVdpdGhFeHRlbnNpb25zKHJlcGxhY2VtZW50KTtcbiAgICAgICAgICBpZiAocmVzb2x2ZWQpIHJldHVybiByZXNvbHZlZDtcbiAgICAgICAgICByZXR1cm4gcmVwbGFjZW1lbnQ7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlkLnN0YXJ0c1dpdGgocHJlZml4ICsgJy8nKSkge1xuICAgICAgICAgIC8vIEdldCB0aGUgcGF0aCBhZnRlciB0aGUgcHJlZml4XG4gICAgICAgICAgY29uc3Qgc3ViUGF0aCA9IGlkLnNsaWNlKHByZWZpeC5sZW5ndGggKyAxKTsgLy8gKzEgZm9yIHRoZSAnLydcbiAgICAgICAgICBjb25zdCBiYXNlUGF0aCA9IGpvaW4ocmVwbGFjZW1lbnQsIHN1YlBhdGgpO1xuICAgICAgICAgIFxuICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gcmVzb2x2ZVdpdGhFeHRlbnNpb25zKGJhc2VQYXRoKTtcbiAgICAgICAgICBpZiAocmVzb2x2ZWQpIHJldHVybiByZXNvbHZlZDtcbiAgICAgICAgICBcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gUGx1Z2luIHRvIHNlcnZlIE9wZW5DbGF3IGNvbmZpZ1xuZnVuY3Rpb24gb3BlbmNsYXdDb25maWdQbHVnaW4oKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnb3BlbmNsYXctY29uZmlnJyxcbiAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XG4gICAgICBjb25zdCBoYW5kbGVyID0gKF9yZXE6IHVua25vd24sIHJlczogeyBzZXRIZWFkZXI6IChrOiBzdHJpbmcsIHY6IHN0cmluZykgPT4gdm9pZDsgZW5kOiAoYm9keTogc3RyaW5nKSA9PiB2b2lkIH0pID0+IHtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgLi4ub3BlbmNsYXdDb25maWcsXG4gICAgICAgICAgYXBpQmFzZVVybDogJy9hMnItYXBpJyxcbiAgICAgICAgfSkpO1xuICAgICAgfTtcblxuICAgICAgLy8gS2VlcCBsZWdhY3kgYW5kIG5ldyBwYXRocyB0byBhdm9pZCBVSS92ZXJzaW9uIG1pc21hdGNoZXMuXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKCcvb3BlbmNsYXctY29uZmlnLmpzb24nLCBoYW5kbGVyKTtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoJy9hMnItY29uZmlnLmpzb24nLCBoYW5kbGVyKTtcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoJy9hcGkvZGV2L29wZW5jbGF3L2FnZW50cy9kaXNjb3ZlcnknLCAoX3JlcSwgcmVzKSA9PiB7XG4gICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkocmVhZE9wZW5DbGF3QWdlbnREaXNjb3ZlcnkoKSkpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gQ2hlY2sgaWYgd2Ugc2hvdWxkIGVuYWJsZSBidW5kbGUgYW5hbHl6ZXJcbmNvbnN0IGlzQW5hbHl6ZU1vZGUgPSBwcm9jZXNzLmVudi5BTkFMWVpFID09PSAndHJ1ZSc7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtcbiAgICBwbGF0Zm9ybUFsaWFzUGx1Z2luKCksXG4gICAgb3BlbmNsYXdDb25maWdQbHVnaW4oKSxcbiAgICByZWFjdCgpLFxuICAgIC8vIEJ1bmRsZSBhbmFseXplciAtIG9ubHkgZW5hYmxlZCB3aGVuIEFOQUxZWkU9dHJ1ZVxuICAgIGlzQW5hbHl6ZU1vZGUgJiYgdmlzdWFsaXplcih7XG4gICAgICBvcGVuOiB0cnVlLFxuICAgICAgZ3ppcFNpemU6IHRydWUsXG4gICAgICBicm90bGlTaXplOiB0cnVlLFxuICAgICAgZmlsZW5hbWU6ICcuL2Rpc3Qvc3RhdHMuaHRtbCcsXG4gICAgfSksXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxuICBkZWZpbmU6IHtcbiAgICAncHJvY2Vzcy5lbnYnOiB7fSxcbiAgICAncHJvY2Vzcy52ZXJzaW9ucyc6IHsgbm9kZTogJzIwLjAuMCcgfSxcbiAgICAnZ2xvYmFsJzogJ3dpbmRvdycsXG4gICAgJ19fQTJSX0dBVEVXQVlfVVJMX18nOiBKU09OLnN0cmluZ2lmeShwcm9jZXNzLmVudi5WSVRFX0EyUl9HQVRFV0FZX1VSTCB8fCAnaHR0cDovLzEyNy4wLjAuMTo4MDEzJyksXG4gICAgLy8gSW5qZWN0IE9wZW5DbGF3IHRva2VuIGF0IGJ1aWxkIHRpbWUgYXMgd2VsbFxuICAgICdfX09QRU5DTEFXX0NPTkZJR19fJzogSlNPTi5zdHJpbmdpZnkob3BlbmNsYXdDb25maWcpLFxuICAgIC8vIFRlcm1pbmFsIFNlcnZlciBVUkwgZm9yIEFJIE1vZGVsIEdhdGV3YXlcbiAgICAnX19URVJNSU5BTF9TRVJWRVJfVVJMX18nOiBKU09OLnN0cmluZ2lmeShwcm9jZXNzLmVudi5WSVRFX1RFUk1JTkFMX1NFUlZFUl9VUkwgfHwgJ2h0dHA6Ly8xMjcuMC4wLjE6NDA5NicpLFxuICB9LFxuICBzZXJ2ZXI6IHtcbiAgICAvLyBQaW4gSVB2NCBsb2NhbGhvc3Qgc28gY2xpZW50cyB1c2luZyAxMjcuMC4wLjEgZG8gbm90IGZhaWwgd2hlbiBWaXRlXG4gICAgLy8gYmluZHMgSVB2NiBsb2NhbGhvc3QgKDo6MSkgYnkgZGVmYXVsdC5cbiAgICBob3N0OiAnMTI3LjAuMC4xJyxcbiAgICBwb3J0OiA1MTc3LFxuICAgIHN0cmljdFBvcnQ6IHRydWUsXG4gICAgcHJveHk6IHtcbiAgICAgIC8vIEhlYWx0aCBwYXRoIHVzZWQgYnkgbGVnYWN5L3F1YXJhbnRpbmUgT3BlbkNsYXcgcGFuZWxzLlxuICAgICAgJy9hMnItYXBpL2hlYWx0aCc6IHtcbiAgICAgICAgdGFyZ2V0OiBvcGVuY2xhd1Byb3h5VGFyZ2V0LFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHJld3JpdGU6ICgpID0+ICcvaGVhbHRoJyxcbiAgICAgIH0sXG4gICAgICAvLyBEZWRpY2F0ZWQgT3BlbkNsYXcgaG9zdCBwcm94eSBwYXRoIHRvIGF2b2lkIGJyb3dzZXIgQ09SUy5cbiAgICAgICcvYTJyLWFwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiBvcGVuY2xhd1Byb3h5VGFyZ2V0LFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hMnItYXBpLywgJy9hcGkvdjEnKSxcbiAgICAgIH0sXG4gICAgICAvLyBQcm94eSBHYXRld2F5IEFQSSB2MSBjYWxscyB0byBUZXJtaW5hbCBTZXJ2ZXIgKGZhbGxiYWNrIHNpbmNlIEdhdGV3YXkgbm90IHJ1bm5pbmcpXG4gICAgICAnL2FwaS92MS9wcm92aWRlcnMnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6NDA5NicsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgcmV3cml0ZTogKCkgPT4gJy9wcm92aWRlcicsXG4gICAgICB9LFxuICAgICAgJy9hcGkvdjEvc2Vzc2lvbnMnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6NDA5NicsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgcmV3cml0ZTogKCkgPT4gJy9zZXNzaW9uJyxcbiAgICAgIH0sXG4gICAgICAnL2FwaS92MS9wcm92aWRlcnMvYXV0aC9zdGF0dXMnOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6NDA5NicsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgcmV3cml0ZTogKCkgPT4gJy9oZWFsdGgnLFxuICAgICAgfSxcbiAgICAgICcvYXBpL3YxL2FnZW50cyc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTozMDAwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIC8vIFByb3h5IGNoYXQgQVBJIGNhbGxzIHRvIFRlcm1pbmFsIFNlcnZlciAocG9ydCA0MDk2KVxuICAgICAgJy9hcGkvY2hhdCc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo0MDk2JyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4ge1xuICAgICAgICAgIC8vIE1hcCAvYXBpL2NoYXQ/Y2hhdElkPXh4eCB0byAvc2Vzc2lvbi94eHgvbWVzc2FnZSBmb3IgVGVybWluYWwgU2VydmVyXG4gICAgICAgICAgY29uc3QgdXJsID0gbmV3IFVSTChwYXRoLCAnaHR0cDovL2xvY2FsaG9zdCcpO1xuICAgICAgICAgIGNvbnN0IGNoYXRJZCA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdjaGF0SWQnKTtcbiAgICAgICAgICBpZiAoY2hhdElkKSB7XG4gICAgICAgICAgICByZXR1cm4gYC9zZXNzaW9uLyR7Y2hhdElkfS9tZXNzYWdlYDtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuIHBhdGg7XG4gICAgICAgIH0sXG4gICAgICAgIGNvbmZpZ3VyZTogKHByb3h5LCBfb3B0aW9ucykgPT4ge1xuICAgICAgICAgIHByb3h5Lm9uKCdlcnJvcicsIChlcnIsIF9yZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVml0ZSBQcm94eV0gQ2hhdCBFcnJvcjonLCBlcnIpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIHByb3h5Lm9uKCdwcm94eVJlcScsIChwcm94eVJlcSwgcmVxLCBfcmVzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1ZpdGUgUHJveHldIENoYXQgUmVxdWVzdDonLCByZXEubWV0aG9kLCByZXEudXJsLCAnLT4nLCBwcm94eVJlcS5wYXRoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXMnLCAocHJveHlSZXMsIHJlcSwgX3JlcykgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tWaXRlIFByb3h5XSBDaGF0IFJlc3BvbnNlOicsIHByb3h5UmVzLnN0YXR1c0NvZGUsIHJlcS51cmwpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIC8vIFByb3h5IHNlc3Npb24gbWFuYWdlbWVudCBjYWxscyB0byBUZXJtaW5hbCBTZXJ2ZXJcbiAgICAgICcvc2Vzc2lvbic6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo0MDk2JyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICBjb25maWd1cmU6IChwcm94eSwgX29wdGlvbnMpID0+IHtcbiAgICAgICAgICBwcm94eS5vbignZXJyb3InLCAoZXJyLCBfcmVxLCBfcmVzKSA9PiB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW1ZpdGUgUHJveHldIFNlc3Npb24gRXJyb3I6JywgZXJyKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBwcm94eS5vbigncHJveHlSZXEnLCAocHJveHlSZXEsIHJlcSwgX3JlcykgPT4ge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tWaXRlIFByb3h5XSBTZXNzaW9uIFJlcXVlc3Q6JywgcmVxLm1ldGhvZCwgcmVxLnVybCwgJy0+JywgcHJveHlSZXEucGF0aCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcHJveHkub24oJ3Byb3h5UmVzJywgKHByb3h5UmVzLCByZXEsIF9yZXMpID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbVml0ZSBQcm94eV0gU2Vzc2lvbiBSZXNwb25zZTonLCBwcm94eVJlcy5zdGF0dXNDb2RlLCByZXEudXJsKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICAnL3dlYi1wcm94eSc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo0MDk2JyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgfSxcbiAgICAgICcvaGVhbHRoJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjMwMDAnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIC8vIE1hbnVhbCBjaHVua2luZyBmb3IgY29kZSBzcGxpdHRpbmdcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgLy8gQ29yZSB2ZW5kb3IgY2h1bmtzXG4gICAgICAgICAgJ3ZlbmRvci1yZWFjdCc6IFsncmVhY3QnLCAncmVhY3QtZG9tJ10sXG4gICAgICAgICAgJ3ZlbmRvci11aSc6IFsnQHJhZGl4LXVpL3JlYWN0LWRpYWxvZycsICdAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudScsICdAcmFkaXgtdWkvcmVhY3QtdGFicyddLFxuICAgICAgICAgICd2ZW5kb3Itc3RhdGUnOiBbJ3p1c3RhbmQnLCAnQHJlZHV4anMvdG9vbGtpdCcsICdyZWFjdC1yZWR1eCddLFxuICAgICAgICAgICd2ZW5kb3ItdXRpbHMnOiBbJ2RhdGUtZm5zJywgJ2Nsc3gnLCAndGFpbHdpbmQtbWVyZ2UnXSxcbiAgICAgICAgICAndmVuZG9yLWljb25zJzogWydsdWNpZGUtcmVhY3QnLCAnQHBob3NwaG9yLWljb25zL3JlYWN0J10sXG4gICAgICAgIH0sXG4gICAgICAgIC8vIEVuc3VyZSBjaHVua3MgZG9uJ3QgZ2V0IHRvbyBsYXJnZVxuICAgICAgICBjaHVua0ZpbGVOYW1lczogJ2Fzc2V0cy9qcy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgZW50cnlGaWxlTmFtZXM6ICdhc3NldHMvanMvW25hbWVdLVtoYXNoXS5qcycsXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzOiAoYXNzZXRJbmZvKSA9PiB7XG4gICAgICAgICAgY29uc3QgaW5mbyA9IGFzc2V0SW5mby5uYW1lIHx8ICcnO1xuICAgICAgICAgIGlmICgvXFwuY3NzJC8udGVzdChpbmZvKSkge1xuICAgICAgICAgICAgcmV0dXJuICdhc3NldHMvY3NzL1tuYW1lXS1baGFzaF1bZXh0bmFtZV0nO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoL1xcLnBuZyR8XFwuanBnJHxcXC5qcGVnJHxcXC5naWYkfFxcLnN2ZyR8XFwud2VicCQvLnRlc3QoaW5mbykpIHtcbiAgICAgICAgICAgIHJldHVybiAnYXNzZXRzL2ltYWdlcy9bbmFtZV0tW2hhc2hdW2V4dG5hbWVdJztcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuICdhc3NldHMvW25hbWVdLVtoYXNoXVtleHRuYW1lXSc7XG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gICAgLy8gRW5hYmxlIG1pbmlmaWNhdGlvbiB3aXRoIHRlcnNlci1saWtlIHNldHRpbmdzXG4gICAgbWluaWZ5OiAndGVyc2VyJyxcbiAgICB0ZXJzZXJPcHRpb25zOiB7XG4gICAgICBjb21wcmVzczoge1xuICAgICAgICBkcm9wX2NvbnNvbGU6IHRydWUsXG4gICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWUsXG4gICAgICAgIHB1cmVfZnVuY3M6IFsnY29uc29sZS5sb2cnLCAnY29uc29sZS5pbmZvJywgJ2NvbnNvbGUuZGVidWcnLCAnY29uc29sZS50cmFjZSddLFxuICAgICAgfSxcbiAgICAgIG1hbmdsZToge1xuICAgICAgICBzYWZhcmkxMDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBmb3JtYXQ6IHtcbiAgICAgICAgY29tbWVudHM6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICAgIC8vIENodW5rIHNpemUgd2FybmluZ1xuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogNTAwLFxuICAgIC8vIFNvdXJjZSBtYXBzIGZvciBwcm9kdWN0aW9uIGRlYnVnZ2luZ1xuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgICAvLyBDU1Mgb3B0aW1pemF0aW9uXG4gICAgY3NzTWluaWZ5OiB0cnVlLFxuICAgIC8vIFRhcmdldCBtb2Rlcm4gYnJvd3NlcnMgZm9yIHNtYWxsZXIgYnVuZGxlc1xuICAgIHRhcmdldDogJ2VzMjAyMCcsXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBleHRlbnNpb25zOiBbJy5tanMnLCAnLmpzJywgJy50cycsICcuanN4JywgJy50c3gnLCAnLmpzb24nXSxcbiAgICBhbGlhczoge1xuICAgICAgJ0BhMnIvcGxhdGZvcm0nOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uLy4uLy4uLzYtdWkvYTJyLXBsYXRmb3JtL3NyYy9pbmRleC50cycpLFxuICAgICAgLy8gTk9URTogV2UgZG9uJ3QgZGVmaW5lICdAJyBoZXJlIGJlY2F1c2UgaXQncyBoYW5kbGVkIGJ5IHBsYXRmb3JtQWxpYXNQbHVnaW5cbiAgICAgIC8vIHRvIHByb3Blcmx5IHJlc29sdmUgdG8gdGhlIHBsYXRmb3JtIHBhY2thZ2Ugd2hlbiBpbXBvcnRlZCBmcm9tIHRoZXJlXG4gICAgICAnQGEyci9ydW50aW1lJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvc2hpbXMvcnVudGltZS50cycpLFxuICAgICAgJ0BhMnIvZW5naW5lJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvc2hpbXMvZW1wdHkudHMnKSxcbiAgICAgICdub2RlOmZzL3Byb21pc2VzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvc2hpbXMvZW1wdHkudHMnKSxcbiAgICAgICdub2RlOmZzJzogcmVzb2x2ZShfX2Rpcm5hbWUsICdzcmMvc2hpbXMvZW1wdHkudHMnKSxcbiAgICAgICdub2RlOnBhdGgnOiByZXNvbHZlKF9fZGlybmFtZSwgJ3NyYy9zaGltcy9lbXB0eS50cycpLFxuICAgICAgJ25vZGU6cHJvY2Vzcyc6IHJlc29sdmUoX19kaXJuYW1lLCAnc3JjL3NoaW1zL2VtcHR5LnRzJyksXG4gICAgfSxcbiAgfSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgLy8gUHJldmVudCBzdGFsZSBwcmVidW5kbGVkIHNuYXBzaG90cyBvZiB3b3Jrc3BhY2Ugc291cmNlIHBhY2thZ2VzLlxuICAgIGV4Y2x1ZGU6IFsnQGEyci9wbGF0Zm9ybSddLFxuICB9LFxuICAvLyBQZXJmb3JtYW5jZSBoaW50c1xuICBlc2J1aWxkOiB7XG4gICAgbG9nT3ZlcnJpZGU6IHsgJ3RoaXMtaXMtdW5kZWZpbmVkLWluLWVzbSc6ICdzaWxlbnQnIH0sXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBcVgsU0FBUyxvQkFBNEI7QUFDMVosT0FBTyxXQUFXO0FBQ2xCLFNBQVMsU0FBUyxZQUFZO0FBQzlCLFNBQVMsWUFBWSxjQUFjLGFBQWEsZ0JBQWdCO0FBQ2hFLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQjtBQUwzQixJQUFNLG1DQUFtQztBQU96QyxJQUFNLGNBQWMsUUFBUSxrQ0FBVyxnQ0FBZ0M7QUFXdkUsU0FBUyxRQUFRLFNBQXlCO0FBQ3hDLFNBQU8sUUFDSixRQUFRLGVBQWUsT0FBTyxFQUM5QixRQUFRLGdCQUFnQixRQUFRLEVBQ2hDLFFBQVEsUUFBUSxFQUFFO0FBQ3ZCO0FBRUEsU0FBUyxvQkFBb0IsS0FBcUI7QUFDaEQsU0FBTyxJQUNKLEtBQUssRUFDTCxRQUFRLGtCQUFrQixFQUFFLEVBQzVCLFFBQVEsUUFBUSxFQUFFO0FBQ3ZCO0FBRUEsU0FBUyxxQkFBcUM7QUFDNUMsUUFBTSxjQUFjO0FBQUEsSUFDbEIsUUFBUSxJQUFJLDBCQUNQLFFBQVEsSUFBSSxZQUNaLFFBQVEsSUFBSSxpQkFDWjtBQUFBLEVBQ1A7QUFDQSxRQUFNLGNBQWM7QUFBQSxJQUNsQixRQUFRLElBQUksdUJBQXVCLEtBQUssS0FDckMsUUFBUSxJQUFJLG1CQUFtQixL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QUMxRDtBQUFBO0FBQUEsUUFFQSxnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0I7QUFBQSxRQUNoQixnQkFBZ0IsQ0FBQyxjQUFjO0FBQzdCLGdCQUFNLE9BQU8sVUFBVSxRQUFRO0FBQy9CLGNBQUksU0FBUyxLQUFLLElBQUksR0FBRztBQUN2QixtQkFBTztBQUFBLFVBQ1Q7QUFDQSxjQUFJLDhDQUE4QyxLQUFLLElBQUksR0FBRztBQUM1RCxtQkFBTztBQUFBLFVBQ1Q7QUFDQSxpQkFBTztBQUFBLFFBQ1Q7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFFQSxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixVQUFVO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxlQUFlO0FBQUEsUUFDZixZQUFZLENBQUMsZUFBZSxnQkFBZ0IsaUJBQWlCLGVBQWU7QUFBQSxNQUM5RTtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sVUFBVTtBQUFBLE1BQ1o7QUFBQSxNQUNBLFFBQVE7QUFBQSxRQUNOLFVBQVU7QUFBQSxNQUNaO0FBQUEsSUFDRjtBQUFBO0FBQUEsSUFFQSx1QkFBdUI7QUFBQTtBQUFBLElBRXZCLFdBQVc7QUFBQTtBQUFBLElBRVgsV0FBVztBQUFBO0FBQUEsSUFFWCxRQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsWUFBWSxDQUFDLFFBQVEsT0FBTyxPQUFPLFFBQVEsUUFBUSxPQUFPO0FBQUEsSUFDMUQsT0FBTztBQUFBLE1BQ0wsaUJBQWlCLFFBQVEsa0NBQVcseUNBQXlDO0FBQUE7QUFBQTtBQUFBLE1BRzdFLGdCQUFnQixRQUFRLGtDQUFXLHNCQUFzQjtBQUFBLE1BQ3pELGVBQWUsUUFBUSxrQ0FBVyxvQkFBb0I7QUFBQSxNQUN0RCxvQkFBb0IsUUFBUSxrQ0FBVyxvQkFBb0I7QUFBQSxNQUMzRCxXQUFXLFFBQVEsa0NBQVcsb0JBQW9CO0FBQUEsTUFDbEQsYUFBYSxRQUFRLGtDQUFXLG9CQUFvQjtBQUFBLE1BQ3BELGdCQUFnQixRQUFRLGtDQUFXLG9CQUFvQjtBQUFBLElBQ3pEO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBO0FBQUEsSUFFWixTQUFTLENBQUMsZUFBZTtBQUFBLEVBQzNCO0FBQUE7QUFBQSxFQUVBLFNBQVM7QUFBQSxJQUNQLGFBQWEsRUFBRSw0QkFBNEIsU0FBUztBQUFBLEVBQ3REO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
