/**
 * Workflow Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createWorkflowEngine } from '../engine/workflow-engine';
import type { Workflow } from '../types';

describe('WorkflowEngine', () => {
  let engine: ReturnType<typeof createWorkflowEngine>;

  beforeEach(() => {
    engine = createWorkflowEngine();
  });

  describe('workflow management', () => {
    it('should register and retrieve workflow', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [],
        connections: [],
      };

      engine.registerWorkflow(workflow);
      const retrieved = engine.getWorkflow('test-workflow');

      expect(retrieved).toEqual(workflow);
    });

    it('should list all workflows', () => {
      const workflow1: Workflow = {
        id: 'workflow-1',
        name: 'Workflow 1',
        version: '1.0.0',
        nodes: [],
        connections: [],
      };

      const workflow2: Workflow = {
        id: 'workflow-2',
        name: 'Workflow 2',
        version: '1.0.0',
        nodes: [],
        connections: [],
      };

      engine.registerWorkflow(workflow1);
      engine.registerWorkflow(workflow2);

      const workflows = engine.listWorkflows();
      expect(workflows).toHaveLength(2);
    });

    it('should delete workflow', () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [],
        connections: [],
      };

      engine.registerWorkflow(workflow);
      expect(engine.getWorkflow('test-workflow')).toBeDefined();

      engine.deleteWorkflow('test-workflow');
      expect(engine.getWorkflow('test-workflow')).toBeUndefined();
    });
  });

  describe('workflow execution', () => {
    it('should execute simple workflow', async () => {
      const workflow: Workflow = {
        id: 'simple-workflow',
        name: 'Simple Workflow',
        version: '1.0.0',
        nodes: [
          {
            id: 'trigger',
            type: 'trigger:manual',
            name: 'Start',
          },
          {
            id: 'output',
            type: 'output:result',
            name: 'End',
          },
        ],
        connections: [
          { id: 'c1', source: 'trigger', target: 'output' },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.execute('simple-workflow');

      expect(execution.status).toBe('completed');
      expect(execution.workflowId).toBe('simple-workflow');
    });

    it('should throw error for non-existent workflow', async () => {
      await expect(engine.execute('non-existent')).rejects.toThrow('Workflow not found');
    });

    it('should track execution state', async () => {
      const workflow: Workflow = {
        id: 'tracking-workflow',
        name: 'Tracking Workflow',
        version: '1.0.0',
        nodes: [
          { id: 'trigger', type: 'trigger:manual', name: 'Start' },
          { id: 'log', type: 'output:log', name: 'Log' },
          { id: 'output', type: 'output:result', name: 'End' },
        ],
        connections: [
          { id: 'c1', source: 'trigger', target: 'log' },
          { id: 'c2', source: 'log', target: 'output' },
        ],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.execute('tracking-workflow');

      expect(execution.context?.state.completedNodes).toContain('trigger');
      expect(execution.context?.state.completedNodes).toContain('log');
      expect(execution.context?.state.completedNodes).toContain('output');
      expect(execution.context?.state.executionPath).toHaveLength(3);
    });
  });

  describe('node types', () => {
    it('should get built-in node types', () => {
      const triggerType = engine.getNodeType('trigger:manual');
      expect(triggerType).toBeDefined();
      expect(triggerType?.displayName).toBe('Manual Trigger');
    });

    it('should register custom node type', () => {
      engine.registerNodeType({
        type: 'custom:action',
        category: 'custom',
        displayName: 'Custom Action',
        executor: async () => ({ result: 'custom' }),
      });

      const customType = engine.getNodeType('custom:action');
      expect(customType).toBeDefined();
      expect(customType?.displayName).toBe('Custom Action');
    });
  });

  describe('execution control', () => {
    it('should get execution by id', async () => {
      const workflow: Workflow = {
        id: 'test-workflow',
        name: 'Test Workflow',
        version: '1.0.0',
        nodes: [
          { id: 'trigger', type: 'trigger:manual', name: 'Start' },
          { id: 'output', type: 'output:result', name: 'End' },
        ],
        connections: [{ id: 'c1', source: 'trigger', target: 'output' }],
      };

      engine.registerWorkflow(workflow);
      const execution = await engine.execute('test-workflow');

      const retrieved = engine.getExecution(execution.id);
      expect(retrieved).toEqual(execution);
    });
  });
});

describe('WorkflowEngine with conditions', () => {
  it('should execute conditional workflow', async () => {
    const engine = createWorkflowEngine();

    const workflow: Workflow = {
      id: 'conditional-workflow',
      name: 'Conditional Workflow',
      version: '1.0.0',
      nodes: [
        { id: 'trigger', type: 'trigger:manual', name: 'Start' },
        {
          id: 'condition',
          type: 'condition:if',
          name: 'Check Value',
          config: { condition: 'data.value > 10' },
        },
        { id: 'high', type: 'output:result', name: 'High Value' },
        { id: 'low', type: 'output:result', name: 'Low Value' },
      ],
      connections: [
        { id: 'c1', source: 'trigger', target: 'condition' },
        { id: 'c2', source: 'condition', target: 'high', condition: 'result.true' },
        { id: 'c3', source: 'condition', target: 'low', condition: 'result.false' },
      ],
    };

    engine.registerWorkflow(workflow);
    const execution = await engine.execute('conditional-workflow', { value: 15 });

    expect(execution.status).toBe('completed');
  });
});

describe('WorkflowEngine with transforms', () => {
  it('should execute transform node', async () => {
    const engine = createWorkflowEngine();

    const workflow: Workflow = {
      id: 'transform-workflow',
      name: 'Transform Workflow',
      version: '1.0.0',
      nodes: [
        { id: 'trigger', type: 'trigger:manual', name: 'Start' },
        {
          id: 'transform',
          type: 'transform:map',
          name: 'Double Value',
          config: { expression: 'data.value * 2' },
          inputs: [{ target: 'data', source: '${value}' }],
        },
        { id: 'output', type: 'output:result', name: 'Result' },
      ],
      connections: [
        { id: 'c1', source: 'trigger', target: 'transform' },
        { id: 'c2', source: 'transform', target: 'output' },
      ],
    };

    engine.registerWorkflow(workflow);
    const execution = await engine.execute('transform-workflow', { value: 5 });

    expect(execution.status).toBe('completed');
  });
});
