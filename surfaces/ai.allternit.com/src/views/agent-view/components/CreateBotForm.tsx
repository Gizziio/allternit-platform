"use client";

import React from "react";
import type { CreateAgentInput } from "@/lib/agents/agent.types";
import { CreateBotWizard } from "./create-bot/CreateBotWizard";

interface CreateBotFormProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Optional prefill (bot templates, duplicates). Create Bot stays atomic —
   * a draft only seeds the form; the single submit still writes all four
   * Bot fields and provisions the persistent desktop.
   */
  draft?: Partial<CreateAgentInput>;
}

/**
 * Launch contract unchanged: same `isOpen/onClose(/draft)` modal API and the
 * same five call sites. The form is now a thin wrapper that mounts the
 * 4-step CreateBotWizard (see .steering/plan-create-bot-wizard.md).
 */
export function CreateBotForm({ isOpen, onClose, draft }: CreateBotFormProps) {
  return <CreateBotWizard isOpen={isOpen} onClose={onClose} draft={draft} />;
}
