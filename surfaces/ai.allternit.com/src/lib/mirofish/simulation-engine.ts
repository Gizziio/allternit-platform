/**
 * simulation-engine — orchestrates the multi-round MiroFish simulation loop.
 *
 * Agent-to-agent interaction for Phase 2 means: each round's summary (what
 * happened, who did what) is visible to every agent's next turn. There is no
 * pairwise agent-to-agent messaging here — a shared round summary is the
 * only "social" signal, per the Phase 2 task spec. Don't build more than
 * that in this file.
 */

import { generateText } from "ai";

import { getDefaultPluginModel } from "@/lib/ai/providers";
import { createModuleLogger } from '@/lib/logger';

import { LocalSwarmProvider } from "@/lib/sandbox/swarm/local-provider";
import { SwarmScheduler } from "@/lib/sandbox/swarm/scheduler";
import type { SwarmUnitSpec } from "@/lib/sandbox/swarm/types";

import { InMemoryMemoryStore } from "./memory-store";
import type { MemoryStore } from "./memory-store";
import { buildPersonas } from "./persona-builder";
import type {
  AgentMemoryEvent,
  Persona,
  RoundSummary,
  SeedMaterial,
  SimulationConfig,
  WorldState,
} from "./types";

const logger = createModuleLogger('MiroFish');

const DEFAULT_MAX_SUMMARY_CHARS = 1000;

function generateWorldId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `world-${crypto.randomUUID()}`;
  }
  return `world-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

export interface RunSimulationOptions {
  /** Memory store to use. Defaults to a fresh InMemoryMemoryStore scoped to this run. */
  memoryStore?: MemoryStore;
  /** Max concurrent LLM calls per round / persona build. */
  concurrency?: number;
}

/** Build the initial WorldState from seed material + config (personas via persona-builder). */
export async function buildInitialWorldState(
  seed: SeedMaterial,
  config: SimulationConfig,
  options: RunSimulationOptions = {}
): Promise<WorldState> {
  const personas = await buildPersonas(seed, config.populationSize, {
    concurrency: options.concurrency,
  });

  return {
    id: generateWorldId(),
    seed,
    personas,
    currentRound: 0,
    roundSummaries: [],
  };
}

function buildTurnPrompt(
  world: WorldState,
  persona: Persona,
  recentMemory: AgentMemoryEvent[],
  previousSummary: RoundSummary | undefined,
  maxSummaryChars: number
): string {
  const memoryLines =
    recentMemory.length > 0
      ? recentMemory.map((event) => `Round ${event.round}: ${event.content}`).join("\n")
      : "(none yet)";

  const summaryLine = previousSummary
    ? truncate(previousSummary.summary, maxSummaryChars)
    : "(this is the first round)";

  return `You are ${persona.name}. ${persona.bio}
Traits: ${JSON.stringify(persona.traits)}

Seed material (${world.seed.kind}):
"""
${world.seed.text}
"""

What happened last round: ${summaryLine}

Your recent memory:
${memoryLines}

It is round ${world.currentRound + 1}. In 2-4 sentences, describe what you think, say, or do this round, in character. Respond with plain text only, no JSON, no preamble.`;
}

interface AgentTurnResult {
  personaId: string;
  content: string;
}

/** Run one round: one LLM turn per persona, fanned out concurrently. Writes memory per turn. */
async function runRound(
  world: WorldState,
  memoryStore: MemoryStore,
  maxSummaryChars: number,
  concurrency: number | undefined
): Promise<AgentTurnResult[]> {
  const provider = new LocalSwarmProvider();
  const scheduler = new SwarmScheduler(provider, { concurrency });

  const specs: SwarmUnitSpec[] = world.personas.map((persona) => ({
    metadata: { personaId: persona.id },
  }));

  const { units } = await scheduler.createBatch(specs);
  const personaByUnitId = new Map(units.map((unit, index) => [unit.id, world.personas[index]]));

  const previousSummary = world.roundSummaries[world.roundSummaries.length - 1];
  const model = await getDefaultPluginModel();

  const results = await provider.runBatch(units, async (unit) => {
    const persona = personaByUnitId.get(unit.id);
    if (!persona) {
      throw new Error(`No persona found for unit ${unit.id}`);
    }

    const recentMemory = await memoryStore.retrieve(persona.id);
    const prompt = buildTurnPrompt(world, persona, recentMemory, previousSummary, maxSummaryChars);

    const { text } = await generateText({ model, prompt, temperature: 0.8 });

    await memoryStore.append(persona.id, {
      round: world.currentRound + 1,
      content: text,
      timestamp: Date.now(),
    });

    return { personaId: persona.id, content: text } satisfies AgentTurnResult;
  });

  await scheduler.destroyBatch(units.map((unit) => unit.id));

  const turns: AgentTurnResult[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      turns.push(result.value);
    } else {
      logger.warn({ unitId: result.unitId, error: result.error }, "Agent turn failed");
    }
  }

  return turns;
}

function summarizeRound(round: number, turns: AgentTurnResult[]): string {
  if (turns.length === 0) return `Round ${round}: no agents produced a turn.`;

  const excerpt = turns
    .slice(0, 5)
    .map((turn) => `${turn.personaId}: ${truncate(turn.content, 160)}`)
    .join(" | ");
  const more = turns.length > 5 ? ` (+${turns.length - 5} more)` : "";

  return `Round ${round}: ${turns.length} agents acted. ${excerpt}${more}`;
}

/** Orchestrate the full multi-round simulation and return the final WorldState. */
export async function runSimulation(
  seed: SeedMaterial,
  config: SimulationConfig,
  options: RunSimulationOptions = {}
): Promise<WorldState> {
  const memoryStore = options.memoryStore ?? new InMemoryMemoryStore();
  const maxSummaryChars = config.maxSummaryChars ?? DEFAULT_MAX_SUMMARY_CHARS;

  let world = await buildInitialWorldState(seed, config, options);

  logger.info(
    { worldId: world.id, personas: world.personas.length, rounds: config.rounds },
    "Starting simulation"
  );

  for (let round = 1; round <= config.rounds; round++) {
    const turns = await runRound(world, memoryStore, maxSummaryChars, options.concurrency);
    const summary: RoundSummary = { round, summary: summarizeRound(round, turns) };

    world = {
      ...world,
      currentRound: round,
      roundSummaries: [...world.roundSummaries, summary],
    };
  }

  logger.info({ worldId: world.id, rounds: world.currentRound }, "Simulation complete");

  return world;
}
