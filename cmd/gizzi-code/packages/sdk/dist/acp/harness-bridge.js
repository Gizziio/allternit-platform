/**
 * ACP (Agent Capability Protocol) Harness Bridge
 *
 * Bridge connecting ACP sessions to the AllternitHarness for unified AI interactions.
 * Uses official ACP types from @agentclientprotocol/sdk.
 */
export class ACPHarnessBridge {
    harness;
    registry;
    constructor(options) {
        this.harness = options.harness;
        this.registry = options.registry;
    }
    /**
     * Convert ACP session to harness stream
     */
    async *streamSession(session) {
        const provider = this.registry.get(session.model.provider);
        if (!provider) {
            throw new Error(`Unknown provider: ${session.model.provider}`);
        }
        const model = provider.models.find((m) => m.id === session.model.model);
        if (!model) {
            throw new Error(`Unknown model: ${session.model.model}`);
        }
        // Convert ACP messages to harness format
        // Note: ACP messages are stored differently, this is a simplified conversion
        const messages = [];
        // Add system prompt if configured
        if (session.config?.systemPrompt) {
            messages.push({ role: 'system', content: session.config.systemPrompt });
        }
        const request = {
            provider: session.model.provider,
            model: session.model.model,
            messages,
            temperature: session.config?.temperature,
            maxTokens: session.config?.maxTokens,
        };
        try {
            for await (const chunk of this.harness.stream(request)) {
                switch (chunk.type) {
                    case 'text': {
                        const content = {
                            type: 'text',
                            text: chunk.text,
                        };
                        yield { type: 'content', content };
                        break;
                    }
                    case 'tool_call': {
                        const toolCall = {
                            toolCallId: chunk.callID || crypto.randomUUID(),
                            title: chunk.name,
                            status: 'in_progress',
                        };
                        yield { type: 'tool_call', toolCall };
                        break;
                    }
                    case 'error': {
                        yield { type: 'error', error: chunk.error.message };
                        break;
                    }
                    case 'done': {
                        yield { type: 'done' };
                        break;
                    }
                }
            }
        }
        catch (error) {
            yield {
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }
    /**
     * Create a new session with the harness
     */
    createSession(agentId, model, config) {
        const now = new Date().toISOString();
        const session = {
            id: crypto.randomUUID(),
            agentId,
            status: 'active',
            model,
            config,
            createdAt: now,
            updatedAt: now,
        };
        // Store in registry
        this.registry.setSession(session);
        return session;
    }
    /**
     * Update a session
     */
    updateSession(sessionId, updates) {
        const session = this.registry.getSession(sessionId);
        if (!session)
            return undefined;
        const updated = {
            ...session,
            ...updates,
            id: sessionId,
            updatedAt: new Date().toISOString(),
        };
        this.registry.setSession(updated);
        return updated;
    }
    /**
     * Register a provider from harness-compatible config
     */
    registerProvider(entry) {
        this.registry.register(entry);
    }
    /**
     * List available providers
     */
    listProviders() {
        return this.registry.list();
    }
    /**
     * Get provider by ID
     */
    getProvider(id) {
        return this.registry.get(id);
    }
}
export { ACPHarnessBridge as default };
//# sourceMappingURL=harness-bridge.js.map