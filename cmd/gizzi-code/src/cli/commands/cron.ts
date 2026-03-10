import { cmd } from "@/cli/commands/cmd"
import * as prompts from "@clack/prompts"
import { UI } from "@/cli/ui"

const { Style } = UI
const green = (s: string) => Style.TEXT_SUCCESS + s + Style.TEXT_NORMAL
const yellow = (s: string) => Style.TEXT_WARNING + s + Style.TEXT_NORMAL
const red = (s: string) => Style.TEXT_DANGER + s + Style.TEXT_NORMAL
const blue = (s: string) => Style.TEXT_INFO + s + Style.TEXT_NORMAL
const gray = (s: string) => Style.TEXT_DIM + s + Style.TEXT_NORMAL
const bold = (s: string) => Style.TEXT_NORMAL_BOLD + s + Style.TEXT_NORMAL
import { Instance } from "@/runtime/context/project/instance"
import { CronService } from "@/runtime/automation/cron/service"
import { CronTypes } from "@/runtime/automation/cron/types"
import { CronParser } from "@/runtime/automation/cron/parser"
import type { Argv } from "yargs"

function formatSchedule(schedule: string): string {
  // Provide human-readable format for common patterns
  if (schedule === "*/5 * * * *") return "Every 5 minutes"
  if (schedule === "*/15 * * * *") return "Every 15 minutes"
  if (schedule === "0 * * * *") return "Every hour"
  if (schedule === "0 */6 * * *") return "Every 6 hours"
  if (schedule === "0 0 * * *") return "Daily at midnight"
  if (schedule === "0 9 * * *") return "Daily at 9 AM"
  if (schedule === "0 9 * * 1") return "Weekly on Monday at 9 AM"
  return schedule
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${Math.round(ms / 1000)}s`
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`
  return `${Math.round(ms / 3600000)}h`
}

function formatTimestamp(ts: number | undefined): string {
  if (!ts) return "never"
  const date = new Date(ts)
  const now = Date.now()
  const diff = now - ts

  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

const CronListCommand = cmd({
  command: "list",
  describe: "list all cron jobs",
  builder: (yargs: Argv) =>
    yargs.option("status", {
      type: "string",
      describe: "filter by status",
      choices: ["active", "paused", "disabled"] as const,
    }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Cron Jobs")

        const jobs = CronService.list()
        const filtered = args.status ? jobs.filter((j) => j.status === args.status) : jobs

        if (filtered.length === 0) {
          prompts.log.info("No cron jobs found")
          return
        }

        prompts.log.message("")
        for (const job of filtered) {
          const statusIcon = job.status === "active" ? "●" : job.status === "paused" ? "⏸" : "○"
          const statusColor = job.status === "active" ? green : job.status === "paused" ? yellow : gray

          prompts.log.message(`${statusColor(statusIcon)} ${bold(job.name)} ${gray(`(${job.id.slice(0, 8)})`)}`)
          prompts.log.message(`  ${gray("Schedule:")} ${formatSchedule(job.schedule)}`)
          prompts.log.message(`  ${gray("Status:")} ${job.status}`)
          prompts.log.message(`  ${gray("Prompt:")} ${job.prompt.slice(0, 60)}${job.prompt.length > 60 ? "..." : ""}`)

          if (job.runCount > 0) {
            prompts.log.message(`  ${gray("Runs:")} ${job.runCount} (${job.failCount} failed)`)
            prompts.log.message(`  ${gray("Last run:")} ${formatTimestamp(job.lastRunAt)}`)
          }

          if (job.nextRunAt && job.status === "active") {
            const nextIn = job.nextRunAt - Date.now()
            prompts.log.message(`  ${gray("Next run:")} ${nextIn > 0 ? `in ${formatDuration(nextIn)}` : "due now"}`)
          }

          prompts.log.message("")
        }

        prompts.outro(`Found ${filtered.length} job(s)`)
      },
    })
  },
})

const CronAddCommand = cmd({
  command: "add",
  describe: "add a new cron job",
  builder: (yargs: Argv) =>
    yargs
      .option("name", {
        type: "string",
        describe: "job name",
      })
      .option("schedule", {
        type: "string",
        describe: "cron schedule expression (e.g., '*/5 * * * *')",
      })
      .option("prompt", {
        type: "string",
        describe: "the prompt to execute",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use",
      })
      .option("session", {
        type: "string",
        describe: "session ID to run in (omit for isolated)",
      })
      .option("mode", {
        type: "string",
        describe: "wake mode",
        choices: ["main", "isolated"] as const,
        default: "main",
      }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const isNonInteractive = args.name && args.schedule && args.prompt

        if (!isNonInteractive) {
          UI.empty()
          prompts.intro("Add Cron Job")
        }

        const name = args.name ?? ((await prompts.text({
          message: "Job name",
          validate: (v) => v && v.length > 0 ? undefined : "Name is required",
        })) as string)
        if (prompts.isCancel(name)) return

        const schedule = args.schedule ?? ((await prompts.text({
          message: "Schedule (cron expression)",
          placeholder: "*/5 * * * *",
          validate: (v) => {
            if (!v) return "Schedule is required"
            if (!CronParser.isValid(v)) return "Invalid cron expression"
            return undefined
          },
        })) as string)
        if (prompts.isCancel(schedule)) return

        const prompt = args.prompt ?? ((await prompts.text({
          message: "Prompt to execute",
          validate: (v) => v && v.length > 0 ? undefined : "Prompt is required",
        })) as string)
        if (prompts.isCancel(prompt)) return

        const agent = args.agent ?? ((await prompts.text({
          message: "Agent (optional)",
        })) as string | undefined)
        if (prompts.isCancel(agent)) return

        const wakeMode = (args.mode as CronTypes.CronJob["wakeMode"]) ?? ((await prompts.select({
          message: "Wake mode",
          options: [
            { value: "main", label: "Main - Run in main session" },
            { value: "isolated", label: "Isolated - Create new session each time" },
          ],
        })) as CronTypes.CronJob["wakeMode"])
        if (prompts.isCancel(wakeMode)) return

        const job = CronService.create({
          name,
          schedule,
          prompt,
          agent: agent || undefined,
          sessionID: args.session,
          wakeMode,
        })

        prompts.log.success(`Created job "${job.name}" (${job.id.slice(0, 8)})`)
        prompts.log.info(`Next run: ${job.nextRunAt ? new Date(job.nextRunAt).toLocaleString() : "calculating..."}`)

        if (!isNonInteractive) {
          prompts.outro("Done")
        }
      },
    })
  },
})

const CronRemoveCommand = cmd({
  command: "remove",
  describe: "remove a cron job",
  builder: (yargs: Argv) =>
    yargs.option("id", {
      type: "string",
      describe: "job ID",
    }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const jobs = CronService.list()

        if (jobs.length === 0) {
          prompts.log.error("No cron jobs found")
          return
        }

        let jobId = args.id
        if (!jobId) {
          UI.empty()
          prompts.intro("Remove Cron Job")

          jobId = (await prompts.select({
            message: "Select job to remove",
            options: jobs.map((j) => ({
              value: j.id,
              label: `${j.name} (${formatSchedule(j.schedule)})`,
            })),
          })) as string
          if (prompts.isCancel(jobId)) return
        }

        const job = CronService.get(jobId)
        if (!job) {
          prompts.log.error(`Job "${jobId}" not found`)
          return
        }

        const confirmed = await prompts.confirm({
          message: `Remove "${job.name}"?`,
        })
        if (!confirmed) return

        CronService.remove(jobId)
        prompts.log.success(`Removed "${job.name}"`)
      },
    })
  },
})

const CronRunCommand = cmd({
  command: "run",
  describe: "manually trigger a cron job",
  builder: (yargs: Argv) =>
    yargs.option("id", {
      type: "string",
      describe: "job ID",
    }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const jobs = CronService.list()

        if (jobs.length === 0) {
          prompts.log.error("No cron jobs found")
          return
        }

        let jobId = args.id
        if (!jobId) {
          UI.empty()
          prompts.intro("Run Cron Job")

          jobId = (await prompts.select({
            message: "Select job to run",
            options: jobs.map((j) => ({
              value: j.id,
              label: `${j.name} (${formatSchedule(j.schedule)})`,
            })),
          })) as string
          if (prompts.isCancel(jobId)) return
        }

        const job = CronService.get(jobId)
        if (!job) {
          prompts.log.error(`Job "${jobId}" not found`)
          return
        }

        const spinner = prompts.spinner()
        spinner.start(`Running "${job.name}"...`)

        try {
          const run = await CronService.trigger(jobId, "manual")
          spinner.stop(`Run completed with status: ${run.status}`)
        } catch (error) {
          spinner.stop("Run failed")
          throw error
        }
      },
    })
  },
})

const CronLogsCommand = cmd({
  command: "logs",
  describe: "view run history for a cron job",
  builder: (yargs: Argv) =>
    yargs
      .option("id", {
        type: "string",
        describe: "job ID",
      })
      .option("limit", {
        type: "number",
        describe: "number of runs to show",
        default: 10,
      }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const jobs = CronService.list()

        if (jobs.length === 0) {
          prompts.log.error("No cron jobs found")
          return
        }

        let jobId = args.id
        if (!jobId) {
          UI.empty()
          prompts.intro("Cron Job Logs")

          jobId = (await prompts.select({
            message: "Select job",
            options: jobs.map((j) => ({
              value: j.id,
              label: `${j.name} (${formatSchedule(j.schedule)})`,
            })),
          })) as string
          if (prompts.isCancel(jobId)) return
        }

        const job = CronService.get(jobId)
        if (!job) {
          prompts.log.error(`Job "${jobId}" not found`)
          return
        }

        const runs = CronService.getRuns(jobId).slice(0, args.limit)

        UI.empty()
        prompts.intro(`Logs for "${job.name}"`)

        if (runs.length === 0) {
          prompts.log.info("No runs yet")
          return
        }

        prompts.log.message("")
        for (const run of runs) {
          const statusIcon = run.status === "completed" ? "✓" : run.status === "running" ? "⟳" : "✗"
          const statusColor = run.status === "completed" ? green : run.status === "running" ? blue : red

          prompts.log.message(`${statusColor(statusIcon)} ${gray(run.id.slice(0, 8))} ${formatTimestamp(run.startedAt)}`)

          if (run.finishedAt) {
            const duration = run.finishedAt - run.startedAt
            prompts.log.message(`  ${gray("Duration:")} ${formatDuration(duration)}`)
          }

          if (run.output) {
            prompts.log.message(`  ${gray("Output:")} ${run.output.slice(0, 100)}${run.output.length > 100 ? "..." : ""}`)
          }

          if (run.error) {
            prompts.log.message(`  ${red("Error:")} ${run.error}`)
          }

          prompts.log.message("")
        }

        prompts.outro(`Showing ${runs.length} run(s)`)
      },
    })
  },
})

const CronStatusCommand = cmd({
  command: "status",
  describe: "show cron service status",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const status = CronService.getStatus()

        UI.empty()
        prompts.intro("Cron Status")

        prompts.log.message("")
        prompts.log.message(`${gray("Total jobs:")} ${status.jobs}`)
        prompts.log.message(`${gray("Active jobs:")} ${status.active}`)
        prompts.log.message(`${gray("Pending runs:")} ${status.pendingRuns}`)
        prompts.log.message(`${gray("Running runs:")} ${status.runningRuns}`)

        prompts.outro("Done")
      },
    })
  },
})

const CronWakeCommand = cmd({
  command: "wake",
  describe: "trigger due jobs immediately",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Wake Cron")

        const spinner = prompts.spinner()
        spinner.start("Checking for due jobs...")

        const result = await CronService.wake("manual")

        spinner.stop(`Triggered ${result.triggered} job(s)`)

        if (result.triggered > 0) {
          for (const jobId of result.jobs) {
            const job = CronService.get(jobId)
            if (job) {
              prompts.log.success(`Triggered: ${job.name}`)
            }
          }
        } else {
          prompts.log.info("No jobs were due")
        }

        prompts.outro("Done")
      },
    })
  },
})

export const CronCommand = cmd({
  command: "cron <command>",
  describe: "manage scheduled automation jobs",
  builder: (yargs: Argv) =>
    yargs
      .command(CronListCommand)
      .command(CronAddCommand)
      .command(CronRemoveCommand)
      .command(CronRunCommand)
      .command(CronLogsCommand)
      .command(CronStatusCommand)
      .command(CronWakeCommand)
      .demandCommand(1, "Please specify a command"),
  async handler() {},
})
