/**
 * MiroFish runtime module.
 *
 * The sole file that statically imports `@/lib/mirofish` (and, transitively,
 * `@/lib/sandbox/swarm/local-provider` + `scheduler` — never
 * `e2b-provider.ts`, which reads `E2B_API_KEY`). `MiroFishPanel.tsx` (a
 * client-rendered component) never imports either of those directly — it
 * reaches this module through a dynamic `import()`, mirroring exactly how
 * every other mode plugin is lazy-loaded via `PLUGINS[id].lazyImport()` in
 * `src/lib/plugins/index.ts` and invoked by
 * `src/lib/agents/agent-mode-executor.ts`. See
 * docs/SWARM_MIROFISH_PHASE_3_NOTES.md for the traced execution boundary.
 *
 * MiroFish isn't a top-level mode (it's a nested sub-mode of Agent Swarm), so
 * it isn't registered in `src/lib/plugins/index.ts`'s `PLUGINS` map and
 * doesn't implement the single-shot `ModePlugin` (`execute(input): output`)
 * contract — that contract is shaped for the composer's one-prompt-in,
 * one-artifact-out flow, which doesn't fit a multi-step Run + persona grid +
 * follow-up chat panel. This module keeps the same lazy-chunk boundary a
 * real plugin has without forcing an unrelated interface onto it.
 */

import {
  askPersona,
  InMemoryMemoryStore,
  isAbortError,
  runSimulation,
} from "@/lib/mirofish";
import type {
  AskExchange,
  MemoryStore,
  Persona,
  SeedMaterial,
  SimulationConfig,
  SimulationProgressEvent,
  WorldState,
} from "@/lib/mirofish";

export { isAbortError };
export type { SimulationProgressEvent };

/**
 * One MemoryStore per world, kept alive for as long as this lazy chunk stays
 * loaded, so a later `askMiroFishPersona` call can see what happened during
 * that world's simulation. Capped so back-to-back runs don't accumulate
 * forever; evicted (or reloaded) worlds still chat, just without simulation
 * memory.
 */
const MAX_RETAINED_WORLDS = 5;
const memoryStoresByWorldId = new Map<string, MemoryStore>();

export interface RunMiroFishOptions {
  signal?: AbortSignal;
  onProgress?: (event: SimulationProgressEvent) => void;
}

export async function runMiroFishSimulation(
  seed: SeedMaterial,
  config: SimulationConfig,
  options: RunMiroFishOptions = {}
): Promise<WorldState> {
  const memoryStore = new InMemoryMemoryStore();
  const world = await runSimulation(seed, config, {
    memoryStore,
    signal: options.signal,
    onProgress: options.onProgress,
  });
  memoryStoresByWorldId.set(world.id, memoryStore);
  while (memoryStoresByWorldId.size > MAX_RETAINED_WORLDS) {
    const oldest = memoryStoresByWorldId.keys().next().value;
    if (oldest === undefined) break;
    memoryStoresByWorldId.delete(oldest);
  }
  return world;
}

export interface AskMiroFishOptions {
  /** Prior Q&A exchanges with this persona, for conversational context. */
  history?: AskExchange[];
  signal?: AbortSignal;
}

export async function askMiroFishPersona(
  world: WorldState,
  persona: Persona,
  question: string,
  options: AskMiroFishOptions = {}
): Promise<string> {
  const memoryStore = memoryStoresByWorldId.get(world.id) ?? new InMemoryMemoryStore();
  return askPersona(world, persona, memoryStore, question, {
    history: options.history,
    signal: options.signal,
  });
}
