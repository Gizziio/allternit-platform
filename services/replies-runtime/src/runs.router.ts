/**
 * /v1/runs router
 *
 * GET    /v1/runs/:runId          — retrieve run
 * GET    /v1/runs/:runId/events   — event log for replay
 */

import { Router } from "express";
import { getRun, getRunEvents } from "./store.js";

export const runsRouter = Router();

runsRouter.get("/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) return res.status(404).json({ error: "run not found" });
  res.json(run);
});

runsRouter.get("/:runId/events", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) return res.status(404).json({ error: "run not found" });
  const events = getRunEvents(req.params.runId);
  res.json({ events });
});
