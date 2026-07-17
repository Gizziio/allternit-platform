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
}

/** The running state of one simulation. */
export interface WorldState {
  id: string;
  seed: SeedMaterial;
  personas: Persona[];
  currentRound: number;
  roundSummaries: RoundSummary[];
}

/** What's genuinely needed to run one simulation — kept minimal. */
export interface SimulationConfig {
  /** Number of personas to populate the simulation with. */
  populationSize: number;
  /** Number of rounds to run. */
  rounds: number;
  /** Max characters of the previous round's summary carried into each turn's prompt. */
  maxSummaryChars?: number;
}

/** What `MemoryStore` stores per agent per round. */
export interface AgentMemoryEvent {
  round: number;
  content: string;
  timestamp: number;
}
