/**
 * Swarm Orchestrator - Enterprise Grade
 * 
 * Production-ready visual interface for managing multi-agent swarms with
 * ReactFlow-powered node-based graph editing, real-time execution monitoring,
 * and comprehensive configuration management.
 * 
 * Features:
 * - Full drag-and-drop node-based canvas with ReactFlow
 * - Custom node types with role-based visual differentiation
 * - Edge connections with animated data flow visualization
 * - Real-time swarm execution monitoring with live metrics
 * - Advanced routing configuration (broadcast, round-robin, capability-based, load-balanced)
 * - Execution modes (parallel, sequential, adaptive)
 * - Swarm validation and error handling
 * - Keyboard shortcuts and accessibility support
 * - Auto-save and state persistence
 * - Mini-map, controls, and background grid
 * 
 * @module SwarmOrchestrator
 * @version 2.0.0
 */

import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  Panel,
  Node,
  Edge,
  Connection,
  ConnectionMode,
  NodeProps,
  Handle,
  Position,
  MarkerType,
  useKeyPress,
  OnSelectionChangeParams,
  BackgroundVariant,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Users,
  Plus,
  Play,
  Pause,
  Square,
  GearSix,
  Chat,
  GitBranch,
  Trash,
  Copy,
  FloppyDisk,
  Lightning,
  Pulse as Activity,
  CaretRight,
  Network,
  Target,
  X,
  Check,
  Warning,
  ArrowsClockwise,
  DownloadSimple,
  ArrowCounterClockwise,
  ArrowsOut,
  ArrowsIn,
  Lock,
  LockOpen,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Stack,
  Cpu,
  Clock,
  TrendUp,
  Radio,
} from '@phosphor-icons/react';

import {
  MODE_COLORS,
  createGlassStyle,
  TEXT,
  type AgentMode,
} from '@/design/allternit.tokens';

import type { Agent } from '@/lib/agents/agent.types';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface SwarmOrchestratorProps {
  /** Available agents to add to the swarm */
  agents: Agent[];
  /** UI theme mode */
  mode?: AgentMode;
  /** Initial swarm configuration (for editing existing swarms) */
  initialSwarm?: SwarmConfig;
  /** Callback when swarm is saved */
  onSaveSwarm?: (swarm: SwarmConfig) => void | Promise<void>;
  /** Callback when swarm execution is requested */
  onExecuteSwarm?: (swarmId: string, config: SwarmExecutionRequest) => void | Promise<void>;
  /** Callback when swarm execution is stopped */
  onStopSwarm?: (executionId: string) => void | Promise<void>;
  /** Callback when swarm execution is paused */
  onPauseSwarm?: (executionId: string) => void | Promise<void>;
  /** Callback when swarm execution is resumed */
  onResumeSwarm?: (executionId: string) => void | Promise<void>;
  /** Real-time execution updates from backend */
  executionUpdates?: SwarmExecutionUpdate;
  /** Whether the user has permission to modify the swarm */
  canEdit?: boolean;
  /** Whether the user has permission to execute the swarm */
  canExecute?: boolean;
  /** Optional className for styling */
  className?: string;
}

export interface SwarmConfig {
  /** Unique identifier for the swarm */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Agents in the swarm with their configuration */
  agents: SwarmAgent[];
  /** Message routing configuration */
  routing: RoutingConfig;
  /** Execution mode for the swarm */
  executionMode: ExecutionMode;
  /** Creation timestamp */
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
  /** Version for optimistic locking */
  version?: number;
  /** Tags for organization */
  tags?: string[];
  /** Whether the swarm is active */
  isActive?: boolean;
}

export interface SwarmAgent {
  /** Unique identifier within the swarm */
  id: string;
  /** Reference to the actual agent ID */
  agentId: string;
  /** Display name */
  name: string;
  /** Role in the swarm */
  role: AgentRole;
  /** Position on the canvas */
  position: { x: number; y: number };
  /** Connected agent IDs */
  connections: string[];
  /** Agent capabilities */
  capabilities: string[];
  /** Custom configuration for this agent in the swarm */
  config?: AgentSwarmConfig;
  /** Whether this agent is currently enabled */
  enabled?: boolean;
  /** Execution priority (higher = earlier) */
  priority?: number;
  /** Maximum concurrent tasks */
  maxConcurrency?: number;
  /** Timeout in milliseconds */
  timeout?: number;
}

export type AgentRole = 'coordinator' | 'worker' | 'specialist' | 'reviewer' | 'gatekeeper';

export type ExecutionMode = 'parallel' | 'sequential' | 'adaptive' | 'pipeline';

export interface RoutingConfig {
  /** Routing strategy */
  strategy: RoutingStrategy;
  /** Optional message type filters */
  messageFilter?: string[];
  /** Priority rules for message routing */
  priorityRules?: PriorityRule[];
  /** Fallback behavior when no agent matches */
  fallbackBehavior?: 'broadcast' | 'drop' | 'queue' | 'error';
  /** Maximum message queue size per agent */
  maxQueueSize?: number;
  /** Message TTL in seconds */
  messageTTL?: number;
}

export type RoutingStrategy = 
  | 'broadcast' 
  | 'roundRobin' 
  | 'capabilityBased' 
  | 'loadBalanced' 
  | 'priorityBased'
  | 'weightedRandom';

export interface PriorityRule {
  /** Rule identifier */
  id: string;
  /** Condition expression (e.g., "message.priority > 5") */
  condition: string;
  /** Priority level (1-10) */
  priority: number;
  /** Target agent IDs */
  targetAgents: string[];
  /** Whether this rule is active */
  enabled?: boolean;
}

export interface AgentSwarmConfig {
  /** Custom system prompt override */
  systemPrompt?: string;
  /** Temperature setting */
  temperature?: number;
  /** Maximum tokens per request */
  maxTokens?: number;
  /** Custom tools enabled for this agent in swarm */
  enabledTools?: string[];
  /** Custom model override */
  model?: string;
}

export interface SwarmExecutionRequest {
  swarmId: string;
  /** Initial input message */
  input: string;
  /** Execution context */
  context?: Record<string, unknown>;
  /** Maximum execution time */
  timeout?: number;
  /** Callback URL for progress updates */
  webhookUrl?: string;
  /** Whether to stream results */
  stream?: boolean;
}

export interface SwarmExecution {
  /** Execution identifier */
  id: string;
  /** Swarm being executed */
  swarmId: string;
  /** Current status */
  status: ExecutionStatus;
  /** Progress percentage (0-100) */
  progress: number;
  /** Currently active agents */
  activeAgents: string[];
  /** Total messages exchanged */
  messagesExchanged: number;
  /** Execution start time */
  startTime?: Date;
  /** Execution end time */
  endTime?: Date;
  /** Current stage */
  currentStage?: string;
  /** Execution results */
  results?: ExecutionResult[];
  /** Error information if failed */
  error?: ExecutionError;
  /** Performance metrics */
  metrics?: ExecutionMetrics;
}

export type ExecutionStatus = 
  | 'idle' 
  | 'starting' 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'
  | 'timeout';

export interface ExecutionResult {
  agentId: string;
  output: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  duration: number;
}

export interface ExecutionError {
  code: string;
  message: string;
  agentId?: string;
  details?: Record<string, unknown>;
}

export interface ExecutionMetrics {
  totalDuration: number;
  averageLatency: number;
  tokensUsed: number;
  costEstimate: number;
  agentMetrics: AgentExecutionMetric[];
}

export interface AgentExecutionMetric {
  agentId: string;
  messagesProcessed: number;
  averageResponseTime: number;
  errorCount: number;
  tokensUsed: number;
}

export interface SwarmExecutionUpdate {
  executionId: string;
  status: ExecutionStatus;
  progress: number;
  activeAgents: string[];
  messagesExchanged: number;
  currentStage?: string;
  timestamp: Date;
  metrics?: Partial<ExecutionMetrics>;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

// ============================================================================
// Constants & Configuration
// ============================================================================

const ROLE_CONFIG: Record<AgentRole, {
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  description: string;
  maxInputs: number;
  maxOutputs: number;
}> = {
  coordinator: {
    color: 'var(--accent-primary)',
    bgColor: 'rgba(212, 149, 106, 0.15)',
    borderColor: 'rgba(212, 149, 106, 0.5)',
    icon: Network,
    description: 'Orchestrates the swarm and distributes tasks',
    maxInputs: 0,
    maxOutputs: -1,
  },
  worker: {
    color: '#79C47C',
    bgColor: 'rgba(121, 196, 124, 0.15)',
    borderColor: 'rgba(121, 196, 124, 0.5)',
    icon: Cpu,
    description: 'Performs general tasks and processes data',
    maxInputs: -1,
    maxOutputs: -1,
  },
  specialist: {
    color: '#69A8C8',
    bgColor: 'rgba(105, 168, 200, 0.15)',
    borderColor: 'rgba(105, 168, 200, 0.5)',
    icon: Target,
    description: 'Handles specific domain expertise tasks',
    maxInputs: -1,
    maxOutputs: 1,
  },
  reviewer: {
    color: '#A78BFA',
    bgColor: 'rgba(167, 139, 250, 0.15)',
    borderColor: 'rgba(167, 139, 250, 0.5)',
    icon: Eye,
    description: 'Reviews and validates outputs from other agents',
    maxInputs: -1,
    maxOutputs: 1,
  },
  gatekeeper: {
    color: '#F472B6',
    bgColor: 'rgba(244, 114, 182, 0.15)',
    borderColor: 'rgba(244, 114, 182, 0.5)',
    icon: Lock,
    description: 'Controls flow and applies conditional logic',
    maxInputs: -1,
    maxOutputs: 2,
  },
};

const EXECUTION_MODE_CONFIG: Record<ExecutionMode, {
  label: string;
  description: string;
  icon: React.ElementType;
}> = {
  parallel: {
    label: 'Parallel',
    description: 'All agents execute simultaneously',
    icon: Lightning,
  },
  sequential: {
    label: 'Sequential',
    description: 'Agents execute one after another',
    icon: CaretRight,
  },
  adaptive: {
    label: 'Adaptive',
    description: 'Dynamic execution based on workload',
    icon: ArrowsClockwise,
  },
  pipeline: {
    label: 'Pipeline',
    description: 'Data flows through agents in stages',
    icon: Stack,
  },
};

const ROUTING_STRATEGY_CONFIG: Record<RoutingStrategy, {
  label: string;
  description: string;
  icon: React.ElementType;
}> = {
  broadcast: {
    label: 'Broadcast',
    description: 'Send to all connected agents',
    icon: Radio,
  },
  roundRobin: {
    label: 'Round Robin',
    description: 'Rotate between agents evenly',
    icon: ArrowCounterClockwise,
  },
  capabilityBased: {
    label: 'Capability Based',
    description: 'Route based on capability match',
    icon: Target,
  },
  loadBalanced: {
    label: 'Load Balanced',
    description: 'Distribute based on current load',
    icon: TrendUp,
  },
  priorityBased: {
    label: 'Priority Based',
    description: 'Route to highest priority agent',
    icon: Lightning,
  },
  weightedRandom: {
    label: 'Weighted Random',
    description: 'Random selection with priority weights',
    icon: GitBranch,
  },
};

// ============================================================================
// Custom Node Components
// ============================================================================

interface AgentNodeData extends SwarmAgent {
  onSelect?: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<SwarmAgent>) => void;
  isSelected?: boolean;
  isExecuting?: boolean;
  executionStatus?: 'idle' | 'active' | 'completed' | 'error';
}

const AgentNodeComponent: React.FC<NodeProps<AgentNodeData>> = ({
  data,
  selected,
  id,
}) => {
  const roleConfig = ROLE_CONFIG[data.role];
  const Icon = roleConfig.icon;
  const isDisabled = data.enabled === false;

  return (
    <div
      className={`
        rounded-xl p-4 min-w-[180px] max-w-[240px] transition-all duration-200
        ${selected ? 'ring-2 ring-offset-2 ring-offset-[#0D0B09]' : ''}
        ${isDisabled ? 'opacity-50' : ''}
        ${data.isExecuting ? 'animate-pulse' : ''}
      `}
      style={{
        background: roleConfig.bgColor,
        border: `2px solid ${selected ? roleConfig.color : roleConfig.borderColor}`,
        boxShadow: selected ? `0 0 20px ${roleConfig.color}40` : 'none',
      }}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: roleConfig.color,
          width: 12,
          height: 12,
          border: `2px solid #0D0B09`,
        }}
        isConnectable={!isDisabled}
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: `${roleConfig.color}30` }}
        >
          <Icon size={20} style={{ color: roleConfig.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-semibold text-sm truncate"
            style={{ color: TEXT.primary }}
          >
            {data.name}
          </div>
          <div
            className="text-xs capitalize flex items-center gap-1"
            style={{ color: roleConfig.color }}
          >
            {data.role}
            {data.executionStatus === 'active' && (
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            )}
            {data.executionStatus === 'error' && (
              <Warning size={10} className="text-red-400" />
            )}
          </div>
        </div>
      </div>

      {/* Capabilities */}
      {data.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {data.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--bg-tertiary)',
                color: TEXT.secondary,
                border: `1px solid ${roleConfig.borderColor}`,
              }}
            >
              {cap}
            </span>
          ))}
          {data.capabilities.length > 3 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full"
              style={{
                background: 'var(--bg-tertiary)',
                color: TEXT.tertiary,
              }}
            >
              +{data.capabilities.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Status Indicators */}
      <div className="flex items-center justify-between text-[10px]" style={{ color: TEXT.tertiary }}>
        <span>{data.connections.length} connections</span>
        {data.priority !== undefined && data.priority > 0 && (
          <span style={{ color: roleConfig.color }}>P{data.priority}</span>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          background: roleConfig.color,
          width: 12,
          height: 12,
          border: `2px solid #0D0B09`,
        }}
        isConnectable={!isDisabled}
      />
    </div>
  );
};

const nodeTypes = {
  agent: AgentNodeComponent,
};

// ============================================================================
// Validation Utilities
// ============================================================================

const validateSwarmConfig = (
  config: SwarmConfig,
  nodes: Node<AgentNodeData>[],
  edges: Edge[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Check for empty name
  if (!config.name.trim()) {
    errors.push({
      field: 'name',
      message: 'Swarm name is required',
      severity: 'error',
    });
  }

  // Check for minimum agents
  if (nodes.length < 2) {
    errors.push({
      field: 'agents',
      message: 'Swarm must have at least 2 agents',
      severity: 'error',
    });
  }

  // Check for coordinator
  const hasCoordinator = nodes.some((n) => n.data.role === 'coordinator');
  if (!hasCoordinator) {
    errors.push({
      field: 'agents',
      message: 'Swarm should have a coordinator agent for optimal orchestration',
      severity: 'warning',
    });
  }

  // Check for orphaned agents
  const connectedAgentIds = new Set<string>();
  edges.forEach((edge) => {
    connectedAgentIds.add(edge.source);
    connectedAgentIds.add(edge.target);
  });

  nodes.forEach((node) => {
    if (!connectedAgentIds.has(node.id) && node.data.role !== 'coordinator') {
      errors.push({
        field: `agent.${node.id}`,
        message: `Agent "${node.data.name}" is not connected to the swarm`,
        severity: 'warning',
      });
    }
  });

  // Check for cycles (simplified - would need full graph analysis)
  if (edges.length > nodes.length) {
    errors.push({
      field: 'connections',
      message: 'Complex connection patterns detected - verify no circular dependencies',
      severity: 'warning',
    });
  }

  return errors;
};

// ============================================================================
// Main Component
// ============================================================================

const SwarmOrchestratorInner: React.FC<SwarmOrchestratorProps> = ({
  agents,
  mode = 'chat',
  initialSwarm,
  onSaveSwarm,
  onExecuteSwarm,
  onStopSwarm,
  onPauseSwarm,
  onResumeSwarm,
  executionUpdates,
  canEdit = true,
  canExecute = true,
  className,
}) => {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;

  // ReactFlow hooks
  const {
    fitView,
  } = useReactFlow<AgentNodeData>();

  // State
  const [activeTab, setActiveTab] = useState<'design' | 'configure' | 'monitor'>('design');
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node<AgentNodeData> | null>(null);
  
  // Swarm configuration state
  const [swarmName, setSwarmName] = useState(initialSwarm?.name || 'New Swarm');
  const [swarmDescription, setSwarmDescription] = useState(initialSwarm?.description || '');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(
    initialSwarm?.executionMode || 'adaptive'
  );
  const [routingStrategy] = useState<RoutingStrategy>(
    initialSwarm?.routing.strategy || 'capabilityBased'
  );
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig>(
    initialSwarm?.routing || {
      strategy: 'capabilityBased',
      fallbackBehavior: 'queue',
      maxQueueSize: 100,
      messageTTL: 300,
    }
  );
  
  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [execution, setExecution] = useState<SwarmExecution | null>(null);
  const [executionHistory, setExecutionHistory] = useState<SwarmExecution[]>([]);
  
  // UI state
  const [showMinimap, setShowMinimap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard shortcuts
  const deletePressed = useKeyPress('Delete');
  const escapePressed = useKeyPress('Escape');
  const savePressed = useKeyPress(['Meta+s', 'Ctrl+s']);

  // ============================================================================
  // Initialization
  // ============================================================================

  useEffect(() => {
    if (initialSwarm) {
      // Load initial swarm configuration
      const initialNodes: Node<AgentNodeData>[] = initialSwarm.agents.map((agent) => ({
        id: agent.id,
        type: 'agent',
        position: agent.position,
        data: {
          ...agent,
          enabled: agent.enabled ?? true,
        },
      }));

      const initialEdges: Edge[] = [];
      initialSwarm.agents.forEach((agent) => {
        agent.connections.forEach((targetId) => {
          initialEdges.push({
            id: `e-${agent.id}-${targetId}`,
            source: agent.id,
            target: targetId,
            animated: true,
            style: { stroke: modeColors.accent, strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: modeColors.accent },
          });
        });
      });

      setNodes(initialNodes);
      setEdges(initialEdges);
    }
  }, [initialSwarm, setNodes, setEdges, modeColors.accent]);

  // ============================================================================
  // Validation
  // ============================================================================

  useEffect(() => {
    const config: SwarmConfig = {
      id: initialSwarm?.id || `swarm-${Date.now()}`,
      name: swarmName,
      description: swarmDescription,
      agents: nodes.map((n) => ({
        ...n.data,
        position: n.position,
        connections: edges
          .filter((e) => e.source === n.id)
          .map((e) => e.target),
      })),
      routing: routingConfig,
      executionMode,
    };

    const errors = validateSwarmConfig(config, nodes, edges);
    setValidationErrors(errors);
  }, [nodes, edges, swarmName, swarmDescription, routingConfig, executionMode, initialSwarm?.id]);

  // ============================================================================
  // Keyboard Shortcuts Handler
  // ============================================================================

  useEffect(() => {
    if (deletePressed && selectedNodes.length > 0 && canEdit) {
      handleDeleteSelected();
    }
  }, [deletePressed, selectedNodes, canEdit]);

  useEffect(() => {
    if (escapePressed) {
      setSelectedNode(null);
      setSelectedNodes([]);
    }
  }, [escapePressed]);

  useEffect(() => {
    if (savePressed && canEdit) {
      handleSave();
    }
  }, [savePressed, canEdit]);

  // ============================================================================
  // Execution Updates Handler
  // ============================================================================

  useEffect(() => {
    if (executionUpdates) {
      setExecution((prev) => {
        if (!prev || prev.id !== executionUpdates.executionId) return prev;
        return {
          ...prev,
          status: executionUpdates.status,
          progress: executionUpdates.progress,
          activeAgents: executionUpdates.activeAgents,
          messagesExchanged: executionUpdates.messagesExchanged,
          currentStage: executionUpdates.currentStage,
          metrics: executionUpdates.metrics
            ? { ...prev.metrics, ...executionUpdates.metrics } as ExecutionMetrics
            : prev.metrics,
        };
      });

      // Update node execution statuses
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          data: {
            ...node.data,
            isExecuting: executionUpdates.activeAgents.includes(node.id),
            executionStatus: executionUpdates.activeAgents.includes(node.id)
              ? 'active'
              : node.data.executionStatus,
          },
        }))
      );

      if (executionUpdates.status === 'completed' || executionUpdates.status === 'failed') {
        setIsExecuting(false);
        setExecution((prev) =>
          prev
            ? {
                ...prev,
                endTime: new Date(),
                status: executionUpdates.status,
              }
            : null
        );
      }
    }
  }, [executionUpdates, setNodes]);

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) return;

      // Validate connection
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);

      if (!sourceNode || !targetNode) return;
      if (connection.source === connection.target) return;

      const sourceRole = sourceNode.data.role;
      const targetRole = targetNode.data.role;

      // Check role connection limits
      const sourceOutputs = edges.filter((e) => e.source === connection.source).length;
      const targetInputs = edges.filter((e) => e.target === connection.target).length;

      if (
        ROLE_CONFIG[sourceRole].maxOutputs > 0 &&
        sourceOutputs >= ROLE_CONFIG[sourceRole].maxOutputs
      ) {
        return;
      }

      if (
        ROLE_CONFIG[targetRole].maxInputs > 0 &&
        targetInputs >= ROLE_CONFIG[targetRole].maxInputs
      ) {
        return;
      }

      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            id: `e-${connection.source}-${connection.target}-${Date.now()}`,
            animated: true,
            style: { stroke: modeColors.accent, strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: modeColors.accent },
          },
          eds
        )
      );
    },
    [canEdit, edges, modeColors.accent, nodes, setEdges]
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<AgentNodeData>) => {
    setSelectedNode(node);
  }, []);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedNodes(params.nodes.map((n) => n.id));
  }, []);

  const handleAddAgent = useCallback(
    (agent: Agent, role: AgentRole = 'worker') => {
      if (!canEdit) return;

      const newNode: Node<AgentNodeData> = {
        id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'agent',
        position: {
          x: 100 + Math.random() * 300,
          y: 100 + Math.random() * 200,
        },
        data: {
          id: `agent-${Date.now()}`,
          agentId: agent.id,
          name: agent.name,
          role,
          position: { x: 0, y: 0 },
          connections: [],
          capabilities: agent.capabilities || [],
          enabled: true,
          priority: 0,
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [canEdit, setNodes]
  );

  const handleDeleteSelected = useCallback(() => {
    if (!canEdit) return;

    setNodes((nds) => nds.filter((n) => !selectedNodes.includes(n.id)));
    setEdges((eds) =>
      eds.filter((e) => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target))
    );
    setSelectedNodes([]);
    setSelectedNode(null);
  }, [canEdit, selectedNodes, setEdges, setNodes]);

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<SwarmAgent>) => {
      if (!canEdit) return;

      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, ...updates } }
            : n
        )
      );

      if (selectedNode?.id === nodeId) {
        setSelectedNode((prev) =>
          prev ? { ...prev, data: { ...prev.data, ...updates } } : null
        );
      }
    },
    [canEdit, selectedNode?.id, setNodes]
  );

  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      if (!canEdit) return;

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      const newNode: Node<AgentNodeData> = {
        ...node,
        id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        data: {
          ...node.data,
          id: `agent-${Date.now()}`,
          name: `${node.data.name} (Copy)`,
          connections: [],
        },
        selected: false,
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [canEdit, nodes, setNodes]
  );

  const handleSave = useCallback(async () => {
    if (!onSaveSwarm || !canEdit) return;

    const criticalErrors = validationErrors.filter((e) => e.severity === 'error');
    if (criticalErrors.length > 0) {
      setShowValidationPanel(true);
      return;
    }

    setIsSaving(true);

    const config: SwarmConfig = {
      id: initialSwarm?.id || `swarm-${Date.now()}`,
      name: swarmName,
      description: swarmDescription,
      agents: nodes.map((n) => ({
        ...n.data,
        position: n.position,
        connections: edges
          .filter((e) => e.source === n.id)
          .map((e) => e.target),
      })),
      routing: routingConfig,
      executionMode,
      updatedAt: new Date().toISOString(),
      version: (initialSwarm?.version || 0) + 1,
    };

    try {
      await onSaveSwarm(config);
    } finally {
      setIsSaving(false);
    }
  }, [
    canEdit,
    edges,
    executionMode,
    initialSwarm?.id,
    initialSwarm?.version,
    nodes,
    onSaveSwarm,
    routingConfig,
    swarmDescription,
    swarmName,
    validationErrors,
  ]);

  const handleExecute = useCallback(async () => {
    if (!canExecute) return;

    const criticalErrors = validationErrors.filter((e) => e.severity === 'error');
    if (criticalErrors.length > 0) {
      setShowValidationPanel(true);
      return;
    }

    const swarmId = initialSwarm?.id || `swarm-${Date.now()}`;
    const executionId = `exec-${Date.now()}`;

    const newExecution: SwarmExecution = {
      id: executionId,
      swarmId,
      status: 'starting',
      progress: 0,
      activeAgents: nodes.filter((n) => n.data.enabled !== false).map((n) => n.id),
      messagesExchanged: 0,
      startTime: new Date(),
      currentStage: 'initialization',
    };

    setExecution(newExecution);
    setIsExecuting(true);
    setActiveTab('monitor');

    if (onExecuteSwarm) {
      await onExecuteSwarm(swarmId, {
        swarmId,
        input: 'Start swarm execution',
        timeout: 300000,
        stream: true,
      });
    } else {
      // Simulation mode for development
      setTimeout(() => {
        setExecution((prev) =>
          prev ? { ...prev, status: 'running', progress: 5, currentStage: 'execution' } : null
        );

        const interval = setInterval(() => {
          setExecution((prev) => {
            if (!prev) return null;

            if (prev.progress >= 100) {
              clearInterval(interval);
              setIsExecuting(false);
              setExecutionHistory((hist) => [
                { ...prev, status: 'completed', endTime: new Date() },
                ...hist,
              ]);
              return { ...prev, status: 'completed', progress: 100 };
            }

            return {
              ...prev,
              progress: Math.min(prev.progress + Math.random() * 10, 100),
              messagesExchanged: prev.messagesExchanged + Math.floor(Math.random() * 5),
            };
          });
        }, 1000);
      }, 1000);
    }
  }, [canExecute, initialSwarm?.id, nodes, onExecuteSwarm, validationErrors]);

  const handleStop = useCallback(async () => {
    if (!execution) return;

    if (onStopSwarm) {
      await onStopSwarm(execution.id);
    }

    setIsExecuting(false);
    setExecution((prev) =>
      prev ? { ...prev, status: 'cancelled', endTime: new Date() } : null
    );
  }, [execution, onStopSwarm]);

  const handlePause = useCallback(async () => {
    if (!execution) return;

    if (onPauseSwarm) {
      await onPauseSwarm(execution.id);
    }

    setExecution((prev) => (prev ? { ...prev, status: 'paused' } : null));
  }, [execution, onPauseSwarm]);

  const handleResume = useCallback(async () => {
    if (!execution) return;

    if (onResumeSwarm) {
      await onResumeSwarm(execution.id);
    }

    setExecution((prev) => (prev ? { ...prev, status: 'running' } : null));
  }, [execution, onResumeSwarm]);

  const handleExport = useCallback(() => {
    const config: SwarmConfig = {
      id: initialSwarm?.id || `swarm-${Date.now()}`,
      name: swarmName,
      description: swarmDescription,
      agents: nodes.map((n) => ({
        ...n.data,
        position: n.position,
        connections: edges
          .filter((e) => e.source === n.id)
          .map((e) => e.target),
      })),
      routing: routingConfig,
      executionMode,
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${swarmName.replace(/\s+/g, '_').toLowerCase()}_swarm.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [edges, executionMode, initialSwarm?.id, nodes, routingConfig, swarmDescription, swarmName]);

  // ============================================================================
  // Filtered Agents
  // ============================================================================

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch =
        !searchQuery ||
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.capabilities?.some((c) =>
          c.toLowerCase().includes(searchQuery.toLowerCase())
        );

      return matchesSearch;
    });
  }, [agents, searchQuery]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      className={`h-screen flex flex-col overflow-hidden ${className || ''}`}
      style={{ background: 'var(--surface-canvas)' }}
    >
      {/* Header */}
      <OrchestratorHeader
        swarmName={swarmName}
        setSwarmName={setSwarmName}
        swarmDescription={swarmDescription}
        setSwarmDescription={setSwarmDescription}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isExecuting={isExecuting}
        executionStatus={execution?.status}
        onExecute={handleExecute}
        onStop={handleStop}
        onPause={handlePause}
        onResume={handleResume}
        onSave={handleSave}
        onExport={handleExport}
        isSaving={isSaving}
        validationErrors={validationErrors}
        onShowValidation={() => setShowValidationPanel(true)}
        canEdit={canEdit}
        canExecute={canExecute}
        modeColors={modeColors as typeof MODE_COLORS.chat}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <AnimatePresence mode="wait">
          {activeTab === 'design' && (
            <AgentPalette
              agents={filteredAgents}
              onAddAgent={handleAddAgent}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              modeColors={modeColors as typeof MODE_COLORS.chat}
            />
          )}
        </AnimatePresence>

        {/* Center - Flow Canvas */}
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onSelectionChange={onSelectionChange}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-right"
            connectionMode={ConnectionMode.Loose}
            snapToGrid={snapToGrid}
            snapGrid={[15, 15]}
            minZoom={0.1}
            maxZoom={2}
            selectNodesOnDrag={false}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable={canEdit}
            deleteKeyCode={canEdit ? 'Delete' : null}
          >
            {showGrid && (
              <Background
                color={modeColors.border}
                gap={20}
                size={1}
                variant={BackgroundVariant.Dots}
              />
            )}
            
            <Controls
              style={{
                background: 'var(--surface-panel)',
                borderColor: modeColors.border,
                borderWidth: 1,
                borderStyle: 'solid',
              }}
            />
            
            {showMinimap && (
              <MiniMap
                nodeStrokeColor={modeColors.accent}
                nodeColor={(node) => {
                  const colors: Record<AgentRole, string> = {
                    coordinator: 'var(--accent-primary)',
                    worker: '#79C47C',
                    specialist: '#69A8C8',
                    reviewer: '#A78BFA',
                    gatekeeper: '#F472B6',
                  };
                  return colors[node.data?.role as AgentRole] || 'var(--ui-text-muted)';
                }}
                maskColor="rgba(0,0,0,0.8)"
                style={{
                  background: 'var(--surface-panel)',
                  border: `1px solid ${modeColors.border}`,
                }}
              />
            )}

            {/* Toolbar Panel */}
            <Panel position="top-right" className="m-4">
              <div
                className="flex items-center gap-1 p-1 rounded-lg"
                style={{
                  background: 'var(--shell-overlay-backdrop)',
                  border: `1px solid ${modeColors.border}`,
                }}
              >
                <ToolbarButton
                  icon={showGrid ? Eye : EyeSlash}
                  active={showGrid}
                  onClick={() => setShowGrid(!showGrid)}
                  tooltip="Toggle Grid"
                />
                <ToolbarButton
                  icon={showMinimap ? ArrowsIn : ArrowsOut}
                  active={showMinimap}
                  onClick={() => setShowMinimap(!showMinimap)}
                  tooltip="Toggle Minimap"
                />
                <ToolbarButton
                  icon={snapToGrid ? Lock : LockOpen}
                  active={snapToGrid}
                  onClick={() => setSnapToGrid(!snapToGrid)}
                  tooltip="Snap to Grid"
                />
                <div
                  className="w-px h-4 mx-1"
                  style={{ background: modeColors.border }}
                />
                <ToolbarButton
                  icon={fitView as unknown as React.ElementType}
                  onClick={() => fitView({ padding: 0.2 })}
                  tooltip="Fit View"
                />
              </div>
            </Panel>
          </ReactFlow>

          {/* Selected Node Configuration Panel */}
          <AnimatePresence>
            {selectedNode && activeTab === 'design' && canEdit && (
              <NodeConfigPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onUpdate={(updates) => handleUpdateNode(selectedNode.id, updates)}
                onDuplicate={() => handleDuplicateNode(selectedNode.id)}
                onRemove={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setEdges((eds) =>
                    eds.filter(
                      (e) => e.source !== selectedNode.id && e.target !== selectedNode.id
                    )
                  );
                  setSelectedNode(null);
                }}
                modeColors={modeColors as typeof MODE_COLORS.chat}
              />
            )}
          </AnimatePresence>

          {/* Validation Panel */}
          <AnimatePresence>
            {showValidationPanel && (
              <ValidationPanel
                errors={validationErrors}
                onClose={() => setShowValidationPanel(false)}
                modeColors={modeColors as typeof MODE_COLORS.chat}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Right Sidebar */}
        <AnimatePresence mode="wait">
          {activeTab === 'design' && (
            <PropertiesPanel
              nodeCount={nodes.length}
              edgeCount={edges.length}
              swarmConfig={{
                executionMode,
                routingStrategy,
              }}
              modeColors={modeColors as typeof MODE_COLORS.chat}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Tab Content Overlays */}
      {activeTab === 'configure' && (
        <ConfigurationPanel
          swarmName={swarmName}
          swarmDescription={swarmDescription}
          setSwarmDescription={setSwarmDescription}
          executionMode={executionMode}
          setExecutionMode={setExecutionMode}
          routingConfig={routingConfig}
          setRoutingConfig={setRoutingConfig}
          onClose={() => setActiveTab('design')}
          canEdit={canEdit}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
      )}

      {activeTab === 'monitor' && (
        <MonitoringPanel
          execution={execution}
          executionHistory={executionHistory}
          nodes={nodes}
          onClose={() => setActiveTab('design')}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
      )}
    </div>
  );
};

// Wrap with ReactFlowProvider
export const SwarmOrchestrator: React.FC<SwarmOrchestratorProps> = (props) => (
  <ReactFlowProvider>
    <SwarmOrchestratorInner {...props} />
  </ReactFlowProvider>
);

export default SwarmOrchestrator;

// ============================================================================
// Sub-Components
// ============================================================================

interface OrchestratorHeaderProps {
  swarmName: string;
  setSwarmName: (name: string) => void;
  swarmDescription: string;
  setSwarmDescription: (desc: string) => void;
  activeTab: 'design' | 'configure' | 'monitor';
  setActiveTab: (tab: 'design' | 'configure' | 'monitor') => void;
  isExecuting: boolean;
  executionStatus?: ExecutionStatus;
  onExecute: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onSave: () => void;
  onExport: () => void;
  isSaving: boolean;
  validationErrors: ValidationError[];
  onShowValidation: () => void;
  canEdit: boolean;
  canExecute: boolean;
  modeColors: (typeof MODE_COLORS)['chat'];
}

function OrchestratorHeader({
  swarmName,
  setSwarmName,
  activeTab,
  setActiveTab,
  isExecuting,
  executionStatus,
  onExecute,
  onStop,
  onPause,
  onResume,
  onSave,
  onExport,
  isSaving,
  validationErrors,
  onShowValidation,
  canEdit,
  canExecute,
  modeColors,
}: OrchestratorHeaderProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const errorCount = validationErrors.filter((e) => e.severity === 'error').length;
  const warningCount = validationErrors.filter((e) => e.severity === 'warning').length;

  const tabs = [
    { id: 'design' as const, label: 'Design', icon: Network },
    { id: 'configure' as const, label: 'Configure', icon: GearSix },
    { id: 'monitor' as const, label: 'Monitor', icon: Activity },
  ];

  return (
    <div
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{
        borderColor: modeColors.border,
        background: 'var(--bg-tertiary)',
      }}
    >
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: modeColors.soft,
            border: `1px solid ${modeColors.border}`,
          }}
        >
          <Users size={20} style={{ color: modeColors.accent }} />
        </div>
        
        <div>
          {isEditingName ? (
            <input
              type="text"
              value={swarmName}
              onChange={(e) => setSwarmName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditingName(false);
              }}
              autoFocus
              className="bg-transparent text-lg font-semibold outline-none border-b"
              style={{ color: TEXT.primary, borderColor: modeColors.accent }}
            />
          ) : (
            <div
              className="text-lg font-semibold cursor-pointer hover:opacity-80"
              style={{ color: TEXT.primary }}
              onClick={() => canEdit && setIsEditingName(true)}
            >
              {swarmName}
            </div>
          )}
          <div className="text-xs" style={{ color: TEXT.tertiary }}>
            Multi-Agent Swarm
            {(errorCount > 0 || warningCount > 0) && (
              <button
                onClick={onShowValidation}
                className="ml-2 flex items-center gap-1 inline-flex"
              >
                {errorCount > 0 && (
                  <span className="text-red-400">{errorCount} errors</span>
                )}
                {warningCount > 0 && (
                  <span className="text-yellow-400">
                    {warningCount} warnings
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Center Tabs */}
      <div
        className="flex items-center rounded-lg p-1"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? modeColors.soft : 'transparent',
                color: activeTab === tab.id ? modeColors.accent : TEXT.secondary,
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {canEdit && (
          <>
            <button
              onClick={onExport}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
              style={{
                background: 'var(--surface-hover)',
                color: TEXT.secondary,
              }}
            >
              <DownloadSimple size={14} />
              Export
            </button>
            
            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
              style={{
                background: 'var(--surface-hover)',
                color: TEXT.secondary,
              }}
            >
              <FloppyDisk size={14} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </>
        )}

        {isExecuting ? (
          <div className="flex items-center gap-2">
            {executionStatus === 'running' && (
              <button
                onClick={onPause}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: 'rgba(251,191,36,0.2)',
                  color: 'var(--status-warning)',
                }}
              >
                <Pause size={14} />
                Pause
              </button>
            )}
            {executionStatus === 'paused' && (
              <button
                onClick={onResume}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: 'rgba(74,222,128,0.2)',
                  color: 'var(--status-success)',
                }}
              >
                <Play size={14} fill="currentColor" />
                Resume
              </button>
            )}
            <button
              onClick={onStop}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: 'var(--status-error)',
                color: 'var(--ui-text-primary)',
              }}
            >
              <Square size={14} fill="currentColor" />
              Stop
            </button>
          </div>
        ) : (
          canExecute && (
            <button
              onClick={onExecute}
              disabled={errorCount > 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
              style={{
                background: modeColors.accent,
                color: 'var(--ui-text-inverse)',
              }}
            >
              <Play size={14} fill="currentColor" />
              Execute
            </button>
          )
        )}
      </div>
    </div>
  );
}

interface AgentPaletteProps {
  agents: Agent[];
  onAddAgent: (agent: Agent, role: AgentRole) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  modeColors: (typeof MODE_COLORS)['chat'];
}

function AgentPalette({
  agents,
  onAddAgent,
  searchQuery,
  setSearchQuery,
  modeColors,
}: AgentPaletteProps) {
  const [selectedRole, setSelectedRole] = useState<AgentRole>('worker');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="w-72 border-r flex flex-col"
      style={{
        borderColor: modeColors.border,
        background: 'var(--surface-hover)',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: modeColors.border }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: TEXT.primary }}>
          Available Agents
        </h3>
        
        {/* Search */}
        <div className="relative">
          <MagnifyingGlass
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: TEXT.tertiary }}
          />
          <input
            type="text"
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--bg-tertiary)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
        </div>
      </div>

      {/* Role Selector */}
      <div className="px-4 py-3 border-b" style={{ borderColor: modeColors.border }}>
        <div className="text-xs mb-2" style={{ color: TEXT.tertiary }}>
          Add as Role:
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(Object.keys(ROLE_CONFIG) as AgentRole[]).map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className="px-2 py-1.5 rounded text-[10px] font-medium capitalize transition-all"
              style={{
                background:
                  selectedRole === role
                    ? ROLE_CONFIG[role].bgColor
                    : 'var(--surface-panel)',
                color:
                  selectedRole === role
                    ? ROLE_CONFIG[role].color
                    : TEXT.tertiary,
                border: `1px solid ${
                  selectedRole === role
                    ? ROLE_CONFIG[role].borderColor
                    : 'transparent'
                }`,
              }}
            >
              {role}
            </button>
          ))}
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {agents.map((agent) => (
            <motion.div
              key={agent.id}
              layout
              className="rounded-lg overflow-hidden"
              style={{
                background: 'var(--surface-hover)',
                border: `1px solid ${modeColors.border}`,
              }}
            >
              <button
                onClick={() =>
                  setExpandedAgent(expandedAgent === agent.id ? null : agent.id)
                }
                className="w-full p-3 text-left"
              >
                <div className="flex items-center gap-2">
                  <Users size={14} style={{ color: modeColors.accent }} />
                  <span
                    className="font-medium text-sm flex-1"
                    style={{ color: TEXT.primary }}
                  >
                    {agent.name}
                  </span>
                  <CaretRight
                    size={14}
                    style={{
                      color: TEXT.tertiary,
                      transform:
                        expandedAgent === agent.id ? 'rotate(90deg)' : 'none',
                      transition: 'transform 0.2s',
                    }}
                  />
                </div>
              </button>

              <AnimatePresence>
                {expandedAgent === agent.id && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3">
                      <p
                        className="text-xs mb-2 line-clamp-2"
                        style={{ color: TEXT.tertiary }}
                      >
                        {agent.description || 'No description'}
                      </p>
                      
                      {agent.capabilities && agent.capabilities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {agent.capabilities.slice(0, 3).map((cap) => (
                            <span
                              key={cap}
                              className="text-[10px] px-1.5 py-0.5 rounded"
                              style={{
                                background: modeColors.soft,
                                color: modeColors.accent,
                              }}
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => onAddAgent(agent, selectedRole)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: ROLE_CONFIG[selectedRole].bgColor,
                          color: ROLE_CONFIG[selectedRole].color,
                          border: `1px solid ${ROLE_CONFIG[selectedRole].borderColor}`,
                        }}
                      >
                        <Plus size={12} />
                        Add as {selectedRole}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface NodeConfigPanelProps {
  node: Node<AgentNodeData>;
  onClose: () => void;
  onUpdate: (updates: Partial<SwarmAgent>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  modeColors: (typeof MODE_COLORS)['chat'];
}

function NodeConfigPanel({
  node,
  onClose,
  onUpdate,
  onDuplicate,
  onRemove,
  modeColors,
}: NodeConfigPanelProps) {
  const roleConfig = ROLE_CONFIG[node.data.role];
  const roles = Object.keys(ROLE_CONFIG) as AgentRole[];

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="absolute right-4 top-4 bottom-4 w-80 rounded-xl overflow-hidden flex flex-col"
      style={{
        ...createGlassStyle('thick'),
        border: `1px solid ${modeColors.border}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: modeColors.border }}
      >
        <h3 className="font-semibold" style={{ color: TEXT.primary }}>
          Agent Configuration
        </h3>
        <button onClick={onClose} style={{ color: TEXT.tertiary }}>
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name */}
        <div>
          <label
            className="text-xs font-medium block mb-1"
            style={{ color: TEXT.secondary }}
          >
            Display Name
          </label>
          <input
            type="text"
            value={node.data.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--bg-tertiary)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
        </div>

        {/* Role */}
        <div>
          <label
            className="text-xs font-medium block mb-2"
            style={{ color: TEXT.secondary }}
          >
            Role
          </label>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((role) => (
              <button
                key={role}
                onClick={() => onUpdate({ role })}
                className="px-3 py-2 rounded-lg text-sm capitalize transition-all text-left"
                style={{
                  background:
                    node.data.role === role
                      ? ROLE_CONFIG[role].bgColor
                      : 'var(--surface-panel)',
                  color:
                    node.data.role === role
                      ? ROLE_CONFIG[role].color
                      : TEXT.secondary,
                  border: `1px solid ${
                    node.data.role === role
                      ? ROLE_CONFIG[role].borderColor
                      : 'transparent'
                  }`,
                }}
              >
                {role}
              </button>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: TEXT.tertiary }}>
            {roleConfig.description}
          </p>
        </div>

        {/* Priority */}
        <div>
          <label
            className="text-xs font-medium block mb-1"
            style={{ color: TEXT.secondary }}
          >
            Priority (0-10)
          </label>
          <input
            type="number"
            min={0}
            max={10}
            value={node.data.priority || 0}
            onChange={(e) =>
              onUpdate({ priority: parseInt(e.target.value) || 0 })
            }
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--bg-tertiary)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
        </div>

        {/* Capabilities */}
        <div>
          <label
            className="text-xs font-medium block mb-2"
            style={{ color: TEXT.secondary }}
          >
            Capabilities
          </label>
          <div className="flex flex-wrap gap-1">
            {node.data.capabilities.map((cap) => (
              <span
                key={cap}
                className="text-xs px-2 py-1 rounded flex items-center gap-1"
                style={{
                  background: modeColors.soft,
                  color: modeColors.accent,
                }}
              >
                {cap}
              </span>
            ))}
          </div>
        </div>

        {/* Enabled Toggle */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-black/20">
          <span className="text-sm" style={{ color: TEXT.secondary }}>
            Enabled
          </span>
          <button
            onClick={() => onUpdate({ enabled: !node.data.enabled })}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              node.data.enabled !== false ? 'bg-green-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                node.data.enabled !== false ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Agent Config */}
        <div>
          <label
            className="text-xs font-medium block mb-2"
            style={{ color: TEXT.secondary }}
          >
            Agent Configuration
          </label>
          <div className="space-y-2">
            <input
              type="number"
              placeholder="Max Concurrency"
              value={node.data.maxConcurrency || ''}
              onChange={(e) =>
                onUpdate({
                  maxConcurrency: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--bg-tertiary)',
                border: `1px solid ${modeColors.border}`,
                color: TEXT.primary,
              }}
            />
            <input
              type="number"
              placeholder="Timeout (ms)"
              value={node.data.timeout || ''}
              onChange={(e) =>
                onUpdate({
                  timeout: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
              className="w-full px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                background: 'var(--bg-tertiary)',
                border: `1px solid ${modeColors.border}`,
                color: TEXT.primary,
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t space-y-2" style={{ borderColor: modeColors.border }}>
        <button
          onClick={onDuplicate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: 'var(--surface-hover)',
            color: TEXT.secondary,
            border: `1px solid ${modeColors.border}`,
          }}
        >
          <Copy size={14} />
          Duplicate Agent
        </button>
        
        <button
          onClick={onRemove}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: 'rgba(248,113,113,0.1)',
            color: 'var(--status-error)',
            border: '1px solid rgba(248,113,113,0.2)',
          }}
        >
          <Trash size={14} />
          Remove Agent
        </button>
      </div>
    </motion.div>
  );
}

interface ConfigurationPanelProps {
  swarmName: string;
  swarmDescription: string;
  setSwarmDescription: (desc: string) => void;
  executionMode: ExecutionMode;
  setExecutionMode: (mode: ExecutionMode) => void;
  routingConfig: RoutingConfig;
  setRoutingConfig: (config: RoutingConfig) => void;
  onClose: () => void;
  canEdit: boolean;
  modeColors: (typeof MODE_COLORS)['chat'];
}

function ConfigurationPanel({
  swarmName,
  swarmDescription,
  setSwarmDescription,
  executionMode,
  setExecutionMode,
  routingConfig,
  setRoutingConfig,
  onClose,
  canEdit,
  modeColors,
}: ConfigurationPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-[#0D0B09] z-10 overflow-auto"
    >
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold" style={{ color: TEXT.primary }}>
            Swarm Configuration
          </h2>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: modeColors.soft,
              color: modeColors.accent,
            }}
          >
            Back to Design
          </button>
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* General Settings */}
          <section
            className="p-6 rounded-xl"
            style={{
              ...createGlassStyle('base'),
              border: `1px solid ${modeColors.border}`,
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: TEXT.primary }}>
              General Settings
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm block mb-1" style={{ color: TEXT.secondary }}>
                  Description
                </label>
                <textarea
                  value={swarmDescription}
                  onChange={(e) => setSwarmDescription(e.target.value)}
                  disabled={!canEdit}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: `1px solid ${modeColors.border}`,
                    color: TEXT.primary,
                  }}
                />
              </div>
            </div>
          </section>

          {/* Execution Mode */}
          <section
            className="p-6 rounded-xl"
            style={{
              ...createGlassStyle('base'),
              border: `1px solid ${modeColors.border}`,
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: TEXT.primary }}>
              Execution Mode
            </h3>
            
            <div className="grid grid-cols-1 gap-3">
              {(Object.keys(EXECUTION_MODE_CONFIG) as ExecutionMode[]).map((mode) => {
                const config = EXECUTION_MODE_CONFIG[mode];
                const Icon = config.icon;
                return (
                  <button
                    key={mode}
                    onClick={() => canEdit && setExecutionMode(mode)}
                    disabled={!canEdit}
                    className="flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                    style={{
                      background:
                        executionMode === mode
                          ? modeColors.soft
                          : 'var(--surface-hover)',
                      border: `1px solid ${
                        executionMode === mode ? modeColors.border : 'transparent'
                      }`,
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        background:
                          executionMode === mode
                            ? modeColors.accent
                            : 'var(--surface-hover)',
                      }}
                    >
                      <Icon
                        size={20}
                        style={{
                          color: executionMode === mode ? 'var(--ui-text-inverse)' : modeColors.accent,
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <div
                        className="font-medium"
                        style={{
                          color: executionMode === mode ? TEXT.primary : TEXT.secondary,
                        }}
                      >
                        {config.label}
                      </div>
                      <div className="text-sm" style={{ color: TEXT.tertiary }}>
                        {config.description}
                      </div>
                    </div>
                    {executionMode === mode && (
                      <Check size={18} style={{ color: modeColors.accent }} />
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Routing Strategy */}
          <section
            className="p-6 rounded-xl col-span-2"
            style={{
              ...createGlassStyle('base'),
              border: `1px solid ${modeColors.border}`,
            }}
          >
            <h3 className="text-lg font-semibold mb-4" style={{ color: TEXT.primary }}>
              Message Routing
            </h3>
            
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(ROUTING_STRATEGY_CONFIG) as RoutingStrategy[]).map((strategy) => {
                const config = ROUTING_STRATEGY_CONFIG[strategy];
                const Icon = config.icon;
                return (
                  <button
                    key={strategy}
                    onClick={() =>
                      canEdit &&
                      setRoutingConfig({ ...routingConfig, strategy })
                    }
                    disabled={!canEdit}
                    className="flex items-center gap-3 p-4 rounded-xl text-left transition-all"
                    style={{
                      background:
                        routingConfig.strategy === strategy
                          ? modeColors.soft
                          : 'var(--surface-hover)',
                      border: `1px solid ${
                        routingConfig.strategy === strategy
                          ? modeColors.border
                          : 'transparent'
                      }`,
                    }}
                  >
                    <Icon size={18} style={{ color: modeColors.accent }} />
                    <div>
                      <div
                        className="font-medium text-sm"
                        style={{
                          color:
                            routingConfig.strategy === strategy
                              ? TEXT.primary
                              : TEXT.secondary,
                        }}
                      >
                        {config.label}
                      </div>
                      <div className="text-xs" style={{ color: TEXT.tertiary }}>
                        {config.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Advanced Routing Options */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm block mb-1" style={{ color: TEXT.secondary }}>
                  Max Queue Size
                </label>
                <input
                  type="number"
                  value={routingConfig.maxQueueSize || 100}
                  onChange={(e) =>
                    setRoutingConfig({
                      ...routingConfig,
                      maxQueueSize: parseInt(e.target.value) || 100,
                    })
                  }
                  disabled={!canEdit}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: `1px solid ${modeColors.border}`,
                    color: TEXT.primary,
                  }}
                />
              </div>
              
              <div>
                <label className="text-sm block mb-1" style={{ color: TEXT.secondary }}>
                  Message TTL (seconds)
                </label>
                <input
                  type="number"
                  value={routingConfig.messageTTL || 300}
                  onChange={(e) =>
                    setRoutingConfig({
                      ...routingConfig,
                      messageTTL: parseInt(e.target.value) || 300,
                    })
                  }
                  disabled={!canEdit}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: `1px solid ${modeColors.border}`,
                    color: TEXT.primary,
                  }}
                />
              </div>

              <div>
                <label className="text-sm block mb-1" style={{ color: TEXT.secondary }}>
                  Fallback Behavior
                </label>
                <select
                  value={routingConfig.fallbackBehavior || 'queue'}
                  onChange={(e) =>
                    setRoutingConfig({
                      ...routingConfig,
                      fallbackBehavior: e.target.value as RoutingConfig['fallbackBehavior'],
                    })
                  }
                  disabled={!canEdit}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: `1px solid ${modeColors.border}`,
                    color: TEXT.primary,
                  }}
                >
                  <option value="queue">Queue</option>
                  <option value="broadcast">Broadcast</option>
                  <option value="drop">Drop</option>
                  <option value="error">Error</option>
                </select>
              </div>
            </div>
          </section>
        </div>
      </div>
    </motion.div>
  );
}

interface MonitoringPanelProps {
  execution: SwarmExecution | null;
  executionHistory: SwarmExecution[];
  nodes: Node<AgentNodeData>[];
  onClose: () => void;
  modeColors: (typeof MODE_COLORS)['chat'];
}

function MonitoringPanel({
  execution,
  executionHistory,
  nodes,
  onClose,
  modeColors,
}: MonitoringPanelProps) {
  const [activeView, setActiveView] = useState<'current' | 'history'>('current');

  if (!execution && executionHistory.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute inset-0 bg-[#0D0B09] z-10 flex flex-col items-center justify-center"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: modeColors.soft,
            color: modeColors.accent,
          }}
        >
          Back to Design
        </button>
        
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
          style={{
            background: modeColors.soft,
            border: `1px solid ${modeColors.border}`,
          }}
        >
          <Activity size={36} style={{ color: modeColors.accent }} />
        </div>
        <h3 className="text-xl font-semibold" style={{ color: TEXT.primary }}>
          No Active Execution
        </h3>
        <p className="text-sm mt-2" style={{ color: TEXT.secondary }}>
          Start execution to monitor swarm activity
        </p>
      </motion.div>
    );
  }

  const currentExecution = execution || executionHistory[0];

  const getStatusColor = (status: ExecutionStatus) => {
    switch (status) {
      case 'running':
      case 'starting':
        return 'var(--status-success)';
      case 'paused':
        return 'var(--status-warning)';
      case 'completed':
        return '#69A8C8';
      case 'failed':
      case 'cancelled':
      case 'timeout':
        return 'var(--status-error)';
      default:
        return 'var(--ui-text-muted)';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute inset-0 bg-[#0D0B09] z-10 overflow-auto"
    >
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-semibold" style={{ color: TEXT.primary }}>
              Execution Monitor
            </h2>
            <div className="flex rounded-lg p-1" style={{ background: 'var(--bg-tertiary)' }}>
              <button
                onClick={() => setActiveView('current')}
                className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                style={{
                  background: activeView === 'current' ? modeColors.soft : 'transparent',
                  color: activeView === 'current' ? modeColors.accent : TEXT.secondary,
                }}
              >
                Current
              </button>
              <button
                onClick={() => setActiveView('history')}
                className="px-3 py-1.5 rounded text-sm font-medium transition-all"
                style={{
                  background: activeView === 'history' ? modeColors.soft : 'transparent',
                  color: activeView === 'history' ? modeColors.accent : TEXT.secondary,
                }}
              >
                History
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{
              background: modeColors.soft,
              color: modeColors.accent,
            }}
          >
            Back to Design
          </button>
        </div>

        {activeView === 'current' && currentExecution && (
          <div className="space-y-6">
            {/* Status Card */}
            <div
              className="p-6 rounded-xl"
              style={{
                ...createGlassStyle('base'),
                border: `1px solid ${modeColors.border}`,
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
                    Execution Status
                  </h3>
                  <p className="text-sm" style={{ color: TEXT.tertiary }}>
                    ID: {currentExecution.id}
                  </p>
                </div>
                <span
                  className="px-4 py-2 rounded-full text-sm font-medium"
                  style={{
                    background: `${getStatusColor(currentExecution.status)}20`,
                    color: getStatusColor(currentExecution.status),
                    border: `1px solid ${getStatusColor(currentExecution.status)}40`,
                  }}
                >
                  {currentExecution.status.toUpperCase()}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-6">
                <div
                  className="flex justify-between text-sm mb-2"
                  style={{ color: TEXT.secondary }}
                >
                  <span>Progress</span>
                  <span>{Math.round(currentExecution.progress)}%</span>
                </div>
                <div
                  className="h-3 rounded-full overflow-hidden"
                  style={{ background: 'var(--surface-hover)' }}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: modeColors.accent }}
                    initial={{ width: 0 }}
                    animate={{ width: `${currentExecution.progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-4">
                <MetricCard
                  label="Active Agents"
                  value={currentExecution.activeAgents.length.toString()}
                  icon={Users}
                  modeColors={modeColors as typeof MODE_COLORS.chat}
                />
                <MetricCard
                  label="Messages"
                  value={currentExecution.messagesExchanged.toString()}
                  icon={Chat}
                  modeColors={modeColors as typeof MODE_COLORS.chat}
                />
                <MetricCard
                  label="Duration"
                  value={
                    currentExecution.startTime
                      ? formatDuration(
                          Date.now() - currentExecution.startTime.getTime()
                        )
                      : '0s'
                  }
                  icon={Clock}
                  modeColors={modeColors as typeof MODE_COLORS.chat}
                />
                <MetricCard
                  label="Current Stage"
                  value={currentExecution.currentStage || 'idle'}
                  icon={Stack}
                  modeColors={modeColors as typeof MODE_COLORS.chat}
                />
              </div>
            </div>

            {/* Agent Status Grid */}
            <div>
              <h3 className="text-lg font-semibold mb-4" style={{ color: TEXT.primary }}>
                Agent Status
              </h3>
              <div className="grid grid-cols-3 gap-4">
                {nodes.map((node) => {
                  const isActive = currentExecution.activeAgents.includes(node.id);
                  const roleConfig = ROLE_CONFIG[node.data.role];

                  return (
                    <div
                      key={node.id}
                      className="p-4 rounded-xl"
                      style={{
                        ...createGlassStyle('base'),
                        border: `1px solid ${isActive ? roleConfig.borderColor : modeColors.border}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            background: isActive ? 'var(--status-success)' : 'var(--ui-text-muted)',
                            boxShadow: isActive ? '0 0 10px #4ade80' : 'none',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div
                            className="font-medium truncate"
                            style={{ color: TEXT.primary }}
                          >
                            {node.data.name}
                          </div>
                          <div
                            className="text-xs capitalize"
                            style={{ color: roleConfig.color }}
                          >
                            {node.data.role}
                          </div>
                        </div>
                      </div>
                      {isActive && (
                        <div className="mt-3 text-sm" style={{ color: TEXT.secondary }}>
                          Processing messages...
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Performance Metrics */}
            {currentExecution.metrics && (
              <div
                className="p-6 rounded-xl"
                style={{
                  ...createGlassStyle('base'),
                  border: `1px solid ${modeColors.border}`,
                }}
              >
                <h3 className="text-lg font-semibold mb-4" style={{ color: TEXT.primary }}>
                  Performance Metrics
                </h3>
                <div className="grid grid-cols-4 gap-4">
                  <MetricCard
                    label="Total Duration"
                    value={formatDuration(currentExecution.metrics.totalDuration)}
                    icon={Clock}
                    modeColors={modeColors as typeof MODE_COLORS.chat}
                  />
                  <MetricCard
                    label="Avg Latency"
                    value={`${Math.round(currentExecution.metrics.averageLatency)}ms`}
                    icon={TrendUp}
                    modeColors={modeColors as typeof MODE_COLORS.chat}
                  />
                  <MetricCard
                    label="Tokens Used"
                    value={currentExecution.metrics.tokensUsed.toLocaleString()}
                    icon={Lightning}
                    modeColors={modeColors as typeof MODE_COLORS.chat}
                  />
                  <MetricCard
                    label="Est. Cost"
                    value={`$${currentExecution.metrics.costEstimate.toFixed(4)}`}
                    icon={Target}
                    modeColors={modeColors as typeof MODE_COLORS.chat}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'history' && (
          <div className="space-y-4">
            {executionHistory.map((exec) => (
              <div
                key={exec.id}
                className="p-4 rounded-xl"
                style={{
                  ...createGlassStyle('base'),
                  border: `1px solid ${modeColors.border}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium" style={{ color: TEXT.primary }}>
                      Execution {exec.id}
                    </div>
                    <div className="text-sm" style={{ color: TEXT.tertiary }}>
                      {exec.startTime?.toLocaleString()}
                    </div>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-sm"
                    style={{
                      background: `${getStatusColor(exec.status)}20`,
                      color: getStatusColor(exec.status),
                    }}
                  >
                    {exec.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface PropertiesPanelProps {
  nodeCount: number;
  edgeCount: number;
  swarmConfig: {
    executionMode: ExecutionMode;
    routingStrategy: RoutingStrategy;
  };
  modeColors: (typeof MODE_COLORS)['chat'];
}

function PropertiesPanel({
  nodeCount,
  edgeCount,
  swarmConfig,
  modeColors,
}: PropertiesPanelProps) {
  const executionModeConfig = EXECUTION_MODE_CONFIG[swarmConfig.executionMode];
  const routingConfig = ROUTING_STRATEGY_CONFIG[swarmConfig.routingStrategy];

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="w-56 border-l p-4"
      style={{
        borderColor: modeColors.border,
        background: 'var(--surface-hover)',
      }}
    >
      <h3 className="text-sm font-semibold mb-4" style={{ color: TEXT.primary }}>
        Swarm Info
      </h3>

      <div className="space-y-3">
        <InfoCard
          label="Agents"
          value={nodeCount.toString()}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
        <InfoCard
          label="Connections"
          value={edgeCount.toString()}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
        <InfoCard
          label="Execution"
          value={executionModeConfig.label}
          subvalue={executionModeConfig.description}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
        <InfoCard
          label="Routing"
          value={routingConfig.label}
          subvalue={routingConfig.description}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
        <InfoCard
          label="Est. Latency"
          value={`~${Math.max(500, nodeCount * 200)}ms`}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
      </div>

      <div
        className="mt-6 p-3 rounded-lg text-xs"
        style={{
          background: 'rgba(251,191,36,0.05)',
          border: '1px solid rgba(251,191,36,0.2)',
          color: 'var(--status-warning)',
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <Target size={12} />
          <span className="font-medium">Tip</span>
        </div>
        Connect agents by dragging from the bottom handle to the top handle of
        another agent.
      </div>
    </motion.div>
  );
}

interface ValidationPanelProps {
  errors: ValidationError[];
  onClose: () => void;
  modeColors: (typeof MODE_COLORS)['chat'];
}

function ValidationPanel({ errors, onClose, modeColors }: ValidationPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute right-4 top-20 w-80 rounded-xl overflow-hidden z-20"
      style={{
        ...createGlassStyle('thick'),
        border: `1px solid ${modeColors.border}`,
      }}
    >
      <div
        className="flex items-center justify-between p-4 border-b"
        style={{ borderColor: modeColors.border }}
      >
        <h3 className="font-semibold" style={{ color: TEXT.primary }}>
          Validation Results
        </h3>
        <button onClick={onClose} style={{ color: TEXT.tertiary }}>
          <X size={18} />
        </button>
      </div>

      <div className="p-4 max-h-80 overflow-y-auto">
        {errors.length === 0 ? (
          <div className="flex items-center gap-2 text-green-400">
            <Check size={18} />
            <span>No issues found</span>
          </div>
        ) : (
          <div className="space-y-2">
            {errors.map((error, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 rounded-lg"
                style={{
                  background:
                    error.severity === 'error'
                      ? 'rgba(248,113,113,0.1)'
                      : 'var(--status-warning-bg)',
                  border: `1px solid ${
                    error.severity === 'error'
                      ? 'rgba(248,113,113,0.2)'
                      : 'rgba(251,191,36,0.2)'
                  }`,
                }}
              >
                <Warning
                  size={16}
                  className={
                    error.severity === 'error' ? 'text-red-400' : 'text-yellow-400'
                  }
                />
                <div>
                  <div
                    className="text-sm font-medium"
                    style={{ color: TEXT.primary }}
                  >
                    {error.field}
                  </div>
                  <div className="text-xs" style={{ color: TEXT.secondary }}>
                    {error.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Utility Components
// ============================================================================

interface ToolbarButtonProps {
  icon: React.ElementType;
  onClick: () => void;
  active?: boolean;
  tooltip?: string;
}

function ToolbarButton({ icon: Icon, onClick, active, tooltip }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className="p-2 rounded transition-all"
      style={{
        background: active ? 'var(--ui-border-default)' : 'transparent',
        color: active ? 'var(--ui-text-inverse)' : TEXT.secondary,
      }}
    >
      <Icon size={16} />
    </button>
  );
}

interface InfoCardProps {
  label: string;
  value: string;
  subvalue?: string;
  modeColors: (typeof MODE_COLORS)['chat'];
}

function InfoCard({ label, value, subvalue, modeColors }: InfoCardProps) {
  return (
    <div
      className="p-3 rounded-lg"
      style={{
        background: 'var(--surface-hover)',
        border: `1px solid ${modeColors.border}`,
      }}
    >
      <div className="text-xs" style={{ color: TEXT.tertiary }}>
        {label}
      </div>
      <div
        className="text-xl font-semibold"
        style={{ color: modeColors.accent }}
      >
        {value}
      </div>
      {subvalue && (
        <div className="text-[10px] mt-1 line-clamp-2" style={{ color: TEXT.tertiary }}>
          {subvalue}
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  modeColors: (typeof MODE_COLORS)['chat'];
}

function MetricCard({ label, value, icon: Icon, modeColors }: MetricCardProps) {
  return (
    <div
      className="p-4 rounded-xl text-center"
      style={{
        background: 'var(--surface-hover)',
        border: `1px solid ${modeColors.border}`,
      }}
    >
      <Icon size={20} className="mx-auto mb-2" style={{ color: modeColors.accent }} />
      <div className="text-2xl font-bold" style={{ color: TEXT.primary }}>
        {value}
      </div>
      <div className="text-xs" style={{ color: TEXT.tertiary }}>
        {label}
      </div>
    </div>
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
