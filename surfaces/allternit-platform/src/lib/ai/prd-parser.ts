// ============================================================================
// PRD → Board Items Parser
// ============================================================================
// Adapted from Task Master's PRD parsing pattern.
// Takes a natural language description / PRD and returns structured board items
// with dependency graph, ready for direct insertion into useBoardStore.
// ============================================================================

import { generateObject } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { z } from 'zod';

// ─── Output Schema ────────────────────────────────────────────────────────────

const ParsedTaskSchema = z.object({
  tempId: z.string().describe('Stable temporary ID for dependency references, e.g. "task-1"'),
  title: z.string().describe('Short, actionable task title in imperative form'),
  description: z.string().describe('What needs to be done and why'),
  priority: z.enum(['high', 'medium', 'low']).describe('Task urgency/importance'),
  estimatedMinutes: z.number().int().min(5).max(480).describe('Realistic duration estimate in minutes'),
  dependencies: z.array(z.string()).describe('tempIds of tasks that must complete before this one'),
  labels: z.array(z.string()).describe('1-3 short category labels, e.g. ["backend", "auth"]'),
  testStrategy: z.string().optional().describe('How to verify this task is done'),
});

export const PRDParseOutputSchema = z.object({
  tasks: z.array(ParsedTaskSchema).min(1).max(50),
  summary: z.string().describe('One sentence describing the overall work breakdown'),
});

export type ParsedTask = z.infer<typeof ParsedTaskSchema>;
export type PRDParseOutput = z.infer<typeof PRDParseOutputSchema>;

// ─── Priority → numeric ───────────────────────────────────────────────────────

export const PRIORITY_MAP: Record<ParsedTask['priority'], number> = {
  high: 75,
  medium: 50,
  low: 25,
};

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert engineering project manager. Given a description or PRD, break the work into a structured, dependency-ordered list of discrete tasks.

Rules:
- Each task must be atomic — completable in one focused session (5–480 min)
- Tasks must be ordered so foundational work has no dependencies, and advanced work depends on earlier tasks
- Use tempId values like "task-1", "task-2", etc. sequentially
- dependencies[] contains only tempIds of other tasks in the same list
- No circular dependencies
- Priority: "high" for blockers/core path, "medium" for important features, "low" for polish/optional
- Labels: 1–3 concise lowercase tags (e.g. "backend", "ui", "auth", "database", "testing")
- estimatedMinutes: honest estimates — don't underestimate; a non-trivial feature is 120–240 min
- If the input is vague, make reasonable scoping assumptions and note them in task descriptions
- Do NOT add tasks for project management, documentation, or meetings — only engineering work`;

// ─── Generator ────────────────────────────────────────────────────────────────

interface ParseOptions {
  description: string;
  existingTitles?: string[];   // prevent duplication with existing board items
  maxTasks?: number;
  modelId?: string;
}

export async function parsePRDToTasks(opts: ParseOptions): Promise<PRDParseOutput> {
  const { description, existingTitles = [], maxTasks = 20, modelId = 'claude-sonnet-4-5' } = opts;

  const existingContext = existingTitles.length > 0
    ? `\n\nExisting board items (DO NOT duplicate):\n${existingTitles.map(t => `- ${t}`).join('\n')}`
    : '';

  const userPrompt =
    `Generate up to ${maxTasks} tasks for the following work:\n\n${description}${existingContext}`;

  const result = await generateObject({
    model: gateway(modelId),
    schema: PRDParseOutputSchema,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
  });

  return result.object;
}

// ─── Dependency resolution ────────────────────────────────────────────────────
// Maps tempId → real BoardItem ID after creation so dependencies[] are valid.

export function resolveDependencies(
  tasks: ParsedTask[],
  tempIdToRealId: Map<string, string>,
): Array<{ tempId: string; resolvedDeps: string[] }> {
  return tasks.map((task) => ({
    tempId: task.tempId,
    resolvedDeps: task.dependencies
      .map((dep) => tempIdToRealId.get(dep))
      .filter((id): id is string => id !== undefined),
  }));
}
