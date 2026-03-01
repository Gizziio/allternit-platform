/**
 * Browser Agent Routes (Snapshot, Screenshot, Actions)
 * Ported from OpenClaw dist/browser/routes/agent.js
 */

import type { Express } from 'express';
import type { createBrowserRouteContext } from '../server-context.js';
import { registerBrowserAgentSnapshotRoutes } from './agent.snapshot.js';
import { registerBrowserAgentActRoutes } from './agent.act.js';

export function registerBrowserAgentRoutes(
  app: Express,
  ctx: ReturnType<typeof createBrowserRouteContext>
): void {
  registerBrowserAgentSnapshotRoutes(app, ctx);
  registerBrowserAgentActRoutes(app, ctx);
  
  // Console messages
  app.get('/console', async (req, res) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { level, targetId } = req.query;
    
    try {
      // Implementation would get console messages from CDP
      res.json({ messages: [] });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // PDF generation
  app.post('/pdf', async (req, res) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { targetId } = req.body;
    
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const { pdfViaPlaywright } = await import('../playwright/pdf.js');
      const result = await pdfViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
      });
      
      res.json({
        ok: true,
        path: result.path,
        targetId: tab.targetId,
        url: tab.url,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
