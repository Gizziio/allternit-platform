"use client";

import type { BrowserScreenshotOptions, ScreenshotResult } from "./citation-manager.types";

export class BrowserScreenshotService {
  isCaptureAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.electron?.browser;
  }

  async capture(options: BrowserScreenshotOptions): Promise<ScreenshotResult> {
    if (!this.isCaptureAvailable()) {
      throw new Error('Browser screenshot capture is unavailable. Start the desktop browser bridge.');
    }
    return this.captureViaBrowserUse(options);
  }

  private async captureViaBrowserUse(options: BrowserScreenshotOptions): Promise<ScreenshotResult> {
    if (!window.electron?.browser) {
      throw new Error('Browser automation not available');
    }

    const result = await window.electron.browser.capture({
      url: options.url,
      fullPage: options.fullPage,
      selector: options.selector,
      viewport: options.width && options.height 
        ? { width: options.width, height: options.height }
        : undefined,
      hideSelectors: options.hideSelectors,
    });

    return {
      id: `screenshot-${Date.now()}`,
      url: options.url,
      screenshot: result.screenshot, 
      timestamp: new Date().toISOString(),
      title: result.title,
      selector: options.selector,
      metadata: {
        viewport: result.viewport,
        userAgent: result.userAgent,
        captureTime: result.captureTime,
      },
    };
  }

  async verifyUrl(url: string): Promise<{ accessible: boolean; statusCode?: number; error?: string }> {
    if (!this.isCaptureAvailable()) {
      return {
        accessible: false,
        error: 'Browser verification is unavailable. Start the desktop browser bridge.',
      };
    }
    return window.electron?.browser?.verify(url) ?? { accessible: false, error: 'Browser verification unavailable' };
  }
}

export const browserScreenshotService = new BrowserScreenshotService();
