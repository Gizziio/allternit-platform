# @a2r/workflow-engine

A2R Workflow Engine - Visual workflow orchestration with DAG support.

## Overview

The Workflow Engine enables visual definition and execution of complex multi-step processes using a directed acyclic graph (DAG) structure. It supports conditional branching, parallel execution, loops, and custom node types.

## Features

- **Visual Workflow Definition**: DAG-based workflow structure
- **Built-in Node Types**: Triggers, transforms, conditions, loops, HTTP requests
- **Parallel Execution**: Scheduler for concurrent task execution
- **Conditional Branching**: Route execution based on conditions
- **Error Handling**: Retry logic and error handlers
- **Visualization**: Export to SVG, Mermaid, or Graphviz
- **Extensible**: Custom node types and executors

## Installation

```bash
pnpm add @a2r/workflow-engine
```

## Quick Start

```typescript
import { createWorkflowEngine } from '@a2r/workflow-engine';

const engine = createWorkflowEngine();

// Define workflow
engine.registerWorkflow({
  id: 'data-pipeline',
  name: 'Data Pipeline',
  version: '1.0.0',
  nodes: [
    {
      id: 'trigger',
      type: 'trigger:webhook',
      name: 'Webhook Trigger',
    },
    {
      id: 'fetch',
      type: 'http:request',
      name: 'Fetch Data',
      config: {
        method: 'GET',
        url: 'https://api.example.com/data',
      },
    },
    {
      id: 'filter',
      type: 'transform:filter',
      name: 'Filter Items',
      config: {
        condition: 'item.active === true',
      },
    },
    {
      id: 'output',
      type: 'output:result',
      name: 'Return Results',
    },
  ],
  connections: [
    { id: 'c1', source: 'trigger', target: 'fetch' },
    { id: 'c2', source: 'fetch', target: 'filter' },
    { id: 'c3', source: 'filter', target: 'output' },
  ],
});

// Execute workflow
const execution = await engine.execute('data-pipeline', {
  webhookData: { id: 123 },
});

console.log(execution.status); // 'completed'
console.log(execution.outputs); // { response: [...] }
```

## Built-in Node Types

### Triggers
| Type | Description |
|------|-------------|
| `trigger:manual` | Manual or API trigger |
| `trigger:schedule` | Scheduled execution |
| `trigger:webhook` | HTTP webhook trigger |

### Transforms
| Type | Description |
|------|-------------|
| `transform:map` | Transform data using expression |
| `transform:filter` | Filter array items |

### Logic
| Type | Description |
|------|-------------|
| `condition:if` | Conditional branching |
| `loop:for-each` | Iterate over array |

### Actions
| Type | Description |
|------|-------------|
| `http:request` | HTTP request |
| `delay:wait` | Pause execution |
| `output:result` | Set workflow output |
| `output:log` | Log message |

## Visualization

```typescript
import { createVisualizer } from '@a2r/workflow-engine';

const visualizer = createVisualizer();

// Export to SVG
const svg = visualizer.toSVG(workflow);

// Export to Mermaid
const mermaid = visualizer.toMermaid(workflow);
// graph TD
//   trigger["Start"]
//   trigger --> http

// Export to Graphviz
const dot = visualizer.toDOT(workflow);
```

## Custom Node Types

```typescript
engine.registerNodeType({
  type: 'custom:processor',
  category: 'custom',
  displayName: 'Data Processor',
  description: 'Process data with custom logic',
  inputs: [
    { name: 'data', type: 'object', required: true },
  ],
  outputs: [
    { name: 'result', type: 'object' },
  ],
  configSchema: [
    { name: 'multiplier', type: 'number', default: 1 },
  ],
  executor: async (node, context, inputs) => {
    const multiplier = node.config?.multiplier || 1;
    const result = inputs.data.value * multiplier;
    return { result: { value: result } };
  },
});
```

## Scheduler

```typescript
import { createScheduler } from '@a2r/workflow-engine';

const scheduler = createScheduler({
  maxConcurrency: 5,
  defaultTimeout: 30000,
});

// Submit task
await scheduler.submit({
  id: 'task-1',
  node: workflowNode,
  execution: workflowExecution,
});

// Check status
const status = scheduler.getStatus();
console.log(status.running); // 1
console.log(status.queued); // 0
```

## API Reference

### WorkflowEngine

```typescript
interface WorkflowEngine {
  registerWorkflow(workflow: Workflow): void;
  getWorkflow(id: string): Workflow | undefined;
  execute(workflowId: string, inputs?: Record<string, unknown>): Promise<WorkflowExecution>;
  getExecution(executionId: string): WorkflowExecution | undefined;
  cancelExecution(executionId: string): boolean;
  registerNodeType(nodeType: NodeType): void;
}
```

### Workflow Types

```typescript
interface Workflow {
  id: string;
  name: string;
  version: string;
  nodes: WorkflowNode[];
  connections: Connection[];
  inputs?: ParameterSchema[];
  outputs?: ParameterSchema[];
  errorHandling?: ErrorHandlingConfig;
}

interface WorkflowNode {
  id: string;
  type: string;
  name: string;
  config?: Record<string, unknown>;
  inputs?: InputMapping[];
  outputs?: OutputMapping[];
}

interface Connection {
  id: string;
  source: string;
  target: string;
  condition?: string;
}
```

## License

MIT
