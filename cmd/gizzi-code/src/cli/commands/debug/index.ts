import type { CommandModule } from "yargs";

export const DebugCommand: CommandModule = {
  command: "debug",
  describe: "debugging and troubleshooting tools",
  builder: (yargs) => yargs,
  handler: () => {
    console.log("Debug command - not implemented yet");
  },
};
