/**
 * ACP (Agent Capability Protocol) Registry
 *
 * Central registry for managing agent and provider entries using official ACP types.
 */
export class ACPRegistry {
    entries = new Map();
    modelsById = new Map();
    sessions = new Map();
    /**
     * Register a new agent/provider entry
     */
    register(entry) {
        // Check for duplicate ID
        if (this.entries.has(entry.id)) {
            throw new Error(`Registry entry with ID "${entry.id}" already exists`);
        }
        this.entries.set(entry.id, entry);
        // Index models for quick lookup
        for (const model of entry.models) {
            this.modelsById.set(`${entry.id}:${model.id}`, model);
        }
    }
    /**
     * Unregister an entry
     */
    unregister(id) {
        const entry = this.entries.get(id);
        if (!entry)
            return false;
        // Remove model indices
        for (const model of entry.models) {
            this.modelsById.delete(`${id}:${model.id}`);
        }
        return this.entries.delete(id);
    }
    /**
     * Get entry by ID
     */
    get(id) {
        return this.entries.get(id);
    }
    /**
     * List all registered entries
     */
    list() {
        return Array.from(this.entries.values());
    }
    /**
     * Query entries by criteria
     */
    query(query) {
        return this.list().filter((entry) => {
            if (query.capability && !entry.capabilities.includes(query.capability)) {
                return false;
            }
            if (query.provider && entry.id !== query.provider) {
                return false;
            }
            if (query.model && !entry.models.some((m) => m.id === query.model)) {
                return false;
            }
            if (query.authType && entry.auth.type !== query.authType) {
                return false;
            }
            return true;
        });
    }
    /**
     * Find entries by capability
     */
    findByCapability(capability) {
        return this.list().filter((e) => e.capabilities.includes(capability));
    }
    /**
     * Find entry by model ID
     */
    findByModel(modelId) {
        for (const entry of this.entries.values()) {
            if (entry.models.some((m) => m.id === modelId)) {
                return entry;
            }
        }
        return undefined;
    }
    /**
     * Get model info
     */
    getModel(providerId, modelId) {
        return this.modelsById.get(`${providerId}:${modelId}`);
    }
    /**
     * List all models across all entries
     */
    listAllModels() {
        const result = [];
        for (const entry of this.entries.values()) {
            for (const model of entry.models) {
                result.push({ provider: entry.id, model });
            }
        }
        return result;
    }
    /**
     * Check if entry exists
     */
    has(id) {
        return this.entries.has(id);
    }
    /**
     * Get count of registered entries
     */
    get size() {
        return this.entries.size;
    }
    /**
     * Clear all entries
     */
    clear() {
        this.entries.clear();
        this.modelsById.clear();
    }
    /**
     * Update an existing entry
     */
    update(id, updates) {
        const existing = this.entries.get(id);
        if (!existing) {
            throw new Error(`Registry entry with ID "${id}" not found`);
        }
        // Remove old model indices
        for (const model of existing.models) {
            this.modelsById.delete(`${id}:${model.id}`);
        }
        const updated = { ...existing, ...updates, id };
        this.entries.set(id, updated);
        // Add new model indices
        for (const model of updated.models) {
            this.modelsById.set(`${id}:${model.id}`, model);
        }
        return updated;
    }
    // ============================================================================
    // Session Management
    // ============================================================================
    /**
     * Store a session
     */
    setSession(session) {
        this.sessions.set(session.id, session);
    }
    /**
     * Get a session
     */
    getSession(id) {
        return this.sessions.get(id);
    }
    /**
     * List all sessions
     */
    listSessions() {
        return Array.from(this.sessions.values());
    }
    /**
     * Delete a session
     */
    deleteSession(id) {
        return this.sessions.delete(id);
    }
}
// Singleton instance for global use
export const acpRegistry = new ACPRegistry();
// Export class as default for custom instances
export default ACPRegistry;
//# sourceMappingURL=registry.js.map