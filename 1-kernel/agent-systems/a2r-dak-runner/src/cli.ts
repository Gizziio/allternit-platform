#!/usr/bin/env node
/**
 * DAK Runner CLI
 *
 * Usage:
 *   dak run          - Discover and execute next ready work item
 *   dak discover     - List ready work items from Rails
 *   dak health       - Check Rails connectivity and runner health
 *   dak worker list  - List active workers
 *   dak worker stats - Show worker statistics
 */

import { createAgentRunner, AgentRunnerConfig } from './runner/agent-runner';
import { createRailsUnifiedAdapter, RailsUnifiedAdapter, UnifiedRailsConfig } from './adapters/rails_unified';
import type { RunId } from './types';

const COMMANDS = ['run', 'discover', 'health', 'worker'] as const;
type Command = typeof COMMANDS[number];

interface CLIOptions {
  railsCliPath: string;
  projectPath: string;
  outputDir: string;
  railsHttpUrl?: string;
  railsApiKey?: string;
}

function parseArgs(): { command: Command; subcommand?: string; options: CLIOptions } {
  const args = process.argv.slice(2);
  const command = (args[0] || 'help') as Command;
  const subcommand = args[1];

  const options: CLIOptions = {
    railsCliPath: process.env.A2R_RAILS_CLI || 'a2r',
    projectPath: process.env.A2R_PROJECT_PATH || process.cwd(),
    outputDir: process.env.A2R_OUTPUT_DIR || '.a2r/runner',
    railsHttpUrl: process.env.A2R_RAILS_HTTP_URL,
    railsApiKey: process.env.A2R_RAILS_API_KEY,
  };

  return { command, subcommand, options };
}

function printUsage(): void {
  process.stdout.write(`
DAK Runner - Deterministic Agent Kernel

Usage: dak <command> [options]

Commands:
  run          Discover and execute next ready work item
  discover     List ready work items from Rails
  health       Check Rails connectivity and runner health
  worker list  List active workers
  worker stats Show worker statistics

Environment:
  A2R_RAILS_CLI        Path to Rails CLI binary (default: a2r)
  A2R_PROJECT_PATH     Project root path (default: cwd)
  A2R_OUTPUT_DIR       Runner output directory (default: .a2r/runner)
  A2R_RAILS_HTTP_URL   Rails HTTP API URL (optional, enables HTTP mode)
  A2R_RAILS_API_KEY    Rails API key (optional)
`);
}

async function runDiscover(options: CLIOptions): Promise<void> {
  const adapter = createAdapter(options);
  const work = await adapter.discoverWork();

  if (work.length === 0) {
    process.stdout.write('No ready work items found.\n');
    return;
  }

  process.stdout.write(`Found ${work.length} ready work item(s):\n\n`);
  for (const item of work) {
    process.stdout.write(`  ${item.nodeId} [${item.role}] priority=${item.priority}\n`);
    process.stdout.write(`    DAG: ${item.dagId}  WIH: ${item.wihId}\n`);
    process.stdout.write(`    Mode: ${item.executionMode}  Deps: ${item.depsSatisfied ? 'satisfied' : 'pending'}\n\n`);
  }
}

async function runExecute(options: CLIOptions): Promise<void> {
  const runId: RunId = `run_${Date.now()}`;

  const config: AgentRunnerConfig = {
    runId,
    projectPath: options.projectPath,
    railsCliPath: options.railsCliPath,
    outputDir: options.outputDir,
  };

  const runner = createAgentRunner(config);
  await runner.initialize();

  // Discover work
  const work = await runner.discoverWork();
  if (work.length === 0) {
    process.stdout.write('No ready work items. Runner idle.\n');
    return;
  }

  // Execute first ready item
  const target = work[0];
  process.stdout.write(`Executing: ${target.nodeId} [${target.role}] from DAG ${target.dagId}\n`);

  const result = await runner.executeWork(target);

  if (result.success) {
    process.stdout.write(`Done. ${result.receipts.length} receipt(s) produced.\n`);
  } else {
    process.stderr.write(`Failed: ${result.error}\n`);
    process.exit(1);
  }
}

async function runHealth(options: CLIOptions): Promise<void> {
  const adapter = createAdapter(options);

  try {
    const health = await adapter.healthCheck();
    process.stdout.write(`Rails: ${health.status} (${adapter.getMode()} mode)\n`);
    process.stdout.write(`Version: ${health.version}\n`);
    process.stdout.write(`Timestamp: ${health.timestamp}\n`);
  } catch (error) {
    process.stderr.write(`Health check failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

async function runWorkerCommand(subcommand: string | undefined, options: CLIOptions): Promise<void> {
  const runId: RunId = `run_${Date.now()}`;
  const config: AgentRunnerConfig = {
    runId,
    projectPath: options.projectPath,
    railsCliPath: options.railsCliPath,
    outputDir: options.outputDir,
  };

  const runner = createAgentRunner(config);

  switch (subcommand) {
    case 'stats': {
      const stats = runner.getWorkerStats();
      process.stdout.write(`Workers: ${stats.total} total, ${stats.active} active, ${stats.completed} completed, ${stats.failed} failed\n`);
      break;
    }
    case 'list':
    default:
      process.stdout.write('No active workers (runner not executing).\n');
      break;
  }
}

function createAdapter(options: CLIOptions): RailsUnifiedAdapter {
  const config: UnifiedRailsConfig = {
    cliPath: options.railsCliPath,
    projectPath: options.projectPath,
    preferHttp: !!options.railsHttpUrl,
    fallbackToCli: true,
    ...(options.railsHttpUrl && {
      http: {
        baseURL: options.railsHttpUrl,
        apiKey: options.railsApiKey,
      },
    }),
  };

  return createRailsUnifiedAdapter(config);
}

async function main(): Promise<void> {
  const { command, subcommand, options } = parseArgs();

  switch (command) {
    case 'run':
      await runExecute(options);
      break;
    case 'discover':
      await runDiscover(options);
      break;
    case 'health':
      await runHealth(options);
      break;
    case 'worker':
      await runWorkerCommand(subcommand, options);
      break;
    default:
      printUsage();
      break;
  }
}

main().catch((error) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
