/**
 * MiroFish simulation engine — public exports.
 *
 * See README.md for usage and docs/SWARM_MIROFISH_MAP.md for product
 * context. Built on `@/lib/sandbox/swarm` (Phase 1) but owns all
 * product-specific concepts (persona, world state, rounds) itself.
 */

export type {
  SeedMaterial,
  SeedMaterialKind,
  Persona,
  RoundSummary,
  WorldState,
  SimulationConfig,
  SimulationProgressEvent,
  SimulationStage,
  SimulationReport,
  SeedGraph,
  SeedEntity,
  SeedRelationship,
  AgentMemoryEvent,
} from "./types";

export type { MemoryStore, MemoryRetrievalOptions } from "./memory-store";
export { InMemoryMemoryStore } from "./memory-store";

export { buildPersonas } from "./persona-builder";
export type { PersonaBuilderOptions } from "./persona-builder";

export { buildInitialWorldState, runSimulation } from "./simulation-engine";
export type { RunSimulationOptions } from "./simulation-engine";

export { extractSeedGraph } from "./seed-graph";
export { generateSimulationReport } from "./report";

export { askPersona } from "./agent-chat";
export type { AskExchange, AskPersonaOptions } from "./agent-chat";

export { isAbortError } from "./model-call";
