/**
 * Create Bot wizard — pure step state machine, gating, and payload building.
 *
 * Kept free of React so the gating rules can be unit-tested directly and the
 * submit path can reuse the exact same payload the UI gated on.
 */

import type {
  AvatarConfig,
  CharacterLayerConfig,
  CreateAgentInput,
} from "@/lib/agents/agent.types";
import {
  validateAgentCreationChecklist,
  type ChecklistResult,
} from "@/lib/agents/agent-creation-checklist";

export type WizardStepId = "start" | "identity" | "job" | "computer";

export interface WizardStep {
  id: WizardStepId;
  label: string;
  railHint: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  { id: "start", label: "Start", railHint: "Pick a starting point" },
  { id: "identity", label: "Identity", railHint: "Name, look, and personality" },
  { id: "job", label: "Job", railHint: "Instructions and tools" },
  { id: "computer", label: "Computer & Runtime", railHint: "Desktop, model, and voice" },
];

export function wizardStepIndex(id: WizardStepId): number {
  return WIZARD_STEPS.findIndex((s) => s.id === id);
}

/** The one hard identity requirement: a display name of at least 2 chars. */
export function hasDisplayName(formData: Partial<CreateAgentInput>): boolean {
  return (formData.botProfile?.displayName?.trim().length ?? 0) >= 2;
}

/**
 * Can the user leave `step` (via Next or by jumping to a later step)?
 * Steps 2–4 all require the identity gate; the Start step is always valid.
 */
export function stepGateMet(
  step: WizardStepId,
  formData: Partial<CreateAgentInput>,
): boolean {
  switch (step) {
    case "start":
      return true;
    case "identity":
    case "job":
    case "computer":
      return hasDisplayName(formData);
  }
}

/**
 * No free step jumping: a step is reachable only when every step before it
 * passes its gate.
 */
export function canNavigateTo(
  targetIndex: number,
  formData: Partial<CreateAgentInput>,
): boolean {
  if (targetIndex < 0 || targetIndex >= WIZARD_STEPS.length) return false;
  for (let i = 0; i < targetIndex; i += 1) {
    if (!stepGateMet(WIZARD_STEPS[i].id, formData)) return false;
  }
  return true;
}

export function deriveHandle(displayName: string): string {
  return (
    displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "my-bot"
  );
}

/**
 * Default character layer for quick-created bots. Mirrors the server-side
 * fallback in normalizeCreateAgentInput, but built client-side because the
 * store's creation checklist validates the raw payload before normalization.
 * (Lifted unchanged from the previous CreateBotForm.)
 */
export function buildDefaultCharacterLayer(
  name: string,
  domain: string,
  displayName: string,
): CharacterLayerConfig {
  return {
    identity: {
      setup: "generalist",
      className: displayName,
      specialtySkills: [],
      temperament: "balanced",
      personalityTraits: [],
      backstory: "",
    },
    roleCard: {
      domain: domain || name || "general",
      inputs: [],
      outputs: [],
      definitionOfDone: [],
      hardBans: [],
      escalation: [],
      metrics: [],
    },
    voice: {
      style: "",
      rules: [],
      microBans: [],
      tone: { formality: 0.5, enthusiasm: 0.5, empathy: 0.5, directness: 0.5 },
    },
    progression: {
      class: "Generalist",
      relevantStats: [],
      level: { maxLevel: 99, xpFormula: "linear" },
    },
    avatar: {
      type: "mascot",
      mascot: { template: "bot" },
      style: { primaryColor: "#6366f1", accentColor: "#1e1c1a" },
    },
  };
}

export interface BuildPayloadArgs {
  formData: Partial<CreateAgentInput>;
  avatar: AvatarConfig;
}

/**
 * Build the exact CreateAgentInput the submit path sends — same derivation
 * rules as the old handleCreate (name/handle length fixes, description
 * fallback, default character layer, brain id into config). The wizard gates
 * the Create button on validateAgentCreationChecklist of THIS payload, so the
 * gate and the submit can never disagree.
 */
export function buildCreateBotPayload({ formData, avatar }: BuildPayloadArgs): CreateAgentInput {
  const botProfile = formData.botProfile!;
  const displayName = botProfile.displayName?.trim() || "My Bot";
  const derivedName = formData.name || deriveHandle(displayName);
  // The creation checklist requires name.length >= 3.
  const name = derivedName.length >= 3 ? derivedName : `${derivedName}-bot`;
  // The creation checklist requires description.length >= 10.
  const description =
    botProfile.tagline?.trim() ||
    formData.description?.trim() ||
    `${displayName} is a custom Allternit bot.`;
  const accentColor = botProfile.accentColor || "#D4956A";

  return {
    ...formData,
    name,
    description,
    avatar,
    characterLayer:
      formData.characterLayer ||
      buildDefaultCharacterLayer(name, botProfile.botCategory || "custom", displayName),
    botProfile: {
      ...botProfile,
      displayName,
      accentColor,
    } as CreateAgentInput["botProfile"],
    brainId: formData.brainId || undefined,
    config: {
      ...(formData.config || {}),
      brainId: formData.brainId || undefined,
    },
  } as CreateAgentInput;
}

/** The creation checklist for the would-be payload — drives the Create gate. */
export function createChecklistFor(
  formData: Partial<CreateAgentInput>,
  avatar: AvatarConfig,
): ChecklistResult {
  return validateAgentCreationChecklist(buildCreateBotPayload({ formData, avatar }));
}
