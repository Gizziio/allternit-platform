import { Command } from 'commander';
import chalk from 'chalk';

export const replCommand = new Command('repl')
  .description('Start an interactive REPL session')
  .argument('[language]', 'Language for REPL', 'python')
  .action(async (language: string) => {
    console.log(chalk.blue('Starting REPL session'));
    console.log(chalk.gray(`Language: ${language}`));
    console.log(chalk.yellow('⚠️  REPL not yet implemented'));
  });
