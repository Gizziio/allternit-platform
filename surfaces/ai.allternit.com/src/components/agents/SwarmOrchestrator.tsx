// @ts-nocheck
'use client';

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Panel,
  ConnectionMode,
  BackgroundVariant,
  useReactFlow,
} from 'reactflow';
import { AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeSlash, 
  ArrowsIn, 
  ArrowsOut, 
  Lock, 
  LockOpen 
} from '@phosphor-icons/react';

import 'reactflow/dist/style.css';

import { 
  type SwarmOrchestratorProps, 
  type AgentNodeData,
  type AgentRole
} from './swarm-orchestrator/types/SwarmOrchestrator.types';
import { useSwarmManager } from './swarm-orchestrator/hooks/useSwarmManager';
import { OrchestratorHeader } from './swarm-orchestrator/components/OrchestratorHeader';
import { AgentPalette } from './swarm-orchestrator/components/AgentPalette';
import { AgentNode } from './swarm-orchestrator/components/AgentNode';
import { NodeConfigPanel } from './swarm-orchestrator/components/NodeConfigPanel';
import { PropertiesPanel } from './swarm-orchestrator/components/PropertiesPanel';
import { ConfigurationPanel } from './swarm-orchestrator/components/ConfigurationPanel';
import { MonitoringPanel } from './swarm-orchestrator/components/MonitoringPanel';
import { ValidationPanel } from './swarm-orchestrator/components/ValidationPanel';
import { TEXT } from '@/design/allternit.tokens';

const nodeTypes = {
  agent: AgentNode,
};

const SwarmOrchestratorInner: React.FC<SwarmOrchestratorProps> = (props) => {
  const { agents, canEdit = true, className } = props;
  const { fitView } = useReactFlow();

  const manager = useSwarmManager(props);
  const {
    activeTab, setActiveTab,
    nodes, setNodes, onNodesChange,
    edges, setEdges, onEdgesChange,
    selectedNodes,
    selectedNode, setSelectedNode,
    swarmName, setSwarmName,
    swarmDescription, setSwarmDescription,
    executionMode, setExecutionMode,
    routingConfig, setRoutingConfig,
    isExecuting,
    execution,
    showMinimap, setShowMinimap,
    showGrid, setShowGrid,
    snapToGrid, setSnapToGrid,
    validationErrors,
    isSaving,
    showValidationPanel, setShowValidationPanel,
    searchQuery, setSearchQuery,
    onConnect,
    handleAddAgent,
    handleSave,
    modeColors,
  } = manager;

  // ReactFlow Handlers
  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedNode(node);
  }, [setSelectedNode]);

  const onSelectionChange = useCallback((params: any) => {
    // handled by react-flow internal state usually, but we keep it for sync if needed
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, updates: any) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n));
  }, [setNodes]);

  const handleDuplicateNode = useCallback((nodeId: string) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    const newNode = {
      ...node,
      id: `agent-${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      data: { ...node.data, id: `agent-${Date.now()}`, name: `${node.data.name} (Copy)` },
      selected: false,
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes, setNodes]);

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${className || ''}`} style={{ background: 'var(--surface-canvas)' }}>
      <OrchestratorHeader
        swarmName={swarmName}
        setSwarmName={setSwarmName}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isExecuting={isExecuting}
        executionStatus={execution?.status}
        onExecute={() => console.log('Execute')}
        onStop={() => console.log('Stop')}
        onSave={handleSave}
        onExport={() => console.log('Export')}
        isSaving={isSaving}
        validationErrors={validationErrors}
        onShowValidation={() => setShowValidationPanel(true)}
        canEdit={canEdit}
        modeColors={modeColors}
      />

      <div className="flex-1 flex overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'design' && (
            <AgentPalette
              agents={agents}
              onAddAgent={handleAddAgent}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              modeColors={modeColors}
            />
          )}
        </AnimatePresence>

        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            connectionMode={ConnectionMode.Loose}
            snapToGrid={snapToGrid}
            snapGrid={[15, 15]}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
          >
            {showGrid && <Background color={modeColors.border} gap={20} size={1} variant={BackgroundVariant.Dots} />}
            <Controls style={{ background: 'var(--surface-panel)', borderColor: modeColors.border }} />
            {showMinimap && (
              <MiniMap
                nodeStrokeColor={modeColors.accent}
                maskColor="rgba(0,0,0,0.8)"
                style={{ background: 'var(--surface-panel)', border: `1px solid ${modeColors.border}` }}
              />
            )}
            <Panel position="top-right" className="m-4">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--shell-overlay-backdrop)] border border-solid border-[var(--ui-border-default)]">
                <ToolbarButton icon={showGrid ? Eye : EyeSlash} active={showGrid} onClick={() => setShowGrid(!showGrid)} tooltip="Toggle Grid" />
                <ToolbarButton icon={showMinimap ? ArrowsIn : ArrowsOut} active={showMinimap} onClick={() => setShowMinimap(!showMinimap)} tooltip="Toggle Minimap" />
                <ToolbarButton icon={snapToGrid ? Lock : LockOpen} active={snapToGrid} onClick={() => setSnapToGrid(!snapToGrid)} tooltip="Snap to Grid" />
                <div className="w-px h-4 mx-1 bg-[var(--ui-border-default)]" />
                <button type="button" onClick={() => fitView({ padding: 0.2 })} className="p-2 text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)]"><ArrowsOut size={16} /></button>
              </div>
            </Panel>
          </ReactFlow>

          <AnimatePresence>
            {selectedNode && activeTab === 'design' && canEdit && (
              <NodeConfigPanel
                node={selectedNode}
                onClose={() => setSelectedNode(null)}
                onUpdate={(updates) => handleUpdateNode(selectedNode.id, updates)}
                onDuplicate={() => handleDuplicateNode(selectedNode.id)}
                onRemove={() => {
                  setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                  setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                  setSelectedNode(null);
                }}
                modeColors={modeColors}
              />
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showValidationPanel && (
              <ValidationPanel errors={validationErrors} onClose={() => setShowValidationPanel(false)} modeColors={modeColors} />
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'design' && (
            <PropertiesPanel
              nodeCount={nodes.length}
              edgeCount={edges.length}
              swarmConfig={{ executionMode, routingStrategy: routingConfig.strategy }}
              modeColors={modeColors}
            />
          )}
        </AnimatePresence>
      </div>

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
          modeColors={modeColors}
        />
      )}

      {activeTab === 'monitor' && (
        <MonitoringPanel
          execution={execution}
          executionHistory={[]}
          nodes={nodes}
          onClose={() => setActiveTab('design')}
          modeColors={modeColors}
        />
      )}
    </div>
  );
};

function ToolbarButton({ icon: Icon, onClick, active, tooltip }: { icon: any; onClick: () => void; active?: boolean; tooltip?: string }) {
  return (
    <button type="button" onClick={onClick} title={tooltip} className={`p-2 rounded transition-all ${active ? 'bg-white/10' : ''}`} style={{ color: active ? '#fff' : TEXT.secondary }}>
      <Icon size={16} />
    </button>
  );
}

export const SwarmOrchestrator: React.FC<SwarmOrchestratorProps> = (props) => (
  <ReactFlowProvider>
    <SwarmOrchestratorInner {...props} />
  </ReactFlowProvider>
);

export default SwarmOrchestrator;
