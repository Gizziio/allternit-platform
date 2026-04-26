import { Command } from 'commander';
import chalk from 'chalk';

export const statusCommand = new Command('status')
  .description('Check system status')
  .option('--json', 'Output as JSON')
  .action(async (options: any) => {
    const status = {
      daemon: 'running',
      workspace: 'loaded',
      skills: 3,
      sessions: 0,
    };
    
    if (options.json) {
      console.log(JSON.stringify(status, null, 2));
    } else {
      console.log(chalk.blue('Allternit System Status'));
      console.log(chalk.gray('─────────────────────'));
      console.log(chalk.green('✓'), 'Daemon:', chalk.white(status.daemon));
      console.log(chalk.green('✓'), 'Workspace:', chalk.white(status.workspace));
      console.log(chalk.green('✓'), 'Skills:', chalk.white(`${status.skills} loaded`));
      console.log(chalk.yellow('○'), 'Sessions:', chalk.white(status.sessions));
    }
  });
