import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser } from "playwright";
import { loadFixture, recordFixture } from "../src/index";
import { launchBrowser } from "./helpers";

let browser: Browser;
let outDir: string;
beforeAll(async () => {
  browser = await launchBrowser();
  outDir = mkdtempSync(join(tmpdir(), "fw-fixtures-"));
});
afterAll(async () => {
  await browser.close();
  rmSync(outDir, { recursive: true, force: true });
});

describe("fixture recorder/loader (§A3.5)", () => {
  it("recordFixture sanitizes input values, emails, and long digit runs", async () => {
    const page = await browser.newPage();
    await page.setContent(`
      <main>
        <input id="secret" value="hunter2-secret">
        <p>Reach jane@example.com about order 123456789.</p>
      </main>`);
    const path = await recordFixture(page, "sample", outDir);
    const html = loadFixture("sample", outDir);
    expect(path.endsWith("sample.html")).toBe(true);
    expect(html).not.toContain("hunter2-secret");
    expect(html).not.toContain("jane@example.com");
    expect(html).not.toContain("123456789");
    expect(html).toContain("[redacted:email]");
    expect(html).toContain("[redacted:number]");
    await page.close();
  });
});
