import { EventEmitter } from 'events';
import type { ToolRegistry } from '../tools/registry.js';
import type {
  CapabilityManifest,
  CapabilityRegistration,
  CapabilityContext,
  CapabilitySearchOptions,
  CapabilitySearchResult,
  CapabilityPublishOptions,
  CapabilityPublishResult,
} from './types.js';

/** Configuration for the {@link CapabilityRegistry}. */
export interface CapabilityRegistryConfig {
  /** Base URL of the marketplace API. Defaults to `https://api.allternit.com/v1/marketplace`. */
  registryUrl?: string;
  /** Bearer token for authenticated operations (publish, etc.). */
  authToken?: string;
  /** Custom fetch implementation (useful for testing). */
  fetch?: typeof globalThis.fetch;
}

const DEFAULT_REGISTRY_URL = 'https://api.allternit.com/v1/marketplace';

/**
 * Client-side registry for installing, uninstalling, searching, and publishing
 * capabilities on the Allternit marketplace.
 *
 * Extends `EventEmitter` — emits `installed` and `uninstalled` events with
 * the capability manifest, plus `<capabilityId>:<event>` events forwarded
 * from capability lifecycle contexts.
 */
export class CapabilityRegistry extends EventEmitter {
  private readonly installed: Map<string, CapabilityRegistration> = new Map();
  private readonly registryUrl: string;
  private readonly authToken?: string;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(config: CapabilityRegistryConfig = {}) {
    super();
    this.registryUrl = config.registryUrl ?? DEFAULT_REGISTRY_URL;
    this.authToken = config.authToken;
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  /**
   * Install a capability: runs lifecycle hooks and optionally registers its
   * tools with the provided {@link ToolRegistry}.
   */
  async install(registration: CapabilityRegistration, toolRegistry?: ToolRegistry): Promise<void> {
    const { manifest, lifecycle } = registration;
    if (this.installed.has(manifest.id)) {
      throw new Error(`Capability ${manifest.id} is already installed`);
    }
    const context = this.createContext(manifest);
    if (lifecycle.onInstall) await lifecycle.onInstall(context);
    if (lifecycle.onActivate) await lifecycle.onActivate(context);
    this.installed.set(manifest.id, registration);
    if (toolRegistry) {
      for (const tool of manifest.tools) {
        toolRegistry.registerTool(tool, { namespace: manifest.id });
      }
    }
    this.emit('installed', manifest);
  }

  /**
   * Uninstall a capability: runs teardown lifecycle hooks and removes it
   * from the local registry.
   *
   * Note: tools registered via {@link install} are not automatically removed
   * from the {@link ToolRegistry} because it does not currently expose an
   * `unregisterTool` method. Callers that need to clean up tool registrations
   * should use `ToolRegistry.fork()` or manage tool lifecycle externally.
   */
  async uninstall(capabilityId: string): Promise<void> {
    const registration = this.installed.get(capabilityId);
    if (!registration) throw new Error(`Capability ${capabilityId} is not installed`);
    const context = this.createContext(registration.manifest);
    if (registration.lifecycle.onDeactivate) await registration.lifecycle.onDeactivate(context);
    if (registration.lifecycle.onUninstall) await registration.lifecycle.onUninstall(context);
    this.installed.delete(capabilityId);
    this.emit('uninstalled', registration.manifest);
  }

  /** Return manifests for all currently installed capabilities. */
  getInstalled(): CapabilityManifest[] {
    return Array.from(this.installed.values()).map((r) => r.manifest);
  }

  /** Check whether a capability is installed by id. */
  isInstalled(capabilityId: string): boolean {
    return this.installed.has(capabilityId);
  }

  /**
   * Search the marketplace catalog for capabilities matching the given filters.
   */
  async search(options: CapabilitySearchOptions = {}): Promise<CapabilitySearchResult> {
    const params = new URLSearchParams();
    if (options.query) params.set('q', options.query);
    if (options.kind) params.set('kind', options.kind);
    if (options.tags?.length) params.set('tags', options.tags.join(','));
    if (options.pricing && options.pricing !== 'all') params.set('pricing', options.pricing);
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.limit) params.set('limit', String(options.limit));

    const response = await this.fetchImpl(`${this.registryUrl}/capabilities?${params}`);
    if (!response.ok) throw new Error(`Marketplace search failed: ${response.status}`);
    return (await response.json()) as CapabilitySearchResult;
  }

  /**
   * Publish a capability manifest to the marketplace.
   *
   * Pass `options.dryRun = true` to validate without publishing.
   * Pass `options.authToken` to override the instance-level token for this call.
   */
  async publish(registration: CapabilityRegistration, options: CapabilityPublishOptions = {}): Promise<CapabilityPublishResult> {
    const response = await this.fetchImpl(`${this.registryUrl}/capabilities/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.authToken ? { Authorization: `Bearer ${options.authToken}` } : {}),
      },
      body: JSON.stringify({
        manifest: registration.manifest,
        dryRun: options.dryRun ?? false,
      }),
    });
    if (!response.ok) throw new Error(`Publish failed: ${response.status}`);
    return (await response.json()) as CapabilityPublishResult;
  }

  private createContext(manifest: CapabilityManifest): CapabilityContext {
    return {
      capabilityId: manifest.id,
      workspacePath: process.cwd(),
      storagePath: `.allternit/capabilities/${manifest.id}`,
      config: {},
      emit: (event: string, payload: unknown) => this.emit(`${manifest.id}:${event}`, payload),
    };
  }
}
