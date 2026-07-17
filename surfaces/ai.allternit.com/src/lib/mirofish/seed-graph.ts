/**
 * seed-graph — graph-lite seed ingestion.
 *
 * Upstream MiroFish runs a full GraphRAG stage before persona generation;
 * this is the one-model-call version of the same idea: extract the named
 * entities, groups, and relationships from the seed material so personas can
 * be grounded in actual stakeholders instead of raw text alone. Extraction
 * failure is never fatal — callers get `null` and fall back to ungrounded
 * persona generation (the pre-graph behavior).
 */

import { generateText } from "ai";

import { getDefaultPluginModel } from "@/lib/ai/providers";
import { createModuleLogger } from '@/lib/logger';

import { modelCallSignal } from "./model-call";
import type { SeedEntity, SeedGraph, SeedMaterial, SeedRelationship } from "./types";

const logger = createModuleLogger('MiroFish');

const MAX_SEED_CHARS = 4000;
const MAX_ENTITIES = 8;
const MAX_RELATIONSHIPS = 10;

const ENTITY_TYPES = new Set([
  "person", "organization", "group", "place", "policy", "event", "other",
]);

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…`;
}

function buildExtractionPrompt(seed: SeedMaterial): string {
  return `Extract the key entities and relationships from the following ${seed.kind} material.

Material:
"""
${truncate(seed.text, MAX_SEED_CHARS)}
"""

Respond with JSON only, no prose, no markdown fences:
{
  "entities": [
    { "name": "string", "type": "person|organization|group|place|policy|event|other", "stance": "optional short stance toward the material" }
  ],
  "relationships": [
    { "from": "entity name", "to": "entity name", "relation": "short verb phrase" }
  ]
}

At most ${MAX_ENTITIES} entities and ${MAX_RELATIONSHIPS} relationships. Include affected groups (e.g. "commuters", "retailers") as entities of type "group".`;
}

function parseSeedGraph(text: string): SeedGraph | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const raw = JSON.parse(jsonMatch[0]) as {
      entities?: unknown;
      relationships?: unknown;
    };

    const entities: SeedEntity[] = (Array.isArray(raw.entities) ? raw.entities : [])
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .filter((e) => typeof e.name === "string" && e.name.trim())
      .slice(0, MAX_ENTITIES)
      .map((e) => ({
        name: (e.name as string).trim(),
        type: ENTITY_TYPES.has(String(e.type)) ? (e.type as SeedEntity["type"]) : "other",
        ...(typeof e.stance === "string" && e.stance.trim()
          ? { stance: e.stance.trim() }
          : {}),
      }));

    if (entities.length === 0) return null;

    const relationships: SeedRelationship[] = (Array.isArray(raw.relationships) ? raw.relationships : [])
      .filter((r): r is Record<string, unknown> => typeof r === "object" && r !== null)
      .filter(
        (r) =>
          typeof r.from === "string" && typeof r.to === "string" && typeof r.relation === "string"
      )
      .slice(0, MAX_RELATIONSHIPS)
      .map((r) => ({
        from: (r.from as string).trim(),
        to: (r.to as string).trim(),
        relation: (r.relation as string).trim(),
      }));

    return { entities, relationships };
  } catch {
    return null;
  }
}

export interface ExtractSeedGraphOptions {
  signal?: AbortSignal;
}

/**
 * One extraction call over the seed. Returns `null` on any failure — the
 * simulation proceeds ungrounded rather than dying at the first stage.
 * A caller-initiated abort still propagates (cancellation is not a failure).
 */
export async function extractSeedGraph(
  seed: SeedMaterial,
  options: ExtractSeedGraphOptions = {}
): Promise<SeedGraph | null> {
  try {
    const model = await getDefaultPluginModel();
    const { text } = await generateText({
      model,
      prompt: buildExtractionPrompt(seed),
      temperature: 0.3,
      maxOutputTokens: 700,
      abortSignal: modelCallSignal(options.signal),
    });

    const graph = parseSeedGraph(text);
    if (!graph) {
      logger.warn({ sample: text.slice(0, 120) }, "Seed graph extraction was unparseable — proceeding without it");
    }
    return graph;
  } catch (error) {
    if (options.signal?.aborted) throw error;
    logger.warn({ error }, "Seed graph extraction failed — proceeding without it");
    return null;
  }
}

/** Render the graph as prompt-ready grounding lines (empty string when null). */
export function seedGraphPromptBlock(graph: SeedGraph | null | undefined): string {
  if (!graph || graph.entities.length === 0) return "";

  const entityLines = graph.entities
    .map((e) => `- ${e.name} (${e.type}${e.stance ? `, stance: ${e.stance}` : ""})`)
    .join("\n");
  const relationLines = graph.relationships
    .map((r) => `- ${r.from} → ${r.relation} → ${r.to}`)
    .join("\n");

  return `\nKey entities extracted from the material:\n${entityLines}${
    relationLines ? `\n\nRelationships:\n${relationLines}` : ""
  }\n`;
}
