/**
 * /v1/conversations router
 *
 * POST   /v1/conversations                          — create
 * GET    /v1/conversations/:conversationId          — retrieve
 * GET    /v1/conversations/:conversationId/replies  — list replies
 */

import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  createConversation,
  getConversation,
  getRepliesForConversation,
} from "./store.js";

export const conversationsRouter = Router();

conversationsRouter.post("/", (req, res) => {
  const id = (req.body as { id?: string }).id ?? uuidv4();
  const c = createConversation(id);
  res.status(201).json(c);
});

conversationsRouter.get("/:conversationId", (req, res) => {
  const c = getConversation(req.params.conversationId);
  if (!c) return res.status(404).json({ error: "conversation not found" });
  res.json(c);
});

conversationsRouter.get("/:conversationId/replies", (req, res) => {
  const replies = getRepliesForConversation(req.params.conversationId);
  res.json({ replies });
});
