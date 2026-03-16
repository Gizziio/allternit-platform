/**
 * Agent Advanced Types - Multi-Agent, Subagents, Swarms, Workflows
 * 
 * Based on AI SDK patterns:
 * - Subagents: Agents that can spawn other agents
 * - Swarms: Multiple agents working collaboratively
 * - Workflows: DAG-based execution patterns
 * - Loop Control: Max steps, step delay, abort conditions
 * - Call Options: Temperature, maxTokens, toolChoice, etc.
 */

import type { Agent, AgentTask, AgentRun } from './agent.types';

// ============================================================================
// Subagent Configuration
// ============================================================================

export interface SubagentConfig {
  /** Unique identifier for the subagent */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of the subagent's purpose */
  description: string;
  /** Parent agent that owns this subagent */
  parentAgentId: string;
  /** When to invoke this subagent (conditions) */
  triggerConditions: TriggerCondition[];
  /** Input mapping from parent to subagent */
  inputMapping: Record<string, string>;
  /** Output mapping from subagent to parent */
  outputMapping: Record<string, string>;
  /** Whether subagent runs in parallel with parent */
  parallel: boolean;
  /** Timeout for subagent execution (ms) */
  timeout: number;
  /** Maximum retries for subagent */
  maxRetries: number;
}

export interface TriggerCondition {
  /** Type of trigger */
  type: 'tool-call' | 'step-count' | 'state-change' | 'manual' | 'condition';
  /** Tool name if type is 'tool-call' */
  toolName?: string;
  /** Step threshold if type is 'step-count' */
  stepThreshold?: number;
  /** State key to watch if type is 'state-change' */
  stateKey?: string;
  /** Condition expression (e.g., "task.complexity > 5") */
  expression?: string;
}

// ============================================================================
// Agent Swarm Configuration
// ============================================================================

export interface AgentSwarm {
  /** Unique identifier */
  id: string;
  /** Swarm name */
  name: string;
  /** Description */
  description: string;
  /** Agents in the swarm */
  agents: SwarmAgentConfig[];
  /** Swarm coordination strategy */
  strategy: SwarmStrategy;
  /** Communication protocol between agents */
  communication: SwarmCommunication;
  /** Shared context/memory */
  sharedContext: boolean;
  /** Consensus threshold (0-1) for decisions */
  consensusThreshold: number;
  /** Max rounds of collaboration */
  maxRounds: number;
}

export interface SwarmAgentConfig {
  /** Agent ID */
  agentId: string;
  /** Role in the swarm */
  role: SwarmRole;
  /** Weight in voting/consensus (0-1) */
  weight: number;
  /** Priority order */
  priority: number;
  /** Can initiate actions */
  canInitiate: boolean;
  /** Can terminate swarm execution */
  canTerminate: boolean;
}

export type SwarmRole = 
  | 'leader'      // Coordinates other agents
  | 'worker'      // Executes tasks
  | 'critic'      // Reviews and validates
  | 'planner'     // Creates execution plans
  | 'specialist'  // Domain expert
  | 'observer';   // Monitors and reports

export type SwarmStrategy = 
  | 'round-robin'     // Each agent takes turns
  | 'hierarchical'    // Leader delegates to workers
  | 'democratic'      // Voting-based decisions
  | 'competitive'     // Agents compete, best result wins
  | 'collaborative'   // All agents work together
  | 'specialist'      // Route to specialist based on task
  | 'adaptive';       // Dynamic strategy based on context

export interface SwarmCommunication {
  /** Communication pattern */
  pattern: 'broadcast' | 'direct' | 'mailbox' | 'shared-memory';
  /** Message retention (ms) */
  retentionPeriod: number;
  /** Include reasoning in messages */
  includeReasoning: boolean;
  /** Synchronous or async communication */
  synchronous: boolean;
}

// ============================================================================
// Workflow Patterns (DAG-based)
// ============================================================================

export interface AgentWorkflow {
  /** Unique identifier */
  id: string;
  /** Workflow name */
  name: string;
  /** Description */
  description: string;
  /** DAG of workflow steps */
  steps: WorkflowStep[];
  /** Entry points (step IDs) */
  entryPoints: string[];
  /** Global error handling */
  errorHandling: WorkflowErrorHandling;
  /** Variables shared across steps */
  variables: Record<string, WorkflowVariable>;
  /** Trigger configuration */
  triggers: WorkflowTrigger[];
}

export interface WorkflowStep {
  /** Step ID */
  id: string;
  /** Step name */
  name: string;
  /** Description */
  description: string;
  /** Agent to execute this step */
  agentId: string;
  /** Input mapping */
  input: Record<string, string | WorkflowExpression>;
  /** Output mapping */
  output: Record<string, string>;
  /** Dependencies (step IDs that must complete first) */
  dependencies: string[];
  /** Condition to execute this step */
  condition?: WorkflowExpression;
  /** Retry configuration */
  retry: RetryConfig;
  /** Timeout (ms) */
  timeout: number;
  /** Step type */
  type: 'agent' | 'tool' | 'subworkflow' | 'decision' | 'parallel' | 'wait';
  /** For parallel steps: concurrent execution config */
  parallelConfig?: ParallelStepConfig;
  /** For decision steps: branches */
  branches?: WorkflowBranch[];
}

export interface ParallelStepConfig {
  /** Number of concurrent executions */
  concurrency: number;
  /** Aggregation strategy */
  aggregation: 'collect' | 'merge' | 'vote' | 'first' | 'all';
}

export interface WorkflowBranch {
  /** Branch ID */
  id: string;
  /** Branch name */
  name: string;
  /** Condition to take this branch */
  condition: WorkflowExpression;
  /** Next step ID */
  nextStepId: string;
}

export type WorkflowExpression = 
  | string  // Simple expression like "${input.value} > 5"
  | { 
      operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'and' | 'or' | 'not' | 'in' | 'contains';
      left: string | number | boolean | WorkflowExpression;
      right?: string | number | boolean | WorkflowExpression;
    };

export interface WorkflowVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  /** Default value */
  default?: unknown;
  /** Required */
  required: boolean;
  /** Description */
  description?: string;
}

export interface WorkflowErrorHandling {
  /** Default retry count */
  defaultRetries: number;
  /** Default retry delay (ms) */
  retryDelay: number;
  /** On failure: stop, continue, or retry */
  onFailure: 'stop' | 'continue' | 'retry';
  /** Error handler step ID */
  errorHandlerStepId?: string;
  /** Notify on error */
  notifyOnError: boolean;
}

export interface WorkflowTrigger {
  /** Trigger type */
  type: 'schedule' | 'webhook' | 'event' | 'manual';
  /** Cron expression for schedule */
  cron?: string;
  /** Event name for event trigger */
  eventName?: string;
  /** Webhook path */
  webhookPath?: string;
  /** Enabled */
  enabled: boolean;
}

export interface RetryConfig {
  /** Max retry attempts */
  maxAttempts: number;
  /** Delay between retries (ms) */
  delay: number;
  /** Exponential backoff multiplier */
  backoffMultiplier?: number;
  /** Max delay (ms) */
  maxDelay?: number;
  /** Retryable error codes */
  retryableErrors?: string[];
}

// ============================================================================
// Loop Control
// ============================================================================

export interface LoopControlConfig {
  /** Maximum number of iterations */
  maxIterations: number;
  /** Delay between iterations (ms) */
  stepDelay?: number;
  /** Conditions that abort the loop */
  abortConditions?: AbortCondition[];
  /** Whether to continue on error */
  continueOnError?: boolean;
  /** Max consecutive errors before abort */
  maxConsecutiveErrors?: number;
  /** Loop termination strategy */
  terminationStrategy?: 'first-success' | 'all-complete' | 'condition-met' | 'max-iterations';
}

export interface AbortCondition {
  /** Condition type */
  type: 'condition' | 'tool-result' | 'state-value' | 'time-limit' | 'cost-limit';
  /** Expression to evaluate */
  expression?: string;
  /** Tool name for tool-result type */
  toolName?: string;
  /** State key for state-value type */
  stateKey?: string;
  /** Time limit in ms */
  timeLimit?: number;
  /** Cost limit in cents */
  costLimit?: number;
  /** Expected value for comparison */
  expectedValue?: unknown;
  /** Comparison operator */
  operator?: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
}

// ============================================================================
// Call Options (Per-Request Configuration)
// ============================================================================

export interface AgentCallOptions {
  /** Temperature (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Maximum completion tokens */
  maxCompletionTokens?: number;
  /** Top-p sampling */
  topP?: number;
  /** Top-k sampling */
  topK?: number;
  /** Frequency penalty */
  frequencyPenalty?: number;
  /** Presence penalty */
  presencePenalty?: number;
  /** Seed for reproducibility */
  seed?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Tool choice strategy */
  toolChoice?: 'auto' | 'required' | 'none' | { type: 'tool'; toolName: string };
  /** Specific tools to allow for this call */
  allowedTools?: string[];
  /** Response format */
  responseFormat?: 
    | { type: 'text' }
    | { type: 'json'; schema?: Record<string, unknown> }
    | { type: 'structured'; schema: Record<string, unknown> };
  /** Streaming options */
  streaming?: {
    enabled: boolean;
    /** Emit partial tool calls */
    emitToolCalls?: boolean;
    /** Emit reasoning steps */
    emitReasoning?: boolean;
  };
}

// ============================================================================
// Tool Configuration
// ============================================================================

export interface AgentToolConfig {
  /** Tool ID */
  toolId: string;
  /** Tool name */
  name: string;
  /** Custom description override */
  description?: string;
  /** Tool parameters schema */
  parameters?: Record<string, unknown>;
  /** Whether tool is enabled */
  enabled?: boolean;
  /** Execution timeout (ms) */
  timeout?: number;
  /** Retry configuration */
  retry?: RetryConfig;
  /** Cost per call (cents) */
  costPerCall?: number;
  /** Rate limit (calls per minute) */
  rateLimit?: number;
  /** Require confirmation before execution */
  requireConfirmation?: boolean;
  /** Approval workflow ID */
  approvalWorkflowId?: string;
  /** Custom prompt template for this tool */
  promptTemplate?: string;
  /** Transform output before returning to agent */
  outputTransform?: string; // JSONata or JMESPath expression
}

// ============================================================================
// Memory & Context Configuration
// ============================================================================

export interface AgentMemoryConfig {
  /** Memory provider */
  provider: 'local' | 'redis' | 'vector-db' | 'kernel';
  /** Max context window (tokens) */
  maxContextTokens: number;
  /** Context summarization threshold */
  summarizationThreshold?: number;
  /** Number of previous runs to include */
  previousRunsContext?: number;
  /** Persistent memory (long-term) */
  persistentMemory?: boolean;
  /** Working memory (short-term) */
  workingMemory?: boolean;
  /** Memory compression */
  compression?: 'none' | 'light' | 'aggressive';
  /** Include conversation history */
  includeHistory?: boolean;
  /** History window size */
  historyWindow?: number;
}

// ============================================================================
// Advanced Agent Configuration
// ============================================================================

export interface AdvancedAgentConfig {
  /** Agent identification */
  id: string;
  
  /** Subagents this agent can spawn */
  subagents: SubagentConfig[];
  
  /** Swarm membership */
  swarmMemberships: string[];
  
  /** Workflow definitions */
  workflows: AgentWorkflow[];
  
  /** Loop control settings */
  loopControl: LoopControlConfig;
  
  /** Default call options */
  defaultCallOptions: AgentCallOptions;
  
  /** Tool configurations */
  toolConfigs: Record<string, AgentToolConfig>;
  
  /** Memory configuration */
  memory: AgentMemoryConfig;
  
  /** Cost tracking and limits */
  costControl: CostControlConfig;
  
  /** Safety and guardrails */
  safety: SafetyConfig;
  
  /** Observation and debugging */
  observability: ObservabilityConfig;
  
  /** Agent relationships */
  relationships: AgentRelationship[];
}

export interface CostControlConfig {
  /** Track costs */
  trackCosts: boolean;
  /** Max cost per run (cents) */
  maxCostPerRun: number;
  /** Max cost per day (cents) */
  maxCostPerDay: number;
  /** Alert threshold (0-1) */
  alertThreshold: number;
  /** Hard stop on limit */
  hardStopOnLimit: boolean;
  /** Cost model (who pays) */
  costModel: 'user' | 'project' | 'organization';
}

export interface SafetyConfig {
  /** Input validation rules */
  inputValidation?: ValidationRule[];
  /** Output filtering */
  outputFiltering?: boolean;
  /** Blocked patterns */
  blockedPatterns?: string[];
  /** Allowed domains (for web tools) */
  allowedDomains?: string[];
  /** Require human approval for */
  requireApproval?: {
    fileWrite: boolean;
    codeExecution: boolean;
    externalApiCalls: boolean;
    databaseOperations: boolean;
    destructiveOperations: boolean;
  };
  /** Content moderation */
  contentModeration?: boolean;
  /** Sandbox level */
  sandboxLevel: 'none' | 'light' | 'strict' | 'isolated';
}

export interface ValidationRule {
  /** Field to validate */
  field: string;
  /** Validation type */
  type: 'required' | 'pattern' | 'length' | 'range' | 'enum';
  /** Pattern for regex validation */
  pattern?: string;
  /** Min/max for range/length */
  min?: number;
  max?: number;
  /** Allowed values for enum */
  values?: string[];
  /** Error message */
  message: string;
}

export interface ObservabilityConfig {
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Enable tracing */
  tracing: boolean;
  /** Export traces to */
  traceExporter?: 'console' | 'otlp' | 'file';
  /** Enable metrics */
  metrics: boolean;
  /** Enable reasoning visibility */
  showReasoning: boolean;
  /** Enable tool call visibility */
  showToolCalls: boolean;
  /** Store execution artifacts */
  storeArtifacts: boolean;
  /** Real-time event streaming */
  realTimeEvents: boolean;
}

export interface AgentRelationship {
  /** Related agent ID */
  agentId: string;
  /** Relationship type */
  type: 'parent' | 'child' | 'peer' | 'depends-on' | 'delegates-to';
  /** Description */
  description?: string;
  /** Communication protocol */
  protocol: 'direct' | 'message-queue' | 'event-bus';
}

// ============================================================================
// Agent Templates
// ============================================================================

export interface AgentTemplate {
  /** Template ID */
  id: string;
  /** Template name */
  name: string;
  /** Description */
  description: string;
  /** Category */
  category: string;
  /** Tags */
  tags: string[];
  /** Base configuration */
  config: Partial<AdvancedAgentConfig> & Pick<Agent, 'model' | 'provider' | 'capabilities'>;
  /** Required tools */
  requiredTools: string[];
  /** System prompt template */
  systemPromptTemplate: string;
  /** Example inputs/outputs */
  examples: AgentExample[];
  /** Workflow template (if any) */
  workflowTemplate?: Partial<AgentWorkflow>;
  /** Icon/image */
  icon?: string;
}

export interface AgentExample {
  /** Example name */
  name: string;
  /** Input */
  input: string;
  /** Expected output pattern */
  expectedOutput: string;
  /** Context needed */
  context?: Record<string, unknown>;
}

// ============================================================================
// Agent Execution State
// ============================================================================

export interface AdvancedAgentRun extends AgentRun {
  /** Subagent runs spawned during this run */
  subagentRuns: string[];
  /** Swarm run ID (if part of swarm) */
  swarmRunId?: string;
  /** Workflow execution state */
  workflowState?: WorkflowExecutionState;
  /** Loop iteration count */
  loopIterations: number;
  /** Current step ID (for workflows) */
  currentStepId?: string;
  /** Completed step IDs */
  completedSteps: string[];
  /** Execution trace */
  trace: ExecutionTraceEvent[];
  /** Cost tracking */
  cost: RunCost;
  /** Token usage */
  tokenUsage: TokenUsage;
}

export interface WorkflowExecutionState {
  /** Workflow ID */
  workflowId: string;
  /** Variable values */
  variables: Record<string, unknown>;
  /** Step results */
  stepResults: Record<string, unknown>;
  /** Current execution path */
  executionPath: string[];
  /** Pending steps */
  pendingSteps: string[];
  /** Failed steps */
  failedSteps: string[];
}

export interface ExecutionTraceEvent {
  /** Timestamp */
  timestamp: string;
  /** Event type */
  type: 'step-start' | 'step-complete' | 'step-error' | 'tool-call' | 'tool-result' | 'llm-call' | 'llm-response' | 'subagent-spawn' | 'subagent-complete' | 'checkpoint' | 'decision';
  /** Event data */
  data: unknown;
  /** Step ID */
  stepId?: string;
  /** Duration (ms) */
  duration?: number;
}

export interface RunCost {
  /** LLM costs (cents) */
  llmCost: number;
  /** Tool costs (cents) */
  toolCost: number;
  /** Total cost (cents) */
  total: number;
  /** By model breakdown */
  byModel: Record<string, number>;
  /** By tool breakdown */
  byTool: Record<string, number>;
}

export interface TokenUsage {
  /** Prompt tokens */
  prompt: number;
  /** Completion tokens */
  completion: number;
  /** Total tokens */
  total: number;
  /** By model breakdown */
  byModel: Record<string, { prompt: number; completion: number }>;
}

// ============================================================================
// Predefined Templates
// ============================================================================

export const PREDEFINED_AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'software-engineer',
    name: 'Software Engineer',
    description: 'Full-stack developer with code generation, testing, and debugging capabilities',
    category: 'Development',
    tags: ['coding', 'testing', 'debugging'],
    config: {
      model: 'claude-3-5-sonnet',
      provider: 'anthropic',
      capabilities: ['code-generation', 'file-operations', 'terminal'],
      defaultCallOptions: {
        temperature: 0.2,
        maxTokens: 4096,
      },
      memory: {
        provider: 'local',
        maxContextTokens: 128000,
        previousRunsContext: 3,
        persistentMemory: true,
      },
      safety: {
        sandboxLevel: 'strict',
        requireApproval: {
          fileWrite: true,
          codeExecution: true,
          externalApiCalls: true,
          databaseOperations: true,
          destructiveOperations: true,
        },
      },
    },
    requiredTools: ['readDocument', 'editCodeDocument', 'codeExecution'],
    systemPromptTemplate: `You are an expert software engineer. Follow best practices:
- Write clean, maintainable code
- Include error handling
- Add appropriate comments
- Follow the existing code style
- Write tests for new functionality`,
    examples: [
      {
        name: 'Create API endpoint',
        input: 'Create a REST API endpoint for user authentication with JWT',
        expectedOutput: 'Complete implementation with routes, controllers, middleware, and tests',
      },
    ],
  },
  {
    id: 'research-analyst',
    name: 'Research Analyst',
    description: 'Deep research with web search, data analysis, and report generation',
    category: 'Research',
    tags: ['research', 'analysis', 'writing'],
    config: {
      model: 'gpt-4o',
      provider: 'openai',
      capabilities: ['web-search', 'file-operations', 'memory'],
      defaultCallOptions: {
        temperature: 0.3,
      },
      loopControl: {
        maxIterations: 20,
        stepDelay: 1000,
        abortConditions: [
          { type: 'time-limit', timeLimit: 300000 }, // 5 minutes
        ],
      },
    },
    requiredTools: ['webSearch', 'retrieveUrl', 'deepResearch', 'createTextDocument'],
    systemPromptTemplate: `You are a thorough research analyst. When given a topic:
1. Search for current information from multiple sources
2. Analyze and synthesize findings
3. Create structured reports with citations
4. Identify gaps in current knowledge`,
    examples: [],
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Specialized in reviewing code for quality, security, and performance',
    category: 'Development',
    tags: ['review', 'quality', 'security'],
    config: {
      model: 'claude-3-5-sonnet',
      provider: 'anthropic',
      capabilities: ['code-generation', 'file-operations', 'reasoning'],
      defaultCallOptions: {
        temperature: 0.1,
      },
    },
    requiredTools: ['readDocument'],
    systemPromptTemplate: `You are a meticulous code reviewer. Check for:
- Security vulnerabilities
- Performance issues
- Code smells and anti-patterns
- Test coverage
- Documentation completeness
- Adherence to best practices`,
    examples: [],
  },
  {
    id: 'multi-agent-orchestrator',
    name: 'Multi-Agent Orchestrator',
    description: 'Coordinates multiple specialized agents for complex tasks',
    category: 'Orchestration',
    tags: ['orchestration', 'multi-agent', 'swarm'],
    config: {
      model: 'gpt-4o',
      provider: 'openai',
      capabilities: ['planning', 'memory', 'reasoning'],
      subagents: [],
    },
    requiredTools: [],
    systemPromptTemplate: `You are an orchestrator agent. Your job is to:
1. Analyze incoming tasks
2. Break down complex tasks into subtasks
3. Delegate to appropriate specialized subagents
4. Synthesize results from subagents
5. Ensure quality and coherence of final output`,
    examples: [],
  },
];

// ============================================================================
// Swarm Execution
// ============================================================================

export interface SwarmRun {
  /** Run ID */
  id: string;
  /** Swarm ID */
  swarmId: string;
  /** Input */
  input: string;
  /** Status */
  status: 'planning' | 'executing' | 'consensus' | 'completed' | 'failed';
  /** Agent runs */
  agentRuns: string[];
  /** Current round */
  currentRound: number;
  /** Max rounds */
  maxRounds: number;
  /** Consensus reached */
  consensusReached: boolean;
  /** Consensus value */
  consensusValue?: unknown;
  /** Messages between agents */
  messages: SwarmMessage[];
  /** Final output */
  output?: string;
  /** Started at */
  startedAt: string;
  /** Completed at */
  completedAt?: string;
}

export interface SwarmMessage {
  /** Message ID */
  id: string;
  /** Sender agent ID */
  from: string;
  /** Recipient agent IDs (empty = broadcast) */
  to: string[];
  /** Message type */
  type: 'proposal' | 'response' | 'vote' | 'question' | 'answer' | 'consensus';
  /** Message content */
  content: string;
  /** Round number */
  round: number;
  /** Timestamp */
  timestamp: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}
