import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import * as plugins from '../services/plugins.js';

export const pluginsRouter = Router();
pluginsRouter.use(requireAuth);

pluginsRouter.get('/', asyncHandler(async (_req, res) => res.json({ plugins: await plugins.listInstalled() })));

pluginsRouter.post(
  '/install',
  asyncHandler(async (req, res) => {
    const repo = String(req.body?.repo ?? '');
    if (!repo) {
      res.status(400).json({ error: 'repo required (owner/name)' });
      return;
    }
    res.json({ plugin: await plugins.installFromGithub(repo) });
  }),
);

pluginsRouter.patch(
  '/:id/enabled',
  asyncHandler(async (req, res) => {
    await plugins.setEnabled(req.params.id, Boolean(req.body?.enabled));
    res.json({ ok: true });
  }),
);

// Serve plugin assets to the browser loader.
pluginsRouter.get(
  '/:id/:asset',
  asyncHandler(async (req, res) => {
    const asset = req.params.asset;
    if (!['main.js', 'styles.css', 'manifest.json'].includes(asset)) {
      res.status(400).json({ error: 'invalid asset' });
      return;
    }
    const body = await plugins.getPluginAsset(req.params.id, asset as any);
    const type =
      asset === 'main.js'
        ? 'application/javascript'
        : asset === 'styles.css'
          ? 'text/css'
          : 'application/json';
    res.setHeader('Content-Type', type).send(body);
  }),
);
