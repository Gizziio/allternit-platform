/**
 * MiroFish simulation engine — core types.
 *
 * See docs/SWARM_MIROFISH_MAP.md for the product context. This layer builds
 * on `@/lib/sandbox/swarm` (provider-agnostic swarm infra) but owns all of
 * the product-specific concepts — persona, world state, simulation rounds —
 * that the swarm tier deliberately stays ignorant of.
 */

/** What kind of real-world material seeded this simulation. */
export type SeedMaterialKind = "news" | "policy" | "financial" | "narrative" | "other";

/** The real-world input a simulation is built from. */
export interface SeedMaterial {
  kind: SeedMaterialKind;
  text: string;
}

/** One simulated agent's persona. Deliberately simple for Phase 2. */
export interface Persona {
  id: string;
  name: string;
  /** Free-text description/backstory. */
  bio: string;
  /** Small set of short behavioral/attitude traits, e.g. `{ risk_tolerance: "low" }`. */
  traits: Record<string, string>;
}

/** What happened in one round, visible to every agent's next turn. */
export interface RoundSummary {
  round: number;
  summary: string;
  /** How many agents produced a turn this round vs. the population size. */
  agentsActed: number;
  agentsTotal: number;
}

/** One entity extracted from the seed material (graph-lite ingestion). */
export interface SeedEntity {
  name: string;
  type: "person" | "organization" | "group" | "place" | "policy" | "event" | "other";
  /** Short stance/attitude toward the seed material, if inferable. */
  stance?: string;
}

/** One relationship between extracted entities. */
export interface SeedRelationship {
  from: string;
  to: string;
  relation: string;
}

/**
 * Lightweight knowledge graph extracted from the seed in one model call —
 * the "graph-lite" version of upstream MiroFish's GraphRAG stage. Personas
 * are grounded in these entities instead of raw seed text alone.
 */
export interface SeedGraph {
  entities: SeedEntity[];
  relationships: SeedRelationship[];
}

/** Post-simulation synthesis produced by one model call over the round data. */
export interface SimulationReport {
  executiveSummary: string;
  riskSignals: string[];
  narrativePaths: string[];
  confidence: "low" | "medium" | "high";
}

/** Progress events emitted while a simulation runs (staged-pipeline model). */
export type SimulationStage = "graph" | "personas" | "rounds" | "report";

export interface SimulationProgressEvent {
  stage: SimulationStage;
  /** Completed units within the stage (personas built, turns finished, …). */
  completed: number;
  total: number;
  /** Current round number — rounds stage only. */
  round?: number;
  /** Total rounds — rounds stage only. */
  rounds?: number;
}

/** The running state of one simulation. */
export interface WorldState {
  id: string;
  seed: SeedMaterial;
  personas: Persona[];
  currentRound: number;
  roundSummaries: RoundSummary[];
  /** Entities/relationships the personas were grounded in (null if extraction failed). */
  seedGraph?: SeedGraph | null;
  /** Final synthesis — absent if report generation failed (run still succeeds). */
  report?: SimulationReport;
}

/** What's genuinely needed to run one simulation — kept minimal. */
export interface SimulationConfig {
  /** Number of personas to populate the simulation with. */
  populationSize: number;
  /** Number of rounds to run. */
  rounds: number;
  /** Max characters of the previous round's summary carried into each turn's prompt. */
  maxSummaryChars?: number;
  /** Registry model id to run every stage with; defaults to the registry's default plugin model. */
  modelId?: string;
}

/** What `MemoryStore` stores per agent per round. */
export interface AgentMemoryEvent {
  round: number;
  content: string;
  timestamp: number;
}
