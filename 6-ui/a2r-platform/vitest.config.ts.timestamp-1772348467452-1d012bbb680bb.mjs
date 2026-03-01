// vitest.config.ts
import { defineConfig } from "file:///sessions/trusting-tender-davinci/mnt/a2rchitech/node_modules/.pnpm/vitest@1.6.1_@types+node@25.3.0_jsdom@28.0.0_@noble+hashes@2.0.1_canvas@3.2.1_/node_modules/vitest/dist/config.js";
import path from "path";
var __vite_injected_original_dirname = "/sessions/trusting-tender-davinci/mnt/a2rchitech/6-ui/a2r-platform";
var vitest_config_default = defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src"),
      "crypto": "node:crypto",
      "js-tiktoken": path.resolve(__vite_injected_original_dirname, "./src/lib/ai/__mocks__/js-tiktoken.ts")
    }
  },
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("/api/v1/swarm"),
    "import.meta.env.VITE_A2R_GATEWAY_URL": JSON.stringify("http://127.0.0.1:8013/api/v1"),
    "import.meta.env.VITE_GATEWAY_BASE_URL": JSON.stringify("http://localhost:8013"),
    "import.meta.env.DEV": "true",
    "import.meta.env.PROD": "false"
  }
});
export {
  vitest_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9zZXNzaW9ucy90cnVzdGluZy10ZW5kZXItZGF2aW5jaS9tbnQvYTJyY2hpdGVjaC82LXVpL2Eyci1wbGF0Zm9ybVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL3Nlc3Npb25zL3RydXN0aW5nLXRlbmRlci1kYXZpbmNpL21udC9hMnJjaGl0ZWNoLzYtdWkvYTJyLXBsYXRmb3JtL3ZpdGVzdC5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL3Nlc3Npb25zL3RydXN0aW5nLXRlbmRlci1kYXZpbmNpL21udC9hMnJjaGl0ZWNoLzYtdWkvYTJyLXBsYXRmb3JtL3ZpdGVzdC5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICB0ZXN0OiB7XG4gICAgZW52aXJvbm1lbnQ6ICdqc2RvbScsXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBzZXR1cEZpbGVzOiBbJy4vdml0ZXN0LnNldHVwLnRzJ10sXG4gIH0sXG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcbiAgICAgICdjcnlwdG8nOiAnbm9kZTpjcnlwdG8nLFxuICAgICAgJ2pzLXRpa3Rva2VuJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjL2xpYi9haS9fX21vY2tzX18vanMtdGlrdG9rZW4udHMnKSxcbiAgICB9LFxuICB9LFxuICBkZWZpbmU6IHtcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfQVBJX0JBU0VfVVJMJzogSlNPTi5zdHJpbmdpZnkoJy9hcGkvdjEvc3dhcm0nKSxcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfQTJSX0dBVEVXQVlfVVJMJzogSlNPTi5zdHJpbmdpZnkoJ2h0dHA6Ly8xMjcuMC4wLjE6ODAxMy9hcGkvdjEnKSxcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlZJVEVfR0FURVdBWV9CQVNFX1VSTCc6IEpTT04uc3RyaW5naWZ5KCdodHRwOi8vbG9jYWxob3N0OjgwMTMnKSxcbiAgICAnaW1wb3J0Lm1ldGEuZW52LkRFVic6ICd0cnVlJyxcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlBST0QnOiAnZmFsc2UnLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRYLFNBQVMsb0JBQW9CO0FBQ3paLE9BQU8sVUFBVTtBQURqQixJQUFNLG1DQUFtQztBQUd6QyxJQUFPLHdCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsSUFDSixhQUFhO0FBQUEsSUFDYixTQUFTO0FBQUEsSUFDVCxZQUFZLENBQUMsbUJBQW1CO0FBQUEsRUFDbEM7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxNQUNwQyxVQUFVO0FBQUEsTUFDVixlQUFlLEtBQUssUUFBUSxrQ0FBVyx1Q0FBdUM7QUFBQSxJQUNoRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNOLHFDQUFxQyxLQUFLLFVBQVUsZUFBZTtBQUFBLElBQ25FLHdDQUF3QyxLQUFLLFVBQVUsOEJBQThCO0FBQUEsSUFDckYseUNBQXlDLEtBQUssVUFBVSx1QkFBdUI7QUFBQSxJQUMvRSx1QkFBdUI7QUFBQSxJQUN2Qix3QkFBd0I7QUFBQSxFQUMxQjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
