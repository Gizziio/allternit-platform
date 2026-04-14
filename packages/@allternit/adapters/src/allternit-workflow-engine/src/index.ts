/**
 * A2R Workflow Engine
 * 
 * Visual workflow orchestration with DAG support.
 * 
 * @example
 * ```typescript
 * import { createWorkflowEngine, createVisualizer } from '@allternit/workflow-engine';
 * 
 * const engine = createWorkflowEngine();
 * 
 * // Register workflow
 * engine.registerWorkflow({
 *   id: 'my-workflow',
 *   name: 'My Workflow',
 *   version: '1.0.0',
 *   nodes: [
 *     { id: 'trigger', type: 'trigger:manual', name: 'Start' },
 *     { id: 'http', type: 'http:request', name: 'Fetch Data', config: { method: 'GET' } },
 *     { id: 'output', type: 'output:result', name: 'Return Result' },
 *   ],
 *   connections: [
 *     { id: 'c1', source: 'trigger', target: 'http' },
 *     { id: 'c2', source: 'http', target: 'output' },
 *   ],
 * });
 * 
 * // Execute workflow
 * const execution = await engine.execute('my-workflow', { url: 'https://api.example.com' });
 * console.log(execution.status); // 'completed'
 * ```
 */

// Core Types
export type {
  Workflow,
  WorkflowNode,
  Connection,
  WorkflowExecution,
  ExecutionContext,
  ExecutionState,
  NodeExecution,
  ExecutionStatus,
  ExecutionError,
  ParameterSchema,
  Variable,
  InputMapping,
  OutputMapping,
  Trigger,
  ErrorHandlingConfig,
  NodeType,
  NodeCategory,
  PortDefinition,
  WorkflowEngineConfig,
  WorkflowHooks,
  Position,
} from './types';

// Engine
export {
  createWorkflowEngine,
  globalWorkflowEngine,
  type WorkflowEngine,
} from './engine/workflow-engine';

// Scheduler
export {
  createScheduler,
  globalScheduler,
  type Scheduler,
  type SchedulerConfig,
  type Task,
  type SchedulerStatus,
} from './scheduler';

// Visualizer
export {
  createVisualizer,
  globalVisualizer,
  type WorkflowVisualizer,
  type VisualizerConfig,
  type VisualLayout,
  type VisualNode,
  type VisualConnection,
  type Bounds,
} from './visualizer';

// Version
export const VERSION = '0.1.0';
