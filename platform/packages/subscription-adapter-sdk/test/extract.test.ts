import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Browser } from "playwright";
import { extractLastAssistantTurn } from "../src/index";
import { fixturePage, launchBrowser, makeResolver } from "./helpers";

let browser: Browser;
beforeAll(async () => {
  browser = await launchBrowser();
});
afterAll(async () => {
  await browser.close();
});

describe("extractLastAssistantTurn (§A3.1)", () => {
  it("converts the complete fixture to markdown with fenced code and citation link", async () => {
    const page = await fixturePage(browser, "complete.html");
    const md = await extractLastAssistantTurn(page, makeResolver(page));
    expect(md).toContain("### Summary");
    expect(md).toContain("Here is the full result for your request.");
    expect(md).toContain("```ts\nconst answer: number = 42;\n```");
    expect(md).toContain("- first supporting point");
    expect(md).toContain("- second supporting point");
    expect(md).toContain("[[1] example reference](https://example.com/ref-1)");
    await page.close();
  });

  it("extracts plain paragraphs from the streaming fixture", async () => {
    const page = await fixturePage(browser, "streaming.html");
    const md = await extractLastAssistantTurn(page, makeResolver(page));
    expect(md).toBe("The answer so far is");
    await page.close();
  });
});
