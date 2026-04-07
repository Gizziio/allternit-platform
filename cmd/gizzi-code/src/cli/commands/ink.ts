#!/usr/bin/env bun
/**
 * Ink TUI Command
 */

import type { Argv } from 'yargs';
import { cmd } from '@/cli/commands/cmd';
import { Log } from '@/shared/util/log';
import { shouldUseHarness } from '@/utils/feature-flags';

const log = Log.create({ service: 'ink-cmd' });

export const InkCommand = cmd({
  command: 'ink',
  describe: 'Launch the Ink-based TUI (React)',
  builder: (yargs: Argv) => {
    return yargs
      .option('skip-boot', { describe: 'Skip boot animation', type: 'boolean', default: false })
      .option('skip-discretion', { describe: 'Skip discretion screen', type: 'boolean', default: false });
  },
  handler: async (args) => {
    log.info('Launching Ink TUI', { skipBoot: args.skipBoot, skipDiscretion: args.skipDiscretion });
    
    // Build flag arguments
    const flagArgs: string[] = [];
    if (args.skipBoot) flagArgs.push('--skip-boot');
    if (args.skipDiscretion) flagArgs.push('--skip-discretion');
    
    // Run from source with flags
    const proc = Bun.spawn({
      cmd: ['bun', 'run', 'src/cli/ui/ink-app/app.tsx', ...flagArgs],
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        GIZZI_USE_HARNESS: shouldUseHarness() ? '1' : '0',
      },
    });
    
    const exitCode = await proc.exited;
    process.exit(exitCode);
  },
});
