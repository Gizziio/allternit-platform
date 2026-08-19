import { EventEmitter } from 'events';
import type { ToolRegistry } from '../tools/registry.js';
import type { CapabilityManifest, CapabilityRegistration, CapabilitySearchOptions, CapabilitySearchResult, CapabilityPublishOptions, CapabilityPublishResult } from './types.js';
/** Configuration for the {@link CapabilityRegistry}. */
export interface CapabilityRegistryConfig {
    /** Base URL of the marketplace API. Defaults to `https://api.allternit.com/v1/marketplace`. */
    registryUrl?: string;
    /** Bearer token for authenticated operations (publish, etc.). */
    authToken?: string;
    /** Custom fetch implementation (useful for testing). */
    fetch?: typeof globalThis.fetch;
}
/**
 * Client-side registry for installing, uninstalling, searching, and publishing
 * capabilities on the Allternit marketplace.
 *
 * Extends `EventEmitter` — emits `installed` and `uninstalled` events with
 * the capability manifest, plus `<capabilityId>:<event>` events forwarded
 * from capability lifecycle contexts.
 */
export declare class CapabilityRegistry extends EventEmitter {
    private readonly installed;
    private readonly registryUrl;
    private readonly authToken?;
    private readonly fetchImpl;
    constructor(config?: CapabilityRegistryConfig);
    /**
     * Install a capability: runs lifecycle hooks and optionally registers its
     * tools with the provided {@link ToolRegistry}.
     */
    install(registration: CapabilityRegistration, toolRegistry?: ToolRegistry): Promise<void>;
    /**
     * Uninstall a capability: runs teardown lifecycle hooks and removes it
     * from the local registry.
     *
     * Note: tools registered via {@link install} are not automatically removed
     * from the {@link ToolRegistry} because it does not currently expose an
     * `unregisterTool` method. Callers that need to clean up tool registrations
     * should use `ToolRegistry.fork()` or manage tool lifecycle externally.
     */
    uninstall(capabilityId: string): Promise<void>;
    /** Return manifests for all currently installed capabilities. */
    getInstalled(): CapabilityManifest[];
    /** Check whether a capability is installed by id. */
    isInstalled(capabilityId: string): boolean;
    /**
     * Search the marketplace catalog for capabilities matching the given filters.
     */
    search(options?: CapabilitySearchOptions): Promise<CapabilitySearchResult>;
    /**
     * Publish a capability manifest to the marketplace.
     *
     * Pass `options.dryRun = true` to validate without publishing.
     * Pass `options.authToken` to override the instance-level token for this call.
     */
    publish(registration: CapabilityRegistration, options?: CapabilityPublishOptions): Promise<CapabilityPublishResult>;
    private createContext;
}
