/**
 * CDP Client Tests
 * 
 * Tests for Chrome DevTools Protocol client.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CDPClient } from '../cdp/client.js';

describe('CDP Client', () => {
  // Note: These tests require a running Chrome instance with CDP enabled
  // Run with: google-chrome --remote-debugging-port=9222
  
  const CDP_URL = process.env.CDP_URL || 'ws://127.0.0.1:9222/devtools/browser';
  let client: CDPClient;

  it('should create CDP client instance', () => {
    // Just test that the class exists and can be imported
    expect(CDPClient).toBeDefined();
    expect(typeof CDPClient.connect).toBe('function');
  });

  // Skip these tests if no Chrome is running
  const describeIfChrome = process.env.CDP_URL ? describe : describe.skip;

  describeIfChrome('with Chrome running', () => {
    beforeAll(async () => {
      client = await CDPClient.connect(CDP_URL);
    });

    afterAll(() => {
      client?.close();
    });

    it('should connect to Chrome', () => {
      expect(client).toBeDefined();
    });

    it('should send commands', async () => {
      const version = await client.send('Browser.getVersion');
      expect(version).toBeDefined();
      expect(version.product).toContain('Chrome');
    });

    it('should handle errors gracefully', async () => {
      try {
        await client.send('Invalid.command');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeDefined();
      }
    });
  });
});

describe('CDP Utils', () => {
  it('should export tab management functions', async () => {
    const tabs = await import('../cdp/tabs.js');
    expect(tabs.getTabs).toBeDefined();
    expect(tabs.openTab).toBeDefined();
    expect(tabs.focusTab).toBeDefined();
    expect(tabs.closeTab).toBeDefined();
  });

  it('should export screenshot functions', async () => {
    const screenshot = await import('../cdp/screenshot.js');
    expect(screenshot.captureScreenshot).toBeDefined();
    expect(screenshot.normalizeScreenshot).toBeDefined();
  });

  it('should export snapshot functions', async () => {
    const snapshot = await import('../cdp/snapshot.js');
    expect(snapshot.snapshotAria).toBeDefined();
    expect(snapshot.snapshotAi).toBeDefined();
  });
});
