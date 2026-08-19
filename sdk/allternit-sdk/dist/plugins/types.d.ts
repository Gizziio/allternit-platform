import type { ToolDefinition } from '../tools/types.js';
/** Discriminator for the kind of capability being published. */
export type CapabilityKind = 'skill' | 'command' | 'tool' | 'mcp' | 'webhook' | 'connector' | 'plugin';
/** Pricing model for a capability in the marketplace. */
export type CapabilityPricing = {
    type: 'free';
} | {
    type: 'paid';
    amountCents: number;
    currency: string;
} | {
    type: 'subscription';
    amountCents: number;
    currency: string;
    interval: 'month' | 'year';
} | {
    type: 'enterprise';
};
/** Full manifest describing a capability's identity, tools, and permissions. */
export interface CapabilityManifest {
    id: string;
    name: string;
    displayName: string;
    description: string;
    version: string;
    kind: CapabilityKind;
    author: CapabilityAuthor;
    pricing: CapabilityPricing;
    tools: ToolDefinition[];
    permissions: CapabilityPermission[];
    dependencies: string[];
    tags: string[];
    icon?: string;
    repository?: string;
    homepage?: string;
    license?: string;
    minRuntimeVersion?: string;
}
/** Author metadata for a capability. */
export interface CapabilityAuthor {
    name: string;
    email?: string;
    url?: string;
    verified?: boolean;
}
/** A permission the capability requires at runtime. */
export interface CapabilityPermission {
    resource: 'filesystem' | 'network' | 'shell' | 'clipboard' | 'notifications';
    access: 'read' | 'write' | 'execute';
    description: string;
}
/** A fully resolved capability: manifest plus lifecycle hooks. */
export interface CapabilityRegistration {
    manifest: CapabilityManifest;
    lifecycle: CapabilityLifecycle;
}
/** Optional lifecycle hooks invoked during capability install/uninstall/activate/deactivate. */
export interface CapabilityLifecycle {
    onInstall?: (context: CapabilityContext) => Promise<void>;
    onUninstall?: (context: CapabilityContext) => Promise<void>;
    onActivate?: (context: CapabilityContext) => Promise<void>;
    onDeactivate?: (context: CapabilityContext) => Promise<void>;
    onUpdate?: (context: CapabilityContext, previousVersion: string) => Promise<void>;
}
/** Runtime context passed to lifecycle hooks. */
export interface CapabilityContext {
    capabilityId: string;
    workspacePath: string;
    storagePath: string;
    config: Record<string, unknown>;
    emit(event: string, payload: unknown): void;
}
/** Options for publishing a capability to the marketplace. */
export interface CapabilityPublishOptions {
    dryRun?: boolean;
    registryUrl?: string;
    authToken?: string;
}
/** Result returned after a successful publish. */
export interface CapabilityPublishResult {
    id: string;
    version: string;
    publishedAt: string;
    url: string;
}
/** Paginated search results from the marketplace. */
export interface CapabilitySearchResult {
    items: CapabilityManifest[];
    total: number;
    cursor?: string;
}
/** Filters for searching the marketplace catalog. */
export interface CapabilitySearchOptions {
    query?: string;
    kind?: CapabilityKind;
    tags?: string[];
    pricing?: 'free' | 'paid' | 'all';
    cursor?: string;
    limit?: number;
}
