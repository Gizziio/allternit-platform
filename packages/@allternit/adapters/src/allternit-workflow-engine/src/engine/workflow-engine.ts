/**
 * Workflow Engine
 * 
 * Core engine for executing workflows with DAG support.
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Workflow,
  WorkflowExecution,
  WorkflowNode,
  Connection,
  ExecutionContext,
  ExecutionState,
  NodeExecution,
  ExecutionStatus,
  ExecutionError,
  WorkflowEngineConfig,
  NodeType,
} from '../types';

export interface WorkflowEngine {
  /** Register a workflow */
  registerWorkflow(workflow: Workflow): void;
  /** Get workflow by ID */
  getWorkflow(id: string): Workflow | undefined;
  /** List all workflows */
  listWorkflows(): Workflow[];
  /** Delete workflow */
  deleteWorkflow(id: string): boolean;
  /** Execute workflow */
  execute(workflowId: string, inputs?: Record<string, unknown>): Promise<WorkflowExecution>;
  /** Get execution status */
  getExecution(executionId: string): WorkflowExecution | undefined;
  /** Cancel execution */
  cancelExecution(executionId: string): boolean;
  /** Pause execution */
  pauseExecution(executionId: string): boolean;
  /** Resume execution */
  resumeExecution(executionId: string): boolean;
  /** Register node type */
  registerNodeType(nodeType: NodeType): void;
  /** Get node type */
  getNodeType(type: string): NodeType | undefined;
}

/**
 * Create workflow engine
 */
export function createWorkflowEngine(config: WorkflowEngineConfig = {}): WorkflowEngine {
  const workflows = new Map<string, Workflow>();
  const executions = new Map<string, WorkflowExecution>();
  const nodeTypes = new Map<string, NodeType>();
  const activeExecutions = new Set<string>();

  const {
    maxConcurrentExecutions = 10,
    defaultTimeout = 300000, // 5 minutes
    enableHistory = true,
    hooks = {},
  } = config;

  /**
   * Register built-in node types
   */
  function registerBuiltInNodeTypes(): void {
    // Input nodes
    registerNodeType({
      type: 'trigger:manual',
      category: 'input',
      displayName: 'Manual Trigger',
      description: 'Triggered manually or via API',
      outputs: [{ name: 'data', type: 'any' }],
      executor: async (_, __, inputs) => inputs,
    });

    registerNodeType({
      type: 'trigger:schedule',
      category: 'input',
      displayName: 'Schedule Trigger',
      description: 'Triggered on a schedule',
      outputs: [{ name: 'timestamp', type: 'string' }],
      executor: async (_, __, inputs) => inputs,
    });

    registerNodeType({
      type: 'trigger:webhook',
      category: 'input',
      displayName: 'Webhook Trigger',
      description: 'Triggered by HTTP webhook',
      outputs: [{ name: 'body', type: 'any' }, { name: 'headers', type: 'object' }],
      executor: async (_, __, inputs) => inputs,
    });

    // Transform nodes
    registerNodeType({
      type: 'transform:map',
      category: 'transform',
      displayName: 'Map',
      description: 'Transform data using expression',
      inputs: [{ name: 'data', type: 'any', required: true }],
      outputs: [{ name: 'result', type: 'any' }],
      configSchema: [
        { name: 'expression', type: 'string', required: true, description: 'JavaScript expression' },
      ],
      executor: async (node, context, inputs) => {
        const expression = node.config?.expression as string;
        if (!expression) throw new Error('Expression required');
        
        // Simple expression evaluation
        const data = inputs.data;
        const result = new Function('data', 'context', `return ${expression}`)(data, context);
        return { result };
      },
    });

    registerNodeType({
      type: 'transform:filter',
      category: 'transform',
      displayName: 'Filter',
      description: 'Filter array items',
      inputs: [{ name: 'array', type: 'array', required: true }],
      outputs: [{ name: 'filtered', type: 'array' }],
      configSchema: [
        { name: 'condition', type: 'string', required: true, description: 'Filter condition (item, index) => boolean' },
      ],
      executor: async (node, _, inputs) => {
        const array = inputs.array as unknown[];
        const condition = node.config?.condition as string;
        
        if (!condition) return { filtered: array };
        
        const filterFn = new Function('item', 'index', `return ${condition}`);
        const filtered = array.filter((item, index) => filterFn(item, index));
        return { filtered };
      },
    });

    // Condition nodes
    registerNodeType({
      type: 'condition:if',
      category: 'condition',
      displayName: 'If Condition',
      description: 'Branch based on condition',
      inputs: [{ name: 'data', type: 'any' }],
      outputs: [
        { name: 'true', type: 'any' },
        { name: 'false', type: 'any' },
      ],
      configSchema: [
        { name: 'condition', type: 'string', required: true, description: 'Boolean expression' },
      ],
      executor: async (node, context, inputs) => {
        const condition = node.config?.condition as string;
        if (!condition) throw new Error('Condition required');
        
        const result = new Function('data', 'context', `return ${condition}`)(inputs.data, context);
        return result ? { true: inputs.data } : { false: inputs.data };
      },
    });

    // Loop nodes
    registerNodeType({
      type: 'loop:for-each',
      category: 'loop',
      displayName: 'For Each',
      description: 'Iterate over array items',
      inputs: [{ name: 'array', type: 'array', required: true }],
      outputs: [{ name: 'results', type: 'array' }],
      configSchema: [
        { name: 'parallel', type: 'boolean', default: false, description: 'Execute in parallel' },
        { name: 'maxConcurrency', type: 'number', default: 5, description: 'Max parallel executions' },
      ],
      executor: async (node, context, inputs) => {
        // For-each logic handled by scheduler
        return { items: inputs.array };
      },
    });

    // Delay nodes
    registerNodeType({
      type: 'delay:wait',
      category: 'delay',
      displayName: 'Wait',
      description: 'Pause execution',
      inputs: [{ name: 'data', type: 'any' }],
      outputs: [{ name: 'data', type: 'any' }],
      configSchema: [
        { name: 'delay', type: 'number', required: true, description: 'Delay in milliseconds' },
      ],
      executor: async (node, _, inputs) => {
        const delay = node.config?.delay as number || 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        return { data: inputs.data };
      },
    });

    // HTTP nodes
    registerNodeType({
      type: 'http:request',
      category: 'http',
      displayName: 'HTTP Request',
      description: 'Make HTTP request',
      inputs: [
        { name: 'url', type: 'string', required: true },
        { name: 'body', type: 'any' },
      ],
      outputs: [
        { name: 'response', type: 'object' },
        { name: 'status', type: 'number' },
      ],
      configSchema: [
        { name: 'method', type: 'string', default: 'GET', description: 'HTTP method' },
        { name: 'headers', type: 'object', description: 'Request headers' },
        { name: 'timeout', type: 'number', default: 30000, description: 'Timeout in ms' },
      ],
      executor: async (node, _, inputs) => {
        const method = (node.config?.method as string) || 'GET';
        const url = inputs.url as string;
        const headers = node.config?.headers as Record<string, string> || {};
        const timeout = (node.config?.timeout as number) || 30000;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
          const response = await fetch(url, {
            method,
            headers,
            body: inputs.body ? JSON.stringify(inputs.body) : undefined,
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          const data = await response.json().catch(() => null);
          const responseHeaders: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            responseHeaders[key] = value;
          });
          return {
            response: data,
            status: response.status,
            headers: responseHeaders,
          };
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
    });

    // Output nodes
    registerNodeType({
      type: 'output:result',
      category: 'output',
      displayName: 'Set Result',
      description: 'Set workflow output',
      inputs: [{ name: 'data', type: 'any' }],
      executor: async (_, __, inputs) => inputs,
    });

    registerNodeType({
      type: 'output:log',
      category: 'output',
      displayName: 'Log',
      description: 'Log message to console',
      inputs: [{ name: 'message', type: 'any' }],
      configSchema: [
        { name: 'level', type: 'string', default: 'info', description: 'Log level' },
      ],
      executor: async (node, _, inputs) => {
        const level = (node.config?.level as string) || 'info';
        console[level as 'log' | 'info' | 'warn' | 'error']?.('Workflow log:', inputs.message);
        return { message: inputs.message };
      },
    });
  }

  /**
   * Register workflow
   */
  function registerWorkflow(workflow: Workflow): void {
    workflows.set(workflow.id, workflow);
  }

  /**
   * Get workflow
   */
  function getWorkflow(id: string): Workflow | undefined {
    return workflows.get(id);
  }

  /**
   * List workflows
   */
  function listWorkflows(): Workflow[] {
    return Array.from(workflows.values());
  }

  /**
   * Delete workflow
   */
  function deleteWorkflow(id: string): boolean {
    return workflows.delete(id);
  }

  /**
   * Execute workflow
   */
  async function execute(
    workflowId: string,
    inputs: Record<string, unknown> = {}
  ): Promise<WorkflowExecution> {
    const workflow = workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    // Check concurrent execution limit
    if (activeExecutions.size >= maxConcurrentExecutions) {
      throw new Error('Max concurrent executions reached');
    }

    const executionId = uuidv4();
    
    // Build DAG
    const dag = buildDAG(workflow);
    
    // Initialize execution
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'pending',
      inputs,
      context: {
        variables: { ...inputs },
        state: {
          activeNodes: [],
          completedNodes: [],
          failedNodes: [],
          nodeResults: {},
          executionPath: [],
        },
      },
      nodeExecutions: [],
      startedAt: new Date().toISOString(),
    };

    executions.set(executionId, execution);
    activeExecutions.add(executionId);

    // Trigger before execute hook
    await hooks.beforeExecute?.(execution);

    // Start execution
    execution.status = 'running';
    
    try {
      // Execute starting nodes (no incoming connections)
      const startNodes = dag.nodes.filter(n => 
        !dag.connections.some(c => c.target === n.id)
      );

      await Promise.all(startNodes.map(node => executeNode(node, execution, dag)));

      execution.status = 'completed';
      execution.completedAt = new Date().toISOString();
      
      // Collect outputs
      const outputNodes = workflow.nodes.filter(n => n.type === 'output:result');
      execution.outputs = {};
      for (const node of outputNodes) {
        const result = execution.context?.state.nodeResults[node.id];
        if (result) {
          Object.assign(execution.outputs, result);
        }
      }

    } catch (error) {
      execution.status = 'failed';
      execution.error = {
        code: 'EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
      };
      await hooks.onError?.(execution.error, execution.context!);
    } finally {
      activeExecutions.delete(executionId);
      await hooks.afterExecute?.(execution);
    }

    return execution;
  }

  /**
   * Build DAG from workflow
   */
  function buildDAG(workflow: Workflow): { nodes: WorkflowNode[]; connections: Connection[] } {
    return {
      nodes: workflow.nodes,
      connections: workflow.connections,
    };
  }

  /**
   * Execute a node
   */
  async function executeNode(
    node: WorkflowNode,
    execution: WorkflowExecution,
    dag: { nodes: WorkflowNode[]; connections: Connection[] }
  ): Promise<void> {
    if (!execution.context) return;

    const nodeType = nodeTypes.get(node.type);
    if (!nodeType) {
      throw new Error(`Unknown node type: ${node.type}`);
    }

    // Check if already executed
    if (execution.context.state.completedNodes.includes(node.id)) {
      return;
    }

    // Check dependencies
    const incomingConnections = dag.connections.filter(c => c.target === node.id);
    const dependenciesMet = incomingConnections.every(c => 
      execution.context!.state.completedNodes.includes(c.source) ||
      execution.context!.state.nodeResults[c.source] !== undefined
    );

    if (!dependenciesMet) {
      return; // Will be executed when dependencies complete
    }

    // Mark as active
    execution.context.state.activeNodes.push(node.id);
    execution.context.state.executionPath.push(node.id);

    // Prepare inputs
    const inputs: Record<string, unknown> = {};
    
    // Get inputs from connections
    incomingConnections.forEach(conn => {
      const sourceResult = execution.context!.state.nodeResults[conn.source];
      if (sourceResult) {
        const portName = conn.sourcePort || 'data';
        inputs[portName] = sourceResult;
      }
    });

    // Apply input mappings
    node.inputs?.forEach(mapping => {
      const value = evaluateMapping(mapping.source, execution.context!);
      if (value !== undefined || mapping.default !== undefined) {
        inputs[mapping.target] = value ?? mapping.default;
      }
    });

    // Create node execution
    const nodeExecution: NodeExecution = {
      nodeId: node.id,
      status: 'running',
      inputs,
      startedAt: new Date().toISOString(),
    };
    execution.nodeExecutions = execution.nodeExecutions || [];
    execution.nodeExecutions.push(nodeExecution);

    // Trigger before node execute hook
    await hooks.beforeNodeExecute?.(node, execution.context);

    try {
      // Execute node
      const executor = nodeType.executor;
      if (!executor) {
        throw new Error(`No executor for node type: ${node.type}`);
      }

      const result = await executor(node, execution.context, inputs);

      // Store result
      execution.context.state.nodeResults[node.id] = result;
      execution.context.state.completedNodes.push(node.id);
      
      // Update node execution
      nodeExecution.status = 'completed';
      nodeExecution.outputs = result;
      nodeExecution.completedAt = new Date().toISOString();

      // Trigger after node execute hook
      await hooks.afterNodeExecute?.(node, execution.context, result);

      // Execute next nodes
      const outgoingConnections = dag.connections.filter(c => c.source === node.id);
      
      for (const conn of outgoingConnections) {
        // Check condition
        if (conn.condition) {
          const conditionMet = evaluateCondition(conn.condition, result, execution.context);
          if (!conditionMet) continue;
        }

        const nextNode = dag.nodes.find(n => n.id === conn.target);
        if (nextNode) {
          await executeNode(nextNode, execution, dag);
        }
      }

    } catch (error) {
      nodeExecution.status = 'failed';
      nodeExecution.error = {
        code: 'NODE_EXECUTION_ERROR',
        message: error instanceof Error ? error.message : String(error),
        nodeId: node.id,
      };
      execution.context.state.failedNodes.push(node.id);
      throw error;
    } finally {
      // Remove from active
      execution.context.state.activeNodes = execution.context.state.activeNodes.filter(
        id => id !== node.id
      );
    }
  }

  /**
   * Evaluate mapping expression
   */
  function evaluateMapping(expression: string, context: ExecutionContext): unknown {
    try {
      // Simple variable substitution
      if (expression.startsWith('${') && expression.endsWith('}')) {
        const path = expression.slice(2, -1);
        return getValueByPath(context.variables, path);
      }
      return expression;
    } catch {
      return undefined;
    }
  }

  /**
   * Evaluate condition
   */
  function evaluateCondition(
    condition: string,
    result: Record<string, unknown>,
    context: ExecutionContext
  ): boolean {
    try {
      return new Function('result', 'context', `return ${condition}`)(result, context);
    } catch {
      return false;
    }
  }

  /**
   * Get value by path
   */
  function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  /**
   * Get execution
   */
  function getExecution(executionId: string): WorkflowExecution | undefined {
    return executions.get(executionId);
  }

  /**
   * Cancel execution
   */
  function cancelExecution(executionId: string): boolean {
    const execution = executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = new Date().toISOString();
      activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * Pause execution
   */
  function pauseExecution(executionId: string): boolean {
    const execution = executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'paused';
      return true;
    }
    return false;
  }

  /**
   * Resume execution
   */
  function resumeExecution(executionId: string): boolean {
    const execution = executions.get(executionId);
    if (execution && execution.status === 'paused') {
      execution.status = 'running';
      // TODO: Resume execution logic
      return true;
    }
    return false;
  }

  /**
   * Register node type
   */
  function registerNodeType(nodeType: NodeType): void {
    nodeTypes.set(nodeType.type, nodeType);
  }

  /**
   * Get node type
   */
  function getNodeType(type: string): NodeType | undefined {
    return nodeTypes.get(type);
  }

  // Initialize
  registerBuiltInNodeTypes();

  return {
    registerWorkflow,
    getWorkflow,
    listWorkflows,
    deleteWorkflow,
    execute,
    getExecution,
    cancelExecution,
    pauseExecution,
    resumeExecution,
    registerNodeType,
    getNodeType,
  };
}

/**
 * Global workflow engine instance
 */
export const globalWorkflowEngine = createWorkflowEngine();
