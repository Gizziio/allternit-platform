/**
 * Browser Agent Action Routes
 * Ported from OpenClaw dist/browser/routes/agent.act.js
 */

import type { Express, Request, Response } from 'express';
import type { createBrowserRouteContext } from '../server-context.js';
import type { ActKind } from '../../types/index.js';

const VALID_ACT_KINDS: ActKind[] = [
  'click', 'type', 'press', 'hover', 'scrollIntoView',
  'drag', 'select', 'fill', 'resize', 'wait', 'evaluate', 'close',
];

function isActKind(kind: string): kind is ActKind {
  return VALID_ACT_KINDS.includes(kind as ActKind);
}

export function registerBrowserAgentActRoutes(
  app: Express,
  ctx: ReturnType<typeof createBrowserRouteContext>
): void {
  // Perform action
  app.post('/act', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { kind: kindRaw, targetId: targetIdRaw, ...body } = req.body;
    
    if (!isActKind(kindRaw)) {
      return res.status(400).json({ error: 'kind is required and must be a valid action type' });
    }
    
    const kind = kindRaw;
    const targetId = targetIdRaw || undefined;
    
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      const cdpUrl = profileCtx.profile.cdpUrl;
      
      const {
        clickViaPlaywright,
        typeViaPlaywright,
        pressKeyViaPlaywright,
        hoverViaPlaywright,
        waitForViaPlaywright,
        evaluateViaPlaywright,
      } = await import('../playwright/actions.js');
      
      switch (kind) {
        case 'click': {
          const { ref, doubleClick, button, modifiers, timeoutMs } = body;
          if (!ref) return res.status(400).json({ error: 'ref is required' });
          
          await clickViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            ref,
            doubleClick,
            button,
            modifiers,
            timeoutMs,
          });
          break;
        }
        
        case 'type': {
          const { ref, text, submit, slowly, timeoutMs } = body;
          if (!ref) return res.status(400).json({ error: 'ref is required' });
          if (typeof text !== 'string') return res.status(400).json({ error: 'text is required' });
          
          await typeViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            ref,
            text,
            submit,
            slowly,
            timeoutMs,
          });
          break;
        }
        
        case 'press': {
          const { key, delayMs } = body;
          if (!key) return res.status(400).json({ error: 'key is required' });
          
          await pressKeyViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            key,
            delayMs,
          });
          break;
        }
        
        case 'hover': {
          const { ref, timeoutMs } = body;
          if (!ref) return res.status(400).json({ error: 'ref is required' });
          
          await hoverViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            ref,
            timeoutMs,
          });
          break;
        }
        
        case 'wait': {
          const { timeMs, text, textGone, selector, url, loadState, fn, timeoutMs } = body;
          
          await waitForViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            timeMs,
            text,
            textGone,
            selector,
            url,
            loadState,
            fn,
            timeoutMs,
          });
          break;
        }
        
        case 'evaluate': {
          const { fn } = body;
          if (!fn) return res.status(400).json({ error: 'fn is required' });
          
          const result = await evaluateViaPlaywright({
            cdpUrl,
            targetId: tab.targetId,
            fn,
          });
          
          return res.json({
            ok: true,
            targetId: tab.targetId,
            url: tab.url,
            result,
          });
        }
        
        case 'close': {
          const { closeTab } = await import('../cdp/tabs.js');
          await closeTab(cdpUrl, tab.targetId);
          break;
        }
        
        default:
          return res.status(400).json({ error: `Action '${kind}' not yet implemented` });
      }
      
      res.json({ ok: true, targetId: tab.targetId, url: tab.url });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // File chooser hook
  app.post('/hooks/file-chooser', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { paths, ref, inputRef, element, targetId, timeoutMs } = req.body;
    
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'paths are required' });
    }
    
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      
      // Implementation would use CDP to set file inputs
      res.json({ ok: true, targetId: tab.targetId, paths });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
  
  // Dialog hook
  app.post('/hooks/dialog', async (req: Request, res: Response) => {
    const profileCtx = ctx.resolveProfileContext(req, res, ctx);
    if (!profileCtx) return;
    
    const { accept, promptText, targetId, timeoutMs } = req.body;
    
    try {
      const tab = await profileCtx.ensureTabAvailable(targetId);
      
      // Implementation would use CDP to handle dialogs
      res.json({ ok: true, targetId: tab.targetId, accept, promptText });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });
}
