/**
 * Cron CLI Commands
 * 
 * Commands:
 * - a2r cron list              List all scheduled jobs
 * - a2r cron add               Add a new job (interactive)
 * - a2r cron remove <id>       Remove a job
 * - a2r cron run <id>          Trigger a job manually
 * - a2r cron logs <id>         Show job run history
 * - a2r cron status            Show daemon status
 * - a2r cron wake              Immediately check for due jobs
 * - a2r cron daemon start      Start daemon mode
 * - a2r cron daemon stop       Stop daemon mode
 * - a2r cron daemon status     Show daemon status
 * 
 * Natural language support:
 * - a2r cron add "backup every day at 2am"
 * - a2r cron add "check health every 5 minutes"
 * - a2r cron add "run reports weekly on friday at 5pm"
 */

import { intro, outro, confirm, select, text, isCancel, spinner } from "@clack/prompts";
import { Command } from "commander";
import { colors } from "../utils/colors";
import { CronService, CronDaemon, parseSchedule, describeSchedule, suggestSchedules } from "../../runtime/automation/cron";
import { isDaemonRunning, getRemoteStatus, startDaemon } from "../../runtime/automation/cron/daemon";
import type { CreateJobInput, CronJob } from "../../runtime/automation/cron/types";

const DEFAULT_DAEMON_PORT = 3031;

// ═══════════════════════════════════════════════════════════════════════════════
// Command Registration
// ═══════════════════════════════════════════════════════════════════════════════

export function registerCronCommands(program: Command): void {
  const cron = program
    .command("cron")
    .description("Manage scheduled jobs");

  // List jobs
  cron
    .command("list")
    .description("List all scheduled jobs")
    .option("-s, --status <status>", "Filter by status")
    .option("-t, --type <type>", "Filter by type")
    .action(handleList);

  // Add job
  cron
    .command("add [description]")
    .description("Add a new scheduled job")
    .option("-n, --name <name>", "Job name")
    .option("-s, --schedule <schedule>", "Schedule (cron or natural language)")
    .option("-t, --type <type>", "Job type (shell, http, agent, cowork)")
    .option("-c, --command <command>", "Command to run")
    .option("-u, --url <url>", "URL for HTTP jobs")
    .option("-p, --prompt <prompt>", "Prompt for agent jobs")
    .action(handleAdd);

  // Remove job
  cron
    .command("remove <id>")
    .description("Remove a scheduled job")
    .action(handleRemove);

  // Run job
  cron
    .command("run <id>")
    .description("Trigger a job manually")
    .action(handleRun);

  // Show logs
  cron
    .command("logs <id>")
    .description("Show job run history")
    .option("-n, --limit <n>", "Number of runs to show", "20")
    .action(handleLogs);

  // Status
  cron
    .command("status")
    .description("Show cron status")
    .action(handleStatus);

  // Wake
  cron
    .command("wake")
    .description("Immediately check for due jobs")
    .action(handleWake);

  // Daemon commands
  const daemon = cron
    .command("daemon")
    .description("Manage the cron daemon");

  daemon
    .command("start")
    .description("Start the cron daemon")
    .option("-p, --port <port>", "Port to listen on", String(DEFAULT_DAEMON_PORT))
    .option("-d, --daemon", "Run in background")
    .action(handleDaemonStart);

  daemon
    .command("stop")
    .description("Stop the cron daemon")
    .option("-p, --port <port>", "Port daemon is running on", String(DEFAULT_DAEMON_PORT))
    .action(handleDaemonStop);

  daemon
    .command("status")
    .description("Show daemon status")
    .option("-p, --port <port>", "Port daemon is running on", String(DEFAULT_DAEMON_PORT))
    .action(handleDaemonStatus);

  // Quick natural language add
  cron
    .command("schedule <schedule> [task...]", { isDefault: true })
    .description('Schedule a task (e.g., "every 5 minutes run backup.sh")')
    .action(handleNaturalLanguage);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Command Handlers
// ═══════════════════════════════════════════════════════════════════════════════

async function handleList(options: { status?: string; type?: string }): Promise<void> {
  const s = spinner();
  s.start("Loading jobs...");

  try {
    // Try local service first
    CronService.initialize();
    const jobs = CronService.list();

    s.stop();

    if (jobs.length === 0) {
      console.log(colors.yellow("No scheduled jobs found."));
      console.log(colors.dim(`Run ${colors.cyan("a2r cron add")} to create one.`));
      return;
    }

    // Filter if requested
    let filtered = jobs;
    if (options.status) filtered = filtered.filter((j) => j.status === options.status);
    if (options.type) filtered = filtered.filter((j) => j.type === options.type);

    console.log(colors.bold(`\n📅 Scheduled Jobs (${filtered.length})\n`));

    for (const job of filtered) {
      const statusIcon = getStatusIcon(job.status);
      const scheduleDesc = describeSchedule(job.schedule);
      const nextRun = job.nextRunAt
        ? formatRelativeTime(new Date(job.nextRunAt))
        : "Not scheduled";

      console.log(`${statusIcon} ${colors.bold(job.name)} ${colors.dim(`(${job.id.slice(0, 8)})`)}`);
      console.log(`   ${colors.cyan(scheduleDesc)}`);
      console.log(`   Next: ${nextRun} | Type: ${job.type} | Runs: ${job.runCount}`);
      if (job.description) {
        console.log(`   ${colors.dim(job.description)}`);
      }
      console.log();
    }

  } finally {
    CronService.close();
  }
}

async function handleAdd(
  description: string | undefined,
  options: {
    name?: string;
    schedule?: string;
    type?: string;
    command?: string;
    url?: string;
    prompt?: string;
  }
): Promise<void> {
  intro("⏰ Create Scheduled Job");

  try {
    // Get job name
    let name = options.name;
    if (!name) {
      const input = await text({
        message: "Job name:",
        placeholder: "e.g., Daily Backup",
        validate: (value) => value.length < 1 ? "Name is required" : undefined,
      });
      if (isCancel(input)) return;
      name = input;
    }

    // Get schedule
    let schedule = options.schedule;
    if (!schedule) {
      const input = await text({
        message: "Schedule:",
        placeholder: "e.g., 'daily at 9am' or '0 9 * * *'",
        validate: (value) => {
          if (value.length < 1) return "Schedule is required";
          if (!parseSchedule(value)) return "Could not parse schedule";
          return undefined;
        },
      });
      if (isCancel(input)) return;
      schedule = input;
    }

    // Validate schedule
    const parsed = parseSchedule(schedule);
    if (!parsed) {
      console.log(colors.red(`Invalid schedule: ${schedule}`));
      return;
    }

    console.log(colors.dim(`  → ${describeSchedule(parsed.type === "cron" ? { type: "cron", expression: parsed.expression } : { type: "interval", seconds: parsed.seconds ?? 60 })}`));

    // Get job type
    let type = options.type as CreateJobInput["type"];
    if (!type) {
      const input = await select({
        message: "Job type:",
        options: [
          { value: "shell", label: "💻 Shell Command", hint: "Execute a shell command" },
          { value: "http", label: "🌐 HTTP Request", hint: "Call an API endpoint" },
          { value: "agent", label: "🤖 Agent Task", hint: "Run an AI agent task" },
          { value: "cowork", label: "🔧 Cowork Session", hint: "Start a cowork session" },
        ],
      });
      if (isCancel(input)) return;
      type = input as CreateJobInput["type"];
    }

    // Get job config based on type
    const config = await getJobConfig(type, options);
    if (!config) return;

    // Create job
    const s = spinner();
    s.start("Creating job...");

    CronService.initialize();
    const job = CronService.create({
      name,
      schedule,
      type,
      config: config as CreateJobInput["config"],
      description,
    });

    s.stop();

    console.log(colors.green(`✓ Created job: ${job.name}`));
    console.log(colors.dim(`  ID: ${job.id}`));
    console.log(colors.dim(`  Next run: ${job.nextRunAt ? formatRelativeTime(new Date(job.nextRunAt)) : "Not scheduled"}`));

    outro("Done!");

  } finally {
    CronService.close();
  }
}

async function handleRemove(id: string): Promise<void> {
  try {
    CronService.initialize();
    const job = CronService.get(id);

    if (!job) {
      console.log(colors.red(`Job not found: ${id}`));
      return;
    }

    const confirmed = await confirm({
      message: `Delete job "${job.name}"?`,
      initialValue: false,
    });

    if (isCancel(confirmed) || !confirmed) {
      console.log(colors.yellow("Cancelled."));
      return;
    }

    CronService.delete(id);
    console.log(colors.green(`✓ Deleted job: ${job.name}`));

  } finally {
    CronService.close();
  }
}

async function handleRun(id: string): Promise<void> {
  const s = spinner();
  s.start("Triggering job...");

  try {
    CronService.initialize();
    const job = CronService.get(id);

    if (!job) {
      s.stop();
      console.log(colors.red(`Job not found: ${id}`));
      return;
    }

    s.stop();
    console.log(colors.bold(`\n▶ Running: ${job.name}\n`));

    const run = await CronService.run(id);

    if (run.status === "success") {
      console.log(colors.green(`✓ Completed in ${run.durationMs}ms`));
      if (run.output) console.log(run.output);
    } else if (run.status === "failed") {
      console.log(colors.red(`✗ Failed: ${run.error}`));
    } else {
      console.log(colors.yellow(`⏳ Status: ${run.status}`));
    }

  } finally {
    CronService.close();
  }
}

async function handleLogs(id: string, options: { limit: string }): Promise<void> {
  const s = spinner();
  s.start("Loading logs...");

  try {
    CronService.initialize();
    const job = CronService.get(id);

    if (!job) {
      s.stop();
      console.log(colors.red(`Job not found: ${id}`));
      return;
    }

    const runs = CronService.getRuns(id, parseInt(options.limit, 10));
    s.stop();

    console.log(colors.bold(`\n📋 Run History: ${job.name}\n`));

    if (runs.length === 0) {
      console.log(colors.dim("No runs yet."));
      return;
    }

    for (const run of runs) {
      const icon = getRunStatusIcon(run.status);
      const time = new Date(run.scheduledAt).toLocaleString();
      const duration = run.durationMs ? `(${run.durationMs}ms)` : "";

      console.log(`${icon} ${time} ${colors.dim(duration)}`);
      
      if (run.output && run.output.length > 0) {
        const lines = run.output.split("\n").slice(0, 3);
        for (const line of lines) {
          console.log(colors.dim(`   ${line.slice(0, 80)}${line.length > 80 ? "..." : ""}`));
        }
      }
      
      if (run.error) {
        console.log(colors.red(`   Error: ${run.error.slice(0, 100)}`));
      }
      console.log();
    }

  } finally {
    CronService.close();
  }
}

async function handleStatus(): Promise<void> {
  try {
    CronService.initialize();
    const status = CronService.getStatus();

    console.log(colors.bold("\n📊 Cron Status\n"));
    console.log(`Scheduler: ${status.running ? colors.green("Running") : colors.red("Stopped")}`);
    console.log(`Jobs: ${status.jobs.total} total, ${colors.green(String(status.jobs.active))} active, ${colors.yellow(String(status.jobs.paused))} paused`);
    console.log(`Runs (24h): ${status.runs.last24h}`);
    console.log(`Pending: ${status.runs.pending} | Running: ${status.runs.running}`);

    // Check daemon
    const daemonRunning = await isDaemonRunning(DEFAULT_DAEMON_PORT);
    console.log(`\nDaemon: ${daemonRunning ? colors.green(`Running on port ${DEFAULT_DAEMON_PORT}`) : colors.dim("Not running")}`);

  } finally {
    CronService.close();
  }
}

async function handleWake(): Promise<void> {
  const s = spinner();
  s.start("Checking for due jobs...");

  try {
    CronService.initialize();
    CronService.start();
    const count = CronService.wake();
    s.stop();

    if (count > 0) {
      console.log(colors.green(`✓ Triggered ${count} job${count === 1 ? "" : "s"}`));
    } else {
      console.log(colors.dim("No jobs due"));
    }

  } finally {
    CronService.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Daemon Commands
// ═══════════════════════════════════════════════════════════════════════════════

async function handleDaemonStart(options: { port: string; daemon?: boolean }): Promise<void> {
  const port = parseInt(options.port, 10);

  // Check if already running
  const running = await isDaemonRunning(port);
  if (running) {
    console.log(colors.yellow(`Daemon is already running on port ${port}`));
    return;
  }

  console.log(colors.bold(`\n🚀 Starting Cron Daemon on port ${port}\n`));

  if (options.daemon) {
    // Background mode - spawn detached process
    // TODO: Implement proper daemonization
    console.log(colors.yellow("Background mode not yet implemented. Running in foreground..."));
  }

  try {
    const daemon = await startDaemon({ port });
    
    console.log(colors.green("✓ Daemon started"));
    console.log(colors.dim(`  Port: ${port}`));
    console.log(colors.dim(`  API: http://127.0.0.1:${port}`));
    console.log(colors.dim("\nPress Ctrl+C to stop\n"));

    // Keep running until interrupted
    await new Promise(() => {});

  } catch (error) {
    console.log(colors.red(`Failed to start daemon: ${error}`));
  }
}

async function handleDaemonStop(options: { port: string }): Promise<void> {
  const port = parseInt(options.port, 10);
  
  // TODO: Implement proper daemon stop (signal, PID file, etc.)
  console.log(colors.yellow("Stop command not yet implemented."));
  console.log(colors.dim("Use Ctrl+C to stop the foreground daemon."));
}

async function handleDaemonStatus(options: { port: string }): Promise<void> {
  const port = parseInt(options.port, 10);

  const s = spinner();
  s.start("Checking daemon...");

  const status = await getRemoteStatus(port);
  s.stop();

  if (!status) {
    console.log(colors.red(`Daemon is not running on port ${port}`));
    return;
  }

  console.log(colors.bold(`\n📊 Daemon Status (Port ${port})\n`));
  console.log(`Version: ${status.version}`);
  console.log(`PID: ${status.pid}`);
  console.log(`Started: ${status.startedAt ? new Date(status.startedAt).toLocaleString() : "Unknown"}`);
  console.log(`\nJobs: ${status.jobs.total} total, ${colors.green(String(status.jobs.active))} active`);
  console.log(`Runs: ${status.runs.last24h} (24h) | Pending: ${status.runs.pending}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Natural Language Handler
// ═══════════════════════════════════════════════════════════════════════════════

async function handleNaturalLanguage(schedule: string, taskParts: string[]): Promise<void> {
  const task = taskParts.join(" ");
  
  // Parse natural language
  const parsed = parseSchedule(schedule);
  if (!parsed) {
    console.log(colors.red(`Could not understand schedule: ${schedule}`));
    console.log(colors.dim("Try: 'every 5 minutes', 'daily at 9am', 'weekly on monday'"));
    return;
  }

  console.log(colors.bold(`\n⏰ ${parsed.description}\n`));
  
  // Interactive mode to complete job creation
  if (!task) {
    await handleAdd(undefined, { schedule: parsed.expression });
    return;
  }

  // Try to infer type from task
  let type: CreateJobInput["type"] = "shell";
  let config: CreateJobInput["config"] = { command: task };

  if (task.startsWith("http://") || task.startsWith("https://")) {
    type = "http";
    config = { url: task, method: "GET" };
  } else if (task.toLowerCase().includes("ask ") || task.toLowerCase().includes("agent ")) {
    type = "agent";
    config = { prompt: task };
  }

  try {
    CronService.initialize();
    const job = CronService.create({
      name: `${type}: ${task.slice(0, 30)}${task.length > 30 ? "..." : ""}`,
      schedule: parsed.expression,
      type,
      config,
    });

    console.log(colors.green(`✓ Created job: ${job.name}`));
    console.log(colors.dim(`  ID: ${job.id}`));
    console.log(colors.dim(`  Schedule: ${parsed.description}`));

  } finally {
    CronService.close();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function getJobConfig(
  type: CreateJobInput["type"],
  options: { command?: string; url?: string; prompt?: string }
): Promise<CreateJobInput["config"] | null> {
  switch (type) {
    case "shell": {
      let command = options.command;
      if (!command) {
        const input = await text({
          message: "Shell command:",
          placeholder: "e.g., ./backup.sh",
          validate: (value) => value.length < 1 ? "Command is required" : undefined,
        });
        if (isCancel(input)) return null;
        command = input;
      }
      return { command };
    }

    case "http": {
      let url = options.url;
      if (!url) {
        const input = await text({
          message: "URL:",
          placeholder: "https://api.example.com/health",
          validate: (value) => {
            if (value.length < 1) return "URL is required";
            if (!value.startsWith("http")) return "URL must start with http:// or https://";
            return undefined;
          },
        });
        if (isCancel(input)) return null;
        url = input;
      }
      
      const method = await select({
        message: "HTTP method:",
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "DELETE", label: "DELETE" },
        ],
        initialValue: "GET",
      });
      if (isCancel(method)) return null;

      return { url, method };
    }

    case "agent": {
      let prompt = options.prompt;
      if (!prompt) {
        const input = await text({
          message: "Agent prompt:",
          placeholder: "What should the agent do?",
          validate: (value) => value.length < 1 ? "Prompt is required" : undefined,
        });
        if (isCancel(input)) return null;
        prompt = input;
      }
      return { prompt };
    }

    case "cowork": {
      const commands = await text({
        message: "Commands (semicolon-separated):",
        placeholder: "npm test; npm build",
      });
      if (isCancel(commands)) return null;

      const runtime = await select({
        message: "Runtime:",
        options: [
          { value: "local", label: "Local", hint: "Run on this machine" },
          { value: "docker", label: "Docker", hint: "Run in container" },
          { value: "vm", label: "VM", hint: "Run in virtual machine" },
        ],
        initialValue: "local",
      });
      if (isCancel(runtime)) return null;

      return {
        runtime: runtime as "local" | "docker" | "vm",
        commands: commands.split(";").map((c) => c.trim()),
      };
    }

    default:
      return null;
  }
}

function getStatusIcon(status: CronJob["status"]): string {
  switch (status) {
    case "active": return colors.green("●");
    case "paused": return colors.yellow("⏸");
    case "disabled": return colors.gray("○");
    case "error": return colors.red("✖");
    default: return colors.gray("?");
  }
}

function getRunStatusIcon(status: CronRun["status"]): string {
  switch (status) {
    case "success": return colors.green("✓");
    case "failed": return colors.red("✗");
    case "running": return colors.blue("▶");
    case "pending": return colors.yellow("⏳");
    case "cancelled": return colors.gray("⊘");
    case "timeout": return colors.red("⏱");
    default: return colors.gray("?");
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const absDiff = Math.abs(diff);
  
  const minutes = Math.floor(absDiff / 60000);
  const hours = Math.floor(absDiff / 3600000);
  const days = Math.floor(absDiff / 86400000);

  if (diff < 0) {
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  if (minutes < 1) return "Now";
  if (minutes < 60) return `in ${minutes}m`;
  if (hours < 24) return `in ${hours}h`;
  return `in ${days}d`;
}
