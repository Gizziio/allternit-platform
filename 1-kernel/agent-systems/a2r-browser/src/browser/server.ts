/**
 * Browser Control Server
 * Ported from OpenClaw dist/browser/server.js
 */

import express from 'express';
import type { BrowserConfig, BrowserState } from '../types/index.js';
import { createBrowserRouteContext } from './server-context.js';
import { registerBrowserRoutes } from './routes/index.js';

export interface BrowserServerOptions {
  config: BrowserConfig;
  port?: number;
  host?: string;
}

let state: BrowserState | null = null;

export async function startBrowserServer(options: BrowserServerOptions): Promise<BrowserState> {
  if (state) return state;
  
  if (!options.config.enabled) {
    throw new Error('Browser control is disabled');
  }
  
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  
  const ctx = createBrowserRouteContext({
    getState: () => state,
  });
  
  registerBrowserRoutes(app, ctx);
  
  const port = options.port || options.config.controlPort;
  const host = options.host || '127.0.0.1';
  
  const server = await new Promise<any>((resolve, reject) => {
    const s = app.listen(port, host, () => resolve(s));
    s.once('error', reject);
  });
  
  state = {
    server,
    port,
    resolved: options.config,
    profiles: new Map(),
  };
  
  console.log(`[Browser] Server listening on http://${host}:${port}/`);
  
  return state;
}

export async function stopBrowserServer(): Promise<void> {
  if (!state) return;
  
  // Stop all running browsers
  const ctx = createBrowserRouteContext({ getState: () => state });
  
  for (const name of Object.keys(state.resolved.profiles)) {
    try {
      // Create a mock request/res for the context
      const mockReq = { query: { profile: name }, body: {} };
      const mockRes = { status: () => mockRes, json: () => {} };
      const profileCtx = ctx.resolveProfileContext(mockReq as any, mockRes as any, ctx);
      
      if (profileCtx && 'stopRunningBrowser' in profileCtx) {
        await profileCtx.stopRunningBrowser();
      }
    } catch (err) {
      console.warn(`[Browser] Failed to stop profile ${name}:`, err);
    }
  }
  
  if (state.server) {
    await new Promise<void>((resolve) => {
      state?.server?.close(() => resolve());
    });
  }
  
  state = null;
}

export function getBrowserState(): BrowserState | null {
  return state;
}
