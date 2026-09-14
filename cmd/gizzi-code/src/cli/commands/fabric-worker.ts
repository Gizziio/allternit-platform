import { cmd } from "@/cli/commands/cmd"

/**
 * Fabric Transport worker daemon (managed runtime, consumer desktop P1).
 *
 * The desktop main process launches the bundled gizzi-code binary as
 * `gizzi-code fabric-worker` with `ALLTERNIT_GIZZI_TOKEN` (from the macOS
 * Keychain) and `ALLTERNIT_API_URL` in the environment — zero terminal
 * interaction. The handler dynamically imports the daemon entry, which runs
 * the claim loop (structured JSON logs, exponential backoff, SIGTERM/SIGINT
 * graceful stop with lease release via the sweeper). The import is relative
 * (not `@/`) because Bun.build does not apply tsconfig paths to dynamic
 * imports in the compiled single-file binary.
 */
export const FabricWorkerCommand = cmd({
  command: "fabric-worker",
  describe: "run the Fabric Transport worker daemon (managed by the Allternit desktop)",
  builder: (yargs) =>
    yargs.option("compute-mode", {
      type: "string",
      choices: ["local", "vm"] as const,
      describe: "execution posture for claimed steps (default: env GIZZI_COMPUTE_MODE or local)",
    }),
  handler: async (args) => {
    if (typeof args.computeMode === "string" && args.computeMode) {
      process.env.GIZZI_COMPUTE_MODE = args.computeMode
    }
    await import("../../runtime/fabric-transport/worker-daemon-entry")
    // The daemon entry owns the process lifecycle; never resolve.
    await new Promise(() => {})
  },
})
