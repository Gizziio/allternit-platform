export interface PluginConfig {
  [key: string]: any;
}

export interface Command {
  id: string;
  description?: string;
  execute: (...args: any[]) => any;
}

export interface View {
  id: string;
  type: 'panel' | 'sidebar' | 'widget';
  render: () => string;
}

export interface Tool {
  id: string;
  name: string;
  execute: (params: Record<string, any>) => Promise<any>;
}

export interface PluginContext {
  config: PluginConfig;
  log: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  registerCommand: (command: Command) => void;
  registerView: (view: View) => void;
  registerTool: (tool: Tool) => void;
  on: (event: string, handler: Function) => void;
  emit: (event: string, data: any) => void;
}

export interface Plugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
  isActive(): boolean;
}

export abstract class BasePlugin implements Plugin {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly version: string;
  readonly description?: string;
  
  protected context: PluginContext | null = null;
  protected active: boolean = false;
  
  async activate(context: PluginContext): Promise<void> {
    this.context = context;
    this.active = true;
    console.log(`Plugin activated: ${this.id}`);
  }
  
  async deactivate(): Promise<void> {
    this.active = false;
    this.context = null;
    console.log(`Plugin deactivated: ${this.id}`);
  }
  
  isActive(): boolean {
    return this.active;
  }
}

export default { BasePlugin };
