import { defineConfig } from "vitest/config";

// One headless browser per test file; parallel Chrome launches can exceed the
// default 10 s hook timeout on this machine.
export default defineConfig({
  test: {
    hookTimeout: 30000,
  },
});
