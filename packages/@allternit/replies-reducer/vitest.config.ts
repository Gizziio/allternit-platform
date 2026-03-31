import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: {
      "@allternit/replies-contract": path.resolve(
        __dirname,
        "../replies-contract/src/index.ts",
      ),
    },
  },
});
