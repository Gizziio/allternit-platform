/**
 * Workflow Designer Engine
 * 
 * Ported from: 6-ui/shell-ui/src/views/workflow/designer.rs
 * 
 * Provides workflow validation, layout, and compilation.
 */

import {
  WorkflowDraft,
  DesignerNode,
  DesignerEdge,
  NodePosition,
  ValidationError,
  ExecutableWorkflow,
  ExecutableNode,
  ExecutableEdge,
  EdgeCondition,
  WorkflowVariable,
  PortType,
  NodeCategory,
} from '@/types/workflow';

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/** Layout options */
export interface LayoutOptions {
  direction: 'horizontal' | 'vertical';
  nodeWidth: number;
  nodeHeight: number;
  spacing: number;
}

/**
 * Workflow Designer Engine
 * 
 * Performs workflow operations ported from Rust implementation.
 */
export class WorkflowDesignerEngine {
  /**
   * Validate a workflow
   * Ported from: designer.rs validation logic
   */
  validateWorkflow(nodes: DesignerNode[], edges: DesignerEdge[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check for empty workflow
    if (nodes.length === 0) {
      errors.push({
        code: 'EMPTY_WORKFLOW',
        message: 'Workflow must have at least one node',
        severity: 'error',
      });
    }

    // Check for disconnected nodes
    const connectedNodeIds = new Set<string>();
    edges.forEach(edge => {
      connectedNodeIds.add(edge.from);
      connectedNodeIds.add(edge.to);
    });

    nodes.forEach(node => {
      if (!connectedNodeIds.has(node.id) && nodes.length > 1) {
        warnings.push({
          code: 'DISCONNECTED_NODE',
          message: `Node "${node.name}" is not connected to any other node`,
          node_id: node.id,
          severity: 'warning',
        });
      }
    });

    // Check for cycles
    const cycle = this.detectCycle(nodes, edges);
    if (cycle) {
      errors.push({
        code: 'CYCLE_DETECTED',
        message: `Cycle detected in workflow: ${cycle.join(' -> ')}`,
        severity: 'error',
      });
    }

    // Check for invalid edges
    edges.forEach(edge => {
      const fromNode = nodes.find(n => n.id === edge.from);
      const toNode = nodes.find(n => n.id === edge.to);

      if (!fromNode) {
        errors.push({
          code: 'INVALID_EDGE_SOURCE',
          message: `Edge references non-existent source node: ${edge.from}`,
          edge_id: edge.id,
          severity: 'error',
        });
      }

      if (!toNode) {
        errors.push({
          code: 'INVALID_EDGE_TARGET',
          message: `Edge references non-existent target node: ${edge.to}`,
          edge_id: edge.id,
          severity: 'error',
        });
      }

      // Check for duplicate edges
      const duplicateEdges = edges.filter(e => 
        e.from === edge.from && e.to === edge.to && e.id !== edge.id
      );
      if (duplicateEdges.length > 0) {
        warnings.push({
          code: 'DUPLICATE_EDGE',
          message: `Duplicate edge from "${fromNode?.name}" to "${toNode?.name}"`,
          edge_id: edge.id,
          severity: 'warning',
        });
      }
    });

    // Check for orphaned inputs/outputs
    nodes.forEach(node => {
      node.inputs.forEach(input => {
        const hasIncomingEdge = edges.some(e => e.to === node.id);
        if (!hasIncomingEdge && input.startsWith('required:')) {
          warnings.push({
            code: 'REQUIRED_INPUT_NOT_CONNECTED',
            message: `Required input "${input}" on node "${node.name}" is not connected`,
            node_id: node.id,
            severity: 'warning',
          });
        }
      });
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Detect cycles in the workflow graph
   */
  private detectCycle(nodes: DesignerNode[], edges: DesignerEdge[]): string[] | null {
    const adjacency = new Map<string, string[]>();
    
    // Build adjacency list
    nodes.forEach(node => adjacency.set(node.id, []));
    edges.forEach(edge => {
      adjacency.get(edge.from)?.push(edge.to);
    });

    // DFS cycle detection
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): string[] | null => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacency.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const cycle = dfs(neighbor, [...path, neighbor]);
          if (cycle) return cycle;
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          return [...path.slice(cycleStart), neighbor];
        }
      }

      recursionStack.delete(nodeId);
      return null;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const cycle = dfs(node.id, [node.id]);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  /**
   * Auto-layout nodes using a simple DAG layout algorithm
   * Ported from: Rust layout logic
   */
  autoLayout(
    nodes: DesignerNode[],
    edges: DesignerEdge[],
    options: LayoutOptions = {
      direction: 'horizontal',
      nodeWidth: 200,
      nodeHeight: 100,
      spacing: 50,
    }
  ): Map<string, NodePosition> {
    const positions = new Map<string, NodePosition>();
    
    if (nodes.length === 0) return positions;

    // Calculate levels using topological sort
    const levels = this.calculateNodeLevels(nodes, edges);
    
    // Group nodes by level
    const nodesByLevel = new Map<number, DesignerNode[]>();
    levels.forEach((level, nodeId) => {
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        nodesByLevel.get(level)!.push(node);
      }
    });

    // Position nodes
    const sortedLevels = Array.from(nodesByLevel.keys()).sort((a, b) => a - b);
    
    sortedLevels.forEach((level, levelIndex) => {
      const levelNodes = nodesByLevel.get(level)!;
      const levelWidth = levelNodes.length * options.nodeWidth + 
                         (levelNodes.length - 1) * options.spacing;
      
      levelNodes.forEach((node, nodeIndex) => {
        if (options.direction === 'horizontal') {
          positions.set(node.id, {
            x: levelIndex * (options.nodeWidth + options.spacing * 2),
            y: nodeIndex * (options.nodeHeight + options.spacing) - levelWidth / 2,
          });
        } else {
          positions.set(node.id, {
            x: nodeIndex * (options.nodeWidth + options.spacing) - levelWidth / 2,
            y: levelIndex * (options.nodeHeight + options.spacing * 2),
          });
        }
      });
    });

    return positions;
  }

  /**
   * Calculate node levels for layout
   */
  private calculateNodeLevels(nodes: DesignerNode[], edges: DesignerEdge[]): Map<string, number> {
    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();

    // Initialize
    nodes.forEach(node => {
      levels.set(node.id, 0);
      inDegree.set(node.id, 0);
    });

    // Calculate in-degrees
    edges.forEach(edge => {
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    });

    // Topological level assignment
    const queue = nodes.filter(n => (inDegree.get(n.id) || 0) === 0).map(n => n.id);
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const currentLevel = levels.get(nodeId) || 0;

      // Find outgoing edges
      const outgoingEdges = edges.filter(e => e.from === nodeId);
      
      outgoingEdges.forEach(edge => {
        const targetLevel = levels.get(edge.to) || 0;
        levels.set(edge.to, Math.max(targetLevel, currentLevel + 1));
        
        const newInDegree = (inDegree.get(edge.to) || 0) - 1;
        inDegree.set(edge.to, newInDegree);
        
        if (newInDegree === 0) {
          queue.push(edge.to);
        }
      });
    }

    return levels;
  }

  /**
   * Compile workflow draft to executable format
   * Ported from: Rust compilation logic
   */
  compileToExecutable(draft: WorkflowDraft): ExecutableWorkflow {
    // Validate first
    const validation = this.validateWorkflow(draft.nodes, draft.edges);
    if (!validation.valid) {
      throw new Error(
        `Cannot compile invalid workflow: ${validation.errors.map(e => e.message).join(', ')}`
      );
    }

    // Convert nodes
    const executableNodes: ExecutableNode[] = draft.nodes.map(node => ({
      id: node.id,
      type: node.node_type,
      config: node.config,
      timeout_ms: 30000, // Default timeout
    }));

    // Convert edges with conditions
    const executableEdges: ExecutableEdge[] = draft.edges.map(edge => ({
      from: edge.from,
      to: edge.to,
      condition: edge.condition 
        ? { type: 'expression', expression: edge.condition }
        : { type: 'always' },
    }));

    // Extract variables from node configs
    const variables = this.extractVariables(draft);

    return {
      workflow_id: draft.workflow_id,
      version: draft.version,
      entry_point: this.findEntryPoint(draft.nodes, draft.edges),
      nodes: executableNodes,
      edges: executableEdges,
      variables,
    };
  }

  /**
   * Find the entry point node (source with no incoming edges)
   */
  private findEntryPoint(nodes: DesignerNode[], edges: DesignerEdge[]): string {
    const nodesWithIncoming = new Set(edges.map(e => e.to));
    const entryPoints = nodes.filter(n => !nodesWithIncoming.has(n.id));
    
    if (entryPoints.length === 0) {
      // Cycle or disconnected - return first node
      return nodes[0]?.id || '';
    }
    
    return entryPoints[0].id;
  }

  /**
   * Extract variables from node configurations
   */
  private extractVariables(draft: WorkflowDraft): WorkflowVariable[] {
    const variables: WorkflowVariable[] = [];
    const seen = new Set<string>();

    draft.nodes.forEach(node => {
      Object.entries(node.config).forEach(([key, value]) => {
        if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
          const varName = value.slice(2, -1);
          if (!seen.has(varName)) {
            seen.add(varName);
            variables.push({
              name: varName,
              type: PortType.String,
              required: true,
            });
          }
        }
      });
    });

    return variables;
  }

  /**
   * Get upstream nodes for a given node
   */
  getUpstreamNodes(nodeId: string, edges: DesignerEdge[]): string[] {
    const upstream: string[] = [];
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      edges.forEach(edge => {
        if (edge.to === current && !visited.has(edge.from)) {
          visited.add(edge.from);
          upstream.push(edge.from);
          queue.push(edge.from);
        }
      });
    }

    return upstream;
  }

  /**
   * Get downstream nodes for a given node
   */
  getDownstreamNodes(nodeId: string, edges: DesignerEdge[]): string[] {
    const downstream: string[] = [];
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      edges.forEach(edge => {
        if (edge.from === current && !visited.has(edge.to)) {
          visited.add(edge.to);
          downstream.push(edge.to);
          queue.push(edge.to);
        }
      });
    }

    return downstream;
  }

  /**
   * Check if adding an edge would create a cycle
   */
  wouldCreateCycle(
    fromNodeId: string,
    toNodeId: string,
    existingEdges: DesignerEdge[]
  ): boolean {
    // Quick check: if toNode is upstream of fromNode, it would create a cycle
    const upstream = this.getUpstreamNodes(fromNodeId, existingEdges);
    return upstream.includes(toNodeId);
  }

  /**
   * Suggest connection points for a node type
   */
  suggestConnections(
    nodeType: string,
    availableNodes: DesignerNode[],
    nodeTypes: NodeCategory[]
  ): { inputs: DesignerNode[]; outputs: DesignerNode[] } {
    // Simple heuristic based on node categories
    const category = this.inferCategory(nodeType);
    
    return {
      inputs: availableNodes.filter(n => 
        category === NodeCategory.Transform || category === NodeCategory.Sink
      ),
      outputs: availableNodes.filter(n => 
        category === NodeCategory.Source || category === NodeCategory.Transform
      ),
    };
  }

  /**
   * Infer node category from type string
   */
  private inferCategory(nodeType: string): NodeCategory {
    const lower = nodeType.toLowerCase();
    if (lower.includes('source') || lower.includes('input')) {
      return NodeCategory.Source;
    }
    if (lower.includes('sink') || lower.includes('output')) {
      return NodeCategory.Sink;
    }
    if (lower.includes('transform') || lower.includes('process')) {
      return NodeCategory.Transform;
    }
    if (lower.includes('control') || lower.includes('condition')) {
      return NodeCategory.Control;
    }
    return NodeCategory.Custom;
  }
}

/** Create workflow designer engine */
export function createWorkflowEngine(): WorkflowDesignerEngine {
  return new WorkflowDesignerEngine();
}

/** Validate workflow helper */
export function validateWorkflow(nodes: DesignerNode[], edges: DesignerEdge[]): ValidationResult {
  const engine = new WorkflowDesignerEngine();
  return engine.validateWorkflow(nodes, edges);
}

/** Auto-layout helper */
export function autoLayoutNodes(
  nodes: DesignerNode[],
  edges: DesignerEdge[],
  options?: Partial<LayoutOptions>
): Map<string, NodePosition> {
  const engine = new WorkflowDesignerEngine();
  return engine.autoLayout(nodes, edges, options as LayoutOptions);
}
