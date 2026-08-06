import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.js';

export const COOKIE_NAME = 'webobsidian_token';

/** Require a valid session cookie for web/session routes. */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME] || bearer(req);
  if (token && (await verifyToken(token))) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function bearer(req: Request): string | undefined {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) return h.slice(7);
  return undefined;
}
