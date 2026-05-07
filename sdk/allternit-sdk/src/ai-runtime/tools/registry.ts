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
    this.emit('event', { type: 'tool.registered', tool } satisfies ToolLifecycleEvent);
  }

  public registerDeferredTool(tool: DeferredToolDefinition) {
    this.deferredTools.set(tool.id, tool);
    this.emit('event', { type: 'tool.registered', tool } satisfies ToolLifecycleEvent);
  }

  /**
   * Session-scoped Activation
   */
  public activateTool(toolId: string) {
    const deferred = this.deferredTools.get(toolId);
    if (!deferred) throw new Error(`Deferred tool ${toolId} not found`);
    
    const tool: ToolDefinition = deferred.activate
      ? deferred.activate()
      : {
          name: deferred.name,
          description: deferred.description,
          input_schema: deferred.input_schema,
          metadata: deferred.metadata,
        };
    this.tools.set(tool.name, tool);
    this.activeTools.add(tool.name);
    this.discoveredTools.add(toolId);
    
    this.emit('event', { type: 'tool.activated', toolId } satisfies ToolLifecycleEvent);
  }

  public getActiveTools(): ToolDefinition[] {
    return Array.from(this.activeTools)
      .map(name => this.tools.get(name)!)
      .filter(Boolean);
  }

  public getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
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
  public snapshot(): ToolRegistrySnapshot & { deferredDefinitions: DeferredToolDefinition[] } {
    return {
      activeToolNames: Array.from(this.activeTools),
      discoveredToolIds: Array.from(this.discoveredTools),
      sessionPolicies: Object.fromEntries(this.policies),
      deferredDefinitions: Array.from(this.deferredTools.values())
    };
  }

  public rehydrate(snapshot: ToolRegistrySnapshot & { deferredDefinitions?: DeferredToolDefinition[] }) {
    this.discoveredTools = new Set(snapshot.discoveredToolIds);
    this.activeTools = new Set(snapshot.activeToolNames);
    this.policies = new Map(Object.entries(snapshot.sessionPolicies));
    
    if (snapshot.deferredDefinitions) {
      for (const def of snapshot.deferredDefinitions) {
        this.deferredTools.set(def.id, def);
      }
    }

    // Ensure all active tools that were deferred are now "live"
    for (const id of snapshot.discoveredToolIds) {
      const deferred = this.deferredTools.get(id);
      if (deferred) {
        this.tools.set(
          deferred.name,
          deferred.activate
            ? deferred.activate()
            : {
                name: deferred.name,
                description: deferred.description,
                input_schema: deferred.input_schema,
                metadata: deferred.metadata,
              },
        );
      }
    }
  }

  public fork(): ToolRegistry {
    const registry = new ToolRegistry();
    registry.tools = new Map(this.tools);
    registry.deferredTools = new Map(this.deferredTools);
    registry.activeTools = new Set(this.activeTools);
    registry.discoveredTools = new Set(this.discoveredTools);
    registry.policies = new Map(this.policies);
    return registry;
  }

  /**
   * Tool Search (Native Primitive)
   */
  public search(query: string): DeferredToolDefinition[] {
    const q = query.toLowerCase();
    const matches = Array.from(this.deferredTools.values()).filter(t => 
      t.name.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
    for (const match of matches) {
      this.emit('event', {
        type: 'tool.discovered',
        toolId: match.id,
        metadata: { name: match.name, tags: match.tags ?? [] },
      } satisfies ToolLifecycleEvent);
    }
    return matches;
  }
}
