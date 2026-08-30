/**
 * DAG Executor Integration Tests
 *
 * End-to-end tests for DAG parsing, topological sorting, and execution.
 */

import { vi } from 'vitest';
import { DagParser } from '../src/dag/parser';
import { DagExecutor, DagExecutorConfig } from '../src/dag/executor';
import { DagDefinition } from '../src/dag/types';
import { WorkerManager } from '../src/workers/manager';

describe('DAG Executor Integration', () => {
  let parser: DagParser;

  beforeEach(() => {
    parser = new DagParser();
  });

  function mockWihParser(): DagExecutorConfig['wihParser'] {
    return {
      parseFile: vi.fn().mockImplementation((path: string) => ({
        work_item_id: `wih_${path.replace(/\.wih$/, '')}`,
        scope: { allowed_paths: ['.'] },
      })),
    } as unknown as DagExecutorConfig['wihParser'];
  }

  function mockRalphLoop(
    behavior: 'success' | 'fail' | 'block' = 'success',
    iterations = 1
  ): DagExecutorConfig['ralphLoop'] {
    return {
      executeNode: vi.fn().mockResolvedValue({
        success: behavior === 'success',
        nodeId: 'node',
        finalStatus:
          behavior === 'success'
            ? 'DONE'
            : behavior === 'block'
              ? 'BLOCKED'
              : 'FAILED',
        iterations,
        builderReceipts: ['rcpt_builder_1'],
        validatorReceipt: 'rcpt_validator_1',
        escalationReason: behavior === 'success' ? undefined : 'Simulated failure',
      }),
    } as unknown as DagExecutorConfig['ralphLoop'];
  }

  function createExecutor(
    dag: DagDefinition,
    overrides?: Partial<DagExecutorConfig>
  ): DagExecutor {
    return new DagExecutor({
      dag,
      runId: 'run_001',
      parser,
      wihParser: mockWihParser(),
      ralphLoop: mockRalphLoop(),
      workerManager: new WorkerManager(),
      observability: {} as DagExecutorConfig['observability'],
      railsAdapter: {
        claimWork: vi.fn().mockResolvedValue({ success: true, lease: { leaseId: 'lease_1' } }),
      } as unknown as DagExecutorConfig['railsAdapter'],
      ...overrides,
    });
  }

  describe('Topological Sort', () => {
    it('should execute nodes in dependency order', async () => {
      const yaml = `
dag_version: 1
dag_id: dag_test_001
title: Simple dependency chain
defaults:
  gates: [tests_green]
nodes:
  - id: node_c
    wih: node_c.wih
    depends_on: [node_b]
  - id: node_a
    wih: node_a.wih
    depends_on: []
  - id: node_b
    wih: node_b.wih
    depends_on: [node_a]
`;
      const dag = parser.parse(yaml);
      const executionOrder: string[] = [];

      const ralphLoop = {
        executeNode: vi.fn().mockImplementation(async (req: { nodeId: string }) => {
          executionOrder.push(req.nodeId);
          return {
            success: true,
            nodeId: req.nodeId,
            finalStatus: 'DONE',
            iterations: 1,
            builderReceipts: [],
            validatorReceipt: undefined,
          };
        }),
      } as unknown as DagExecutorConfig['ralphLoop'];

      const executor = createExecutor(dag, { ralphLoop });
      const result = await executor.execute();

      expect(executionOrder).toEqual(['node_a', 'node_b', 'node_c']);
      expect(result.success).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const yaml = `
dag_version: 1
dag_id: dag_cycle_001
title: Circular dependency
defaults:
  gates: [tests_green]
nodes:
  - id: node_a
    wih: node_a.wih
    depends_on: [node_c]
  - id: node_b
    wih: node_b.wih
    depends_on: [node_a]
  - id: node_c
    wih: node_c.wih
    depends_on: [node_b]
`;
      expect(() => parser.parse(yaml)).toThrow(/Circular dependency/);
    });

    it('should handle parallel execution branches', async () => {
      const yaml = `
dag_version: 1
dag_id: dag_parallel_001
title: Parallel branches
defaults:
  gates: [tests_green]
nodes:
  - id: start
    wih: start.wih
    depends_on: []
  - id: branch_a
    wih: branch_a.wih
    depends_on: [start]
  - id: branch_b
    wih: branch_b.wih
    depends_on: [start]
  - id: merge
    wih: merge.wih
    depends_on: [branch_a, branch_b]
`;
      const dag = parser.parse(yaml);
      const executionOrder: string[] = [];

      const ralphLoop = {
        executeNode: vi.fn().mockImplementation(async (req: { nodeId: string }) => {
          executionOrder.push(req.nodeId);
          return {
            success: true,
            nodeId: req.nodeId,
            finalStatus: 'DONE',
            iterations: 1,
            builderReceipts: [],
            validatorReceipt: undefined,
          };
        }),
      } as unknown as DagExecutorConfig['ralphLoop'];

      const executor = createExecutor(dag, { ralphLoop });
      const result = await executor.execute();

      expect(executionOrder[0]).toBe('start');
      expect(executionOrder[executionOrder.length - 1]).toBe('merge');
      expect(executionOrder).toContain('branch_a');
      expect(executionOrder).toContain('branch_b');
      expect(result.success).toBe(true);
    });
  });

  describe('Gate Evaluation', () => {
    it('should mark node blocked when Ralph loop reports BLOCKED', async () => {
      const yaml = `
dag_version: 1
dag_id: dag_gate_001
title: Gate evaluation
defaults:
  gates: [tests_green]
nodes:
  - id: build
    wih: build.wih
    depends_on: []
  - id: test
    wih: test.wih
    depends_on: [build]
`;
      const dag = parser.parse(yaml);
      const ralphLoop = {
        executeNode: vi.fn().mockImplementation(async (req: { nodeId: string }) => {
          if (req.nodeId === 'test') {
            return {
              success: false,
              nodeId: req.nodeId,
              finalStatus: 'BLOCKED',
              iterations: 1,
              builderReceipts: [],
              validatorReceipt: undefined,
              escalationReason: 'Max fix cycles exceeded',
            };
          }
          return {
            success: true,
            nodeId: req.nodeId,
            finalStatus: 'DONE',
            iterations: 1,
            builderReceipts: [],
            validatorReceipt: undefined,
          };
        }),
      } as unknown as DagExecutorConfig['ralphLoop'];

      const executor = createExecutor(dag, { ralphLoop });
      const result = await executor.execute();

      expect(result.completed_nodes).toContain('build');
      expect(result.blocked_nodes).toContain('test');
      expect(result.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should reflect Ralph loop iterations in node results', async () => {
      const yaml = `
dag_version: 1
dag_id: dag_retry_001
title: Retry policy test
defaults:
  gates: [tests_green]
nodes:
  - id: flaky_node
    wih: flaky_node.wih
    depends_on: []
    loop:
      max_iterations: 3
      on_fail: ralph
`;
      const dag = parser.parse(yaml);
      const ralphLoop = mockRalphLoop('success', 3);
      const executor = createExecutor(dag, { ralphLoop });
      const result = await executor.execute();

      expect(result.success).toBe(true);
      expect(result.completed_nodes).toContain('flaky_node');
      expect(result.node_results.get('flaky_node')?.iteration_count).toBe(3);
    });

    it('should propagate node failures', async () => {
      const yaml = `
dag_version: 1
dag_id: dag_fail_001
title: Failure propagation
defaults:
  gates: [tests_green]
nodes:
  - id: will_fail
    wih: will_fail.wih
    depends_on: []
  - id: dependent
    wih: dependent.wih
    depends_on: [will_fail]
`;
      const dag = parser.parse(yaml);
      const ralphLoop = {
        executeNode: vi.fn().mockImplementation(async (req: { nodeId: string }) => {
          if (req.nodeId === 'will_fail') {
            return {
              success: false,
              nodeId: req.nodeId,
              finalStatus: 'FAILED',
              iterations: 1,
              builderReceipts: [],
              validatorReceipt: undefined,
              escalationReason: 'Intentional failure',
            };
          }
          return {
            success: true,
            nodeId: req.nodeId,
            finalStatus: 'DONE',
            iterations: 1,
            builderReceipts: [],
            validatorReceipt: undefined,
          };
        }),
      } as unknown as DagExecutorConfig['ralphLoop'];

      const executor = createExecutor(dag, { ralphLoop });
      const result = await executor.execute();

      expect(result.success).toBe(false);
      expect(result.failed_nodes).toContain('will_fail');
    });
  });
});
