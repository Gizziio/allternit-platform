import { Command } from 'commander';
import chalk from 'chalk';
import { Workspace, createWorkspaceDirs } from '@allternit/gizziclaw';

export const workspaceCommand = new Command('workspace')
  .description('Manage agent workspaces')
  
  .command('create <name>')
  .description('Create a new workspace')
  .option('-t, --template <template>', 'Workspace template')
  .action(async (name: string, options: any) => {
    const workspacePath = `${process.cwd()}/${name}`;
    
    try {
      const workspace = await Workspace.create(workspacePath, name);
      await workspace.save();
      
      console.log(chalk.green('✓'), chalk.blue('Created workspace:'), chalk.white(name));
      console.log(chalk.gray(`  Path: ${workspacePath}`));
      console.log(chalk.gray('  Layers:'));
      console.log(chalk.gray('    - layer1-cognitive'));
      console.log(chalk.gray('    - layer2-identity'));
      console.log(chalk.gray('    - layer3-governance'));
      console.log(chalk.gray('    - layer4-skills'));
      console.log(chalk.gray('    - layer5-business'));
    } catch (error) {
      console.log(chalk.red('✗'), chalk.red('Failed to create workspace'));
      console.error(error);
    }
  })
  
  .command('load <path>')
  .description('Load a workspace')
  .action(async (path: string) => {
    try {
      const workspace = await Workspace.load(path);
      console.log(chalk.green('✓'), chalk.blue('Loaded workspace:'), chalk.white(workspace.config.name));
      console.log(chalk.gray(`  Version: ${workspace.config.version}`));
      console.log(chalk.gray(`  Skills: ${workspace.skills.length}`));
    } catch (error) {
      console.log(chalk.red('✗'), chalk.red('Failed to load workspace'));
      console.error(error);
    }
  })
  
  .command('list')
  .description('List workspaces')
  .action(async () => {
    console.log(chalk.blue('Workspaces'));
    console.log(chalk.gray('─────────────────────'));
    console.log(chalk.yellow('⚠️  Workspace listing not yet implemented'));
  })
  
  .command('bootstrap')
  .description('Bootstrap workspace layers')
  .option('-p, --path <path>', 'Workspace path')
  .action(async (options: any) => {
    const workspacePath = options.path || process.cwd();
    
    try {
      const dirs = await createWorkspaceDirs(workspacePath);
      console.log(chalk.green('✓'), chalk.blue('Bootstrapped workspace layers'));
      console.log(chalk.gray(`  Cognitive: ${dirs.layers.cognitive}`));
      console.log(chalk.gray(`  Identity: ${dirs.layers.identity}`));
      console.log(chalk.gray(`  Governance: ${dirs.layers.governance}`));
      console.log(chalk.gray(`  Skills: ${dirs.layers.skills}`));
      console.log(chalk.gray(`  Business: ${dirs.layers.business}`));
    } catch (error) {
      console.log(chalk.red('✗'), chalk.red('Failed to bootstrap workspace'));
      console.error(error);
    }
  });
