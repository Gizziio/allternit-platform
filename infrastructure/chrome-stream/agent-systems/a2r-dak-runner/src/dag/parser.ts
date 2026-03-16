/**
 * DAG Parser
 * 
 * Parses DAG YAML files into DagDefinition objects.
 * Based on agent/Agentic Prompts/formats/dag-schema.md
 */

import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { DagDefinition, DagNode, DagDefaults, GateName } from './types';

export interface ParseOptions {
  validate?: boolean;
  basePath?: string;
}

export class DagParser {
  /**
   * Parse a DAG from YAML string
   */
  parse(yamlContent: string, options: ParseOptions = {}): DagDefinition {
    const parsed = yaml.load(yamlContent) as any;
    
    if (options.validate !== false) {
      this.validate(parsed);
    }

    return this.transform(parsed);
  }

  /**
   * Parse a DAG from file
   */
  parseFile(filePath: string, options: ParseOptions = {}): DagDefinition {
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.parse(content, { ...options, basePath: filePath });
  }

  /**
   * Validate raw parsed YAML
   */
  private validate(parsed: any): void {
    if (!parsed) {
      throw new Error('Empty DAG content');
    }

    // Required fields
    if (!parsed.dag_version) {
      throw new Error('Missing required field: dag_version');
    }
    
    if (!parsed.dag_id) {
      throw new Error('Missing required field: dag_id');
    }

    if (!parsed.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      throw new Error('Missing or empty nodes array');
    }

    // Validate nodes
    const nodeIds = new Set<string>();
    for (const node of parsed.nodes) {
      if (!node.id) {
        throw new Error('Node missing required field: id');
      }
      
      if (nodeIds.has(node.id)) {
        throw new Error(`Duplicate node id: ${node.id}`);
      }
      nodeIds.add(node.id);

      if (!node.wih) {
        throw new Error(`Node ${node.id} missing required field: wih`);
      }

      // Validate dependencies exist
      if (node.depends_on) {
        for (const dep of node.depends_on) {
          // Dependencies can be forward references, so we validate during execution
        }
      }

      // Validate gates
      if (node.gates) {
        for (const gate of node.gates) {
          this.validateGate(gate);
        }
      }
    }

    // Validate no circular dependencies
    this.checkCircularDependencies(parsed.nodes);
  }

  /**
   * Validate gate name
   */
  private validateGate(gate: string): void {
    const validGates: GateName[] = [
      'validator_pass',
      'tests_green',
      'lint_green',
      'policy_pass',
      'security_pass',
      'evidence_attached',
      'plan_synced'
    ];

    if (!validGates.includes(gate as GateName)) {
      throw new Error(`Invalid gate name: ${gate}. Valid gates: ${validGates.join(', ')}`);
    }
  }

  /**
   * Check for circular dependencies using DFS
   */
  private checkCircularDependencies(nodes: any[]): void {
    const adjacency = new Map<string, string[]>();
    
    for (const node of nodes) {
      adjacency.set(node.id, node.depends_on || []);
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recStack.add(nodeId);

      const deps = adjacency.get(nodeId) || [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          dfs(dep, [...path, nodeId]);
        } else if (recStack.has(dep)) {
          const cycle = [...path, nodeId, dep].join(' -> ');
          throw new Error(`Circular dependency detected: ${cycle}`);
        }
      }

      recStack.delete(nodeId);
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }
  }

  /**
   * Transform raw YAML to typed DagDefinition
   */
  private transform(parsed: any): DagDefinition {
    return {
      dag_version: parsed.dag_version,
      dag_id: parsed.dag_id,
      title: parsed.title || parsed.dag_id,
      sot: parsed.sot,
      defaults: this.transformDefaults(parsed.defaults),
      nodes: parsed.nodes.map((n: any) => this.transformNode(n)),
      hooks: parsed.hooks,
      concurrency: parsed.concurrency,
    };
  }

  private transformDefaults(defaults: any): DagDefaults {
    if (!defaults) {
      return {
        gates: ['validator_pass'],
        max_iterations: 3,
      };
    }

    return {
      gates: defaults.gates || ['validator_pass'],
      max_iterations: defaults.max_iterations || 3,
      execution_permission: defaults.execution_permission,
    };
  }

  private transformNode(node: any): DagNode {
    return {
      id: node.id,
      wih: node.wih,
      depends_on: node.depends_on || [],
      gates: node.gates,
      roles: node.roles,
      loop: node.loop,
      stop_conditions: node.stop_conditions,
      output: node.output,
      execution_permission: node.execution_permission,
      status: 'pending',
      iteration_count: 0,
    };
  }

  /**
   * Serialize DAG to YAML
   */
  serialize(dag: DagDefinition): string {
    const obj = {
      dag_version: dag.dag_version,
      dag_id: dag.dag_id,
      title: dag.title,
      ...(dag.sot && { sot: dag.sot }),
      defaults: dag.defaults,
      nodes: dag.nodes.map(n => ({
        id: n.id,
        wih: n.wih,
        depends_on: n.depends_on,
        ...(n.gates && { gates: n.gates }),
        ...(n.roles && { roles: n.roles }),
        ...(n.loop && { loop: n.loop }),
        ...(n.stop_conditions && { stop_conditions: n.stop_conditions }),
        ...(n.output && { output: n.output }),
        ...(n.execution_permission && { execution_permission: n.execution_permission }),
      })),
      ...(dag.hooks && { hooks: dag.hooks }),
      ...(dag.concurrency && { concurrency: dag.concurrency }),
    };

    return yaml.dump(obj, { 
      indent: 2,
      lineWidth: -1,
      noRefs: true,
    });
  }

  /**
   * Get topological sort of nodes
   */
  topologicalSort(dag: DagDefinition): DagNode[] {
    const visited = new Set<string>();
    const result: DagNode[] = [];
    const tempMark = new Set<string>();

    const visit = (nodeId: string, path: string[]): void => {
      if (tempMark.has(nodeId)) {
        const cycle = [...path, nodeId].join(' -> ');
        throw new Error(`Circular dependency: ${cycle}`);
      }

      if (visited.has(nodeId)) {
        return;
      }

      const node = dag.nodes.find(n => n.id === nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }

      tempMark.add(nodeId);

      for (const depId of node.depends_on) {
        visit(depId, [...path, nodeId]);
      }

      tempMark.delete(nodeId);
      visited.add(nodeId);
      result.push(node);
    };

    for (const node of dag.nodes) {
      if (!visited.has(node.id)) {
        visit(node.id, []);
      }
    }

    return result;
  }

  /**
   * Get nodes ready to execute (dependencies done)
   */
  getReadyNodes(dag: DagDefinition, completedNodeIds: string[]): DagNode[] {
    const completed = new Set(completedNodeIds);
    
    return dag.nodes.filter(node => {
      // Already done or running
      if (completed.has(node.id) || node.status === 'running') {
        return false;
      }

      // All dependencies complete
      return node.depends_on.every(depId => completed.has(depId));
    });
  }
}

// Factory function
export function createDagParser(): DagParser {
  return new DagParser();
}
