/**
 * Agent Trust Tier System
 * 
 * Implements permission gating based on SOUL.md trust tiers:
 * - Tier 1: Autonomous actions (no permission needed)
 * - Tier 2: Notify after completion
 * - Tier 3: Ask before execution
 */

import type { AgentWorkspace } from './agent-workspace-files';

export interface TrustTierConfig {
  tier1: string[]; // Autonomous patterns
  tier2: string[]; // Notify-after patterns
  tier3: string[]; // Ask-before patterns
}

export interface PermissionRequest {
  id: string;
  action: string;
  tool: string;
  args: Record<string, unknown>;
  reason: string;
  timestamp: Date;
  resolved: boolean;
  approved?: boolean;
}

export type PermissionCallback = (request: PermissionRequest) => Promise<boolean>;

export class AgentTrustTiers {
  private config: TrustTierConfig;
  private pendingRequests = new Map<string, PermissionRequest>();
  private permissionCallback?: PermissionCallback;

  constructor(config?: TrustTierConfig) {
    this.config = config || { tier1: [], tier2: [], tier3: [] };
  }

  /**
   * Parse trust tiers from SOUL.md content
   */
  static parseFromSoulMd(content: string): TrustTierConfig {
    const config: TrustTierConfig = {
      tier1: [],
      tier2: [],
      tier3: [],
    };

    // Parse Tier sections
    const tierRegex = /##?\s*Tier\s*(\d)[\s:-]+([\s\S]+?)(?=##?\s*Tier|$)/gi;
    let match;

    while ((match = tierRegex.exec(content)) !== null) {
      const tier = parseInt(match[1], 10);
      const content = match[2];

      // Extract bullet points or list items
      const items = content
        .split(/\n/)
        .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(line => line.length > 0 && !line.startsWith('#'));

      if (tier === 1) config.tier1.push(...items);
      if (tier === 2) config.tier2.push(...items);
      if (tier === 3) config.tier3.push(...items);
    }

    // Also try to parse explicit sections
    const tier1Section = content.match(/Tier\s*1[\s\S]*?(?=Tier\s*2|$)/i);
    const tier2Section = content.match(/Tier\s*2[\s\S]*?(?=Tier\s*3|$)/i);
    const tier3Section = content.match(/Tier\s*3[\s\S]*?(?=$)/i);

    if (tier1Section && config.tier1.length === 0) {
      config.tier1 = this.extractRules(tier1Section[0]);
    }
    if (tier2Section && config.tier2.length === 0) {
      config.tier2 = this.extractRules(tier2Section[0]);
    }
    if (tier3Section && config.tier3.length === 0) {
      config.tier3 = this.extractRules(tier3Section[0]);
    }

    return config;
  }

  private static extractRules(content: string): string[] {
    return content
      .split(/\n/)
      .map(line => line.replace(/^[-*\d.)\s]+/, '').trim())
      .filter(line => 
        line.length > 0 && 
        !line.toLowerCase().includes('tier') &&
        !line.startsWith('#')
      );
  }

  /**
   * Set callback for permission requests
   */
  onPermissionRequest(callback: PermissionCallback): void {
    this.permissionCallback = callback;
  }

  /**
   * Check if an action requires permission
   */
  requiresPermission(tool: string, args: Record<string, unknown>): boolean {
    const actionString = `${tool} ${JSON.stringify(args)}`.toLowerCase();

    // Check Tier 3 patterns (always require permission)
    for (const pattern of this.config.tier3) {
      if (this.matchesPattern(actionString, pattern.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an action should notify after completion
   */
  shouldNotify(tool: string, args: Record<string, unknown>): boolean {
    const actionString = `${tool} ${JSON.stringify(args)}`.toLowerCase();

    for (const pattern of this.config.tier2) {
      if (this.matchesPattern(actionString, pattern.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if action is autonomous (Tier 1)
   */
  isAutonomous(tool: string, args: Record<string, unknown>): boolean {
    const actionString = `${tool} ${JSON.stringify(args)}`.toLowerCase();

    // Check Tier 1 patterns
    for (const pattern of this.config.tier1) {
      if (this.matchesPattern(actionString, pattern.toLowerCase())) {
        return true;
      }
    }

    // If not explicitly Tier 1, and not Tier 3, check if it's Tier 2
    if (this.shouldNotify(tool, args)) return true;

    // Default: require permission for unknown actions
    return false;
  }

  /**
   * Request permission for an action
   */
  async requestPermission(
    tool: string,
    args: Record<string, unknown>,
    reason: string
  ): Promise<boolean> {
    // If no callback set, deny by default for safety
    if (!this.permissionCallback) {
      console.warn(`[TrustTiers] No permission callback set, denying ${tool}`);
      return false;
    }

    const request: PermissionRequest = {
      id: `perm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      action: `${tool}(${JSON.stringify(args)})`,
      tool,
      args,
      reason,
      timestamp: new Date(),
      resolved: false,
    };

    this.pendingRequests.set(request.id, request);

    try {
      const approved = await this.permissionCallback(request);
      request.resolved = true;
      request.approved = approved;
      return approved;
    } catch (error) {
      console.error(`[TrustTiers] Permission request failed:`, error);
      request.resolved = true;
      request.approved = false;
      return false;
    } finally {
      // Clean up after some time
      setTimeout(() => this.pendingRequests.delete(request.id), 5 * 60 * 1000);
    }
  }

  /**
   * Execute a tool with trust tier enforcement
   */
  async executeWithPermission<T>(
    tool: string,
    args: Record<string, unknown>,
    executeFn: () => Promise<T>,
    reason?: string
  ): Promise<{ success: boolean; result?: T; error?: string; requiredPermission?: boolean }> {
    // Check if permission is required
    if (this.requiresPermission(tool, args)) {
      const approved = await this.requestPermission(
        tool,
        args,
        reason || `Execute ${tool} with args: ${JSON.stringify(args)}`
      );

      if (!approved) {
        return {
          success: false,
          error: `Permission denied for ${tool}`,
          requiredPermission: true,
        };
      }
    }

    // Execute the action
    try {
      const result = await executeFn();
      
      // Check if we should notify
      if (this.shouldNotify(tool, args)) {
        // TODO: Send notification
        console.log(`[TrustTiers] Action completed: ${tool}`);
      }

      return { success: true, result };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get pending permission requests
   */
  getPendingRequests(): PermissionRequest[] {
    return Array.from(this.pendingRequests.values()).filter(r => !r.resolved);
  }

  /**
   * Match action against pattern
   * 
   * Pattern matching rules:
   * - If pattern contains '*', it's a wildcard match
   * - If pattern is a single word, check if action contains that word
   * - Otherwise, check if action contains any keywords from the pattern
   */
  private matchesPattern(action: string, pattern: string): boolean {
    const actionLower = action.toLowerCase();
    const patternLower = pattern.toLowerCase();
    
    // Wildcard pattern
    if (patternLower.includes('*')) {
      const regex = new RegExp(
        patternLower
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.'),
        'i'
      );
      return regex.test(actionLower);
    }
    
    // Single word pattern - check if action contains it
    if (!patternLower.includes(' ')) {
      return actionLower.includes(patternLower);
    }
    
    // Multi-word pattern - extract keywords and check if any match
    // Extract key action words (verbs and nouns)
    const keywords = patternLower
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'can'].includes(word));
    
    // If any significant keyword matches, consider it a match
    return keywords.some(keyword => actionLower.includes(keyword));
  }

  /**
   * Create from workspace
   */
  static fromWorkspace(workspace: AgentWorkspace): AgentTrustTiers {
    const soulFile = workspace.files.find(f => 
      f.name.toUpperCase() === 'SOUL.MD'
    );

    if (!soulFile) {
      // Default: require permission for everything
      return new AgentTrustTiers({
        tier1: [],
        tier2: [],
        tier3: ['*'],
      });
    }

    const config = this.parseFromSoulMd(soulFile.content);
    return new AgentTrustTiers(config);
  }
}

// Export singleton for UI integration
export const trustTierManager = new AgentTrustTiers();
