import { Command } from 'commander';
import chalk from 'chalk';
import { ConnectorRegistry } from '@allternit/mcp-connectors';

const registry = new ConnectorRegistry();

export const connectorsCommand = new Command('connectors')
  .description('Manage MCP connectors')
  
  .command('list')
  .description('List available connectors')
  .action(async () => {
    const connectors = registry.list();
    console.log(chalk.blue('Available Connectors'));
    console.log(chalk.gray('─────────────────────'));
    
    if (connectors.length === 0) {
      console.log(chalk.yellow('No connectors registered'));
    } else {
      connectors.forEach(connector => {
        const caps = connector.getCapabilities();
        console.log(chalk.green('✓'), chalk.white(connector.name));
        console.log(chalk.gray(`  ${connector.description}`));
        console.log(chalk.gray(`  v${connector.version}`));
        console.log(chalk.gray(`  Operations: ${caps.operations.slice(0, 5).join(', ')}...`));
      });
    }
  })
  
  .command('configure <connector>')
  .description('Configure a connector')
  .option('-c, --config <config>', 'Configuration (JSON or file path)')
  .action(async (connector, options) => {
    console.log(chalk.blue(`Configuring ${connector}...`));
    console.log(chalk.yellow('⚠️  Connector configuration not yet fully implemented'));
  })
  
  .command('connect [connector]')
  .description('Connect connector(s)')
  .action(async (connector) => {
    if (connector) {
      const c = registry.get(connector);
      if (c) {
        await c.connect();
        console.log(chalk.green('✓'), `${connector} connected`);
      } else {
        console.log(chalk.red('✗'), `Connector not found: ${connector}`);
      }
    } else {
      await registry.connectAll();
      console.log(chalk.green('✓'), 'All connectors connected');
    }
  })
  
  .command('disconnect [connector]')
  .description('Disconnect connector(s)')
  .action(async (connector) => {
    if (connector) {
      const c = registry.get(connector);
      if (c) {
        await c.disconnect();
        console.log(chalk.green('✓'), `${connector} disconnected`);
      }
    } else {
      await registry.disconnectAll();
      console.log(chalk.green('✓'), 'All connectors disconnected');
    }
  })
  
  .command('exec <connector> <operation> [params...]')
  .description('Execute connector operation')
  .action(async (connector, operation, params) => {
    const c = registry.get(connector);
    if (!c) {
      console.log(chalk.red('✗'), `Connector not found: ${connector}`);
      return;
    }
    
    try {
      const result = await c.execute(operation, JSON.parse(params[0] || '{}'));
      console.log(chalk.green('Result:'), result);
    } catch (error: any) {
      console.log(chalk.red('✗'), error.message);
    }
  });
