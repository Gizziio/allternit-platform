/**
 * agent-chat — post-hoc "ask a persona a question" after a simulation has run.
 *
 * Phase 2's `runSimulation` only drives the round loop; this is the "Deep
 * Interaction" step from docs/SWARM_MIROFISH_MAP.md's workflow (chat with
 * any simulated agent afterward). A post-hoc question is not a simulation
 * round, so `askPersona` does not write back to `memoryStore`.
 */

import { generateText } from "ai";

import { getDefaultPluginModel } from "@/lib/ai/providers";
import { createModuleLogger } from '@/lib/logger';

import type { MemoryStore } from "./memory-store";
import type { AgentMemoryEvent, Persona, WorldState } from "./types";

const logger = createModuleLogger('MiroFish');

const DEFAULT_MEMORY_LIMIT = 5;
const MAX_SEED_CHARS = 1500;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function buildAskPrompt(
  world: WorldState,
  persona: Persona,
  recentMemory: AgentMemoryEvent[],
  question: string
): string {
  const memoryLines =
    recentMemory.length > 0
      ? recentMemory.map((event) => `Round ${event.round}: ${event.content}`).join("\n")
      : "(none yet)";

  return `You are ${persona.name}. ${persona.bio}
Traits: ${JSON.stringify(persona.traits)}

Seed material (${world.seed.kind}):
"""
${truncate(world.seed.text, MAX_SEED_CHARS)}
"""

Your recent memory from the simulation:
${memoryLines}

Someone is now asking you, in character, after the simulation: "${question}"

Answer in 2-4 sentences, in character, consistent with what you thought, said, or did during the simulation. Respond with plain text only, no JSON, no preamble.`;
}

/**
 * Ask one persona a question after a simulation has run. Does not write to
 * `memoryStore` — see module doc comment.
 */
export async function askPersona(
  world: WorldState,
  persona: Persona,
  memoryStore: MemoryStore,
  question: string
): Promise<string> {
  const recentMemory = await memoryStore.retrieve(persona.id, { limit: DEFAULT_MEMORY_LIMIT });
  const model = await getDefaultPluginModel();
  const prompt = buildAskPrompt(world, persona, recentMemory, question);

  logger.debug({ worldId: world.id, personaId: persona.id }, "Asking persona a post-hoc question");

  const { text } = await generateText({ model, prompt, temperature: 0.7 });
  return text;
}
