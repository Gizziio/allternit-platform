/**
 * run-request — natural-language entry point interpretation.
 *
 * The composer is MiroFish's only input: the user types seed material plus,
 * optionally, what they want simulated ("simulate 8 retailers over 3 rounds
 * reacting to …"). One model call separates the seed from the meta-request,
 * classifies the material, pulls out any stated population/round counts, and
 * extracts the grounding entities/relationships — replacing the old
 * hardcoded form AND the separate seed-graph extraction call.
 *
 * Interpretation failure is never fatal: the whole prompt becomes the seed
 * with defaults, and the simulation proceeds ungrounded.
 */

import { generateText } from "ai";

import { getPluginModel } from "@/lib/ai/providers";
import { createModuleLogger } from '@/lib/logger';

import { modelCallSignal } from "./model-call";
import type {
  SeedGraph,
  SeedMaterial,
  SeedMaterialKind,
} from "./types";

const logger = createModuleLogger('MiroFish');

const MAX_PROMPT_CHARS = 6000;
const MAX_ENTITIES = 8;
const MAX_RELATIONSHIPS = 10;

export const DEFAULT_POPULATION = 12;
export const DEFAULT_ROUNDS = 3;
export const MIN_POPULATION = 1;
export const MAX_POPULATION = 50;
export const MIN_ROUNDS = 1;
export const MAX_ROUNDS = 10;

const SEED_KINDS = new Set<SeedMaterialKind>(["news", "policy", "financial", "narrative", "other"]);
const ENTITY_TYPES = new Set([
  "person", "organization", "group", "place", "policy", "event", "other",
]);

/** What the user asked for, resolved from natural language + defaults. */
export interface InterpretedRunRequest {
  seed: SeedMaterial;
  populationSize: number;
  rounds: number;
  seedGraph: SeedGraph | null;
  /** True when the counts came from the prompt rather than defaults. */
  statedPopulation: boolean;
  statedRounds: boolean;
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function buildInterpretationPrompt(prompt: string): string {
  return `A user wants to run a population simulation: a crowd of AI personas reacting to some real-world material over several rounds. Interpret their request.

User request:
"""
${truncate(prompt, MAX_PROMPT_CHARS)}
"""

Respond with JSON only, no prose, no markdown fences:
{
  "seedText": "the actual material to simulate reactions to — strip meta-instructions like 'simulate 8 people…' but keep ALL substantive content verbatim; if the whole request is material, return it unchanged",
  "kind": "news|policy|financial|narrative|other",
  "populationSize": <number the user stated, or null if unstated — "how 4 retailers react" or "a crowd of 20" means the user stated it>,
  "rounds": <number the user stated, or null if unstated>,
  "entities": [
    { "name": "string", "type": "person|organization|group|place|policy|event|other", "stance": "optional short stance toward the material" }
  ],
  "relationships": [
    { "from": "entity name", "to": "entity name", "relation": "short verb phrase" }
  ]
}

At most ${MAX_ENTITIES} entities and ${MAX_RELATIONSHIPS} relationships. Include affected groups (e.g. "commuters", "retailers") as entities of type "group".`;
}

function parseInterpretation(text: string, fallbackSeedText: string): InterpretedRunRequest | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const raw = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const seedText =
      typeof raw.seedText === "string" && raw.seedText.trim()
        ? raw.seedText.trim()
        : fallbackSeedText;
    const kind = SEED_KINDS.has(raw.kind as SeedMaterialKind)
      ? (raw.kind as SeedMaterialKind)
      : "other";

    const statedPopulation = typeof raw.populationSize === "number" && Number.isFinite(raw.populationSize);
    const statedRounds = typeof raw.rounds === "number" && Number.isFinite(raw.rounds);

    const entities = (Array.isArray(raw.entities) ? raw.entities : [])
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .filter((e) => typeof e.name === "string" && (e.name as string).trim())
      .slice(0, MAX_ENTITIES)
      .map((e) => ({
        name: (e.name as string).trim(),
        type: (ENTITY_TYPES.has(String(e.type)) ? e.type : "other") as SeedGraph["entities"][number]["type"],
        ...(typeof e.stance === "string" && (e.stance as string).trim()
          ? { stance: (e.stance as string).trim() }
          : {}),
      }));

    const relationships = (Array.isArray(raw.relationships) ? raw.relationships : [])
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .filter(
        (r) => typeof r.from === "string" && typeof r.to === "string" && typeof r.relation === "string"
      )
      .slice(0, MAX_RELATIONSHIPS)
      .map((r) => ({
        from: (r.from as string).trim(),
        to: (r.to as string).trim(),
        relation: (r.relation as string).trim(),
      }));

    return {
      seed: { kind, text: seedText },
      populationSize: statedPopulation
        ? clamp(raw.populationSize as number, MIN_POPULATION, MAX_POPULATION)
        : DEFAULT_POPULATION,
      rounds: statedRounds ? clamp(raw.rounds as number, MIN_ROUNDS, MAX_ROUNDS) : DEFAULT_ROUNDS,
      seedGraph: entities.length > 0 ? { entities, relationships } : null,
      statedPopulation,
      statedRounds,
    };
  } catch {
    return null;
  }
}

export interface InterpretRunRequestOptions {
  signal?: AbortSignal;
  /** Registry model id; defaults to the registry default. */
  modelId?: string;
}

/**
 * Interpret a composer prompt into a runnable request. Never throws for
 * model/parse failures — falls back to prompt-as-seed with defaults. A
 * caller-initiated abort still propagates.
 */
export async function interpretRunRequest(
  prompt: string,
  options: InterpretRunRequestOptions = {}
): Promise<InterpretedRunRequest> {
  const fallback: InterpretedRunRequest = {
    seed: { kind: "other", text: prompt.trim() },
    populationSize: DEFAULT_POPULATION,
    rounds: DEFAULT_ROUNDS,
    seedGraph: null,
    statedPopulation: false,
    statedRounds: false,
  };

  try {
    const model = await getPluginModel(options.modelId as never);
    const { text } = await generateText({
      model,
      prompt: buildInterpretationPrompt(prompt),
      temperature: 0.2,
      maxOutputTokens: 900,
      abortSignal: modelCallSignal(options.signal),
    });

    const parsed = parseInterpretation(text, prompt.trim());
    if (!parsed) {
      logger.warn({ sample: text.slice(0, 120) }, "Run-request interpretation unparseable — using defaults");
      return fallback;
    }
    return parsed;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    logger.warn({ error }, "Run-request interpretation failed — using defaults");
    return fallback;
  }
}
