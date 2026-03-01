/**
 * Browser Agent Snapshot Routes
 * Ported from OpenClaw dist/browser/routes/agent.snapshot.js
 */

import type { Express, Request, Response } from 'express';
import type { createBrowserRouteContext } from '../server-context.js';
import { captureScreenshot, normalizeScreenshot } from '../cdp/screenshot.js';
import { snapshotAria } from '../cdp/snapshot.js';

export function registerBrowserAgentSnapshotRoutes(
  app: Express,
  ctx: ReturnType<typeof createBrowserRouteContext>
): void {
  // Navigate to URL
  app.post('/navigate', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { url, targetId } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }
    
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const { navigateViaPlaywright } = await import('../playwright/actions.js');
      await navigateViaPlaywright({
        cdpUrl: profileCtx.profile.cdpUrl,
        targetId: tab.targetId,
        url,
      });
      
      res.json({ ok: true, targetId: tab.targetId, url });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Take screenshot
  app.post('/screenshot', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { targetId, fullPage, ref, element, type = 'png' } = req.body;
    
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      
      // Use Playwright for element screenshots or extension driver
      if (ref || element || profileCtx.profile.driver === 'extension' || !tab.wsUrl) {
        const { takeScreenshotViaPlaywright } = await import('../playwright/actions.js');
        const { buffer } = await takeScreenshotViaPlaywright({
          cdpUrl: profileCtx.profile.cdpUrl,
          targetId: tab.targetId,
          ref,
          element,
          fullPage,
          type: type as 'png' | 'jpeg',
        });
        
        // Save and return path
        const path = `/tmp/screenshot-${Date.now()}.${type}`;
        const { writeFile } = await import('fs/promises');
        await writeFile(path, buffer);
        
        res.json({ ok: true, path, targetId: tab.targetId, url: tab.url });
      } else {
        // Use CDP for full page screenshots
        const buffer = await captureScreenshot({
          wsUrl: tab.wsUrl,
          fullPage,
          format: type as 'png' | 'jpeg',
          quality: type === 'jpeg' ? 85 : undefined,
        });
        
        const normalized = await normalizeScreenshot(buffer, {
          maxSide: 2048,
          maxBytes: 5 * 1024 * 1024,
        });
        
        const path = `/tmp/screenshot-${Date.now()}.${type}`;
        const { writeFile } = await import('fs/promises');
        await writeFile(path, normalized.buffer);
        
        res.json({ ok: true, path, targetId: tab.targetId, url: tab.url });
      }
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Get page snapshot
  app.get('/snapshot', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const format = req.query.format === 'aria' ? 'aria' : 'ai';
    const targetId = typeof req.query.targetId === 'string' ? req.query.targetId : '';
    const mode = req.query.mode === 'efficient' ? 'efficient' : undefined;
    const labels = req.query.labels === 'true';
    const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit) : undefined;
    const maxChars = typeof req.query.maxChars === 'string' ? parseInt(req.query.maxChars) : undefined;
    
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId || undefined);
      
      if (format === 'ai') {
        // AI snapshot with Playwright
        const wantsRoleSnapshot = labels || mode === 'efficient' || maxChars;
        
        if (wantsRoleSnapshot) {
          const { snapshotRoleViaPlaywright } = await import('../playwright/snapshot.js');
          const result = await snapshotRoleViaPlaywright({
            cdpUrl: profileCtx.profile.cdpUrl,
            targetId: tab.targetId,
            options: {
              interactive: mode === 'efficient',
              compact: mode === 'efficient',
            },
          });
          
          // Take screenshot with labels if requested
          if (labels) {
            const { takeScreenshotViaPlaywright } = await import('../playwright/actions.js');
            const { buffer } = await takeScreenshotViaPlaywright({
              cdpUrl: profileCtx.profile.cdpUrl,
              targetId: tab.targetId,
              type: 'png',
            });
            
            const path = `/tmp/snapshot-${Date.now()}.png`;
            const { writeFile } = await import('fs/promises');
            await writeFile(path, buffer);
            
            return res.json({
              ok: true,
              format,
              targetId: tab.targetId,
              url: tab.url,
              labels: true,
              imagePath: path,
              ...result,
            });
          }
          
          return res.json({
            ok: true,
            format,
            targetId: tab.targetId,
            url: tab.url,
            ...result,
          });
        }
        
        // Standard AI snapshot
        const { snapshotAiViaPlaywright } = await import('../playwright/snapshot.js');
        const result = await snapshotAiViaPlaywright({
          cdpUrl: profileCtx.profile.cdpUrl,
          targetId: tab.targetId,
          maxChars,
        });
        
        return res.json({
          ok: true,
          format,
          targetId: tab.targetId,
          url: tab.url,
          ...result,
        });
      }
      
      // ARIA snapshot
      if (profileCtx.profile.driver === 'extension' || !tab.wsUrl) {
        // Use Playwright for extension driver
        const { snapshotAriaViaPlaywright } = await import('../playwright/snapshot.js');
        const result = await snapshotAriaViaPlaywright({
          cdpUrl: profileCtx.profile.cdpUrl,
          targetId: tab.targetId,
          limit,
        });
        
        return res.json({
          ok: true,
          format,
          targetId: tab.targetId,
          url: tab.url,
          ...result,
        });
      }
      
      // Use CDP for direct connection
      const result = await snapshotAria({
        wsUrl: tab.wsUrl,
        limit,
      });
      
      res.json({
        ok: true,
        format,
        targetId: tab.targetId,
        url: tab.url,
        ...result,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
