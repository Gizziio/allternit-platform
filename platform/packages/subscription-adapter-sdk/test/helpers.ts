import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { SelectorPack, createResolver, type DriftSignal, type SdkSelectorResolver } from "../src/index";

// Bundled chromium first; fall back to the installed system Chrome when the
// playwright browser download is unavailable on this machine.
export async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    return await chromium.launch({ channel: "chrome" });
  }
}

export function fixtureHtml(name: string): string {
  return readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");
}

export function loadPack(): SelectorPack {
  return SelectorPack.fromYaml(fixtureHtml("selectors.v1.yaml"));
}

export async function fixturePage(browser: Browser, name: string): Promise<Page> {
  const page = await browser.newPage();
  await page.setContent(fixtureHtml(name));
  return page;
}

export function makeResolver(
  page: Page,
  onDrift?: (signal: DriftSignal) => void
): SdkSelectorResolver {
  return createResolver(page, loadPack(), onDrift ? { onDrift } : {});
}
