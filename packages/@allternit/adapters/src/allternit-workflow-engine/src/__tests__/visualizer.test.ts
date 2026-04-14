/**
 * Workflow Visualizer Tests
 */

import { describe, it, expect } from 'vitest';
import { createVisualizer } from '../visualizer';
import type { Workflow } from '../types';

describe('WorkflowVisualizer', () => {
  const sampleWorkflow: Workflow = {
    id: 'test-workflow',
    name: 'Test Workflow',
    version: '1.0.0',
    nodes: [
      { id: 'trigger', type: 'trigger:manual', name: 'Start', position: { x: 100, y: 100 } },
      { id: 'http', type: 'http:request', name: 'HTTP Request', position: { x: 100, y: 200 } },
      { id: 'condition', type: 'condition:if', name: 'Check', position: { x: 100, y: 300 } },
      { id: 'output1', type: 'output:result', name: 'Success', position: { x: 50, y: 400 } },
      { id: 'output2', type: 'output:result', name: 'Error', position: { x: 150, y: 400 } },
    ],
    connections: [
      { id: 'c1', source: 'trigger', target: 'http' },
      { id: 'c2', source: 'http', target: 'condition' },
      { id: 'c3', source: 'condition', target: 'output1' },
      { id: 'c4', source: 'condition', target: 'output2' },
    ],
  };

  describe('layout', () => {
    it('should generate visual layout', () => {
      const visualizer = createVisualizer({ autoLayout: false });
      const layout = visualizer.layout(sampleWorkflow);

      expect(layout.nodes).toHaveLength(5);
      expect(layout.connections).toHaveLength(4);
      expect(layout.bounds).toBeDefined();
    });

    it('should position nodes correctly', () => {
      const visualizer = createVisualizer({ autoLayout: false });
      const layout = visualizer.layout(sampleWorkflow);

      const triggerNode = layout.nodes.find(n => n.id === 'trigger');
      expect(triggerNode?.x).toBe(100);
      expect(triggerNode?.y).toBe(100);
    });
  });

  describe('auto layout', () => {
    it('should auto-layout nodes in layers', () => {
      const visualizer = createVisualizer({ autoLayout: true });
      const positions = visualizer.autoLayout(sampleWorkflow.nodes, sampleWorkflow.connections);

      expect(Object.keys(positions)).toHaveLength(5);
      
      // Check that all nodes have positions
      sampleWorkflow.nodes.forEach(node => {
        expect(positions[node.id]).toBeDefined();
        expect(positions[node.id].x).toBeGreaterThanOrEqual(0);
        expect(positions[node.id].y).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('export formats', () => {
    it('should export to SVG', () => {
      const visualizer = createVisualizer();
      const svg = visualizer.toSVG(sampleWorkflow);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('Start');
      expect(svg).toContain('HTTP Request');
    });

    it('should export to Mermaid', () => {
      const visualizer = createVisualizer();
      const mermaid = visualizer.toMermaid(sampleWorkflow);

      expect(mermaid).toContain('graph TD');
      expect(mermaid).toContain('trigger');
      expect(mermaid).toContain('http');
      expect(mermaid).toContain('-->');
    });

    it('should export to DOT', () => {
      const visualizer = createVisualizer();
      const dot = visualizer.toDOT(sampleWorkflow);

      expect(dot).toContain('digraph Workflow');
      expect(dot).toContain('trigger');
      expect(dot).toContain('->');
    });
  });

  describe('node colors', () => {
    it('should assign colors by node type', () => {
      const visualizer = createVisualizer();
      const layout = visualizer.layout(sampleWorkflow);

      const triggerNode = layout.nodes.find(n => n.id === 'trigger');
      const httpNode = layout.nodes.find(n => n.id === 'http');
      const conditionNode = layout.nodes.find(n => n.id === 'condition');

      expect(triggerNode?.color).toBe('#3b82f6'); // Blue for triggers
      expect(httpNode?.color).toBe('#ec4899'); // Pink for HTTP
      expect(conditionNode?.color).toBe('#f59e0b'); // Orange for conditions
    });
  });
});
