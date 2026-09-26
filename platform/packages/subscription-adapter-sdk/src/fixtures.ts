// §A3.5 — fixture recorder/loader (sanitized DOM snapshots for future live
// captures; the hand-written Phase 1 fixtures stay canonical).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "playwright";
import { redactText } from "./runtime";

export async function recordFixture(
  page: Page,
  name: string,
  outDir: string
): Promise<string> {
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll("input, textarea"))) {
      el.setAttribute("value", "");
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.value = "";
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
    const digits = /\b\d{6,}\b/g;
    let node = walker.nextNode();
    while (node) {
      node.textContent = (node.textContent ?? "")
        .replace(email, "[redacted:email]")
        .replace(digits, "[redacted:number]");
      node = walker.nextNode();
    }
  });
  const html = redactText(await page.content());
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `${name}.html`);
  writeFileSync(path, html);
  return path;
}

export function loadFixture(name: string, dir: string): string {
  return readFileSync(join(dir, `${name}.html`), "utf8");
}
