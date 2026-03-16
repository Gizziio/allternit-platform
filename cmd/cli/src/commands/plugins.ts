import { Command } from 'commander';
import chalk from 'chalk';
import { PluginRegistry, PluginLoader } from '@a2r/plugins';

const registry = new PluginRegistry();
const loader = new PluginLoader('./plugins');

export const pluginsCommand = new Command('plugins')
  .description('Manage plugins')
  
  .command('list')
  .description('List installed plugins')
  .action(async () => {
    const plugins = registry.list();
    console.log(chalk.blue('Installed Plugins'));
    console.log(chalk.gray('─────────────────────'));
    
    if (plugins.length === 0) {
      console.log(chalk.yellow('No plugins installed'));
    } else {
      plugins.forEach(plugin => {
        console.log(chalk.green('✓'), chalk.white(plugin.name));
        console.log(chalk.gray(`  ID: ${plugin.id}`));
        console.log(chalk.gray(`  v${plugin.version}`));
        console.log(chalk.gray(`  ${plugin.description || ''}`));
        console.log(chalk.gray(`  Status: ${plugin.isActive() ? chalk.green('Active') : chalk.yellow('Inactive')}`));
      });
    }
  })
  
  .command('load')
  .description('Load plugins from directory')
  .action(async () => {
    console.log(chalk.blue('Loading plugins...'));
    const plugins = await loader.loadAll();
    plugins.forEach(p => registry.register(p));
    console.log(chalk.green('✓'), `Loaded ${plugins.length} plugin(s)`);
  })
  
  .command('activate <plugin>')
  .description('Activate a plugin')
  .action(async (plugin) => {
    try {
      await registry.activate(plugin);
      console.log(chalk.green('✓'), `${plugin} activated`);
    } catch (error: any) {
      console.log(chalk.red('✗'), error.message);
    }
  })
  
  .command('deactivate <plugin>')
  .description('Deactivate a plugin')
  .action(async (plugin) => {
    await registry.deactivate(plugin);
    console.log(chalk.green('✓'), `${plugin} deactivated`);
  })
  
  .command('exec <command> [args...]')
  .description('Execute plugin command')
  .action(async (command, args) => {
    const cmd = registry.getCommand(command);
    if (!cmd) {
      console.log(chalk.red('✗'), `Command not found: ${command}`);
      return;
    }
    
    try {
      const result = await cmd.execute(...args);
      console.log(chalk.green('Result:'), result);
    } catch (error: any) {
      console.log(chalk.red('✗'), error.message);
    }
  });
