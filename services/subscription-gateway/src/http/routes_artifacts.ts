// GET /v1/artifacts + GET /v1/artifacts/:id — metadata rows only; byte export
// and sandboxed preview routes land with the preview bundle work (§A6.6).
import { Router, type Request, type Response } from "express";
import { getArtifact, listArtifacts } from "../store/queries.js";
import { requireScope, type GatewayDeps } from "./server.js";

export function artifactsRouter(deps: GatewayDeps): Router {
  const router = Router();

  router.get("/v1/artifacts", requireScope("artifacts:read"), (_req: Request, res: Response) => {
    res.json(listArtifacts(deps.db));
  });

  router.get("/v1/artifacts/:id", requireScope("artifacts:read"), (req: Request, res: Response) => {
    const artifact = getArtifact(deps.db, req.params.id);
    if (!artifact) {
      res.status(404).json({ error: "artifact_not_found", artifact_id: req.params.id });
      return;
    }
    res.json(artifact);
  });

  return router;
}
