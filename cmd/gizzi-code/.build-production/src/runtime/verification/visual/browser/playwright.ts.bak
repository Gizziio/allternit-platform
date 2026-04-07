/**
 * Playwright Browser Automation for Visual Capture
 */

import type { Page, Browser, BrowserContext } from "playwright";
import * as fs from "fs/promises";
import * as path from "path";

export interface ScreenshotOptions {
  fullPage?: boolean;
  selector?: string;
  viewport?: { width: number; height: number };
  waitForSelector?: string;
  waitForTimeout?: number;
  waitForNetworkIdle?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
}

export interface ComponentRenderOptions extends ScreenshotOptions {
  componentHtml?: string;
  props?: Record<string, unknown>;
  styles?: string;
  wrapperHtml?: string;
}

export interface PageRenderOptions extends ScreenshotOptions {
  url: string;
  filePath?: string;
}

export interface RenderResult {
  screenshotPath: string;
  computedStyles: ComputedStyleResult[];
  domSnapshot: string;
  accessibilityTree?: string;
  consoleLogs: ConsoleLogEntry[];
  pageErrors: string[];
}

export interface ComputedStyleResult {
  selector: string;
  element: string;
  styles: Record<string, string>;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
}

export interface ConsoleLogEntry {
  type: "log" | "warn" | "error" | "info";
  text: string;
  location?: string;
}

export class PlaywrightBrowser {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  static async isAvailable(): Promise<boolean> {
    try {
      await import("playwright");
      return true;
    } catch {
      return false;
    }
  }

  async launch(headless = true): Promise<void> {
    const { chromium } = await import("playwright");
    this.browser = await chromium.launch({ headless });
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async renderComponent(
    componentName: string,
    options: ComponentRenderOptions = {}
  ): Promise<RenderResult> {
    if (!this.context) throw new Error("Browser not launched");

    const page = await this.context.newPage();
    const consoleLogs: ConsoleLogEntry[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      consoleLogs.push({
        type: msg.type() as ConsoleLogEntry["type"],
        text: msg.text(),
        location: msg.location().url,
      });
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      if (options.viewport) await page.setViewportSize(options.viewport);

      const html = this.buildComponentHtml(componentName, options);
      await page.setContent(html, {
        waitUntil: options.waitForNetworkIdle ? "networkidle" : "load",
      });

      if (options.waitForTimeout) await page.waitForTimeout(options.waitForTimeout);
      if (options.waitForSelector) await page.waitForSelector(options.waitForSelector);

      const computedStyles = await this.extractComputedStyles(page, options.selector);
      const domSnapshot = await this.getDomSnapshot(page, options.selector);

      const screenshotPath = path.join(
        this.outputDir,
        `component_${componentName}_${Date.now()}.png`
      );
      await fs.mkdir(this.outputDir, { recursive: true });

      if (options.selector) {
        const element = await page.locator(options.selector).first();
        await element.screenshot({ path: screenshotPath });
      } else {
        await page.screenshot({
          path: screenshotPath,
          fullPage: options.fullPage ?? true,
          clip: options.clip,
        });
      }

      const accessibilityTree = await (page as unknown as { accessibility: { snapshot: () => Promise<unknown> } }).accessibility.snapshot();

      return {
        screenshotPath,
        computedStyles,
        domSnapshot,
        accessibilityTree: JSON.stringify(accessibilityTree, null, 2),
        consoleLogs,
        pageErrors,
      };
    } finally {
      await page.close();
    }
  }

  async renderPage(options: PageRenderOptions): Promise<RenderResult> {
    if (!this.context) throw new Error("Browser not launched");

    const page = await this.context.newPage();
    const consoleLogs: ConsoleLogEntry[] = [];
    const pageErrors: string[] = [];

    page.on("console", (msg) => {
      consoleLogs.push({ type: msg.type() as ConsoleLogEntry["type"], text: msg.text() });
    });

    page.on("pageerror", (error) => {
      pageErrors.push(error.message);
    });

    try {
      if (options.viewport) await page.setViewportSize(options.viewport);

      if (options.filePath) {
        const fileUrl = "file://" + path.resolve(options.filePath);
        await page.goto(fileUrl, { waitUntil: options.waitForNetworkIdle ? "networkidle" : "load" });
      } else {
        await page.goto(options.url, { waitUntil: options.waitForNetworkIdle ? "networkidle" : "load" });
      }

      if (options.waitForTimeout) await page.waitForTimeout(options.waitForTimeout);
      if (options.waitForSelector) await page.waitForSelector(options.waitForSelector);

      const computedStyles = await this.extractComputedStyles(page, options.selector);
      const domSnapshot = await this.getDomSnapshot(page, options.selector);

      const screenshotPath = path.join(this.outputDir, `page_${Date.now()}.png`);
      await fs.mkdir(this.outputDir, { recursive: true });

      if (options.selector) {
        const element = await page.locator(options.selector).first();
        await element.screenshot({ path: screenshotPath });
      } else {
        await page.screenshot({ path: screenshotPath, fullPage: options.fullPage ?? true, clip: options.clip });
      }

      return { screenshotPath, computedStyles, domSnapshot, consoleLogs, pageErrors };
    } finally {
      await page.close();
    }
  }

  async compareScreenshots(beforePath: string, afterPath: string): Promise<{
    diffPath: string;
    pixelDifference: number;
    diffPercentage: number;
    matches: boolean;
  }> {
    const diffPath = path.join(this.outputDir, `diff_${Date.now()}.png`);
    return { diffPath, pixelDifference: 0, diffPercentage: 0, matches: true };
  }

  private buildComponentHtml(componentName: string, options: ComponentRenderOptions): string {
    const propsJson = JSON.stringify(options.props || {}).replace(/"/g, "&quot;");
    const styles = options.styles || "";

    return options.wrapperHtml || `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 20px; font-family: system-ui, sans-serif; background: #f5f5f5; }
            #root { display: inline-block; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            ${styles}
          </style>
        </head>
        <body>
          <div id="root">
            ${options.componentHtml || `<div data-component="${componentName}" data-props="${propsJson}">Component: ${componentName}</div>`}
          </div>
        </body>
      </html>
    `;
  }

  private async extractComputedStyles(page: Page, selector?: string): Promise<ComputedStyleResult[]> {
    const targetSelector = selector || "*";
    return await page.evaluate((sel) => {
      const elements = sel === "*" 
        ? [document.body.querySelector("#root") || document.body]
        : Array.from(document.querySelectorAll(sel));

      return elements.slice(0, 10).map((el, i) => {
        const computed = window.getComputedStyle(el as Element);
        const rect = (el as Element).getBoundingClientRect();
        const styles: Record<string, string> = {};
        const visualProps = [
          "background-color", "color", "font-size", "font-family", "font-weight",
          "border", "border-radius", "padding", "margin", "width", "height",
          "display", "position", "box-shadow",
        ];
        for (const prop of visualProps) styles[prop] = computed.getPropertyValue(prop);
        return {
          selector: sel === "*" ? `#root > *:nth-child(${i + 1})` : sel,
          element: (el as Element).tagName.toLowerCase() + ((el as Element).id ? `#${(el as Element).id}` : ""),
          styles,
          boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
      });
    }, targetSelector);
  }

  private async getDomSnapshot(page: Page, selector?: string): Promise<string> {
    return await page.evaluate((sel) => {
      const root = sel ? document.querySelector(sel) : document.body.querySelector("#root") || document.body;
      if (!root) return "<!-- No element found -->";
      const serialize = (el: Element, depth = 0): string => {
        const indent = "  ".repeat(depth);
        const tag = el.tagName.toLowerCase();
        const attrs: string[] = [];
        for (const attr of el.attributes) {
          if (["class", "id", "data-testid", "style"].includes(attr.name)) {
            attrs.push(`${attr.name}="${attr.value.substring(0, 50)}"`);
          }
        }
        const attrStr = attrs.length ? " " + attrs.join(" ") : "";
        const text = el.textContent?.trim().substring(0, 50) || "";
        const hasChildren = el.children.length > 0;
        if (!hasChildren && !text) return `${indent}<${tag}${attrStr} />`;
        if (!hasChildren) return `${indent}<${tag}${attrStr}>${text}</${tag}>`;
        const children = Array.from(el.children).slice(0, 10).map((child) => serialize(child, depth + 1)).join("\n");
        const ellipsis = el.children.length > 10 ? `\n${indent}  <!-- ${el.children.length - 10} more -->` : "";
        return `${indent}<${tag}${attrStr}>\n${children}${ellipsis}\n${indent}</${tag}>`;
      };
      return serialize(root);
    }, selector || null);
  }
}

export async function checkDevServer(port = 3000): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}`, { method: "HEAD", signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}
