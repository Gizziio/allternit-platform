/**
 * Policy Bundle Builder
 * 
 * Creates deterministic policy bundles from AGENTS.md, role definitions,
 * and agent profiles. Emits injection markers for context boundaries.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface PolicyBundle {
  bundle_id: string;
  version: string;
  created_at: string;
  agents_md_hash: string;
  role: string;
  execution_mode: ExecutionMode;
  constraints: PolicyConstraints;
  injection_marker: InjectionMarker;
}

export interface PolicyConstraints {
  allowed_tools: string[];
  forbidden_tools: string[];
  write_scope: {
    mode: 'run_scoped' | 'lease_scoped';
    allowed_globs: string[];
    forbidden_globs: string[];
  };
  network_policy: 'none' | 'restricted' | 'full';
  receipts_required: boolean;
  max_fix_cycles: number;
  require_validator: boolean;
}

export interface InjectionMarker {
  marker_id: string;
  agents_md_hash: string;
  bundle_hash: string;
  role: string;
  timestamp: string;
}

export type ExecutionMode = 
  | 'PLAN_ONLY' 
  | 'REQUIRE_APPROVAL' 
  | 'ACCEPT_EDITS' 
  | 'BYPASS_PERMISSIONS';

export interface AgentProfile {
  id: string;
  description: string;
  worker_allowlist: string[];
  tool_allowlist: string[];
  write_scope_policy: {
    mode: 'run_scoped' | 'lease_scoped';
    allowed_globs: string[];
  };
  network_policy: 'none' | 'restricted' | 'full';
  receipts_required: boolean;
}

export class PolicyBundleBuilder {
  private agentsMdPath: string;
  private profilesPath: string;
  private agentsMdContent: string | null = null;
  private profiles: Map<string, AgentProfile> = new Map();

  constructor(
    agentsMdPath: string = 'agents/AGENTS.md',
    profilesPath: string = 'agent/agent_profiles.json'
  ) {
    this.agentsMdPath = agentsMdPath;
    this.profilesPath = profilesPath;
  }

  /**
   * Initialize by loading AGENTS.md and profiles
   */
  async initialize(): Promise<void> {
    await this.loadAgentsMd();
    await this.loadProfiles();
  }

  /**
   * Load and hash AGENTS.md
   */
  private async loadAgentsMd(): Promise<void> {
    if (!fs.existsSync(this.agentsMdPath)) {
      throw new Error(`AGENTS.md not found at ${this.agentsMdPath}`);
    }
    this.agentsMdContent = fs.readFileSync(this.agentsMdPath, 'utf-8');
  }

  /**
   * Load agent profiles from JSON
   */
  private async loadProfiles(): Promise<void> {
    if (!fs.existsSync(this.profilesPath)) {
      throw new Error(`Profiles not found at ${this.profilesPath}`);
    }
    
    const content = fs.readFileSync(this.profilesPath, 'utf-8');
    const data = JSON.parse(content);
    
    for (const profile of data.profiles) {
      this.profiles.set(profile.id, profile);
    }
  }

  /**
   * Get hash of AGENTS.md content
   */
  getAgentsMdHash(): string {
    if (!this.agentsMdContent) {
      throw new Error('Not initialized. Call initialize() first.');
    }
    return crypto
      .createHash('sha256')
      .update(this.agentsMdContent)
      .digest('hex');
  }

  /**
   * Build a policy bundle for a specific role and execution mode
   */
  buildBundle(
    role: string,
    executionMode: ExecutionMode,
    runId: string,
    overrides?: Partial<PolicyConstraints>
  ): PolicyBundle {
    if (!this.agentsMdContent) {
      throw new Error('Not initialized. Call initialize() first.');
    }

    const profile = this.profiles.get(role);
    if (!profile) {
      throw new Error(`Unknown role: ${role}. Available: ${Array.from(this.profiles.keys()).join(', ')}`);
    }

    const agentsMdHash = this.getAgentsMdHash();
    
    // Build constraints from profile + role defaults
    const constraints: PolicyConstraints = {
      allowed_tools: profile.tool_allowlist,
      forbidden_tools: this.getForbiddenToolsForRole(role),
      write_scope: {
        mode: profile.write_scope_policy.mode,
        allowed_globs: this.expandGlobs(profile.write_scope_policy.allowed_globs, runId),
        forbidden_globs: [
          '.a2r/ledger/**',
          '.a2r/leases/**',
          '.a2r/wih/**',
          '.a2r/graphs/**',
          '.a2r/spec/**',
        ],
      },
      network_policy: profile.network_policy,
      receipts_required: profile.receipts_required,
      max_fix_cycles: role === 'builder' ? 3 : 0,
      require_validator: role === 'builder',
      ...overrides,
    };

    // Create bundle
    const bundle: Omit<PolicyBundle, 'bundle_id' | 'injection_marker'> = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      agents_md_hash: agentsMdHash,
      role,
      execution_mode: executionMode,
      constraints,
    };

    // Generate bundle hash
    const bundleHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(bundle))
      .digest('hex');

    const bundleId = `pb_${bundleHash.slice(0, 16)}`;

    // Create injection marker
    const injectionMarker: InjectionMarker = {
      marker_id: `im_${crypto.randomUUID()}`,
      agents_md_hash: agentsMdHash,
      bundle_hash: bundleHash,
      role,
      timestamp: bundle.created_at,
    };

    return {
      ...bundle,
      bundle_id: bundleId,
      injection_marker: injectionMarker,
    };
  }

  /**
   * Get forbidden tools based on role
   */
  private getForbiddenToolsForRole(role: string): string[] {
    const commonForbidden = ['BypassPermissions'];
    
    switch (role) {
      case 'validator':
        return [...commonForbidden, 'Write', 'Edit', 'Bash'];
      case 'reviewer':
        return [...commonForbidden, 'Write', 'Edit', 'Bash'];
      case 'security':
        return [...commonForbidden, 'Write', 'Edit'];
      case 'planner':
        return [...commonForbidden, 'Write', 'Edit', 'Bash'];
      case 'builder':
        return commonForbidden;
      case 'orchestrator':
        return ['Write', 'Edit', 'Bash']; // Orchestrator is read-only
      default:
        return commonForbidden;
    }
  }

  /**
   * Expand glob patterns with run_id substitution
   */
  private expandGlobs(globs: string[], runId: string): string[] {
    return globs.map(glob => 
      glob.replace(/\{\{run_id\}\}/g, runId)
    );
  }

  /**
   * Serialize bundle to JSON (deterministic)
   */
  serializeBundle(bundle: PolicyBundle): string {
    // Sort keys for deterministic output
    return JSON.stringify(bundle, Object.keys(bundle).sort(), 2);
  }

  /**
   * Write bundle to disk
   */
  async writeBundle(
    bundle: PolicyBundle, 
    outputDir: string = '.a2r/runner/policy_bundles'
  ): Promise<string> {
    const outputPath = path.join(outputDir, `${bundle.bundle_id}.json`);
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    
    // Write bundle
    fs.writeFileSync(outputPath, this.serializeBundle(bundle), 'utf-8');
    
    return outputPath;
  }
}

// Export factory function
export async function createPolicyBundle(
  role: string,
  executionMode: ExecutionMode,
  runId: string
): Promise<PolicyBundle> {
  const builder = new PolicyBundleBuilder();
  await builder.initialize();
  return builder.buildBundle(role, executionMode, runId);
}
