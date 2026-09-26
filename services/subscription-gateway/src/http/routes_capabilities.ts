// GET /v1/capabilities — live registry view (loaded adapter manifests). Empty
// when no registry is wired (unit tests) or no adapters are installed.
import { Router, type Request, type Response } from "express";
import type { GatewayDeps } from "./server.js";

export function capabilitiesRouter(deps: GatewayDeps): Router {
  const router = Router();

  router.get("/v1/capabilities", (_req: Request, res: Response) => {
    res.json(deps.adapterRegistry?.capabilities() ?? []);
  });

  return router;
}
