/**
 * Workflow Visualizer
 * 
 * Generates visual representations of workflows.
 */

import type { Workflow, WorkflowNode, Connection, Position } from '../types';

export interface VisualizerConfig {
  /** Canvas width */
  width?: number;
  /** Canvas height */
  height?: number;
  /** Node width */
  nodeWidth?: number;
  /** Node height */
  nodeHeight?: number;
  /** Horizontal spacing */
  hSpacing?: number;
  /** Vertical spacing */
  vSpacing?: number;
  /** Enable auto-layout */
  autoLayout?: boolean;
}

export interface VisualLayout {
  nodes: VisualNode[];
  connections: VisualConnection[];
  bounds: Bounds;
}

export interface VisualNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  icon?: string;
  label: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
}

export interface VisualConnection {
  id: string;
  source: { x: number; y: number };
  target: { x: number; y: number };
  path: string;
  color?: string;
  animated?: boolean;
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface WorkflowVisualizer {
  /** Generate visual layout */
  layout(workflow: Workflow): VisualLayout;
  /** Auto-layout nodes */
  autoLayout(nodes: WorkflowNode[], connections: Connection[]): Record<string, Position>;
  /** Export to SVG */
  toSVG(workflow: Workflow): string;
  /** Export to Mermaid diagram */
  toMermaid(workflow: Workflow): string;
  /** Export to DOT (Graphviz) */
  toDOT(workflow: Workflow): string;
}

/**
 * Create workflow visualizer
 */
export function createVisualizer(config: VisualizerConfig = {}): WorkflowVisualizer {
  const {
    width = 1200,
    height = 800,
    nodeWidth = 180,
    nodeHeight = 60,
    hSpacing = 100,
    vSpacing = 80,
    autoLayout: enableAutoLayout = true,
  } = config;

  /**
   * Generate visual layout
   */
  function layout(workflow: Workflow): VisualLayout {
    let nodePositions: Record<string, Position>;

    if (enableAutoLayout) {
      nodePositions = autoLayoutNodes(workflow.nodes, workflow.connections);
    } else {
      // Use existing positions or default
      nodePositions = {};
      workflow.nodes.forEach(node => {
        nodePositions[node.id] = node.position || { x: 0, y: 0 };
      });
    }

    // Create visual nodes
    const visualNodes: VisualNode[] = workflow.nodes.map(node => {
      const pos = nodePositions[node.id];
      return {
        id: node.id,
        x: pos.x,
        y: pos.y,
        width: nodeWidth,
        height: nodeHeight,
        label: node.name || node.type,
        color: getNodeColor(node.type),
        icon: getNodeIcon(node.type),
      };
    });

    // Create visual connections
    const visualConnections: VisualConnection[] = workflow.connections.map(conn => {
      const sourcePos = nodePositions[conn.source];
      const targetPos = nodePositions[conn.target];
      
      const source = {
        x: sourcePos.x + nodeWidth / 2,
        y: sourcePos.y + nodeHeight,
      };
      
      const target = {
        x: targetPos.x + nodeWidth / 2,
        y: targetPos.y,
      };

      return {
        id: conn.id,
        source,
        target,
        path: generatePath(source, target),
      };
    });

    // Calculate bounds
    const bounds = calculateBounds(visualNodes);

    return {
      nodes: visualNodes,
      connections: visualConnections,
      bounds,
    };
  }

  /**
   * Auto-layout nodes using layered graph layout
   */
  function autoLayout(
    nodes: WorkflowNode[],
    connections: Connection[]
  ): Record<string, Position> {
    return autoLayoutNodes(nodes, connections);
  }

  /**
   * Auto-layout nodes
   */
  function autoLayoutNodes(
    nodes: WorkflowNode[],
    connections: Connection[]
  ): Record<string, Position> {
    const positions: Record<string, Position> = {};
    
    // Build adjacency list
    const incoming = new Map<string, string[]>();
    const outgoing = new Map<string, string[]>();
    
    nodes.forEach(node => {
      incoming.set(node.id, []);
      outgoing.set(node.id, []);
    });
    
    connections.forEach(conn => {
      outgoing.get(conn.source)?.push(conn.target);
      incoming.get(conn.target)?.push(conn.source);
    });

    // Topological sort with layering
    const layers: string[][] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();
    
    nodes.forEach(node => {
      inDegree.set(node.id, incoming.get(node.id)?.length || 0);
    });

    while (visited.size < nodes.length) {
      const layer: string[] = [];
      
      nodes.forEach(node => {
        if (!visited.has(node.id) && (inDegree.get(node.id) || 0) === 0) {
          layer.push(node.id);
        }
      });

      if (layer.length === 0) {
        // Cycle detected, add remaining nodes
        nodes.forEach(node => {
          if (!visited.has(node.id)) {
            layer.push(node.id);
          }
        });
      }

      layers.push(layer);
      
      layer.forEach(nodeId => {
        visited.add(nodeId);
        outgoing.get(nodeId)?.forEach(targetId => {
          const degree = inDegree.get(targetId) || 0;
          inDegree.set(targetId, degree - 1);
        });
      });
    }

    // Position nodes in layers
    layers.forEach((layer, layerIndex) => {
      const layerWidth = layer.length * (nodeWidth + hSpacing) - hSpacing;
      const startX = (width - layerWidth) / 2;
      
      layer.forEach((nodeId, index) => {
        positions[nodeId] = {
          x: startX + index * (nodeWidth + hSpacing),
          y: 100 + layerIndex * (nodeHeight + vSpacing),
        };
      });
    });

    return positions;
  }

  /**
   * Generate SVG path between two points
   */
  function generatePath(
    source: { x: number; y: number },
    target: { x: number; y: number }
  ): string {
    const midY = (source.y + target.y) / 2;
    return `M ${source.x} ${source.y} C ${source.x} ${midY}, ${target.x} ${midY}, ${target.x} ${target.y}`;
  }

  /**
   * Calculate bounds
   */
  function calculateBounds(nodes: VisualNode[]): Bounds {
    if (nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: width, maxY: height, width, height };
    }

    const xs = nodes.map(n => n.x);
    const ys = nodes.map(n => n.y);
    
    const minX = Math.min(...xs) - 50;
    const minY = Math.min(...ys) - 50;
    const maxX = Math.max(...xs) + nodeWidth + 50;
    const maxY = Math.max(...ys) + nodeHeight + 50;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Get node color by type
   */
  function getNodeColor(type: string): string {
    const colors: Record<string, string> = {
      'trigger:manual': '#3b82f6',
      'trigger:schedule': '#3b82f6',
      'trigger:webhook': '#3b82f6',
      'transform:map': '#10b981',
      'transform:filter': '#10b981',
      'condition:if': '#f59e0b',
      'loop:for-each': '#8b5cf6',
      'delay:wait': '#6b7280',
      'http:request': '#ec4899',
      'output:result': '#ef4444',
      'output:log': '#6b7280',
    };
    return colors[type] || '#6b7280';
  }

  /**
   * Get node icon by type
   */
  function getNodeIcon(type: string): string {
    const icons: Record<string, string> = {
      'trigger:manual': 'play',
      'trigger:schedule': 'clock',
      'trigger:webhook': 'webhook',
      'transform:map': 'transform',
      'transform:filter': 'filter',
      'condition:if': 'git-branch',
      'loop:for-each': 'repeat',
      'delay:wait': 'timer',
      'http:request': 'globe',
      'output:result': 'check-circle',
      'output:log': 'file-text',
    };
    return icons[type] || 'box';
  }

  /**
   * Export to SVG
   */
  function toSVG(workflow: Workflow): string {
    const { nodes, connections, bounds } = layout(workflow);
    
    const svgWidth = bounds.width;
    const svgHeight = bounds.height;

    let svg = `<svg width="${svgWidth}" height="${svgHeight}" viewBox="${bounds.minX} ${bounds.minY} ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">\n`;
    
    // Definitions
    svg += `  <defs>\n`;
    svg += `    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">\n`;
    svg += `      <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />\n`;
    svg += `    </marker>\n`;
    svg += `  </defs>\n`;

    // Connections
    connections.forEach(conn => {
      svg += `  <path d="${conn.path}" fill="none" stroke="#6b7280" stroke-width="2" marker-end="url(#arrowhead)" />\n`;
    });

    // Nodes
    nodes.forEach(node => {
      const rx = 8;
      svg += `  <g transform="translate(${node.x}, ${node.y})">\n`;
      svg += `    <rect width="${node.width}" height="${node.height}" rx="${rx}" fill="${node.color}" stroke="none" />\n`;
      svg += `    <text x="${node.width / 2}" y="${node.height / 2}" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="sans-serif" font-size="14">${node.label}</text>\n`;
      svg += `  </g>\n`;
    });

    svg += `</svg>`;
    return svg;
  }

  /**
   * Export to Mermaid diagram
   */
  function toMermaid(workflow: Workflow): string {
    let mermaid = 'graph TD\n';

    // Node definitions
    workflow.nodes.forEach(node => {
      const label = node.name || node.type;
      mermaid += `  ${node.id}["${label}"]\n`;
    });

    // Connections
    workflow.connections.forEach(conn => {
      mermaid += `  ${conn.source} --> ${conn.target}\n`;
    });

    return mermaid;
  }

  /**
   * Export to DOT (Graphviz)
   */
  function toDOT(workflow: Workflow): string {
    let dot = 'digraph Workflow {\n';
    dot += '  rankdir=TB;\n';
    dot += '  node [shape=box, style=filled, fontname="sans-serif"];\n';

    // Node definitions
    workflow.nodes.forEach(node => {
      const label = node.name || node.type;
      const color = getNodeColor(node.type);
      dot += `  "${node.id}" [label="${label}", fillcolor="${color}", fontcolor=white];\n`;
    });

    // Connections
    workflow.connections.forEach(conn => {
      dot += `  "${conn.source}" -> "${conn.target}";\n`;
    });

    dot += '}';
    return dot;
  }

  return {
    layout,
    autoLayout,
    toSVG,
    toMermaid,
    toDOT,
  };
}

/**
 * Global visualizer instance
 */
export const globalVisualizer = createVisualizer();
