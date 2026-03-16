/**
 * Workflow Visualizer Tests
 *
 * Comprehensive tests for the WorkflowVisualizer covering auto-layout algorithms,
 * manual layout, SVG export, Mermaid export, and DOT export.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createVisualizer, globalVisualizer } from './index';
import type { Workflow, WorkflowNode, Connection, Position } from '../types';

describe('WorkflowVisualizer', () => {
  let visualizer: ReturnType<typeof createVisualizer>;

  beforeEach(() => {
    visualizer = createVisualizer();
  });

  describe('createVisualizer', () => {
    it('should create a visualizer with default config', () => {
      const viz = createVisualizer();
      expect(viz).toBeDefined();
      expect(typeof viz.layout).toBe('function');
      expect(typeof viz.autoLayout).toBe('function');
      expect(typeof viz.toSVG).toBe('function');
      expect(typeof viz.toMermaid).toBe('function');
      expect(typeof viz.toDOT).toBe('function');
    });

    it('should create a visualizer with custom config', () => {
      const viz = createVisualizer({
        width: 2000,
        height: 1200,
        nodeWidth: 200,
        nodeHeight: 80,
        hSpacing: 120,
        vSpacing: 100,
        autoLayout: false,
      });
      expect(viz).toBeDefined();
    });
  });

  describe('layout generation', () => {
    it('should generate layout for a simple workflow', () => {
      const workflow: Workflow = {
        id: 'wf-simple',
        name: 'Simple Workflow',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Start' },
          { id: 'node-2', type: 'output:result', name: 'End' },
        ],
        connections: [
          { id: 'conn-1', source: 'node-1', target: 'node-2' },
        ],
      };

      const layout = visualizer.layout(workflow);

      expect(layout).toHaveProperty('nodes');
      expect(layout).toHaveProperty('connections');
      expect(layout).toHaveProperty('bounds');
      expect(layout.nodes).toHaveLength(2);
      expect(layout.connections).toHaveLength(1);
    });

    it('should include correct node properties', () => {
      const workflow: Workflow = {
        id: 'wf-props',
        name: 'Properties Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Trigger Node' },
        ],
        connections: [],
      };

      const layout = visualizer.layout(workflow);
      const node = layout.nodes[0];

      expect(node).toHaveProperty('id', 'node-1');
      expect(node).toHaveProperty('x');
      expect(node).toHaveProperty('y');
      expect(node).toHaveProperty('width');
      expect(node).toHaveProperty('height');
      expect(node).toHaveProperty('label');
      expect(node).toHaveProperty('color');
      expect(node).toHaveProperty('icon');
    });

    it('should include correct connection properties', () => {
      const workflow: Workflow = {
        id: 'wf-conn',
        name: 'Connection Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Start' },
          { id: 'node-2', type: 'output:result', name: 'End' },
        ],
        connections: [
          { id: 'conn-1', source: 'node-1', target: 'node-2' },
        ],
      };

      const layout = visualizer.layout(workflow);
      const conn = layout.connections[0];

      expect(conn).toHaveProperty('id', 'conn-1');
      expect(conn).toHaveProperty('source');
      expect(conn).toHaveProperty('target');
      expect(conn).toHaveProperty('path');
      expect(conn.source).toHaveProperty('x');
      expect(conn.source).toHaveProperty('y');
      expect(conn.target).toHaveProperty('x');
      expect(conn.target).toHaveProperty('y');
    });
  });

  describe('auto-layout algorithms (dag-layered)', () => {
    it('should auto-layout nodes in layers', () => {
      const nodes: WorkflowNode[] = [
        { id: 'A', type: 'trigger:manual', name: 'A' },
        { id: 'B', type: 'transform:map', name: 'B' },
        { id: 'C', type: 'transform:filter', name: 'C' },
        { id: 'D', type: 'output:result', name: 'D' },
      ];
      const connections: Connection[] = [
        { id: 'c1', source: 'A', target: 'B' },
        { id: 'c2', source: 'A', target: 'C' },
        { id: 'c3', source: 'B', target: 'D' },
        { id: 'c4', source: 'C', target: 'D' },
      ];

      const positions = visualizer.autoLayout(nodes, connections);

      expect(positions).toHaveProperty('A');
      expect(positions).toHaveProperty('B');
      expect(positions).toHaveProperty('C');
      expect(positions).toHaveProperty('D');

      // A should be in a different layer than D
      expect(positions['A'].y).not.toBe(positions['D'].y);
    });

    it('should handle disconnected nodes', () => {
      const nodes: WorkflowNode[] = [
        { id: 'A', type: 'trigger:manual', name: 'A' },
        { id: 'B', type: 'trigger:schedule', name: 'B' },
        { id: 'C', type: 'output:result', name: 'C' },
      ];
      const connections: Connection[] = [];

      const positions = visualizer.autoLayout(nodes, connections);

      expect(Object.keys(positions)).toHaveLength(3);
      nodes.forEach(node => {
        expect(positions[node.id]).toHaveProperty('x');
        expect(positions[node.id]).toHaveProperty('y');
      });
    });

    it('should handle linear chains', () => {
      const nodes: WorkflowNode[] = [
        { id: 'n1', type: 'trigger:manual', name: 'N1' },
        { id: 'n2', type: 'transform:map', name: 'N2' },
        { id: 'n3', type: 'transform:filter', name: 'N3' },
        { id: 'n4', type: 'output:result', name: 'N4' },
      ];
      const connections: Connection[] = [
        { id: 'c1', source: 'n1', target: 'n2' },
        { id: 'c2', source: 'n2', target: 'n3' },
        { id: 'c3', source: 'n3', target: 'n4' },
      ];

      const positions = visualizer.autoLayout(nodes, connections);

      // Each node should be in a different layer (y position)
      expect(positions['n1'].y).toBeLessThan(positions['n2'].y);
      expect(positions['n2'].y).toBeLessThan(positions['n3'].y);
      expect(positions['n3'].y).toBeLessThan(positions['n4'].y);
    });

    it('should handle diamond patterns', () => {
      const nodes: WorkflowNode[] = [
        { id: 'start', type: 'trigger:manual', name: 'Start' },
        { id: 'branch1', type: 'condition:if', name: 'Branch 1' },
        { id: 'branch2', type: 'condition:if', name: 'Branch 2' },
        { id: 'end', type: 'output:result', name: 'End' },
      ];
      const connections: Connection[] = [
        { id: 'c1', source: 'start', target: 'branch1' },
        { id: 'c2', source: 'start', target: 'branch2' },
        { id: 'c3', source: 'branch1', target: 'end' },
        { id: 'c4', source: 'branch2', target: 'end' },
      ];

      const positions = visualizer.autoLayout(nodes, connections);

      // Branch nodes should be at same level
      expect(positions['branch1'].y).toBe(positions['branch2'].y);
      // But different x positions
      expect(positions['branch1'].x).not.toBe(positions['branch2'].x);
    });

    it('should handle cycles gracefully', () => {
      const nodes: WorkflowNode[] = [
        { id: 'A', type: 'trigger:manual', name: 'A' },
        { id: 'B', type: 'transform:map', name: 'B' },
        { id: 'C', type: 'output:result', name: 'C' },
      ];
      // Create a cycle: A -> B -> C -> B
      const connections: Connection[] = [
        { id: 'c1', source: 'A', target: 'B' },
        { id: 'c2', source: 'B', target: 'C' },
        { id: 'c3', source: 'C', target: 'B' },
      ];

      // Should not throw
      const positions = visualizer.autoLayout(nodes, connections);
      expect(Object.keys(positions)).toHaveLength(3);
    });

    it('should calculate bounds correctly', () => {
      const workflow: Workflow = {
        id: 'wf-bounds',
        name: 'Bounds Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Node 1' },
          { id: 'node-2', type: 'output:result', name: 'Node 2' },
        ],
        connections: [
          { id: 'c1', source: 'node-1', target: 'node-2' },
        ],
      };

      const layout = visualizer.layout(workflow);

      expect(layout.bounds).toHaveProperty('minX');
      expect(layout.bounds).toHaveProperty('minY');
      expect(layout.bounds).toHaveProperty('maxX');
      expect(layout.bounds).toHaveProperty('maxY');
      expect(layout.bounds).toHaveProperty('width');
      expect(layout.bounds).toHaveProperty('height');

      expect(layout.bounds.width).toBeGreaterThan(0);
      expect(layout.bounds.height).toBeGreaterThan(0);
    });
  });

  describe('manual layout with existing positions', () => {
    it('should respect existing node positions when autoLayout is disabled', () => {
      const customPositions = {
        x: 100,
        y: 200,
      };

      const workflow: Workflow = {
        id: 'wf-manual',
        name: 'Manual Layout Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Node 1', position: customPositions },
        ],
        connections: [],
      };

      const manualVisualizer = createVisualizer({ autoLayout: false });
      const layout = manualVisualizer.layout(workflow);

      expect(layout.nodes[0].x).toBe(customPositions.x);
      expect(layout.nodes[0].y).toBe(customPositions.y);
    });

    it('should default to (0,0) for nodes without positions', () => {
      const workflow: Workflow = {
        id: 'wf-default-pos',
        name: 'Default Position Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Node 1' },
        ],
        connections: [],
      };

      const manualVisualizer = createVisualizer({ autoLayout: false });
      const layout = manualVisualizer.layout(workflow);

      expect(layout.nodes[0].x).toBe(0);
      expect(layout.nodes[0].y).toBe(0);
    });

    it('should mix auto-layout and manual positions', () => {
      const workflow: Workflow = {
        id: 'wf-mixed',
        name: 'Mixed Layout Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Node 1', position: { x: 50, y: 50 } },
          { id: 'node-2', type: 'output:result', name: 'Node 2' },
        ],
        connections: [
          { id: 'c1', source: 'node-1', target: 'node-2' },
        ],
      };

      // With autoLayout enabled, positions are recalculated
      const autoLayout = createVisualizer({ autoLayout: true });
      const layout = autoLayout.layout(workflow);

      expect(layout.nodes).toHaveLength(2);
      // Both nodes should have valid positions
      layout.nodes.forEach(node => {
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      });
    });
  });

  describe('SVG export', () => {
    it('should generate valid SVG string', () => {
      const workflow: Workflow = {
        id: 'wf-svg',
        name: 'SVG Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Start' },
          { id: 'node-2', type: 'output:result', name: 'End' },
        ],
        connections: [
          { id: 'c1', source: 'node-1', target: 'node-2' },
        ],
      };

      const svg = visualizer.toSVG(workflow);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });

    it('should include node rectangles in SVG', () => {
      const workflow: Workflow = {
        id: 'wf-svg-nodes',
        name: 'SVG Nodes Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Test Node' },
        ],
        connections: [],
      };

      const svg = visualizer.toSVG(workflow);

      expect(svg).toContain('<rect');
      // SVG rect elements may be self-closing or have closing tags depending on generator
      expect(svg).toMatch(/<rect[^>]*\/>|<rect[^>]*>.*<\/rect>/s);
    });

    it('should include connection paths in SVG', () => {
      const workflow: Workflow = {
        id: 'wf-svg-conn',
        name: 'SVG Connection Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Start' },
          { id: 'node-2', type: 'output:result', name: 'End' },
        ],
        connections: [
          { id: 'c1', source: 'node-1', target: 'node-2' },
        ],
      };

      const svg = visualizer.toSVG(workflow);

      expect(svg).toContain('<path');
      expect(svg).toContain('d="M');
    });

    it('should include arrowhead marker in SVG', () => {
      const workflow: Workflow = {
        id: 'wf-svg-arrow',
        name: 'SVG Arrow Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Start' },
          { id: 'node-2', type: 'output:result', name: 'End' },
        ],
        connections: [
          { id: 'c1', source: 'node-1', target: 'node-2' },
        ],
      };

      const svg = visualizer.toSVG(workflow);

      expect(svg).toContain('<defs>');
      expect(svg).toContain('<marker');
      expect(svg).toContain('arrowhead');
    });

    it('should include node labels in SVG', () => {
      const workflow: Workflow = {
        id: 'wf-svg-labels',
        name: 'SVG Labels Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'My Node' },
        ],
        connections: [],
      };

      const svg = visualizer.toSVG(workflow);

      expect(svg).toContain('<text');
      expect(svg).toContain('My Node');
    });

    it('should generate SVG with correct viewBox', () => {
      const workflow: Workflow = {
        id: 'wf-svg-viewbox',
        name: 'SVG ViewBox Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Node 1' },
          { id: 'node-2', type: 'output:result', name: 'Node 2' },
        ],
        connections: [
          { id: 'c1', source: 'node-1', target: 'node-2' },
        ],
      };

      const svg = visualizer.toSVG(workflow);

      expect(svg).toContain('viewBox');
      expect(svg).toContain('width="');
      expect(svg).toContain('height="');
    });

    it('should handle empty workflow SVG export', () => {
      const workflow: Workflow = {
        id: 'wf-empty',
        name: 'Empty Workflow',
        version: '1.0.0',
        nodes: [],
        connections: [],
      };

      const svg = visualizer.toSVG(workflow);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
    });
  });

  describe('Mermaid export', () => {
    it('should generate valid Mermaid diagram', () => {
      const workflow: Workflow = {
        id: 'wf-mermaid',
        name: 'Mermaid Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Start' },
          { id: 'node-2', type: 'output:result', name: 'End' },
        ],
        connections: [
          { id: 'c1', source: 'node-1', target: 'node-2' },
        ],
      };

      const mermaid = visualizer.toMermaid(workflow);

      expect(mermaid).toContain('graph TD');
      expect(mermaid).toContain('node-1');
      expect(mermaid).toContain('node-2');
    });

    it('should include node definitions in Mermaid', () => {
      const workflow: Workflow = {
        id: 'wf-mermaid-nodes',
        name: 'Mermaid Nodes Test',
        version: '1.0.0',
        nodes: [
          { id: 'A', type: 'trigger:manual', name: 'Trigger Node' },
          { id: 'B', type: 'transform:map', name: 'Transform Node' },
        ],
        connections: [],
      };

      const mermaid = visualizer.toMermaid(workflow);

      expect(mermaid).toContain('A["Trigger Node"]');
      expect(mermaid).toContain('B["Transform Node"]');
    });

    it('should include connections in Mermaid', () => {
      const workflow: Workflow = {
        id: 'wf-mermaid-conn',
        name: 'Mermaid Connection Test',
        version: '1.0.0',
        nodes: [
          { id: 'A', type: 'trigger:manual', name: 'A' },
          { id: 'B', type: 'transform:map', name: 'B' },
          { id: 'C', type: 'output:result', name: 'C' },
        ],
        connections: [
          { id: 'c1', source: 'A', target: 'B' },
          { id: 'c2', source: 'B', target: 'C' },
        ],
      };

      const mermaid = visualizer.toMermaid(workflow);

      expect(mermaid).toContain('A --> B');
      expect(mermaid).toContain('B --> C');
    });

    it('should handle empty workflow Mermaid export', () => {
      const workflow: Workflow = {
        id: 'wf-empty',
        name: 'Empty Workflow',
        version: '1.0.0',
        nodes: [],
        connections: [],
      };

      const mermaid = visualizer.toMermaid(workflow);

      expect(mermaid).toContain('graph TD');
    });

    it('should handle complex workflows in Mermaid', () => {
      const workflow: Workflow = {
        id: 'wf-complex',
        name: 'Complex Workflow',
        version: '1.0.0',
        nodes: [
          { id: 'start', type: 'trigger:manual', name: 'Start' },
          { id: 'condition', type: 'condition:if', name: 'Condition?' },
          { id: 'path-a', type: 'transform:map', name: 'Path A' },
          { id: 'path-b', type: 'transform:filter', name: 'Path B' },
          { id: 'end', type: 'output:result', name: 'End' },
        ],
        connections: [
          { id: 'c1', source: 'start', target: 'condition' },
          { id: 'c2', source: 'condition', target: 'path-a' },
          { id: 'c3', source: 'condition', target: 'path-b' },
          { id: 'c4', source: 'path-a', target: 'end' },
          { id: 'c5', source: 'path-b', target: 'end' },
        ],
      };

      const mermaid = visualizer.toMermaid(workflow);

      expect(mermaid).toContain('start');
      expect(mermaid).toContain('condition');
      expect(mermaid).toContain('path-a');
      expect(mermaid).toContain('path-b');
      expect(mermaid).toContain('end');
    });
  });

  describe('DOT export', () => {
    it('should generate valid DOT graph', () => {
      const workflow: Workflow = {
        id: 'wf-dot',
        name: 'DOT Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Start' },
          { id: 'node-2', type: 'output:result', name: 'End' },
        ],
        connections: [
          { id: 'c1', source: 'node-1', target: 'node-2' },
        ],
      };

      const dot = visualizer.toDOT(workflow);

      expect(dot).toContain('digraph Workflow');
      expect(dot).toContain('{');
      expect(dot).toContain('}');
    });

    it('should include rankdir in DOT', () => {
      const workflow: Workflow = {
        id: 'wf-dot-rank',
        name: 'DOT Rank Test',
        version: '1.0.0',
        nodes: [],
        connections: [],
      };

      const dot = visualizer.toDOT(workflow);

      expect(dot).toContain('rankdir=TB');
    });

    it('should include node definitions in DOT', () => {
      const workflow: Workflow = {
        id: 'wf-dot-nodes',
        name: 'DOT Nodes Test',
        version: '1.0.0',
        nodes: [
          { id: 'A', type: 'trigger:manual', name: 'Trigger' },
          { id: 'B', type: 'transform:map', name: 'Transform' },
        ],
        connections: [],
      };

      const dot = visualizer.toDOT(workflow);

      expect(dot).toContain('"A"');
      expect(dot).toContain('"B"');
      expect(dot).toContain('label="Trigger"');
      expect(dot).toContain('label="Transform"');
    });

    it('should include node colors in DOT', () => {
      const workflow: Workflow = {
        id: 'wf-dot-colors',
        name: 'DOT Colors Test',
        version: '1.0.0',
        nodes: [
          { id: 'trigger', type: 'trigger:manual', name: 'Trigger' },
          { id: 'transform', type: 'transform:map', name: 'Transform' },
          { id: 'condition', type: 'condition:if', name: 'Condition' },
        ],
        connections: [],
      };

      const dot = visualizer.toDOT(workflow);

      expect(dot).toContain('fillcolor=');
      expect(dot).toContain('fontcolor=white');
    });

    it('should include edges in DOT', () => {
      const workflow: Workflow = {
        id: 'wf-dot-edges',
        name: 'DOT Edges Test',
        version: '1.0.0',
        nodes: [
          { id: 'A', type: 'trigger:manual', name: 'A' },
          { id: 'B', type: 'transform:map', name: 'B' },
          { id: 'C', type: 'output:result', name: 'C' },
        ],
        connections: [
          { id: 'c1', source: 'A', target: 'B' },
          { id: 'c2', source: 'B', target: 'C' },
        ],
      };

      const dot = visualizer.toDOT(workflow);

      expect(dot).toContain('"A" -> "B"');
      expect(dot).toContain('"B" -> "C"');
    });

    it('should handle empty workflow DOT export', () => {
      const workflow: Workflow = {
        id: 'wf-empty',
        name: 'Empty Workflow',
        version: '1.0.0',
        nodes: [],
        connections: [],
      };

      const dot = visualizer.toDOT(workflow);

      expect(dot).toContain('digraph Workflow');
      expect(dot).toContain('{');
      expect(dot).toContain('}');
    });

    it('should include node style attributes in DOT', () => {
      const workflow: Workflow = {
        id: 'wf-dot-style',
        name: 'DOT Style Test',
        version: '1.0.0',
        nodes: [
          { id: 'node-1', type: 'trigger:manual', name: 'Node' },
        ],
        connections: [],
      };

      const dot = visualizer.toDOT(workflow);

      expect(dot).toContain('node [');
      expect(dot).toContain('shape=box');
      expect(dot).toContain('style=filled');
    });
  });

  describe('node type styling', () => {
    it('should assign correct colors to node types', () => {
      const workflow: Workflow = {
        id: 'wf-colors',
        name: 'Colors Test',
        version: '1.0.0',
        nodes: [
          { id: 'trigger', type: 'trigger:manual', name: 'Trigger' },
          { id: 'schedule', type: 'trigger:schedule', name: 'Schedule' },
          { id: 'webhook', type: 'trigger:webhook', name: 'Webhook' },
          { id: 'map', type: 'transform:map', name: 'Map' },
          { id: 'filter', type: 'transform:filter', name: 'Filter' },
          { id: 'condition', type: 'condition:if', name: 'Condition' },
          { id: 'loop', type: 'loop:for-each', name: 'Loop' },
          { id: 'delay', type: 'delay:wait', name: 'Delay' },
          { id: 'http', type: 'http:request', name: 'HTTP' },
          { id: 'result', type: 'output:result', name: 'Result' },
          { id: 'log', type: 'output:log', name: 'Log' },
          { id: 'unknown', type: 'unknown:type', name: 'Unknown' },
        ],
        connections: [],
      };

      const layout = visualizer.layout(workflow);

      // All nodes should have colors
      layout.nodes.forEach(node => {
        expect(node.color).toBeDefined();
        expect(node.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it('should assign correct icons to node types', () => {
      const workflow: Workflow = {
        id: 'wf-icons',
        name: 'Icons Test',
        version: '1.0.0',
        nodes: [
          { id: 'trigger', type: 'trigger:manual', name: 'Trigger' },
          { id: 'schedule', type: 'trigger:schedule', name: 'Schedule' },
          { id: 'webhook', type: 'trigger:webhook', name: 'Webhook' },
          { id: 'map', type: 'transform:map', name: 'Map' },
          { id: 'filter', type: 'transform:filter', name: 'Filter' },
          { id: 'condition', type: 'condition:if', name: 'Condition' },
          { id: 'loop', type: 'loop:for-each', name: 'Loop' },
          { id: 'delay', type: 'delay:wait', name: 'Delay' },
          { id: 'http', type: 'http:request', name: 'HTTP' },
          { id: 'result', type: 'output:result', name: 'Result' },
          { id: 'log', type: 'output:log', name: 'Log' },
          { id: 'unknown', type: 'unknown:type', name: 'Unknown' },
        ],
        connections: [],
      };

      const layout = visualizer.layout(workflow);

      // All nodes should have icons
      layout.nodes.forEach(node => {
        expect(node.icon).toBeDefined();
        expect(typeof node.icon).toBe('string');
        expect(node.icon!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('path generation', () => {
    it('should generate valid SVG path for connections', () => {
      const workflow: Workflow = {
        id: 'wf-path',
        name: 'Path Test',
        version: '1.0.0',
        nodes: [
          { id: 'A', type: 'trigger:manual', name: 'A' },
          { id: 'B', type: 'output:result', name: 'B' },
        ],
        connections: [
          { id: 'c1', source: 'A', target: 'B' },
        ],
      };

      const layout = visualizer.layout(workflow);

      expect(layout.connections[0].path).toContain('M');
      expect(layout.connections[0].path).toContain('C');
    });
  });

  describe('global visualizer instance', () => {
    it('should have a global visualizer instance', () => {
      expect(globalVisualizer).toBeDefined();
      expect(typeof globalVisualizer.layout).toBe('function');
      expect(typeof globalVisualizer.toSVG).toBe('function');
      expect(typeof globalVisualizer.toMermaid).toBe('function');
      expect(typeof globalVisualizer.toDOT).toBe('function');
    });
  });

  describe('complex workflow visualization', () => {
    it('should handle complex workflow with multiple branches', () => {
      const workflow: Workflow = {
        id: 'wf-complex-viz',
        name: 'Complex Visualization',
        version: '1.0.0',
        nodes: [
          { id: 'input', type: 'trigger:manual', name: 'Input' },
          { id: 'validate', type: 'transform:filter', name: 'Validate' },
          { id: 'check', type: 'condition:if', name: 'Check' },
          { id: 'process-a', type: 'transform:map', name: 'Process A' },
          { id: 'process-b', type: 'transform:map', name: 'Process B' },
          { id: 'merge', type: 'transform:map', name: 'Merge' },
          { id: 'delay', type: 'delay:wait', name: 'Wait' },
          { id: 'output', type: 'output:result', name: 'Output' },
        ],
        connections: [
          { id: 'c1', source: 'input', target: 'validate' },
          { id: 'c2', source: 'validate', target: 'check' },
          { id: 'c3', source: 'check', target: 'process-a' },
          { id: 'c4', source: 'check', target: 'process-b' },
          { id: 'c5', source: 'process-a', target: 'merge' },
          { id: 'c6', source: 'process-b', target: 'merge' },
          { id: 'c7', source: 'merge', target: 'delay' },
          { id: 'c8', source: 'delay', target: 'output' },
        ],
      };

      const layout = visualizer.layout(workflow);

      expect(layout.nodes).toHaveLength(8);
      expect(layout.connections).toHaveLength(8);

      // All nodes should have valid positions
      layout.nodes.forEach(node => {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.y).toBeGreaterThanOrEqual(0);
      });

      // SVG should generate without errors
      const svg = visualizer.toSVG(workflow);
      expect(svg).toContain('<svg');

      // Mermaid should generate without errors
      const mermaid = visualizer.toMermaid(workflow);
      expect(mermaid).toContain('graph TD');

      // DOT should generate without errors
      const dot = visualizer.toDOT(workflow);
      expect(dot).toContain('digraph Workflow');
    });
  });
});
