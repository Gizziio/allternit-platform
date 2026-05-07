import { EventEmitter } from 'events';
import type { 
  ToolDefinition, 
  DeferredToolDefinition, 
  ToolRegistrySnapshot,
  ToolPolicy,
  ToolLifecycleEvent
} from './types.js';

export class ToolRegistry extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private deferredTools: Map<string, DeferredToolDefinition> = new Map();
  private activeTools: Set<string> = new Set();
  private discoveredTools: Set<string> = new Set();
  private policies: Map<string, ToolPolicy> = new Map();

  constructor() {
    super();
  }

  /**
   * Global registration (Startup)
   */
  public registerTool(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
    this.activeTools.add(tool.name); // By default, registered tools are active
    this.emit('event', { type: 'tool.registered', tool });
  }

  public registerDeferredTool(tool: DeferredToolDefinition) {
    this.deferredTools.set(tool.id, tool);
    this.emit('event', { type: 'tool.registered', tool });
  }

  /**
   * Session-scoped Activation
   */
  public activateTool(toolId: string) {
    const deferred = this.deferredTools.get(toolId);
    if (!deferred) throw new Error(`Deferred tool ${toolId} not found`);
    
    // Move to active tools
    const tool: ToolDefinition = {
      name: deferred.name,
      description: deferred.description,
      input_schema: deferred.input_schema
    };
    this.tools.set(tool.name, tool);
    this.activeTools.add(tool.name);
    this.discoveredTools.add(toolId);
    
    this.emit('event', { type: 'tool.activated', toolId });
  }

  public getActiveTools(): ToolDefinition[] {
    return Array.from(this.activeTools)
      .map(name => this.tools.get(name)!)
      .filter(Boolean);
  }

  public setPolicy(toolName: string, policy: ToolPolicy) {
    this.policies.set(toolName, policy);
  }

  public getPolicy(toolName: string): ToolPolicy {
    return this.policies.get(toolName) || 'require_approval';
  }

  /**
   * Snapshot for Persistence
   */
  public snapshot(): ToolRegistrySnapshot {
    return {
      activeToolNames: Array.from(this.activeTools),
      discoveredToolIds: Array.from(this.discoveredTools),
      sessionPolicies: Object.fromEntries(this.policies)
    };
  }

  public rehydrate(snapshot: ToolRegistrySnapshot) {
    this.discoveredTools = new Set(snapshot.discoveredToolIds);
    this.activeTools = new Set(snapshot.activeToolNames);
    this.policies = new Map(Object.entries(snapshot.sessionPolicies));
    
    // Ensure all active tools that were deferred are now "live"
    for (const id of snapshot.discoveredToolIds) {
      const deferred = this.deferredTools.get(id);
      if (deferred) {
        this.tools.set(deferred.name, {
          name: deferred.name,
          description: deferred.description,
          input_schema: deferred.input_schema
        });
      }
    }
  }

  /**
   * Tool Search (Native Primitive)
   */
  public search(query: string): DeferredToolDefinition[] {
    const q = query.toLowerCase();
    return Array.from(this.deferredTools.values()).filter(t => 
      t.name.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  }
}
