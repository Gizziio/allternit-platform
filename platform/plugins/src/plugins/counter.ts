import { BasePlugin, PluginContext, Command } from '../plugin.js';

export class CounterPlugin extends BasePlugin {
  readonly id = 'counter';
  readonly name = 'Counter';
  readonly version = '1.0.0';
  readonly description = 'Simple counter plugin for demonstration';
  
  private count: number = 0;
  
  async activate(context: PluginContext): Promise<void> {
    await super.activate(context);
    
    // Register commands
    const commands: Command[] = [
      {
        id: 'counter.increment',
        description: 'Increment the counter',
        execute: () => {
          this.count++;
          context.log(`Count: ${this.count}`);
          return this.count;
        }
      },
      {
        id: 'counter.decrement',
        description: 'Decrement the counter',
        execute: () => {
          this.count--;
          context.log(`Count: ${this.count}`);
          return this.count;
        }
      },
      {
        id: 'counter.reset',
        description: 'Reset the counter',
        execute: () => {
          this.count = 0;
          context.log('Count reset');
          return this.count;
        }
      },
      {
        id: 'counter.get',
        description: 'Get the current count',
        execute: () => {
          return this.count;
        }
      }
    ];
    
    commands.forEach(cmd => context.registerCommand(cmd));
    
    context.log('Counter plugin activated with 4 commands');
  }
  
  async deactivate(): Promise<void> {
    this.count = 0;
    await super.deactivate();
  }
}

export default CounterPlugin;
