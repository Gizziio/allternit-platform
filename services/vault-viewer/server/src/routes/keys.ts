import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { listKeys, createKey, revokeKey, type Scope } from '../services/apikeys.js';

export const keysRouter = Router();
keysRouter.use(requireAuth);

keysRouter.get('/', asyncHandler(async (_req, res) => res.json({ keys: await listKeys() })));

keysRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const name = String(req.body?.name ?? 'agent');
    const scopes = (Array.isArray(req.body?.scopes) ? req.body.scopes : ['read', 'search']) as Scope[];
    const { raw, record } = await createKey(name, scopes);
    // raw key returned exactly once
    res.json({ key: raw, record });
  }),
);

keysRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const ok = await revokeKey(req.params.id);
    res.status(ok ? 200 : 404).json({ ok });
  }),
);
