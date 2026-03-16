import { Command } from 'commander';
import chalk from 'chalk';

export const shellCommand = new Command('shell')
  .description('Start an interactive shell session')
  .argument('[shell]', 'Shell to use', 'bash')
  .action(async (shell: string) => {
    console.log(chalk.blue('Starting shell session'));
    console.log(chalk.gray(`Shell: ${shell}`));
    console.log(chalk.yellow('⚠️  Shell not yet implemented'));
  });
