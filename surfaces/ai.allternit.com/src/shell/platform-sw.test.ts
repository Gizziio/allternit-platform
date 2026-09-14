import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sw = readFileSync(join(root, "public/sw.js"), "utf8");
const boot = readFileSync(join(root, "public/boot.js"), "utf8");

describe("platform service worker", () => {
  it("does not precache HTML (stale index.html 404s hashed Vite chunks after deploy)", () => {
    expect(sw).toMatch(/CACHE_NAME = 'allternit-platform-v2'/);
    const precache = sw.match(/PRECACHE_ASSETS = \[([\s\S]*?)\];/)?.[1] ?? "";
    expect(precache).not.toMatch(/['"]\/['"]/);
    expect(precache).not.toContain("/index.html");
  });

  it("network-firsts navigations and boot.js", () => {
    expect(sw).toContain("request.mode === 'navigate'");
    expect(sw).toContain("path === '/boot.js'");
    expect(sw).toContain("url.pathname === '/sw.js') return");
  });

  it("unsticks controlled clients when a new worker activates", () => {
    expect(sw).toContain("client.navigate(client.url)");
  });
});

describe("platform boot.js", () => {
  it("reloads once when a hashed asset fails to load", () => {
    expect(boot).toContain("recoverFromStaleAssets");
    expect(boot).toContain("allternit-sw-recover");
    expect(boot).toContain("/assets/");
  });
});
