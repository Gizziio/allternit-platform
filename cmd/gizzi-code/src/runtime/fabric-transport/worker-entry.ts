/**
 * Entry point for the Gizzi fabric-transport worker (A-T4).
 *
 *   ALLTERNIT_GIZZI_TOKEN=atok_… bun src/runtime/fabric-transport/worker-entry.ts
 */
import { runFabricWorker } from "./worker"

runFabricWorker().catch((err) => {
  console.error(`[gizzi-worker] fatal: ${(err as Error).message}`)
  process.exit(1)
})
