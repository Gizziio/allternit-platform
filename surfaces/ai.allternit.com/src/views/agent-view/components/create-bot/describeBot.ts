"use client";

import type { BotCategory } from "@/lib/agents/agent.types";
import { getDefaultAgentModel } from "@/lib/agents/agent-models";
import { BOT_TEMPLATES } from "@/lib/bots/bots.manifest";
import { BOT_NATIVE_TOOLS } from "@/lib/bots/bot-tool-registry";
import { createModuleLogger } from "@/lib/logger";

const logger = createModuleLogger("CreateBotWizard");

const ALLTERNIT_AI_URL = process.env.NEXT_PUBLIC_ALLTERNIT_AI_URL || "";

/** Hard cap so a hung model can never wedge the wizard (fallback → null). */
export const DESCRIBE_BOT_TIMEOUT_MS = 20_000;

const VALID_CATEGORIES: BotCategory[] = [
  "research",
  "code",
  "writing",
  "data",
  "sales",
  "design",
  "ops",
  "custom",
];

const TEMPLATE_IDS = new Set(BOT_TEMPLATES.map((t) => t.id));
const TOOL_IDS = new Set(BOT_NATIVE_TOOLS.map((t) => t.id));

export interface DescribeBotResult {
  displayName?: string;
  tagline?: string;
  botCategory?: BotCategory;
  description?: string;
  systemPrompt?: string;
  welcomeMessage?: string;
  starterPrompts?: string[];
  allowedTools?: string[];
  suggestedTemplateId?: string;
}

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const RESULT_SCHEMA = `{
  "displayName": "Name — Role",
  "tagline": "short description for the bot card",
  "botCategory": "one of: research | code | writing | data | sales | design | ops | custom",
  "description": "one or two sentences: what the bot does",
  "systemPrompt": "the bot's job instructions (what it does and does not do)",
  "welcomeMessage": "first message the bot sends in a new session",
  "starterPrompts": ["up to 5 clickable example prompts"],
  "allowedTools": ["subset of: ${BOT_NATIVE_TOOLS.map((t) => t.id).join(", ")}"],
  "suggestedTemplateId": "nearest of: ${BOT_TEMPLATES.map((t) => t.id).join(", ")}"
}`;

/**
 * One call on the platform's existing chat-completions route — the exact
 * request shape the playground uses (POST /api/chat/completions, platform
 * default model, non-streaming). Forced JSON via response_format plus a
 * schema-first system prompt; the response is still validated defensively
 * below because not every backend model honors response_format.
 */
async function callCompletionJson(
  messages: ChatCompletionMessage[],
  signal: AbortSignal,
): Promise<unknown | null> {
  const base = ALLTERNIT_AI_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const res = await fetch(`${base}/api/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: getDefaultAgentModel().id,
      messages,
      temperature: 0.4,
      max_tokens: 1500,
      stream: false,
      response_format: { type: "json_object" },
    }),
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) return null;
  // Tolerate models that wrap JSON in a code fence despite instructions.
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : content;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Defensive narrow validation: unknown categories/tools/templates are
 * dropped, wrong types are ignored. Returns null when nothing usable came
 * back, so callers can fall back to template defaults silently. */
export function validateDescribeBotResult(input: unknown): DescribeBotResult | null {
  if (typeof input !== "object" || input === null) return null;
  const obj = input as Record<string, unknown>;
  const out: DescribeBotResult = {};

  const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);

  out.displayName = str(obj.displayName);
  out.tagline = str(obj.tagline);
  out.description = str(obj.description);
  out.systemPrompt = str(obj.systemPrompt);
  out.welcomeMessage = str(obj.welcomeMessage);

  if (typeof obj.botCategory === "string" && VALID_CATEGORIES.includes(obj.botCategory as BotCategory)) {
    out.botCategory = obj.botCategory as BotCategory;
  }

  if (Array.isArray(obj.starterPrompts)) {
    const prompts = obj.starterPrompts.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, 5);
    if (prompts.length > 0) out.starterPrompts = prompts;
  }

  if (Array.isArray(obj.allowedTools)) {
    const tools = obj.allowedTools.filter((t): t is string => typeof t === "string" && TOOL_IDS.has(t));
    if (tools.length > 0) out.allowedTools = tools;
  }

  if (typeof obj.suggestedTemplateId === "string" && TEMPLATE_IDS.has(obj.suggestedTemplateId)) {
    out.suggestedTemplateId = obj.suggestedTemplateId;
  }

  const hasAnything =
    out.displayName ||
    out.tagline ||
    out.description ||
    out.systemPrompt ||
    out.welcomeMessage ||
    out.botCategory ||
    out.starterPrompts ||
    out.allowedTools ||
    out.suggestedTemplateId;
  return hasAnything ? out : null;
}

export interface DescribeBotInput {
  /** Free-text paragraph describing the bot the user wants. */
  description: string;
  /** Optional existing context so the call refines instead of reinventing. */
  displayName?: string;
  currentSystemPrompt?: string;
}

/**
 * Describe-to-prefill accelerator (plan milestone 5). ONE LLM call; on ANY
 * failure — network, non-JSON, validation, timeout — returns null and the
 * UI keeps the selected template's defaults. Never throws, never blocks.
 */
export async function describeBot(input: DescribeBotInput): Promise<DescribeBotResult | null> {
  const paragraph = input.description.trim();
  if (!paragraph) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DESCRIBE_BOT_TIMEOUT_MS);
  try {
    const messages: ChatCompletionMessage[] = [
      {
        role: "system",
        content:
          "You configure bots on a platform. Reply with ONLY a JSON object matching this schema " +
          "(no prose, no code fences):\n" +
          RESULT_SCHEMA +
          "\nFill every field from the user's description. Keep every value plain and short. " +
          "suggestedTemplateId must be the closest catalog template, not the user's words.",
      },
      {
        role: "user",
        content:
          (input.displayName ? `Current bot name: ${input.displayName}\n` : "") +
          (input.currentSystemPrompt
            ? `Current job instructions (improve, keep the intent):\n${input.currentSystemPrompt}\n`
            : "") +
          `Describe the bot I want:\n${paragraph}`,
      },
    ];
    const raw = await callCompletionJson(messages, controller.signal);
    return validateDescribeBotResult(raw);
  } catch (err) {
    logger.warn({ err }, "describeBot failed; falling back to template defaults");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Job-step helper: rewrite the system prompt from the bot's description and
 * current instructions. Same call, same fallback contract — null on failure.
 */
export async function refineSystemPrompt(input: DescribeBotInput): Promise<DescribeBotResult | null> {
  return describeBot({ ...input, currentSystemPrompt: input.currentSystemPrompt });
}
