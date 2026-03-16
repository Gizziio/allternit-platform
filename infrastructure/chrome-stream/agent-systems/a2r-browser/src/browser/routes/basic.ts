/**
 * Browser Basic Routes
 * Ported from OpenClaw dist/browser/routes/basic.js
 */

import type { Express, Request, Response } from 'express';
import type { createBrowserRouteContext } from '../server-context.js';

export function registerBrowserBasicRoutes(
  app: Express,
  ctx: ReturnType<typeof createBrowserRouteContext>
): void {
  // Get status (profile-aware)
  app.get('/', async (req: Request, res: Response) => {
    const state = ctx.state();
    if (!state) {
      return res.status(503).json({ error: 'Browser server not started' });
    }
    
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    try {
      const [cdpHttp, cdpReady] = await Promise.all([
        profileCtx.isHttpReachable(300),
        profileCtx.isReachable(600),
      ]);
      
      const profileState = state.profiles.get(profileCtx.profile.name);
      
      res.json({
        enabled: state.resolved.enabled,
        profile: profileCtx.profile.name,
        running: cdpReady,
        cdpReady,
        cdpHttp,
        pid: profileState?.running?.pid ?? null,
        cdpPort: profileCtx.profile.cdpPort,
        cdpUrl: profileCtx.profile.cdpUrl,
        headless: state.resolved.headless,
        noSandbox: state.resolved.noSandbox,
        executablePath: state.resolved.executablePath ?? null,
        attachOnly: state.resolved.attachOnly,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // List all profiles
  app.get('/profiles', async (_req: Request, res: Response) => {
    const state = ctx.state();
    if (!state) {
      return res.status(503).json({ error: 'Browser server not started' });
    }
    
    const profiles = Object.values(state.resolved.profiles).map(p => ({
      name: p.name,
      color: p.color,
      cdpPort: p.cdpPort,
      driver: p.driver,
    }));
    
    res.json({ profiles });
  });
  
  // Start browser
  app.post('/start', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    try {
      await profileCtx.ensureBrowserAvailable();
      res.json({ ok: true, profile: profileCtx.profile.name });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Stop browser
  app.post('/stop', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    try {
      const result = await profileCtx.stopRunningBrowser();
      res.json({ ok: true, ...result, profile: profileCtx.profile.name });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Reset profile
  app.post('/reset-profile', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    try {
      const result = await profileCtx.resetProfile();
      res.json({ ok: true, profile: profileCtx.profile.name, ...result });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Create profile
  app.post('/profiles/create', async (req: Request, res: Response) => {
    const { name, color, cdpUrl, driver } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    
    // Profile creation logic here
    res.status(201).json({ ok: true, name, color, cdpUrl, driver });
  });
  
  // Delete profile
  app.delete('/profiles/:name', async (req: Request, res: Response) => {
    const { name } = req.params;
    
    if (!name) {
      return res.status(400).json({ error: 'Profile name is required' });
    }
    
    // Profile deletion logic here
    res.json({ ok: true, deleted: name });
  });
}
