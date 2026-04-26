/**
 * ContextPack Builder
 * 
 * Compiles deterministic context bundles from Rails truth:
 * - WIH content + referenced contracts/specs
 * - DAG slice (node + hard deps + ancestors)
 * - Receipts/evidence from dependencies
 * - Policy bundle (AGENTS.md + role + packs)
 * - Plan artifacts (plan.md, todo.md, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ContextPack,
  WihId,
  DagId,
  NodeId,
  ReceiptId,
  ContextPackId,
  CorrelationId,
  PolicyBundleId,
} from '../types';

export interface ContextPackInputs {
  wihId: WihId;
  dagId: DagId;
  nodeId: NodeId;
  wihContent: string;
  dagSlice: DagSlice;
  receiptRefs: ReceiptId[];
  policyBundleId: string;
  planArtifacts: PlanArtifacts;
  toolRegistryVersion: string;
  leaseInfo?: LeaseInfo;
}

export interface DagSlice {
  node: DagNode;
  hardDeps: DagNode[];
  ancestors: DagNode[];
  edges: DagEdge[];
}

export interface DagNode {
  id: NodeId;
  type: string;
  title: string;
  description?: string;
  status: string;
  requiredEvidence?: string[];
}

export interface DagEdge {
  from: NodeId;
  to: NodeId;
  type: 'blocked_by' | 'related_to';
}

export interface PlanArtifacts {
  planPath?: string;
  todoPath?: string;
  progressPath?: string;
  findingsPath?: string;
}

export interface LeaseInfo {
  leaseId: string;
  keys: string[];
  expiresAt: string;
}

export interface ArtifactHashes {
  plan?: string;
  todo?: string;
  progress?: string;
  findings?: string;
}

export interface ContextPackBuilderConfig {
  basePath?: string;
  railsAdapter?: {
    sealContextPack: (pack: ContextPack) => Promise<void>;
    queryReceipts?: (query: {
      wihId?: string;
      dagId?: string;
      nodeId?: string;
      kinds?: string[];
    }) => Promise<Array<{ receiptId: string; kind: string; payload: unknown }>>;
  };
}

export class ContextPackBuilder {
  private basePath: string;
  private railsAdapter?: ContextPackBuilderConfig['railsAdapter'];

  constructor(config?: ContextPackBuilderConfig) {
    this.basePath = config?.basePath || '.';
    this.railsAdapter = config?.railsAdapter;
  }

  /**
   * Build a context pack from inputs
   */
  async build(inputs: ContextPackInputs): Promise<ContextPack> {
    // Hash all inputs for deterministic pack ID
    const planHashes = await this.hashPlanArtifacts(inputs.planArtifacts);
    
    const packData = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      inputs: {
        wih_id: inputs.wihId,
        dag_id: inputs.dagId,
        node_id: inputs.nodeId,
        wih_content_hash: this.hashContent(inputs.wihContent),
        dag_slice_hash: this.hashDagSlice(inputs.dagSlice),
        receipt_refs: inputs.receiptRefs,
        policy_bundle_id: inputs.policyBundleId,
        plan_hashes: planHashes,
        tool_registry_version: inputs.toolRegistryVersion,
        lease_info: inputs.leaseInfo,
      },
    };

    // Generate deterministic pack ID
    const packHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(packData.inputs))
      .digest('hex');

    const contextPackId: ContextPackId = `cp_${packHash.slice(0, 24)}`;
    const correlationId: CorrelationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const contextPack: ContextPack = {
      contextPackId,
      version: packData.version,
      createdAt: packData.created_at,
      inputs: {
        wihId: inputs.wihId,
        dagId: inputs.dagId,
        nodeId: inputs.nodeId,
        receiptRefs: inputs.receiptRefs,
        policyBundleId: inputs.policyBundleId as PolicyBundleId,
        planHashes: {
          plan: planHashes.plan || '',
          todo: planHashes.todo || '',
          progress: planHashes.progress || '',
          findings: planHashes.findings || '',
        },
      },
      correlationId,
    };

    return contextPack;
  }

  /**
   * Serialize context pack to JSON (deterministic)
   */
  serialize(pack: ContextPack): string {
    return JSON.stringify(pack, this.sortKeysReplacer, 2);
  }

  /**
   * Write context pack to disk
   */
  async writePack(
    pack: ContextPack,
    outputDir: string = '.allternit/runner/context_packs'
  ): Promise<string> {
    const outputPath = path.join(outputDir, `${pack.contextPackId}.json`);
    
    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    
    // Write pack
    fs.writeFileSync(outputPath, this.serialize(pack), 'utf-8');
    
    return outputPath;
  }

  /**
   * Read a context pack from disk
   */
  async readPack(packId: ContextPackId, inputDir: string = '.allternit/runner/context_packs'): Promise<ContextPack | null> {
    const inputPath = path.join(inputDir, `${packId}.json`);
    
    if (!fs.existsSync(inputPath)) {
      return null;
    }
    
    const content = fs.readFileSync(inputPath, 'utf-8');
    return JSON.parse(content) as ContextPack;
  }

  /**
   * Seal context pack to Rails (production persistence)
   */
  async sealToRails(pack: ContextPack): Promise<void> {
    if (!this.railsAdapter) {
      throw new Error('Rails adapter not configured - cannot seal context pack');
    }

    await this.railsAdapter.sealContextPack(pack);
  }

  /**
   * Build and seal context pack in one operation
   */
  async buildAndSeal(inputs: ContextPackInputs): Promise<ContextPack> {
    const pack = await this.build(inputs);
    
    // Write locally first
    await this.writePack(pack);
    
    // Seal to Rails if adapter available
    if (this.railsAdapter) {
      await this.sealToRails(pack);
    }
    
    return pack;
  }

  /**
   * Collect receipts from dependency nodes
   */
  async collectDependencyReceipts(
    dagId: string,
    nodeIds: string[],
    kinds: string[] = ['tool_call_post', 'validator_report', 'build_report']
  ): Promise<Array<{ receiptId: string; kind: string; nodeId: string; payload: unknown }>> {
    if (!this.railsAdapter?.queryReceipts) {
      throw new Error('Rails adapter with queryReceipts not configured');
    }

    const allReceipts: Array<{ receiptId: string; kind: string; nodeId: string; payload: unknown }> = [];

    for (const nodeId of nodeIds) {
      const receipts = await this.railsAdapter.queryReceipts({
        dagId,
        nodeId,
        kinds,
      });

      for (const receipt of receipts) {
        allReceipts.push({
          receiptId: receipt.receiptId,
          kind: receipt.kind,
          nodeId,
          payload: receipt.payload,
        });
      }
    }

    return allReceipts;
  }

  /**
   * Build a minimal context pack (for quick operations)
   */
  async buildMinimal(
    wihId: WihId,
    dagId: DagId,
    nodeId: NodeId,
    policyBundleId: string
  ): Promise<ContextPack> {
    const packData = {
      version: '1.0.0',
      created_at: new Date().toISOString(),
      inputs: {
        wih_id: wihId,
        dag_id: dagId,
        node_id: nodeId,
        policy_bundle_id: policyBundleId,
      },
    };

    const packHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(packData.inputs))
      .digest('hex');

    const contextPackId: ContextPackId = `cp_${packHash.slice(0, 24)}`;
    const correlationId: CorrelationId = `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      contextPackId,
      version: packData.version,
      createdAt: packData.created_at,
      inputs: {
        wihId,
        dagId,
        nodeId,
        receiptRefs: [],
        policyBundleId: policyBundleId as PolicyBundleId,
        planHashes: {},
      },
      correlationId,
    };
  }

  // Private helpers

  private async hashPlanArtifacts(artifacts: PlanArtifacts): Promise<ArtifactHashes> {
    const hashes: ArtifactHashes = {};

    if (artifacts.planPath && fs.existsSync(artifacts.planPath)) {
      hashes.plan = await this.hashFile(artifacts.planPath);
    }
    if (artifacts.todoPath && fs.existsSync(artifacts.todoPath)) {
      hashes.todo = await this.hashFile(artifacts.todoPath);
    }
    if (artifacts.progressPath && fs.existsSync(artifacts.progressPath)) {
      hashes.progress = await this.hashFile(artifacts.progressPath);
    }
    if (artifacts.findingsPath && fs.existsSync(artifacts.findingsPath)) {
      hashes.findings = await this.hashFile(artifacts.findingsPath);
    }

    return hashes;
  }

  private async hashFile(filePath: string): Promise<string> {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  private hashDagSlice(slice: DagSlice): string {
    const data = {
      node: slice.node.id,
      deps: slice.hardDeps.map(d => d.id).sort(),
      ancestors: slice.ancestors.map(a => a.id).sort(),
    };
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
  }

  private sortKeysReplacer(key: string, value: unknown): unknown {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted, k) => {
        sorted[k] = (value as Record<string, unknown>)[k];
        return sorted;
      }, {} as Record<string, unknown>);
    }
    return value;
  }
}

// Factory function
export function createContextPackBuilder(config?: ContextPackBuilderConfig): ContextPackBuilder {
  return new ContextPackBuilder(config);
}
