// GET /v1/catalog — D13 subs model-selector catalog. Derived on read from the
// same snapshot assembly the router uses (no second assembly path); the
// entries are picker-ready and carry the fabric block a submitter needs.
// Auth pattern matches /v1/capabilities: any valid bearer token, no scope —
// this is read-only registry/health data the picker needs before any task
// exists.
import { Router, type Request, type Response } from "express";
import { subsModelCatalog } from "../catalog/subs_models.js";
import { buildSnapshot } from "../router/snapshot.js";
import type { GatewayDeps } from "./server.js";

export function catalogRouter(deps: GatewayDeps): Router {
  const router = Router();

  router.get("/v1/catalog", (_req: Request, res: Response) => {
    if (!deps.adapterRegistry) {
      res.json([]);
      return;
    }
    res.json(subsModelCatalog(buildSnapshot(deps.db, deps.adapterRegistry)));
  });

  return router;
}
