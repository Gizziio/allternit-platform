import { Command } from 'commander';
import chalk from 'chalk';
import { loadSkills } from '@allternit/gizziclaw';

export const skillsCommand = new Command('skills')
  .description('Manage skills')
  
  .command('list')
  .description('List installed skills')
  .option('-p, --path <path>', 'Workspace path')
  .action(async (options: any) => {
    const workspacePath = options.path || process.cwd();
    const skillsDir = `${workspacePath}/layer4-skills`;
    
    try {
      const skills = await loadSkills(skillsDir);
      console.log(chalk.blue('Installed Skills'));
      console.log(chalk.gray('─────────────────────'));
      
      if (skills.length === 0) {
        console.log(chalk.yellow('No skills installed'));
      } else {
        skills.forEach(skill => {
          console.log(chalk.green('✓'), chalk.white(skill.name), chalk.gray(`v${skill.version}`));
          console.log(chalk.gray(`  ${skill.description}`));
        });
      }
    } catch (error) {
      console.log(chalk.yellow('No skills directory found'));
    }
  })
  
  .command('install <name>')
  .description('Install a skill')
  .action(async (name: string) => {
    console.log(chalk.blue('Installing skill:'), chalk.white(name));
    console.log(chalk.yellow('⚠️  Skill installation not yet implemented'));
  })
  
  .command('uninstall <name>')
  .description('Uninstall a skill')
  .action(async (name: string) => {
    console.log(chalk.blue('Uninstalling skill:'), chalk.white(name));
    console.log(chalk.yellow('⚠️  Skill uninstallation not yet implemented'));
  });
