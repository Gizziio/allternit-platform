/**
 * DAG Executor Integration Tests
 * 
 * End-to-end tests for DAG parsing, topological sorting, and execution.
 */

import { DagParser } from '../src/dag/parser';
import { DagExecutor } from '../src/dag/executor';
import { DAG, ExecutionContext } from '../src/dag/types';

describe('DAG Executor Integration', () => {
  let parser: DagParser;
  let executor: DagExecutor;

  beforeEach(() => {
    parser = new DagParser();
    executor = new DagExecutor();
  });

  describe('Topological Sort', () => {
    it('should execute nodes in dependency order', async () => {
      const yaml = `
dag_version: v1
dag_id: dag_test_001
description: Simple dependency chain
nodes:
  - id: node_c
    action: test
    depends_on: [node_b]
  - id: node_a
    action: test
    depends_on: []
  - id: node_b
    action: test
    depends_on: [node_a]
`;
      const dag = await parser.parse(yaml);
      const executionOrder: string[] = [];

      const context: ExecutionContext = {
        sessionId: 'test-session',
        agentId: 'test-agent',
        executeNode: async (node) => {
          executionOrder.push(node.id);
          return { status: 'success', outputs: {} };
        }
      };

      await executor.execute(dag, context);

      expect(executionOrder).toEqual(['node_a', 'node_b', 'node_c']);
    });

    it('should detect circular dependencies', async () => {
      const yaml = `
dag_version: v1
dag_id: dag_cycle_001
description: Circular dependency
nodes:
  - id: node_a
    action: test
    depends_on: [node_c]
  - id: node_b
    action: test
    depends_on: [node_a]
  - id: node_c
    action: test
    depends_on: [node_b]
`;
      const dag = await parser.parse(yaml);

      await expect(executor.execute(dag, {} as ExecutionContext))
        .rejects.toThrow('Cycle detected in DAG');
    });

    it('should handle parallel execution branches', async () => {
      const yaml = `
dag_version: v1
dag_id: dag_parallel_001
description: Parallel branches
nodes:
  - id: start
    action: test
    depends_on: []
  - id: branch_a
    action: test
    depends_on: [start]
  - id: branch_b
    action: test
    depends_on: [start]
  - id: merge
    action: test
    depends_on: [branch_a, branch_b]
`;
      const dag = await parser.parse(yaml);
      const executionOrder: string[] = [];

      const context: ExecutionContext = {
        sessionId: 'test-session',
        agentId: 'test-agent',
        executeNode: async (node) => {
          executionOrder.push(node.id);
          return { status: 'success', outputs: {} };
        }
      };

      await executor.execute(dag, context);

      expect(executionOrder[0]).toBe('start');
      expect(executionOrder[executionOrder.length - 1]).toBe('merge');
      expect(executionOrder).toContain('branch_a');
      expect(executionOrder).toContain('branch_b');
    });
  });

  describe('Gate Evaluation', () => {
    it('should stop execution when gate fails', async () => {
      const yaml = `
dag_version: v1
dag_id: dag_gate_001
description: Gate evaluation
gates:
  - name: tests_pass
    condition: "{{test_result}} == 'pass'"
nodes:
  - id: build
    action: build
    depends_on: []
  - id: test
    action: test
    depends_on: [build]
    gates:
      - name: tests_pass
        on_fail: stop
`;
      const dag = await parser.parse(yaml);
      const executedNodes: string[] = [];

      const context: ExecutionContext = {
        sessionId: 'test-session',
        agentId: 'test-agent',
        executeNode: async (node) => {
          executedNodes.push(node.id);
          if (node.id === 'test') {
            return { status: 'success', outputs: { test_result: 'fail' } };
          }
          return { status: 'success', outputs: {} };
        },
        evaluateGate: async (gate, evidence) => {
          return { passed: false, reason: 'Tests failed' };
        }
      };

      const result = await executor.execute(dag, context);

      expect(executedNodes).toContain('build');
      expect(executedNodes).toContain('test');
      expect(result.status).toBe('failed');
    });
  });

  describe('Error Handling', () => {
    it('should retry failed nodes with retry policy', async () => {
      const yaml = `
dag_version: v1
dag_id: dag_retry_001
description: Retry policy test
nodes:
  - id: flaky_node
    action: test
    depends_on: []
    retry:
      max_attempts: 3
      backoff: exponential
`;
      const dag = await parser.parse(yaml);
      let attempts = 0;

      const context: ExecutionContext = {
        sessionId: 'test-session',
        agentId: 'test-agent',
        executeNode: async (node) => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient error');
          }
          return { status: 'success', outputs: {} };
        }
      };

      const result = await executor.execute(dag, context);

      expect(attempts).toBe(3);
      expect(result.status).toBe('completed');
    });

    it('should propagate node failures', async () => {
      const yaml = `
dag_version: v1
dag_id: dag_fail_001
description: Failure propagation
nodes:
  - id: will_fail
    action: test
    depends_on: []
  - id: dependent
    action: test
    depends_on: [will_fail]
`;
      const dag = await parser.parse(yaml);

      const context: ExecutionContext = {
        sessionId: 'test-session',
        agentId: 'test-agent',
        executeNode: async (node) => {
          if (node.id === 'will_fail') {
            throw new Error('Intentional failure');
          }
          return { status: 'success', outputs: {} };
        }
      };

      const result = await executor.execute(dag, context);

      expect(result.status).toBe('failed');
      expect(result.failedNodes).toContain('will_fail');
    });
  });
});
