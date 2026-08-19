/**
 * Bot Prompt Augmentation
 *
 * Generates phase-specific system prompt augmentations for bot sessions.
 * Each phase of the goal/task loop (planning, executing, reviewing, delivering,
 * complete) gets tailored instructions appended to the base system prompt.
 *
 * @module bot-prompt-augmentation
 */

import { createModuleLogger } from "@/lib/logger";

const logger = createModuleLogger("BotPromptAugmentation");

// ============================================================================
// Types
// ============================================================================

export type BotPhase =
  | "idle"
  | "planning"
  | "executing"
  | "reviewing"
  | "delivering"
  | "complete";

export interface PromptAugmentationContext {
  phase: BotPhase;
  botName: string;
  taskTitle?: string;
  blockedBy?: string[];
  requiredArtifacts?: string[];
  writeScope?: { root: string; allowedGlobs: string[] };
  toolAllowlist?: string[];
  artifactPaths?: string[];
  iteration?: { current: number; max: number };
  previousPlan?: string;
  reviewNotes?: string;
}

// ============================================================================
// Phase Prompt Templates
// ============================================================================

const PHASE_PROMPTS: Record<BotPhase, (ctx: PromptAugmentationContext) => string> = {
  idle: (_ctx) => {
    return [
      "## Current Phase: Idle",
      "",
      "You are waiting for a task assignment. Do not begin any work until a task is provided.",
    ].join("\n");
  },

  planning: (ctx) => {
    const lines: string[] = [
      "## Current Phase: Planning",
      "",
      "Create a structured execution plan for the current task.",
      "",
    ];

    if (ctx.taskTitle) {
      lines.push(`**Task:** ${ctx.taskTitle}`, "");
    }

    if (ctx.blockedBy && ctx.blockedBy.length > 0) {
      lines.push(
        "**Blocked by:**",
        ...ctx.blockedBy.map((dep) => `- ${dep}`),
        "",
        "You must wait for these dependencies to be resolved before proceeding. If a dependency is not yet available, note it in your plan and propose a partial execution path.",
        "",
      );
    }

    if (ctx.requiredArtifacts && ctx.requiredArtifacts.length > 0) {
      lines.push(
        "**Required artifacts:**",
        ...ctx.requiredArtifacts.map((a) => `- ${a}`),
        "",
        "Your plan should include steps to produce each of these artifacts.",
        "",
      );
    }

    if (ctx.iteration) {
      lines.push(
        `**Iteration:** ${ctx.iteration.current} of ${ctx.iteration.max}`,
        "",
      );
    }

    if (ctx.previousPlan) {
      lines.push(
        "**Previous plan (for reference):**",
        "```",
        ctx.previousPlan,
        "```",
        "",
        "If this is a re-plan, address what changed and why the previous plan did not complete.",
        "",
      );
    }

    lines.push(
      "**Instructions:**",
      "- Break the task into discrete, ordered steps.",
      "- For each step, identify which tools you will use.",
      "- Estimate the effort and risk for each step.",
      "- Do NOT begin executing. Wait for plan approval before proceeding.",
      "- Output your plan in a structured format that can be reviewed by a human or orchestrator.",
    );

    return lines.join("\n");
  },

  executing: (ctx) => {
    const lines: string[] = [
      "## Current Phase: Executing",
      "",
      "Execute the approved plan step by step.",
      "",
    ];

    if (ctx.taskTitle) {
      lines.push(`**Task:** ${ctx.taskTitle}`, "");
    }

    if (ctx.writeScope) {
      lines.push(
        "**Write scope:**",
        `- Root: \`${ctx.writeScope.root}\``,
        `- Allowed globs: ${ctx.writeScope.allowedGlobs.map((g) => `\`${g}\``).join(", ")}`,
        "",
        "You MUST NOT write files outside this scope. If you need to write outside the allowed paths, request a scope expansion through the gate review system.",
        "",
      );
    }

    if (ctx.toolAllowlist && ctx.toolAllowlist.length > 0) {
      lines.push(
        "**Tool allowlist:**",
        ...ctx.toolAllowlist.map((t) => `- \`${t}\``),
        "",
        "You may only use the tools listed above. If you need an unlisted tool, request approval through the gate review system.",
        "",
      );
    }

    if (ctx.iteration) {
      lines.push(
        `**Iteration:** ${ctx.iteration.current} of ${ctx.iteration.max}`,
        "",
      );
    }

    lines.push(
      "**Instructions:**",
      "- Follow the approved plan strictly.",
      "- Report progress after completing each step.",
      "- If you encounter a blocker or deviation, stop and request guidance.",
      "- Do not skip steps or reorder without approval.",
      "- Log any unexpected issues or deviations from the plan.",
    );

    return lines.join("\n");
  },

  reviewing: (ctx) => {
    const lines: string[] = [
      "## Current Phase: Reviewing",
      "",
      "Summarize what you accomplished during execution.",
      "",
    ];

    if (ctx.taskTitle) {
      lines.push(`**Task:** ${ctx.taskTitle}`, "");
    }

    if (ctx.artifactPaths && ctx.artifactPaths.length > 0) {
      lines.push(
        "**Expected artifact paths:**",
        ...ctx.artifactPaths.map((p) => `- \`${p}\``),
        "",
        "Verify that each artifact exists at the expected path and is in a valid state.",
        "",
      );
    }

    if (ctx.requiredArtifacts && ctx.requiredArtifacts.length > 0) {
      lines.push(
        "**Required artifacts:**",
        ...ctx.requiredArtifacts.map((a) => `- ${a}`),
        "",
        "Confirm each required artifact was produced.",
        "",
      );
    }

    if (ctx.reviewNotes) {
      lines.push(
        "**Review notes from previous cycle:**",
        ctx.reviewNotes,
        "",
        "Address any feedback or issues raised in the review notes.",
        "",
      );
    }

    lines.push(
      "**Instructions:**",
      "- List each step from the plan and whether it completed successfully.",
      "- List any issues, errors, or partial completions.",
      "- Provide a summary of all artifacts produced and their locations.",
      "- Flag any steps that need rework or further iteration.",
      "- If issues were found, propose a remediation plan.",
    );

    return lines.join("\n");
  },

  delivering: (ctx) => {
    const lines: string[] = [
      "## Current Phase: Delivering",
      "",
      "Finalize and deliver all artifacts.",
      "",
    ];

    if (ctx.taskTitle) {
      lines.push(`**Task:** ${ctx.taskTitle}`, "");
    }

    if (ctx.artifactPaths && ctx.artifactPaths.length > 0) {
      lines.push(
        "**Artifact paths:**",
        ...ctx.artifactPaths.map((p) => `- \`${p}\``),
        "",
        "Ensure each artifact is written to the correct path and is in its final state.",
        "",
      );
    }

    lines.push(
      "**Instructions:**",
      "- Ensure all artifacts are written to their correct final paths.",
      "- Verify file integrity (no partial writes, correct encoding).",
      "- Clean up any temporary files or intermediate outputs.",
      "- Produce a final delivery manifest listing all deliverables.",
    );

    return lines.join("\n");
  },

  complete: (ctx) => {
    const lines: string[] = [
      "## Current Phase: Complete",
      "",
      "The task is complete. Provide a final summary.",
      "",
    ];

    if (ctx.taskTitle) {
      lines.push(`**Task:** ${ctx.taskTitle}`, "");
    }

    if (ctx.iteration) {
      lines.push(
        `**Completed in:** ${ctx.iteration.current} iteration${ctx.iteration.current !== 1 ? "s" : ""} (max ${ctx.iteration.max})`,
        "",
      );
    }

    lines.push(
      "**Instructions:**",
      "- Provide a concise summary of what was accomplished.",
      "- List all deliverables and their locations.",
      "- Note any outstanding issues or follow-up items.",
      "- Do not begin any new work. Wait for the next task assignment.",
    );

    return lines.join("\n");
  },
};

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate phase-specific system prompt augmentation.
 * This gets appended to the bot's base system prompt for each phase.
 */
export function generatePhasePrompt(context: PromptAugmentationContext): string {
  const generator = PHASE_PROMPTS[context.phase];
  if (!generator) {
    logger.warn({ phase: context.phase }, "Unknown phase, returning empty augmentation");
    return "";
  }

  logger.debug(
    { phase: context.phase, botName: context.botName },
    "Generating phase prompt",
  );

  return generator(context);
}

/**
 * Get the full augmented system prompt for a bot in a given phase.
 * Combines the base system prompt with the phase-specific augmentation.
 */
export function getAugmentedSystemPrompt(
  baseSystemPrompt: string,
  context: PromptAugmentationContext,
): string {
  const phasePrompt = generatePhasePrompt(context);

  if (!phasePrompt) {
    return baseSystemPrompt;
  }

  const botIdentity = context.botName
    ? `\n\nYou are operating as **${context.botName}**.\n`
    : "";

  return [
    baseSystemPrompt,
    botIdentity,
    "\n---\n",
    phasePrompt,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Map a session status string to a bot phase.
 * Handles the various status strings used across the session lifecycle.
 */
export function sessionStatusToPhase(status: string): BotPhase {
  const normalized = status.toLowerCase().trim();

  switch (normalized) {
    case "idle":
    case "disconnected":
    case "stopped":
      return "idle";

    case "connecting":
    case "hydrating":
    case "planning":
    case "plan_requested":
      return "planning";

    case "executing":
    case "running":
    case "active":
    case "tool_use":
      return "executing";

    case "reviewing":
    case "review":
    case "gate_review":
    case "pending_review":
    case "compacting":
      return "reviewing";

    case "delivering":
    case "responding":
    case "finalizing":
      return "delivering";

    case "complete":
    case "completed":
    case "done":
    case "finished":
      return "complete";

    case "error":
    case "failed":
    case "escalated":
      // Errors stay in whatever phase they occurred in;
      // default to reviewing so the user sees the issue.
      return "reviewing";

    default:
      logger.warn({ status }, "Unknown session status, defaulting to idle");
      return "idle";
  }
}
