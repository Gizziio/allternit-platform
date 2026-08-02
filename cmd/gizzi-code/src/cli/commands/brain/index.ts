import { cmd } from "@/cli/commands/cmd"
import { BrainInitCommand } from "./init"
import { BrainMemoryCommand } from "./memory"
import { BrainRemoteCommand } from "./remote"
import { BrainStatusCommand } from "./status"
import { BrainSyncCommand } from "./sync"

/**
 * `gizzi brain` — second-brain command group (Track D, phase D1).
 *
 * Bare `gizzi brain` prints brain status (BrainStatusCommand is the group's
 * `$0` default). The pre-D1 BrainService memory CLI lives on as
 * `gizzi brain memory`.
 */
export const BrainCommand = cmd({
  command: "brain",
  describe: "Second brain — a local git repo of agent-readable markdown",
  builder: (yargs) =>
    yargs
      .command(BrainStatusCommand)
      .command(BrainInitCommand)
      .command(BrainSyncCommand)
      .command(BrainRemoteCommand)
      .command(BrainMemoryCommand),
  handler: async () => {},
})
