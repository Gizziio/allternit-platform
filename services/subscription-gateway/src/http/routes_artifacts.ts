// GET /v1/artifacts/:id — metadata row lookup only; the byte store, export,
// and download routes land with real artifacts in P3+.
import { Router, type Request, type Response } from "express";
import { getArtifact } from "../store/queries.js";
import { requireScope, type GatewayDeps } from "./server.js";

export function artifactsRouter(deps: GatewayDeps): Router {
  const router = Router();

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
