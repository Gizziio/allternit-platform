/**
 * Policy Injection System
 * 
 * Generates deterministic policy markers and injects them into context.
 * Ensures policy compliance is auditable and verifiable.
 */

import { createHash, randomUUID } from 'crypto';
import { Policy, PolicyRule, PolicyBundle } from './types';

/**
 * Injection marker - proof that policy was applied
 */
export interface InjectionMarker {
  marker_id: string;
  marker_version: 'v1';
  created_at: string;
  policy_bundle_id: string;
  policy_bundle_hash: string;
  injected_policies: string[]; // policy_ids
  session_id: string;
  dag_id: string;
  node_id?: string;
  injection_point: 'session_start' | 'dag_load' | 'node_entry' | 'tool_invoke';
  context_hash: string; // hash of context at injection time
  signature: string;
}

/**
 * Policy injection context
 */
export interface InjectionContext {
  session_id: string;
  dag_id: string;
  node_id?: string;
  agent_id: string;
  timestamp: Date;
  original_context: Record<string, unknown>;
}

/**
 * Policy injector configuration
 */
export interface InjectorConfig {
  bundle_id: string;
  bundle_path?: string;
  auto_inject: boolean;
  injection_points: InjectionPoint[];
  marker_output_dir: string;
}

export type InjectionPoint = 
  | 'session_start'
  | 'dag_load' 
  | 'node_entry'
  | 'tool_invoke';

/**
 * Policy Injector - generates and injects policy markers
 */
export class PolicyInjector {
  private config: InjectorConfig;
  private bundle: PolicyBundle | null = null;
  private markers: InjectionMarker[] = [];

  constructor(config: InjectorConfig) {
    this.config = {
      ...config,
      marker_output_dir: config.marker_output_dir || '.allternit/markers'
    };
  }

  /**
   * Load policy bundle
   */
  async loadBundle(bundle: PolicyBundle): Promise<void> {
    // Validate bundle
    if (!bundle.bundle_id || !bundle.policies) {
      throw new Error('Invalid policy bundle: missing bundle_id or policies');
    }

    // Verify bundle hash if provided
    if (bundle.bundle_hash) {
      const computed = this.computeBundleHash(bundle);
      if (computed !== bundle.bundle_hash) {
        throw new Error(`Bundle hash mismatch: expected ${bundle.bundle_hash}, got ${computed}`);
      }
    }

    this.bundle = bundle;
  }

  /**
   * Inject policy at specified point
   */
  async inject(
    point: InjectionPoint,
    context: InjectionContext
  ): Promise<InjectionMarker> {
    if (!this.bundle) {
      throw new Error('No policy bundle loaded');
    }

    // Check if injection should happen at this point
    if (!this.config.injection_points.includes(point)) {
      throw new Error(`Injection not configured for point: ${point}`);
    }

    // Compute context hash
    const contextHash = this.computeContextHash(context);

    // Create marker
    const marker: InjectionMarker = {
      marker_id: `marker-${randomUUID()}`,
      marker_version: 'v1',
      created_at: new Date().toISOString(),
      policy_bundle_id: this.bundle.bundle_id,
      policy_bundle_hash: this.bundle.bundle_hash || this.computeBundleHash(this.bundle),
      injected_policies: this.bundle.policies.map(p => p.policy_id),
      session_id: context.session_id,
      dag_id: context.dag_id,
      node_id: context.node_id,
      injection_point: point,
      context_hash: contextHash,
      signature: '' // Will be filled
    };

    // Sign marker
    marker.signature = await this.signMarker(marker);

    // Store marker
    this.markers.push(marker);

    // Persist marker
    await this.persistMarker(marker);

    return marker;
  }

  /**
   * Inject policy into DAG execution context
   */
  async injectForDAG(
    dagId: string,
    sessionId: string,
    agentId: string
  ): Promise<InjectionMarker> {
    const context: InjectionContext = {
      session_id: sessionId,
      dag_id: dagId,
      agent_id: agentId,
      timestamp: new Date(),
      original_context: {}
    };

    return this.inject('dag_load', context);
  }

  /**
   * Inject policy for node execution
   */
  async injectForNode(
    dagId: string,
    nodeId: string,
    sessionId: string,
    agentId: string
  ): Promise<InjectionMarker> {
    const context: InjectionContext = {
      session_id: sessionId,
      dag_id: dagId,
      node_id: nodeId,
      agent_id: agentId,
      timestamp: new Date(),
      original_context: {}
    };

    return this.inject('node_entry', context);
  }

  /**
   * Inject policy for tool invocation
   */
  async injectForTool(
    dagId: string,
    nodeId: string,
    toolName: string,
    sessionId: string,
    agentId: string,
    toolInputs: Record<string, unknown>
  ): Promise<InjectionMarker> {
    const context: InjectionContext = {
      session_id: sessionId,
      dag_id: dagId,
      node_id: nodeId,
      agent_id: agentId,
      timestamp: new Date(),
      original_context: { tool_name: toolName, tool_inputs: toolInputs }
    };

    return this.inject('tool_invoke', context);
  }

  /**
   * Verify marker integrity
   */
  async verifyMarker(marker: InjectionMarker): Promise<boolean> {
    try {
      // Verify signature
      const signature = marker.signature;
      const markerCopy = { ...marker, signature: '' };
      const expectedSignature = await this.signMarker(markerCopy);
      
      if (signature !== expectedSignature) {
        return false;
      }

      // Verify bundle hash if bundle is loaded
      if (this.bundle && marker.policy_bundle_hash !== this.bundle.bundle_hash) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all markers for a session
   */
  getMarkersForSession(sessionId: string): InjectionMarker[] {
    return this.markers.filter(m => m.session_id === sessionId);
  }

  /**
   * Get markers for a DAG
   */
  getMarkersForDAG(dagId: string): InjectionMarker[] {
    return this.markers.filter(m => m.dag_id === dagId);
  }

  /**
   * Compute hash of policy bundle
   */
  private computeBundleHash(bundle: PolicyBundle): string {
    const canonical = JSON.stringify({
      bundle_id: bundle.bundle_id,
      version: bundle.version,
      policies: bundle.policies.map(p => ({
        policy_id: p.policy_id,
        rules: p.rules.map(r => ({
          rule_id: r.rule_id,
          effect: r.effect,
          condition_hash: createHash('sha256').update(
            JSON.stringify(r.condition)
          ).digest('hex')
        }))
      }))
    });
    
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Compute hash of injection context
   */
  private computeContextHash(context: InjectionContext): string {
    const canonical = JSON.stringify({
      session_id: context.session_id,
      dag_id: context.dag_id,
      node_id: context.node_id,
      agent_id: context.agent_id,
      timestamp: context.timestamp.toISOString()
    });
    
    return createHash('sha256').update(canonical).digest('hex');
  }

  /**
   * Sign marker (simplified - would use actual crypto in production)
   */
  private async signMarker(marker: InjectionMarker): Promise<string> {
    const data = JSON.stringify({
      marker_id: marker.marker_id,
      policy_bundle_id: marker.policy_bundle_id,
      context_hash: marker.context_hash,
      injection_point: marker.injection_point
    });
    
    // In production, this would use Ed25519 or similar
    // For now, we use a simple HMAC-like approach
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * Persist marker to disk
   */
  private async persistMarker(marker: InjectionMarker): Promise<void> {
    // In production, this would write to the marker output directory
    // For now, we just keep in memory
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const outputPath = path.join(
      this.config.marker_output_dir,
      marker.injection_point,
      `${marker.marker_id}.json`
    );

    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(marker, null, 2));
    } catch (err) {
      console.warn(`Failed to persist marker: ${err}`);
    }
  }
}

/**
 * Create injection marker from bundle and context
 */
export function createInjectionMarker(
  bundle: PolicyBundle,
  context: InjectionContext,
  point: InjectionPoint
): Omit<InjectionMarker, 'signature'> {
  const contextHash = createHash('sha256')
    .update(JSON.stringify({
      session_id: context.session_id,
      dag_id: context.dag_id,
      node_id: context.node_id,
      agent_id: context.agent_id
    }))
    .digest('hex');

  return {
    marker_id: `marker-${randomUUID()}`,
    marker_version: 'v1',
    created_at: new Date().toISOString(),
    policy_bundle_id: bundle.bundle_id,
    policy_bundle_hash: bundle.bundle_hash || '',
    injected_policies: bundle.policies.map(p => p.policy_id),
    session_id: context.session_id,
    dag_id: context.dag_id,
    node_id: context.node_id,
    injection_point: point,
    context_hash: contextHash
  };
}

/**
 * Validate that context contains required policy markers
 */
export function validatePolicyMarkers(
  context: Record<string, unknown>,
  requiredPoints: InjectionPoint[]
): { valid: boolean; missing: InjectionPoint[] } {
  const markers = (context._policy_markers as InjectionMarker[]) || [];
  const foundPoints = new Set(markers.map(m => m.injection_point));
  
  const missing = requiredPoints.filter(p => !foundPoints.has(p));
  
  return {
    valid: missing.length === 0,
    missing
  };
}
