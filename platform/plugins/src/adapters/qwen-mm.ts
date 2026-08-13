import * as fs from 'node:fs/promises';
import { BasePlugin, PluginContext, Tool } from '../plugin.js';
import {
  QwenMMCapabilityManifest,
  QwenMMMarketplaceManifest,
  validateCapabilityManifest,
  validateMarketplaceManifest,
} from './qwen-mm.schema.js';

export interface QwenMMAdapterOptions {
  manifest: QwenMMCapabilityManifest;
  config?: Record<string, string>;
}

export class QwenMMPluginAdapter extends BasePlugin {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;

  private manifest: QwenMMCapabilityManifest;
  private config: Record<string, string>;
  private registeredToolIds: string[] = [];

  constructor(options: QwenMMAdapterOptions) {
    super();
    this.manifest = options.manifest;
    this.config = options.config ?? {};
    this.id = `qwen-mm-${this.manifest.name}`;
    this.name = `Qwen MM: ${this.manifest.name}`;
    this.version = this.manifest.version;
    this.description = this.manifest.description;
  }

  async activate(context: PluginContext): Promise<void> {
    await super.activate(context);

    for (const toolDef of this.manifest.tools) {
      const tool: Tool = {
        id: `${this.id}:${toolDef.name}`,
        name: toolDef.name,
        execute: async (params: Record<string, any>) => {
          return this.invokeTool(toolDef.name, params);
        },
      };
      context.registerTool(tool);
      this.registeredToolIds.push(tool.id);
    }

    context.log(`Registered ${this.manifest.tools.length} tool(s) from capability "${this.manifest.name}"`);
  }

  async deactivate(): Promise<void> {
    this.registeredToolIds = [];
    await super.deactivate();
  }

  getTools() {
    return this.manifest.tools.map((t) => ({
      id: `${this.id}:${t.name}`,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  getServerCommand(): { command: string; args: string[]; env: Record<string, string> } {
    return {
      command: this.manifest.server.command,
      args: [...this.manifest.server.args],
      env: { ...this.config, ...this.manifest.server.env },
    };
  }

  private async invokeTool(toolName: string, params: Record<string, any>): Promise<any> {
    if (!this.context) {
      throw new Error(`Plugin ${this.id} is not active`);
    }

    const toolDef = this.manifest.tools.find((t) => t.name === toolName);
    if (!toolDef) {
      throw new Error(`Unknown tool "${toolName}" in capability "${this.manifest.name}"`);
    }

    this.context.log(`Invoking tool "${toolName}" with params: ${JSON.stringify(params)}`);
    return { tool: toolName, params, status: 'invoked' };
  }

  static async fromManifestPath(manifestPath: string): Promise<QwenMMPluginAdapter> {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const raw = JSON.parse(content);
    const manifest = validateCapabilityManifest(raw);
    return new QwenMMPluginAdapter({ manifest });
  }

  static async fromMarketplaceManifest(
    manifestPath: string,
    capabilityName: string,
  ): Promise<QwenMMPluginAdapter | null> {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const raw = JSON.parse(content);
    const marketplace = validateMarketplaceManifest(raw);

    const entry = marketplace.plugins.find((p) => p.name === capabilityName);
    if (!entry) return null;

    const capabilityManifest: QwenMMCapabilityManifest = {
      name: entry.name,
      version: marketplace.metadata.version,
      description: entry.description,
      tools: [],
      server: { command: 'uvx', args: [] },
    };

    return new QwenMMPluginAdapter({ manifest: capabilityManifest });
  }
}
