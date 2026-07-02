import React, { useCallback, useEffect, useMemo, useState } from "react";
import { 
  useNodesState, 
  useEdgesState, 
  addEdge, 
  MarkerType, 
  Connection, 
  Edge, 
  Node,
  useKeyPress,
  OnSelectionChangeParams
} from 'reactflow';
import type { Agent } from '@/lib/agents/agent.types';
import type { 
  SwarmOrchestratorProps, 
  SwarmConfig, 
  ExecutionMode, 
  RoutingConfig, 
  SwarmExecution, 
  AgentNodeData,
  SwarmAgent,
  AgentRole,
  ExecutionMetrics
} from '../types/SwarmOrchestrator.types';
import { validateSwarmConfig } from '../utils/SwarmValidation';
import { MODE_COLORS } from '@/design/allternit.tokens';

export function useSwarmManager(props: SwarmOrchestratorProps) {
  const { 
    initialSwarm, 
    agents, 
    mode = 'chat', 
    executionUpdates, 
    canEdit, 
    onSaveSwarm,
    onExecuteSwarm
  } = props;
  
  const modeColors = MODE_COLORS[mode];

  const [activeTab, setActiveTab] = useState<'design' | 'configure' | 'monitor'>('design');
  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node<AgentNodeData> | null>(null);
  
  const [swarmName, setSwarmName] = useState(initialSwarm?.name || 'New Swarm');
  const [swarmDescription, setSwarmDescription] = useState(initialSwarm?.description || '');
  const [executionMode, setExecutionMode] = useState<ExecutionMode>(initialSwarm?.executionMode || 'adaptive');
  const [routingConfig, setRoutingConfig] = useState<RoutingConfig>(
    initialSwarm?.routing || {
      strategy: 'capabilityBased',
      fallbackBehavior: 'queue',
      maxQueueSize: 100,
      messageTTL: 300,
    }
  );
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [execution, setExecution] = useState<SwarmExecution | null>(null);
  
  const [showMinimap, setShowMinimap] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Keyboard shortcuts
  const deletePressed = useKeyPress('Delete');
  const escapePressed = useKeyPress('Escape');
  const savePressed = useKeyPress(['Meta+s', 'Ctrl+s']);

  // Handle initialSwarm change (Inline adjustment)
  const [prevInitialSwarm, setPrevInitialSwarm] = useState(initialSwarm);
  if (initialSwarm !== prevInitialSwarm) {
    setPrevInitialSwarm(initialSwarm);
    if (initialSwarm) {
      const initialNodes: Node<AgentNodeData>[] = initialSwarm.agents.map((agent) => ({
        id: agent.id,
        type: 'agent',
        position: agent.position,
        data: { ...agent, enabled: agent.enabled ?? true },
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
      setSwarmName(initialSwarm.name);
      setSwarmDescription(initialSwarm.description);
      setExecutionMode(initialSwarm.executionMode);
      setRoutingConfig(initialSwarm.routing);
    }
  }

  // Derive validation errors
  const validationErrors = useMemo(() => {
    const config: SwarmConfig = {
      id: initialSwarm?.id || 'new-swarm',
      name: swarmName,
      description: swarmDescription,
      agents: nodes.map((n) => ({
        ...n.data,
        position: n.position,
        connections: edges.filter((e) => e.source === n.id).map((e) => e.target),
      })),
      routing: routingConfig,
      executionMode,
    };
    return validateSwarmConfig(config, nodes, edges);
  }, [nodes, edges, swarmName, swarmDescription, routingConfig, executionMode, initialSwarm?.id]);

  // Handle execution updates (Inline adjustment)
  const [prevExecutionUpdates, setPrevExecutionUpdates] = useState(executionUpdates);
  if (executionUpdates !== prevExecutionUpdates) {
    setPrevExecutionUpdates(executionUpdates);
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
      }
    }
  }

  const onConnect = useCallback((connection: Connection) => {
    if (!canEdit) return;
    setEdges((eds) => addEdge({
      ...connection,
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      animated: true,
      style: { stroke: modeColors.accent, strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: modeColors.accent },
    }, eds));
  }, [canEdit, modeColors.accent, setEdges]);

  const handleAddAgent = useCallback((agent: Agent, role: AgentRole = 'worker') => {
    if (!canEdit) return;
    const newNode: Node<AgentNodeData> = {
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'agent',
      position: { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 },
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
  }, [canEdit, setNodes]);

  const handleDeleteSelected = useCallback(() => {
    if (!canEdit) return;
    setNodes((nds) => nds.filter((n) => !selectedNodes.includes(n.id)));
    setEdges((eds) => eds.filter((e) => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target)));
    setSelectedNodes([]);
    setSelectedNode(null);
  }, [canEdit, selectedNodes, setEdges, setNodes]);

  const handleSave = useCallback(async () => {
    if (!canEdit || !onSaveSwarm) return;
    setIsSaving(true);
    try {
      const config: SwarmConfig = {
        id: initialSwarm?.id || `swarm-${Date.now()}`,
        name: swarmName,
        description: swarmDescription,
        agents: nodes.map((n) => ({
          ...n.data,
          position: n.position,
          connections: edges.filter((e) => e.source === n.id).map((e) => e.target),
        })),
        routing: routingConfig,
        executionMode,
      };
      await onSaveSwarm(config);
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, onSaveSwarm, initialSwarm?.id, swarmName, swarmDescription, nodes, edges, routingConfig, executionMode]);

  return {
    activeTab, setActiveTab,
    nodes, setNodes, onNodesChange,
    edges, setEdges, onEdgesChange,
    selectedNodes, setSelectedNodes,
    selectedNode, setSelectedNode,
    swarmName, setSwarmName,
    swarmDescription, setSwarmDescription,
    executionMode, setExecutionMode,
    routingConfig, setRoutingConfig,
    isExecuting, setIsExecuting,
    execution, setExecution,
    showMinimap, setShowMinimap,
    showGrid, setShowGrid,
    snapToGrid, setSnapToGrid,
    validationErrors,
    isSaving,
    showValidationPanel, setShowValidationPanel,
    searchQuery, setSearchQuery,
    onConnect,
    handleAddAgent,
    handleDeleteSelected,
    handleSave,
    modeColors,
  };
}
