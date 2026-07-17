/**
 * persona-builder — derives a population of Personas from SeedMaterial.
 *
 * Each persona is genuinely LLM-generated from the seed content (not a
 * templated placeholder), and generation is fanned out through
 * `SwarmScheduler` + `LocalSwarmProvider` so a population of hundreds
 * doesn't run one LLM call at a time.
 */

import { generateText } from "ai";

import { getDefaultPluginModel } from "@/lib/ai/providers";
import { createModuleLogger } from '@/lib/logger';

import { LocalSwarmProvider } from "@/lib/sandbox/swarm/local-provider";
import { SwarmScheduler } from "@/lib/sandbox/swarm/scheduler";
import type { SwarmUnitSpec } from "@/lib/sandbox/swarm/types";

import type { Persona, SeedMaterial } from "./types";

const logger = createModuleLogger('MiroFish');

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

function parsePersona(text: string, fallbackId: string): Persona {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let raw: RawPersona = {};

  if (jsonMatch) {
    try {
      raw = JSON.parse(jsonMatch[0]) as RawPersona;
    } catch {
      // Fall through to the defaults below — a malformed response still
      // yields a usable (if generic) persona rather than failing the batch.
    }
  }

  return {
    id: fallbackId,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : `Persona ${fallbackId}`,
    bio: typeof raw.bio === "string" && raw.bio.trim() ? raw.bio.trim() : text.trim().slice(0, 500),
    traits: isStringRecord(raw.traits) ? raw.traits : {},
  };
}

function buildPersonaPrompt(seed: SeedMaterial, index: number, populationSize: number): string {
  return `You are generating one member of a simulated population of ${populationSize} people who would plausibly encounter and react to the following ${seed.kind} material.

Seed material:
"""
${seed.text}
"""

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
}

/** Build `populationSize` personas from `seed`, one LLM call per persona, fanned out concurrently. */
export async function buildPersonas(
  seed: SeedMaterial,
  populationSize: number,
  options: PersonaBuilderOptions = {}
): Promise<Persona[]> {
  if (populationSize <= 0) return [];

  const provider = new LocalSwarmProvider();
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

  const results = await provider.runBatch(units, async (unit) => {
    const index = typeof unit.metadata.index === "number" ? unit.metadata.index : 0;
    const { text } = await generateText({
      model,
      prompt: buildPersonaPrompt(seed, index, populationSize),
      temperature: 0.9,
    });
    return parsePersona(text, unit.id);
  });

  await scheduler.destroyBatch(units.map((unit) => unit.id));

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
