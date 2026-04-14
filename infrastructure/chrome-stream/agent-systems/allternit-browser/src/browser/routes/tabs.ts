/**
 * Browser Tab Routes
 * Ported from OpenClaw dist/browser/routes/tabs.js
 */

import type { Express, Request, Response } from 'express';
import type { createBrowserRouteContext } from '../server-context.js';
import * as tabs from '../cdp/tabs.js';

export function registerBrowserTabRoutes(
  app: Express,
  ctx: ReturnType<typeof createBrowserRouteContext>
): void {
  // List tabs
  app.get('/tabs', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    try {
      await profileCtx.ensureBrowserAvailable();
      const tabList = await tabs.getTabs(profileCtx.profile.cdpUrl);
      res.json({ tabs: tabList });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Open tab
  app.post('/tabs/open', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    
    try {
      await profileCtx.ensureBrowserAvailable();
      const tab = await tabs.openTab(profileCtx.profile.cdpUrl, url);
      res.json({ ok: true, tab });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Focus tab
  app.post('/tabs/focus', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { targetId } = req.body;
    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required' });
    }
    
    try {
      await tabs.focusTab(profileCtx.profile.cdpUrl, targetId);
      res.json({ ok: true, targetId });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Close tab
  app.delete('/tabs/:targetId', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { targetId } = req.params;
    
    try {
      await tabs.closeTab(profileCtx.profile.cdpUrl, targetId);
      res.json({ ok: true, targetId });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Tab actions (back, forward, reload)
  app.post('/tabs/action', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { action, targetId } = req.body;
    if (!action || !['back', 'forward', 'reload'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    try {
      await tabs.getTabAction(profileCtx.profile.cdpUrl, targetId, action);
      res.json({ ok: true, action, targetId });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
