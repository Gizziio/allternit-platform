import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import * as git from '../services/git.js';

export const gitRouter = Router();
gitRouter.use(requireAuth);

gitRouter.get('/status', asyncHandler(async (_req, res) => res.json(await git.status())));

gitRouter.get(
  '/log',
  asyncHandler(async (req, res) => {
    const path = String(req.query.path ?? '').trim();
    if (!path) return res.status(400).json({ error: 'path required' });
    res.json({ commits: await git.log(path) });
  }),
);

gitRouter.get(
  '/show',
  asyncHandler(async (req, res) => {
    const hash = String(req.query.hash ?? '').trim();
    const path = String(req.query.path ?? '').trim();
    if (!hash || !path) return res.status(400).json({ error: 'hash and path required' });
    res.json({ content: await git.showFile(hash, path) });
  }),
);

gitRouter.post(
  '/init',
  asyncHandler(async (_req, res) => {
    await git.init();
    res.json(await git.status());
  }),
);

gitRouter.post(
  '/clone',
  asyncHandler(async (_req, res) => {
    await git.clone();
    res.json(await git.status());
  }),
);

gitRouter.post(
  '/pull',
  asyncHandler(async (_req, res) => {
    const message = await git.pull();
    console.log('[git] pull:', message);
    res.json({ message });
  }),
);

gitRouter.post(
  '/commit',
  asyncHandler(async (req, res) => {
    const message = await git.commitAll(String(req.body?.message ?? ''));
    console.log('[git] commit:', message);
    res.json({ message });
  }),
);

gitRouter.post(
  '/push',
  asyncHandler(async (_req, res) => {
    const message = await git.push();
    console.log('[git] push:', message);
    res.json({ message });
  }),
);

gitRouter.post(
  '/sync',
  asyncHandler(async (req, res) => {
    console.log('[git] manual sync requested');
    const result = await git.sync(req.body?.message);
    console.log(`[git] sync ${result.ok ? 'ok' : 'not-ok'}:`, result.log.join(' | '));
    res.json(result);
  }),
);
