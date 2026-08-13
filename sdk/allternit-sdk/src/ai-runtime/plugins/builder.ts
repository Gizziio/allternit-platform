import type { ToolDefinition } from '../tools/types.js';
import type {
  CapabilityManifest,
  CapabilityKind,
  CapabilityPricing,
  CapabilityPermission,
  CapabilityLifecycle,
  CapabilityRegistration,
  CapabilityContext,
} from './types.js';

/**
 * Fluent builder for constructing a {@link CapabilityRegistration}.
 *
 * @example
 * ```ts
 * const cap = new CapabilityBuilder()
 *   .id('my-plugin')
 *   .name('my-plugin')
 *   .version('1.0.0')
 *   .kind('plugin')
 *   .description('Does something useful')
 *   .free()
 *   .build();
 * ```
 */
export class CapabilityBuilder {
  private _manifest: Partial<CapabilityManifest> = { tools: [], permissions: [], dependencies: [], tags: [] };
  private _lifecycle: CapabilityLifecycle = {};

  /** Set the unique identifier for this capability. */
  id(id: string): this { this._manifest.id = id; return this; }

  /** Set the package name (typically matches the npm package name). */
  name(name: string): this { this._manifest.name = name; return this; }

  /** Set a human-readable display name. */
  displayName(displayName: string): this { this._manifest.displayName = displayName; return this; }

  /** Set a short description shown in the marketplace. */
  description(description: string): this { this._manifest.description = description; return this; }

  /** Set the semver version string. */
  version(version: string): this { this._manifest.version = version; return this; }

  /** Set the capability kind (skill, command, tool, mcp, webhook, connector, plugin). */
  kind(kind: CapabilityKind): this { this._manifest.kind = kind; return this; }

  /** Set the author metadata. */
  author(name: string, opts?: { email?: string; url?: string }): this {
    this._manifest.author = { name, ...opts };
    return this;
  }

  /** Mark the capability as free. */
  free(): this { this._manifest.pricing = { type: 'free' }; return this; }

  /** Set a one-time paid price in cents. */
  paid(amountCents: number, currency = 'USD'): this {
    this._manifest.pricing = { type: 'paid', amountCents, currency };
    return this;
  }

  /** Set a recurring subscription price. */
  subscription(amountCents: number, interval: 'month' | 'year', currency = 'USD'): this {
    this._manifest.pricing = { type: 'subscription', amountCents, currency, interval };
    return this;
  }

  /** Mark the capability as enterprise-only (custom pricing). */
  enterprise(): this { this._manifest.pricing = { type: 'enterprise' }; return this; }

  /** Add a tool definition provided by this capability. */
  addTool(tool: ToolDefinition): this {
    this._manifest.tools = [...(this._manifest.tools || []), tool];
    return this;
  }

  /** Declare a runtime permission this capability requires. */
  addPermission(permission: CapabilityPermission): this {
    this._manifest.permissions = [...(this._manifest.permissions || []), permission];
    return this;
  }

  /** Declare a dependency on another capability by id. */
  addDependency(id: string): this {
    this._manifest.dependencies = [...(this._manifest.dependencies || []), id];
    return this;
  }

  /** Add a tag for marketplace discovery. */
  addTag(tag: string): this {
    this._manifest.tags = [...(this._manifest.tags || []), tag];
    return this;
  }

  /** Set the icon URL or emoji. */
  icon(icon: string): this { this._manifest.icon = icon; return this; }

  /** Set the source repository URL. */
  repository(url: string): this { this._manifest.repository = url; return this; }

  /** Set the homepage URL. */
  homepage(url: string): this { this._manifest.homepage = url; return this; }

  /** Set the SPDX license identifier. */
  license(spdx: string): this { this._manifest.license = spdx; return this; }

  /** Set the minimum Allternit runtime version required. */
  minRuntimeVersion(version: string): this { this._manifest.minRuntimeVersion = version; return this; }

  /** Register a handler invoked when the capability is first installed. */
  onInstall(handler: (ctx: CapabilityContext) => Promise<void>): this {
    this._lifecycle.onInstall = handler;
    return this;
  }

  /** Register a handler invoked when the capability is uninstalled. */
  onUninstall(handler: (ctx: CapabilityContext) => Promise<void>): this {
    this._lifecycle.onUninstall = handler;
    return this;
  }

  /** Register a handler invoked when the capability is activated. */
  onActivate(handler: (ctx: CapabilityContext) => Promise<void>): this {
    this._lifecycle.onActivate = handler;
    return this;
  }

  /** Register a handler invoked when the capability is deactivated. */
  onDeactivate(handler: (ctx: CapabilityContext) => Promise<void>): this {
    this._lifecycle.onDeactivate = handler;
    return this;
  }

  /** Register a handler invoked when the capability is updated from a previous version. */
  onUpdate(handler: (ctx: CapabilityContext, prev: string) => Promise<void>): this {
    this._lifecycle.onUpdate = handler;
    return this;
  }

  /**
   * Validate and produce the final {@link CapabilityRegistration}.
   *
   * @throws If required fields (id, name, version, kind, description) are missing.
   */
  build(): CapabilityRegistration {
    const manifest = this._manifest as CapabilityManifest;
    if (!manifest.id) throw new Error('Capability id is required');
    if (!manifest.name) throw new Error('Capability name is required');
    if (!manifest.version) throw new Error('Capability version is required');
    if (!manifest.kind) throw new Error('Capability kind is required');
    if (!manifest.description) throw new Error('Capability description is required');
    if (!manifest.pricing) manifest.pricing = { type: 'free' };
    if (!manifest.author) manifest.author = { name: 'Unknown' };
    return { manifest, lifecycle: this._lifecycle };
  }
}

/**
 * Concise helper that creates a {@link CapabilityBuilder}, passes it to `fn`,
 * and returns the built registration.
 *
 * @example
 * ```ts
 * const reg = defineCapability((b) =>
 *   b.id('my-plugin').name('my-plugin').version('1.0.0').kind('plugin').description('…').free()
 * );
 * ```
 */
export function defineCapability(fn: (builder: CapabilityBuilder) => CapabilityBuilder): CapabilityRegistration {
  return fn(new CapabilityBuilder()).build();
}
