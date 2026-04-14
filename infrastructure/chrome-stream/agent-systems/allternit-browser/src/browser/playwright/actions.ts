/**
 * Playwright Browser Actions
 * Ported from OpenClaw dist/browser/pw-tools-core.interactions.js
 */

import { connectViaCDP } from './launcher.js';

export interface ClickOptions {
  cdpUrl: string;
  targetId: string;
  ref: string;
  doubleClick?: boolean;
  button?: 'left' | 'right' | 'middle';
  modifiers?: string[];
  timeoutMs?: number;
}

export async function clickViaPlaywright(options: ClickOptions): Promise<void> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages().find(p => p.url() === options.targetId) || context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    // Find element by ref (aria-ref or role+name)
    const selector = `[data-ref="${options.ref}"]`;
    
    await page.click(selector, {
      clickCount: options.doubleClick ? 2 : 1,
      button: options.button || 'left',
      modifiers: options.modifiers as any,
      timeout: options.timeoutMs || 5000,
    });
  } finally {
    await browser.close();
  }
}

export interface TypeOptions {
  cdpUrl: string;
  targetId: string;
  ref: string;
  text: string;
  submit?: boolean;
  slowly?: boolean;
  timeoutMs?: number;
}

export async function typeViaPlaywright(options: TypeOptions): Promise<void> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages().find(p => p.url() === options.targetId) || context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    const selector = `[data-ref="${options.ref}"]`;
    
    await page.fill(selector, options.text, { timeout: options.timeoutMs || 5000 });
    
    if (options.submit) {
      await page.press(selector, 'Enter');
    }
  } finally {
    await browser.close();
  }
}

export interface NavigateOptions {
  cdpUrl: string;
  targetId: string;
  url: string;
}

export async function navigateViaPlaywright(options: NavigateOptions): Promise<void> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages().find(p => p.url() === options.targetId) || context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    await page.goto(options.url, { waitUntil: 'networkidle' });
  } finally {
    await browser.close();
  }
}

export interface ScreenshotOptions {
  cdpUrl: string;
  targetId: string;
  ref?: string;
  element?: string;
  fullPage?: boolean;
  type: 'png' | 'jpeg';
}

export async function takeScreenshotViaPlaywright(options: ScreenshotOptions): Promise<{ buffer: Buffer }> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages().find(p => p.url() === options.targetId) || context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    let screenshotOptions: any = {
      type: options.type,
      fullPage: options.fullPage,
    };
    
    if (options.ref || options.element) {
      const selector = options.element || `[data-ref="${options.ref}"]`;
      const element = page.locator(selector).first();
      const buffer = await element.screenshot(screenshotOptions);
      return { buffer };
    } else {
      const buffer = await page.screenshot(screenshotOptions);
      return { buffer };
    }
  } finally {
    await browser.close();
  }
}

export interface HoverOptions {
  cdpUrl: string;
  targetId: string;
  ref: string;
  timeoutMs?: number;
}

export async function hoverViaPlaywright(options: HoverOptions): Promise<void> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    const selector = `[data-ref="${options.ref}"]`;
    await page.hover(selector, { timeout: options.timeoutMs || 5000 });
  } finally {
    await browser.close();
  }
}

export interface PressOptions {
  cdpUrl: string;
  targetId: string;
  key: string;
  delayMs?: number;
}

export async function pressKeyViaPlaywright(options: PressOptions): Promise<void> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    await page.keyboard.press(options.key, { delay: options.delayMs });
  } finally {
    await browser.close();
  }
}

export interface EvaluateOptions {
  cdpUrl: string;
  targetId: string;
  fn: string;
  ref?: string;
}

export async function evaluateViaPlaywright(options: EvaluateOptions): Promise<unknown> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    return await page.evaluate(options.fn);
  } finally {
    await browser.close();
  }
}

export interface WaitOptions {
  cdpUrl: string;
  targetId: string;
  timeMs?: number;
  text?: string;
  textGone?: string;
  selector?: string;
  url?: string;
  loadState?: 'load' | 'domcontentloaded' | 'networkidle';
  fn?: string;
  timeoutMs?: number;
}

export async function waitForViaPlaywright(options: WaitOptions): Promise<void> {
  const { browser, context } = await connectViaCDP(options.cdpUrl);
  
  try {
    const page = context.pages()[0];
    if (!page) throw new Error('Page not found');
    
    if (options.timeMs) {
      await page.waitForTimeout(options.timeMs);
    }
    
    if (options.text) {
      await page.waitForSelector(`text=${options.text}`, { timeout: options.timeoutMs });
    }
    
    if (options.selector) {
      await page.waitForSelector(options.selector, { timeout: options.timeoutMs });
    }
    
    if (options.url) {
      await page.waitForURL(options.url, { timeout: options.timeoutMs });
    }
    
    if (options.loadState) {
      await page.waitForLoadState(options.loadState, { timeout: options.timeoutMs });
    }
    
    if (options.fn) {
      await page.waitForFunction(options.fn, { timeout: options.timeoutMs });
    }
  } finally {
    await browser.close();
  }
}
