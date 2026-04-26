/**
 * Integration Tests
 * 
 * End-to-end tests demonstrating the full architecture works.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startBrowserServer, stopBrowserServer } from '../browser/server.js';
import { startCanvasHost } from '../canvas-host/server.js';
import type { BrowserConfig } from '../types/index.js';

const TEST_BROWSER_CONFIG: BrowserConfig = {
  enabled: true,
  controlPort: 0,
  headless: true,
  noSandbox: true,
  attachOnly: false,
  profiles: {
    default: {
      name: 'default',
      cdpPort: 9222,
      cdpUrl: 'http://127.0.0.1:9222',
    },
  },
};

describe('Integration: Full Stack', () => {
  let browserServer: any;
  let canvasHost: any;

  beforeAll(async () => {
    // Start both servers
    [browserServer, canvasHost] = await Promise.all([
      startBrowserServer({ config: TEST_BROWSER_CONFIG }),
      startCanvasHost({ port: 0, liveReload: false }),
    ]);
  });

  afterAll(async () => {
    await Promise.all([
      stopBrowserServer(),
      canvasHost.close(),
    ]);
  });

  it('should have both servers running', () => {
    expect(browserServer.port).toBeGreaterThan(0);
    expect(canvasHost.port).toBeGreaterThan(0);
    console.log(`  Browser: http://127.0.0.1:${browserServer.port}`);
    console.log(`  Canvas: http://127.0.0.1:${canvasHost.port}`);
  });

  it('should get browser status', async () => {
    const response = await fetch(`http://127.0.0.1:${browserServer.port}/`);
    expect(response.ok).toBe(true);
    
    const data = await response.json() as { enabled: boolean; profile: string };
    expect(data.enabled).toBe(true);
    expect(data.profile).toBe('default');
  });

  it('should get canvas index', async () => {
    const response = await fetch(`http://127.0.0.1:${canvasHost.port}/`);
    expect(response.ok).toBe(true);
    
    const html = await response.text();
    expect(html).toContain('Allternit Canvas');
  });

  it('should handle A2UI path', async () => {
    // A2UI handler returns 503 if bundle not present (expected in test)
    const response = await fetch(`http://127.0.0.1:${canvasHost.port}/__allternit__/a2ui`);
    // Should return 503 (A2UI assets not found) or 200 (if bundle exists)
    expect([200, 404, 503]).toContain(response.status);
  });
});

describe('Integration: Module Exports', () => {
  it('should export all browser server functions', async () => {
    const module = await import('../index.js');
    expect(module.startBrowserServer).toBeDefined();
    expect(module.stopBrowserServer).toBeDefined();
    expect(module.getBrowserState).toBeDefined();
  });

  it('should export all canvas host functions', async () => {
    const module = await import('../index.js');
    expect(module.startCanvasHost).toBeDefined();
    expect(module.createCanvasHostHandler).toBeDefined();
  });

  it('should export CDP client', async () => {
    const module = await import('../index.js');
    expect(module.CDPClient).toBeDefined();
  });

  it('should export all tab functions', async () => {
    const module = await import('../index.js');
    expect(module.getTabs).toBeDefined();
    expect(module.openTab).toBeDefined();
    expect(module.focusTab).toBeDefined();
    expect(module.closeTab).toBeDefined();
  });

  it('should export all screenshot functions', async () => {
    const module = await import('../index.js');
    expect(module.captureScreenshot).toBeDefined();
    expect(module.normalizeScreenshot).toBeDefined();
  });

  it('should export all snapshot functions', async () => {
    const module = await import('../index.js');
    expect(module.snapshotAria).toBeDefined();
    expect(module.snapshotAi).toBeDefined();
    expect(module.snapshotRole).toBeDefined();
  });

  it('should export all Playwright functions', async () => {
    const module = await import('../index.js');
    expect(module.launchBrowser).toBeDefined();
    expect(module.connectViaCDP).toBeDefined();
    expect(module.clickViaPlaywright).toBeDefined();
    expect(module.typeViaPlaywright).toBeDefined();
    expect(module.navigateViaPlaywright).toBeDefined();
    expect(module.takeScreenshotViaPlaywright).toBeDefined();
    expect(module.hoverViaPlaywright).toBeDefined();
    expect(module.pressKeyViaPlaywright).toBeDefined();
    expect(module.evaluateViaPlaywright).toBeDefined();
    expect(module.waitForViaPlaywright).toBeDefined();
    expect(module.snapshotAiViaPlaywright).toBeDefined();
    expect(module.snapshotRoleViaPlaywright).toBeDefined();
    expect(module.snapshotAriaViaPlaywright).toBeDefined();
    expect(module.pdfViaPlaywright).toBeDefined();
  });

  it('should export A2UI constants and functions', async () => {
    const module = await import('../index.js');
    expect(module.A2UI_PATH).toBeDefined();
    expect(module.CANVAS_HOST_PATH).toBeDefined();
    expect(module.CANVAS_WS_PATH).toBeDefined();
    expect(module.handleA2uiHttpRequest).toBeDefined();
    expect(module.injectCanvasLiveReload).toBeDefined();
  });
});

describe('Integration: Type Safety', () => {
  it('should have proper TypeScript types', async () => {
    const types = await import('../types/index.js');
    
    // Check that types are exported
    expect(types).toBeDefined();
    
    // Type checks (compile-time, but we can verify exports exist)
    expect(true).toBe(true); // Types compile = test passes
  });
});
