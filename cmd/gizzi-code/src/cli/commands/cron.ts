/**
 * Cron CLI Commands
 * 
 * Commands:
 * - a2r cron list              List all scheduled jobs
 * - a2r cron add               Add a new job (interactive)
 * - a2r cron remove <id>       Remove a job
 * - a2r cron run <id>          Run a job immediately
 * - a2r cron pause <id>        Pause a job
 * - a2r cron resume <id>       Resume a job
 * - a2r cron status            Show daemon status
 * - a2r cron start             Start the cron daemon
 * - a2r cron stop              Stop the cron daemon
 */

import { CronServiceEnhanced, CronDaemon, startDaemon, getRemoteStatus } from "@/runtime/automation/cron";
import { colors } from "../utils/colors";
import { cmd } from "./cmd";

export const CronCommand = cmd({
  command: "cron",
  describe: "manage scheduled jobs (cron)",
  builder: (yargs) =>
    yargs
      .command(
        "list",
        "List all scheduled jobs",
        () => {},
        async () => {
          try {
            const status = await getRemoteStatus();
            if (status.jobs.total === 0) {
              console.log(colors.yellow("No scheduled jobs found."));
              return;
            }

            console.log(colors.bold("\nScheduled Jobs:"));
            console.log("=".repeat(80));
            // In a real implementation, we would fetch the full list from the daemon
            console.log(`Total: ${status.jobs.total} (${status.jobs.active} active, ${status.jobs.paused} paused)`);
          } catch (e) {
            console.error(colors.red("Failed to connect to cron daemon. Is it running?"));
          }
        }
      )
      .command(
        "start",
        "Start the cron daemon",
        (yargs) =>
          yargs
            .option("port", {
              type: "number",
              default: 3031,
              describe: "Port to run the daemon on",
            })
            .option("background", {
              type: "boolean",
              default: false,
              describe: "Run in the background",
            }),
        async (argv) => {
          console.log(colors.cyan("Starting GIZZI Cron Daemon..."));
          
          if (argv.background) {
            console.log(colors.yellow("Background mode not yet implemented. Running in foreground..."));
          }

          try {
            await startDaemon({
              port: argv.port as number,
              dbPath: "~/.a2r/cron.db",
            });
          } catch (e: any) {
            if (e.message?.includes("already in use")) {
              console.log(colors.yellow(`Daemon is already running on port ${argv.port}`));
            } else {
              console.error(colors.red(`Failed to start daemon: ${e.message}`));
            }
          }
        }
      )
      .command(
        "stop",
        "Stop the cron daemon",
        () => {},
        async () => {
          console.log(colors.yellow("Stop command not yet implemented."));
        }
      )
      .command(
        "status",
        "Show daemon status",
        () => {},
        async () => {
          try {
            const status = await getRemoteStatus();
            console.log(colors.bold("\nCron Daemon Status:"));
            console.log("=".repeat(40));
            console.log(`Status:  ${colors.green("Online")}`);
            console.log(`Port:    ${status.config.port}`);
            console.log(`Uptime:  ${formatDuration(Date.now() - new Date(status.startTime).getTime())}`);
            console.log(`Jobs:    ${status.jobs.total} total, ${colors.green(String(status.jobs.active))} active, ${colors.yellow(String(status.jobs.paused))} paused`);
          } catch (e) {
            console.log(`Status:  ${colors.red("Offline")}`);
          }
        }
      )
      .demandCommand(1),
  handler: async () => {},
});

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}
