/**
 * Browser Routes Registration
 * Ported from OpenClaw dist/browser/routes/index.js
 */

import type { Express } from 'express';
import type { createBrowserRouteContext } from '../server-context.js';
import { registerBrowserBasicRoutes } from './basic.js';
import { registerBrowserTabRoutes } from './tabs.js';
import { registerBrowserAgentRoutes } from './agent.js';

export function registerBrowserRoutes(
  app: Express,
  ctx: ReturnType<typeof createBrowserRouteContext>
): void {
  registerBrowserBasicRoutes(app, ctx);
  registerBrowserTabRoutes(app, ctx);
  registerBrowserAgentRoutes(app, ctx);
}
