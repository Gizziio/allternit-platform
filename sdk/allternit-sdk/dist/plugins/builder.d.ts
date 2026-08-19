import type { ToolDefinition } from '../tools/types.js';
import type { CapabilityKind, CapabilityPermission, CapabilityRegistration, CapabilityContext } from './types.js';
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
export declare class CapabilityBuilder {
    private _manifest;
    private _lifecycle;
    /** Set the unique identifier for this capability. */
    id(id: string): this;
    /** Set the package name (typically matches the npm package name). */
    name(name: string): this;
    /** Set a human-readable display name. */
    displayName(displayName: string): this;
    /** Set a short description shown in the marketplace. */
    description(description: string): this;
    /** Set the semver version string. */
    version(version: string): this;
    /** Set the capability kind (skill, command, tool, mcp, webhook, connector, plugin). */
    kind(kind: CapabilityKind): this;
    /** Set the author metadata. */
    author(name: string, opts?: {
        email?: string;
        url?: string;
    }): this;
    /** Mark the capability as free. */
    free(): this;
    /** Set a one-time paid price in cents. */
    paid(amountCents: number, currency?: string): this;
    /** Set a recurring subscription price. */
    subscription(amountCents: number, interval: 'month' | 'year', currency?: string): this;
    /** Mark the capability as enterprise-only (custom pricing). */
    enterprise(): this;
    /** Add a tool definition provided by this capability. */
    addTool(tool: ToolDefinition): this;
    /** Declare a runtime permission this capability requires. */
    addPermission(permission: CapabilityPermission): this;
    /** Declare a dependency on another capability by id. */
    addDependency(id: string): this;
    /** Add a tag for marketplace discovery. */
    addTag(tag: string): this;
    /** Set the icon URL or emoji. */
    icon(icon: string): this;
    /** Set the source repository URL. */
    repository(url: string): this;
    /** Set the homepage URL. */
    homepage(url: string): this;
    /** Set the SPDX license identifier. */
    license(spdx: string): this;
    /** Set the minimum Allternit runtime version required. */
    minRuntimeVersion(version: string): this;
    /** Register a handler invoked when the capability is first installed. */
    onInstall(handler: (ctx: CapabilityContext) => Promise<void>): this;
    /** Register a handler invoked when the capability is uninstalled. */
    onUninstall(handler: (ctx: CapabilityContext) => Promise<void>): this;
    /** Register a handler invoked when the capability is activated. */
    onActivate(handler: (ctx: CapabilityContext) => Promise<void>): this;
    /** Register a handler invoked when the capability is deactivated. */
    onDeactivate(handler: (ctx: CapabilityContext) => Promise<void>): this;
    /** Register a handler invoked when the capability is updated from a previous version. */
    onUpdate(handler: (ctx: CapabilityContext, prev: string) => Promise<void>): this;
    /**
     * Validate and produce the final {@link CapabilityRegistration}.
     *
     * @throws If required fields (id, name, version, kind, description) are missing.
     */
    build(): CapabilityRegistration;
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
export declare function defineCapability(fn: (builder: CapabilityBuilder) => CapabilityBuilder): CapabilityRegistration;
