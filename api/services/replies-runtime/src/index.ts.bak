/**
 * Replies Runtime Service
 *
 * Phase 1: in-memory store. Swap store.ts for a Postgres-backed version in Phase 2 (#39).
 *
 * Routes:
 *   POST/GET  /v1/replies
 *   GET       /v1/replies/:id/stream    — SSE ReplyEvents
 *   POST      /v1/replies/:id/cancel
 *   POST/GET  /v1/conversations
 *   GET       /v1/runs/:id + /events
 *   GET       /v1/tools                — stub
 */

import express from "express";
import cors from "cors";
import { repliesRouter } from "./replies.router.js";
import { conversationsRouter } from "./conversations.router.js";
import { runsRouter } from "./runs.router.js";

const app = express();

app.use(cors());
app.use(express.json());

// Health
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "replies-runtime", store: "in-memory" });
});

// Routes
app.use("/v1/replies", repliesRouter);
app.use("/v1/conversations", conversationsRouter);
app.use("/v1/runs", runsRouter);

// Tools stub
app.get("/v1/tools", (_req, res) => {
  res.json({ tools: [] });
});

// Artifacts stub
app.get("/v1/artifacts/:artifactId", (_req, res) => {
  res.status(404).json({ error: "artifact not found" });
});

const PORT = process.env.PORT ?? 4200;
app.listen(PORT, () => {
  process.stdout.write(`replies-runtime listening on :${PORT}\n`);
});

export { app };
