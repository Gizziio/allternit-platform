import type { SiteToolDescriptor } from '@allternit/computer-use-protocol';

/**
 * Context handed to a site tool handler. Handlers drive the existing
 * browser/playwright/actions.ts primitives through the CDP binding for the
 * session's active tab. `targetId` is the active tab identity used by
 * actions.ts (it matches pages by URL).
 */
export interface SiteToolContext {
  cdpUrl: string;
  targetId: string;
  /**
   * When true, the handler must not touch the browser; it returns the plan it
   * would execute (used for smoke tests and pre-flight checks).
   */
  dryRun?: boolean;
}

export interface SiteToolResult {
  ok: boolean;
  /** True when the call was refused without attempting anything (blocked action, wrong origin). */
  refused?: boolean;
  reason?: string;
  /** Human-readable one-line summary, safe for logs and receipts. */
  summary: string;
  data?: Record<string, unknown>;
}

export interface SiteTool {
  descriptor: SiteToolDescriptor;
  /** Hostnames this tool may run against. Supports one leading wildcard label (`*.github.com`). */
  allowedDomains: string[];
  /** Golden-path action names blocked by the plugin policy profile — refused at the tool boundary. */
  blockedActions: string[];
  /**
   * Golden-path action names this tool may perform. Invocations carrying a
   * `requestedAction` argument (or tools whose action set overlaps the plugin's
   * blocked list) are refused before any browser primitive runs.
   */
  actions: string[];
  handler: (args: Record<string, unknown>, ctx: SiteToolContext) => Promise<SiteToolResult>;
}

export function refused(reason: string, extra?: Record<string, unknown>): SiteToolResult {
  return { ok: false, refused: true, reason, summary: `Refused: ${reason}`, data: extra };
}

/** Match a hostname against an allowed-domain entry, supporting one `*.` wildcard label. */
export function domainMatches(domainPattern: string, hostname: string): boolean {
  const pattern = domainPattern.toLowerCase().replace(/^\*\./, '');
  const host = hostname.toLowerCase();
  if (domainPattern.startsWith('*.')) {
    return host === pattern || host.endsWith(`.${pattern}`);
  }
  return host === pattern;
}

export function originMatches(origin: string | null | undefined, allowedDomains: string[]): boolean {
  if (!origin) return false;
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  return allowedDomains.some((domain) => domainMatches(domain, hostname));
}

export class SiteToolRegistry {
  private readonly tools = new Map<string, SiteTool>();

  register(tool: SiteTool): void {
    if (this.tools.has(tool.descriptor.name)) {
      throw new Error(`Site tool already registered: ${tool.descriptor.name}`);
    }
    const staticallyBlocked = tool.actions.filter((action) => tool.blockedActions.includes(action));
    if (staticallyBlocked.length > 0) {
      throw new Error(
        `Site tool ${tool.descriptor.name} declares actions blocked by its plugin policy: ${staticallyBlocked.join(', ')}`,
      );
    }
    this.tools.set(tool.descriptor.name, tool);
  }

  registerAll(tools: SiteTool[]): void {
    for (const tool of tools) this.register(tool);
  }

  get(name: string): SiteTool | undefined {
    return this.tools.get(name);
  }

  list(): SiteTool[] {
    return [...this.tools.values()];
  }

  descriptors(): SiteToolDescriptor[] {
    return this.list().map((tool) => tool.descriptor);
  }

  /** Tools whose allowedDomains match the given origin (e.g. `https://github.com`). */
  toolsForOrigin(origin: string | null | undefined): SiteTool[] {
    return this.list().filter((tool) => originMatches(origin, tool.allowedDomains));
  }

  /**
   * Invoke a tool by name. Blocked actions are refused here, at the tool
   * boundary — a refused call never reaches a browser primitive.
   */
  async invoke(name: string, args: Record<string, unknown>, ctx: SiteToolContext): Promise<SiteToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return refused(`Unknown site tool: ${name}`);
    }
    const requestedAction = typeof args.requestedAction === 'string' ? args.requestedAction : undefined;
    if (requestedAction && tool.blockedActions.includes(requestedAction)) {
      return refused(`Action '${requestedAction}' is blocked by the ${tool.descriptor.name} plugin policy`, { tool: name });
    }
    return tool.handler(args, ctx);
  }
}
