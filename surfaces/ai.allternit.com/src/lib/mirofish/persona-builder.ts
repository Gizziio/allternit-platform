/**
 * persona-builder — derives a population of Personas from SeedMaterial.
 *
 * Each persona is genuinely LLM-generated from the seed content (not a
 * templated placeholder), grounded in the extracted seed graph when one is
 * available, and generation is fanned out through `SwarmScheduler` +
 * `LocalSwarmProvider` so a population of hundreds doesn't run one LLM call
 * at a time.
 *
 * Output hardening (observed live before this existed: a persona card whose
 * bio was a raw JSON blob): responses are token-capped, unparseable JSON gets
 * one retry, and the final fallback never leaks internal unit ids into the UI.
 */

import { generateText } from "ai";

import { getDefaultPluginModel } from "@/lib/ai/providers";
import { createModuleLogger } from '@/lib/logger';

import { LocalSwarmProvider } from "@/lib/sandbox/swarm/local-provider";
import { SwarmScheduler } from "@/lib/sandbox/swarm/scheduler";
import type { SwarmUnitSpec } from "@/lib/sandbox/swarm/types";

import { modelCallSignal, throwIfAborted } from "./model-call";
import { seedGraphPromptBlock } from "./seed-graph";
import type { Persona, SeedGraph, SeedMaterial } from "./types";

const logger = createModuleLogger('MiroFish');

const MAX_SEED_CHARS = 1500;
const PERSONA_MAX_OUTPUT_TOKENS = 500;

interface RawPersona {
  name?: unknown;
  bio?: unknown;
  traits?: unknown;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((v) => typeof v === "string")
  );
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

/** Strict parse: null unless the response contains valid JSON with a usable name and bio. */
function tryParsePersona(text: string, id: string): Persona | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  let raw: RawPersona;
  try {
    raw = JSON.parse(jsonMatch[0]) as RawPersona;
  } catch {
    return null;
  }

  if (typeof raw.name !== "string" || !raw.name.trim()) return null;
  if (typeof raw.bio !== "string" || !raw.bio.trim()) return null;

  return {
    id,
    name: raw.name.trim(),
    bio: raw.bio.trim(),
    traits: isStringRecord(raw.traits) ? raw.traits : {},
  };
}

/** Last-resort persona when both generation attempts were unparseable. */
function fallbackPersona(id: string, index: number, text: string): Persona {
  // Never surface raw JSON fragments or internal unit ids in the UI.
  const cleaned = text.replace(/[{}"[\]]/g, " ").replace(/\s+/g, " ").trim();
  return {
    id,
    name: `Persona ${index + 1}`,
    bio: cleaned ? truncate(cleaned, 300) : "No description was generated for this persona.",
    traits: {},
  };
}

function buildPersonaPrompt(
  seed: SeedMaterial,
  index: number,
  populationSize: number,
  seedGraph: SeedGraph | null | undefined
): string {
  const grounding = seedGraphPromptBlock(seedGraph);
  const groundingInstruction = grounding
    ? `\nGround this persona in the extracted entities: they should be one of the named stakeholders, belong to one of the affected groups, or have a concrete relationship to them.\n`
    : "";

  return `You are generating one member of a simulated population of ${populationSize} people who would plausibly encounter and react to the following ${seed.kind} material.

Seed material:
"""
${truncate(seed.text, MAX_SEED_CHARS)}
"""
${grounding}${groundingInstruction}
Invent persona #${index + 1} of ${populationSize}. Make them distinct from a "typical" reaction — vary background, stance, and life circumstances across the population. Respond with JSON only, no prose, no markdown fences:
{
  "name": "string - a plausible full name",
  "bio": "string - 2-3 sentences on who they are and why this material matters to them",
  "traits": { "trait_name": "short value", "...": "..." }
}`;
}

export interface PersonaBuilderOptions {
  /** Max concurrent LLM calls while generating the population. */
  concurrency?: number;
  /** Cancels the whole build (each model call also has its own timeout). */
  signal?: AbortSignal;
  /** Called after each persona settles (built or failed). */
  onProgress?: (completed: number, total: number) => void;
  /** Grounding graph from seed extraction; null/undefined = ungrounded. */
  seedGraph?: SeedGraph | null;
}

/** Build `populationSize` personas from `seed`, one LLM call per persona, fanned out concurrently. */
export async function buildPersonas(
  seed: SeedMaterial,
  populationSize: number,
  options: PersonaBuilderOptions = {}
): Promise<Persona[]> {
  if (populationSize <= 0) return [];
  throwIfAborted(options.signal);

  const provider = new LocalSwarmProvider({ concurrency: options.concurrency });
  const scheduler = new SwarmScheduler(provider, { concurrency: options.concurrency });

  const specs: SwarmUnitSpec[] = Array.from({ length: populationSize }, (_, index) => ({
    metadata: { index },
  }));

  const { units, failures: createFailures } = await scheduler.createBatch(specs);
  if (createFailures.length > 0) {
    // LocalSwarmProvider bookkeeping can't actually fail, but log defensively
    // in case that assumption ever changes.
    logger.warn({ failed: createFailures.length }, "Some persona units failed to create");
  }

  const model = await getDefaultPluginModel();
  let completed = 0;

  const results = await provider.runBatch(units, async (unit) => {
    const index = typeof unit.metadata.index === "number" ? unit.metadata.index : 0;
    const prompt = buildPersonaPrompt(seed, index, populationSize, options.seedGraph);

    try {
      // One retry on unparseable output before falling back.
      for (let attempt = 0; attempt < 2; attempt++) {
        throwIfAborted(options.signal);
        const { text } = await generateText({
          model,
          prompt,
          temperature: 0.9,
          maxOutputTokens: PERSONA_MAX_OUTPUT_TOKENS,
          abortSignal: modelCallSignal(options.signal),
        });

        const persona = tryParsePersona(text, unit.id);
        if (persona) return persona;

        if (attempt === 0) {
          logger.warn({ unitId: unit.id }, "Persona response unparseable — retrying once");
        } else {
          logger.warn({ unitId: unit.id }, "Persona response unparseable after retry — using fallback");
          return fallbackPersona(unit.id, index, text);
        }
      }
      // Unreachable, but keeps the compiler honest about the return path.
      return fallbackPersona(unit.id, index, "");
    } finally {
      completed += 1;
      options.onProgress?.(completed, populationSize);
    }
  });

  await scheduler.destroyBatch(units.map((unit) => unit.id));
  throwIfAborted(options.signal);

  const personas: Persona[] = [];
  const failures: unknown[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      personas.push(result.value);
    } else {
      failures.push(result.error);
      logger.warn(
        { unitId: result.unitId, error: result.error },
        "Persona generation turn failed"
      );
    }
  }

  // Partial failures are tolerated — the simulation runs with the survivors.
  // But if every generation failed there is no population to simulate, and
  // silently returning [] would make the run "complete" with nothing to show;
  // surface the underlying cause (usually a model-access problem) instead.
  if (personas.length === 0) {
    throw new Error(
      `All ${populationSize} persona generations failed — cannot run a simulation with an empty population. First error: ${String(failures[0])}`
    );
  }

  return personas;
}
