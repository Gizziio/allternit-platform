// GET /v1/capabilities — live registry view. No adapters are loaded in P1,
// so the registry is empty and this returns [] (P1 smoke verify pins this).
import { Router, type Request, type Response } from "express";
import type { GatewayDeps } from "./server.js";

export function capabilitiesRouter(_deps: GatewayDeps): Router {
  const router = Router();

  router.get("/v1/capabilities", (_req: Request, res: Response) => {
    res.json([]);
  });

  return router;
}
