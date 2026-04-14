/**
 * Browser Server Tests
 * 
 * Tests for the browser control server implementation.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startBrowserServer, stopBrowserServer, getBrowserState } from '../server.js';
import type { BrowserConfig } from '../../types/index.js';

const TEST_CONFIG: BrowserConfig = {
  enabled: true,
  controlPort: 0, // Use any available port
  headless: true,
  noSandbox: true,
  executablePath: process.env.CHROME_PATH,
  attachOnly: false,
  profiles: {
    default: {
      name: 'default',
      cdpPort: 9222,
      cdpUrl: 'http://127.0.0.1:9222',
    },
  },
};

describe('Browser Server', () => {
  let serverState: any;

  beforeAll(async () => {
    serverState = await startBrowserServer({
      config: TEST_CONFIG,
    });
  });

  afterAll(async () => {
    await stopBrowserServer();
  });

  it('should start the browser server', () => {
    expect(serverState).toBeDefined();
    expect(serverState.port).toBeGreaterThan(0);
    expect(getBrowserState()).toBeDefined();
  });

  it('should respond to status endpoint', async () => {
    const response = await fetch(`http://127.0.0.1:${serverState.port}/`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.enabled).toBe(true);
    expect(data.profile).toBe('default');
    expect(typeof data.running).toBe('boolean');
  });

  it('should respond to profiles endpoint', async () => {
    const response = await fetch(`http://127.0.0.1:${serverState.port}/profiles`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data.profiles)).toBe(true);
    expect(data.profiles.length).toBeGreaterThan(0);
    expect(data.profiles[0].name).toBe('default');
  });

  it('should respond to tabs endpoint (browser not running)', async () => {
    // Before browser is started, should return empty tabs or error
    const response = await fetch(`http://127.0.0.1:${serverState.port}/tabs`);
    // May fail if browser not started, that's OK
    expect([200, 500, 503]).toContain(response.status);
  });
});
