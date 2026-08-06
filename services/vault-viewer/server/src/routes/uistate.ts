import { Router } from 'express';
import { asyncHandler } from '../middleware/error.js';
import { requireAuth } from '../middleware/auth.js';
import { readUiState, writeUiState } from '../services/uistate.js';
import { broadcast } from '../services/realtime.js';

export const uiStateRouter = Router();
uiStateRouter.use(requireAuth);

uiStateRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await readUiState());
  }),
);

uiStateRouter.put(
  '/',
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'object body required' });
      return;
    }
    await writeUiState(body);
    // Notify other tabs/devices so they sync live. originId lets the sender
    // ignore the echo of its own change.
    const originId = String(req.headers['x-client-id'] ?? '');
    broadcast({ type: 'uistate', originId, state: body });
    res.json({ ok: true });
  }),
);
