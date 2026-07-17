/**
 * agent-chat — post-hoc "ask a persona a question" after a simulation has run.
 *
 * Phase 2's `runSimulation` only drives the round loop; this is the "Deep
 * Interaction" step from docs/SWARM_MIROFISH_MAP.md's workflow (chat with
 * any simulated agent afterward). A post-hoc question is not a simulation
 * round, so `askPersona` does not write back to `memoryStore` — but the
 * prompt does carry the conversation so far and the world's round summaries,
 * so follow-up questions are answered in context rather than amnesiac
 * single-turns.
 */

import { generateText } from "ai";

import { getPluginModel } from "@/lib/ai/providers";
import { createModuleLogger } from '@/lib/logger';

import { modelCallSignal } from "./model-call";
import type { MemoryStore } from "./memory-store";
import type { AgentMemoryEvent, Persona, WorldState } from "./types";

const logger = createModuleLogger('MiroFish');

const DEFAULT_MEMORY_LIMIT = 5;
const MAX_SEED_CHARS = 1500;
const MAX_ROUND_SUMMARIES = 3;
const MAX_SUMMARY_CHARS = 400;
const MAX_HISTORY_EXCHANGES = 4;
const ASK_MAX_OUTPUT_TOKENS = 300;

/** One prior Q&A exchange in this persona's post-simulation chat. */
export interface AskExchange {
  question: string;
  answer: string;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function buildAskPrompt(
  world: WorldState,
  persona: Persona,
  recentMemory: AgentMemoryEvent[],
  question: string,
  history: AskExchange[]
): string {
  const memoryLines =
    recentMemory.length > 0
      ? recentMemory.map((event) => `Round ${event.round}: ${event.content}`).join("\n")
      : "(none yet)";

  const roundLines =
    world.roundSummaries.length > 0
      ? world.roundSummaries
          .slice(-MAX_ROUND_SUMMARIES)
          .map((r) => truncate(r.summary, MAX_SUMMARY_CHARS))
          .join("\n")
      : "(no rounds were recorded)";

  const historyBlock =
    history.length > 0
      ? `\nYour conversation so far:\n${history
          .slice(-MAX_HISTORY_EXCHANGES)
          .map((e) => `Q: ${e.question}\nA: ${e.answer}`)
          .join("\n")}\n`
      : "";

  return `You are ${persona.name}. ${persona.bio}
Traits: ${JSON.stringify(persona.traits)}

Seed material (${world.seed.kind}):
"""
${truncate(world.seed.text, MAX_SEED_CHARS)}
"""

What happened in the simulation (round summaries):
${roundLines}

Your recent memory from the simulation:
${memoryLines}
${historyBlock}
Someone is now asking you, in character, after the simulation: "${question}"

Answer in 2-4 sentences, in character, consistent with what you thought, said, or did during the simulation and with your previous answers. Respond with plain text only, no JSON, no preamble.`;
}

export interface AskPersonaOptions {
  /** Prior exchanges in this persona's chat — included in the prompt. */
  history?: AskExchange[];
  signal?: AbortSignal;
  /** Registry model id; defaults to the registry default. */
  modelId?: string;
}

/**
 * Ask one persona a question after a simulation has run. Does not write to
 * `memoryStore` — see module doc comment.
 */
export async function askPersona(
  world: WorldState,
  persona: Persona,
  memoryStore: MemoryStore,
  question: string,
  options: AskPersonaOptions = {}
): Promise<string> {
  const recentMemory = await memoryStore.retrieve(persona.id, { limit: DEFAULT_MEMORY_LIMIT });
  const model = await getPluginModel(options.modelId as never);
  const prompt = buildAskPrompt(world, persona, recentMemory, question, options.history ?? []);

  logger.debug({ worldId: world.id, personaId: persona.id }, "Asking persona a post-hoc question");

  const { text } = await generateText({
    model,
    prompt,
    temperature: 0.7,
    maxOutputTokens: ASK_MAX_OUTPUT_TOKENS,
    abortSignal: modelCallSignal(options.signal),
  });
  return text;
}
