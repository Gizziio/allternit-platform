import { EventEmitter } from 'events';
import { toStrictJsonSchema, validateJsonSchema } from './schema.js';
const NAMESPACE_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;
export function qualifyToolName(namespace, name) {
    if (!namespace)
        return name;
    if (!NAMESPACE_PATTERN.test(namespace))
        throw new Error(`Invalid tool namespace: ${namespace}`);
    return `${namespace}.${name}`;
}
export class ToolRegistry extends EventEmitter {
    tools = new Map();
    deferredTools = new Map();
    activeTools = new Set();
    discoveredTools = new Set();
    policies = new Map();
    constructor() {
        super();
    }
    /**
     * Global registration (Startup)
     */
    registerTool(tool, options = {}) {
        const namespace = options.namespace ?? tool.namespace;
        const name = qualifyToolName(namespace, tool.name);
        const registered = {
            ...tool,
            name,
            namespace,
            input_schema: options.strict ? toStrictJsonSchema(tool.input_schema) : tool.input_schema,
        };
        this.tools.set(name, registered);
        this.activeTools.add(name); // By default, registered tools are active
        this.emit('event', { type: 'tool.registered', tool: registered });
    }
    registerDeferredTool(tool) {
        this.deferredTools.set(tool.id, tool);
        this.emit('event', { type: 'tool.registered', tool });
    }
    /**
     * Session-scoped Activation
     */
    activateTool(toolId) {
        const deferred = this.deferredTools.get(toolId);
        if (!deferred)
            throw new Error(`Deferred tool ${toolId} not found`);
        const tool = deferred.activate
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
        this.emit('event', { type: 'tool.activated', toolId });
    }
    getActiveTools() {
        return Array.from(this.activeTools)
            .map(name => this.tools.get(name))
            .filter(Boolean);
    }
    getTool(name) {
        return this.tools.get(name);
    }
    validateInput(toolName, input) {
        const tool = this.tools.get(toolName);
        if (!tool)
            throw new Error(`Tool ${toolName} not found`);
        return validateJsonSchema(tool.input_schema, input);
    }
    setPolicy(toolName, policy) {
        this.policies.set(toolName, policy);
    }
    getPolicy(toolName) {
        return this.policies.get(toolName) || 'require_approval';
    }
    /**
     * Snapshot for Persistence
     */
    snapshot() {
        return {
            activeToolNames: Array.from(this.activeTools),
            discoveredToolIds: Array.from(this.discoveredTools),
            sessionPolicies: Object.fromEntries(this.policies),
            deferredDefinitions: Array.from(this.deferredTools.values())
        };
    }
    rehydrate(snapshot) {
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
                this.tools.set(deferred.name, deferred.activate
                    ? deferred.activate()
                    : {
                        name: deferred.name,
                        description: deferred.description,
                        input_schema: deferred.input_schema,
                        metadata: deferred.metadata,
                    });
            }
        }
    }
    fork() {
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
    search(query) {
        const q = query.toLowerCase();
        const matches = Array.from(this.deferredTools.values()).filter(t => t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.tags?.some(tag => tag.toLowerCase().includes(q)));
        for (const match of matches) {
            this.emit('event', {
                type: 'tool.discovered',
                toolId: match.id,
                metadata: { name: match.name, tags: match.tags ?? [] },
            });
        }
        return matches;
    }
}
