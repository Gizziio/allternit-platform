#!/usr/bin/env node
/**
 * A2R Command Line Interface
 * 
 * TypeScript implementation ported from Rust CLI
 * Integrated with GizziClaw workspace system
 */

import { Command } from 'commander';
import { runCommand } from './commands/run.js';
import { replCommand } from './commands/repl.js';
import { shellCommand } from './commands/shell.js';
import { statusCommand } from './commands/status.js';
import { skillsCommand } from './commands/skills.js';
import { workspaceCommand } from './commands/workspace.js';
import { vmCommand } from './commands/vm.js';
import { connectorsCommand } from './commands/connectors.js';
import { pluginsCommand } from './commands/plugins.js';
import { computerUseCommand } from './commands/computer-use.js';
import { agentCommand } from './commands/agent.js';
import { version } from '../package.json' assert { type: 'json' };

const program = new Command();

program
  .name('a2r')
  .description('A2R - AI-native runtime environment')
  .version(version);

// Register all commands
program.addCommand(runCommand);
program.addCommand(replCommand);
program.addCommand(shellCommand);
program.addCommand(statusCommand);
program.addCommand(skillsCommand);
program.addCommand(workspaceCommand);
program.addCommand(vmCommand);
program.addCommand(connectorsCommand);
program.addCommand(pluginsCommand);
program.addCommand(computerUseCommand);
program.addCommand(agentCommand);

// Parse and execute
program.parse();
