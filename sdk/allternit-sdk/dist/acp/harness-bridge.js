/**
 * ACP Harness Bridge
 * Bridges ACP protocol with AllternitHarness for seamless integration
 */
import { acpRegistry } from './registry.js';
import { validateMessage } from './validator.js';
/**
 * ACP Harness Bridge
 * Enables ACP agents to use the AllternitHarness for AI operations
 */
export class ACPHarnessBridge {
    harness;
    registry;
    agentId;
    capabilities;
    enableStreaming;
    constructor(config) {
        this.harness = config.harness;
        this.registry = config.registry || acpRegistry;
        this.agentId = config.agentId;
        this.capabilities = config.capabilities || [];
        this.enableStreaming = config.enableStreaming ?? true;
    }
    /**
     * Process an incoming ACP message
     */
    async processMessage(message) {
        // Validate the message
        const validation = validateMessage(message);
        if (!validation.valid) {
            return this.createErrorResponse(message, 'INVALID_MESSAGE', `Message validation failed: ${validation.errors?.join(', ')}`);
        }
        // Check if this message is for us
        if (message.target.agentId !== this.agentId && message.target.agentId !== '*') {
            return null; // Not for us
        }
        // Process based on message type
        switch (message.type) {
            case 'request':
                return this.handleRequest(message);
            case 'handshake':
                return this.handleHandshake(message);
            case 'heartbeat':
                return this.handleHeartbeat(message);
            default:
                return this.createErrorResponse(message, 'INVALID_MESSAGE', `Unsupported message type: ${message.type}`);
        }
    }
    /**
     * Execute a tool using the harness
     */
    async executeTool(tool, parameters, context) {
        // Map tool execution to harness capabilities
        const action = tool.name;
        switch (action) {
            case 'chat':
                return this.executeChat(parameters, context);
            case 'stream':
                return this.executeStream(parameters, context);
            case 'complete':
                return this.executeComplete(parameters, context);
            default:
                throw new Error(`Unknown tool: ${action}`);
        }
    }
    /**
     * Create a streaming response
     */
    async *streamResponse(request) {
        yield* this.harness.stream(request);
    }
    /**
     * Register this agent with the ACP registry
     */
    register() {
        this.registry.register({
            agentId: this.agentId,
            name: `Allternit Agent (${this.agentId})`,
            description: 'AI agent powered by AllternitHarness',
            version: '1.0.0',
            capabilities: this.capabilities.map(cap => ({
                name: cap,
                description: `Capability: ${cap}`,
                version: '1.0.0',
                tools: [],
            })),
            endpoints: {},
            authentication: { type: 'none' },
            metadata: {
                tags: ['allternit', 'ai', 'harness'],
                category: 'ai-agent',
                author: 'Allternit',
                license: 'MIT',
            },
            status: 'active',
            registeredAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
        });
    }
    /**
     * Unregister this agent
     */
    unregister() {
        this.registry.unregister(this.agentId);
    }
    /**
     * Get bridge statistics
     */
    getStats() {
        const entry = this.registry.get(this.agentId);
        return {
            agentId: this.agentId,
            capabilities: this.capabilities,
            harnessMode: 'unknown', // Would need to expose from harness
            registered: !!entry,
        };
    }
    // Private handlers
    async handleRequest(message) {
        const { action, parameters } = message.payload;
        try {
            switch (action) {
                case 'chat': {
                    const result = await this.executeChat(parameters || {}, {
                        messageId: message.id,
                        timestamp: message.timestamp,
                    });
                    return this.createResponse(message, result);
                }
                case 'stream': {
                    // For streaming, we'd need to send multiple messages
                    // For now, return a placeholder
                    return this.createResponse(message, {
                        status: 'streaming_initiated',
                        streamId: crypto.randomUUID(),
                    });
                }
                case 'getCapabilities': {
                    return this.createResponse(message, {
                        capabilities: this.capabilities,
                        harness: this.getStats(),
                    });
                }
                default:
                    return this.createErrorResponse(message, 'CAPABILITY_NOT_FOUND', `Unknown action: ${action}`);
            }
        }
        catch (error) {
            return this.createErrorResponse(message, 'INTERNAL_ERROR', error.message);
        }
    }
    handleHandshake(message) {
        return this.createResponse(message, {
            agentId: this.agentId,
            capabilities: this.capabilities,
            version: '1.0.0',
            status: 'ready',
        });
    }
    handleHeartbeat(message) {
        // Update last seen
        const entry = this.registry.get(this.agentId);
        if (entry) {
            entry.lastSeenAt = new Date().toISOString();
        }
        return this.createResponse(message, {
            status: 'alive',
            timestamp: new Date().toISOString(),
        });
    }
    async executeChat(parameters, context) {
        const request = {
            provider: String(parameters.provider || 'anthropic'),
            model: String(parameters.model || 'claude-3-haiku-20240307'),
            messages: Array.isArray(parameters.messages) ? parameters.messages : [],
            temperature: parameters.temperature,
            maxTokens: parameters.maxTokens,
        };
        const result = await this.harness.complete(request);
        return result;
    }
    async executeStream(parameters, context) {
        // Return stream initiation info
        // Actual streaming would be handled separately
        return {
            streamId: crypto.randomUUID(),
            status: 'ready',
        };
    }
    async executeComplete(parameters, context) {
        return this.executeChat(parameters, context);
    }
    createResponse(request, data) {
        return {
            id: crypto.randomUUID(),
            version: '1.0',
            timestamp: new Date().toISOString(),
            source: {
                agentId: this.agentId,
                capability: request.target.capability || 'core',
            },
            target: {
                agentId: request.source.agentId,
            },
            type: 'response',
            payload: {
                action: `${request.payload.action}_response`,
                data,
                context: {
                    requestId: request.id,
                    timestamp: new Date().toISOString(),
                },
            },
            metadata: {
                priority: 'normal',
                correlationId: request.id,
            },
        };
    }
    createErrorResponse(request, code, message) {
        return {
            id: crypto.randomUUID(),
            version: '1.0',
            timestamp: new Date().toISOString(),
            source: {
                agentId: this.agentId,
                capability: request.target.capability || 'core',
            },
            target: {
                agentId: request.source.agentId,
            },
            type: 'error',
            payload: {
                action: 'error',
                data: {
                    code,
                    message,
                    originalAction: request.payload.action,
                },
                context: {
                    requestId: request.id,
                },
            },
            metadata: {
                priority: 'high',
                correlationId: request.id,
            },
        };
    }
}
export default ACPHarnessBridge;
