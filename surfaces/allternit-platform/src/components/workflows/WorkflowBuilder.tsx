'use client';

import React, { useState, useCallback } from 'react';
import { Workflow, WorkflowNode, WorkflowEdge } from '@/lib/workflows/store';
import { PLUGINS, PluginId } from '@/lib/plugins';
import { useWorkflow } from '@/hooks/useWorkflow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Play, Plus, Trash2, Save, Settings, 
  ArrowRight, GitBranch, Zap, MousePointer2 
} from 'lucide-react';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface NodeTypeConfig {
  type: WorkflowNode['type'];
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const NODE_TYPES: NodeTypeConfig[] = [
  { 
    type: 'trigger', 
    label: 'Trigger', 
    icon: <Zap className="w-4 h-4" />, 
    color: 'amber',
    description: 'Start the workflow'
  },
  { 
    type: 'mode', 
    label: 'Agent Mode', 
    icon: <Settings className="w-4 h-4" />, 
    color: 'violet',
    description: 'Execute an agent mode'
  },
  { 
    type: 'condition', 
    label: 'Condition', 
    icon: <GitBranch className="w-4 h-4" />, 
    color: 'blue',
    description: 'Branch based on condition'
  },
  { 
    type: 'action', 
    label: 'Action', 
    icon: <MousePointer2 className="w-4 h-4" />, 
    color: 'emerald',
    description: 'Perform an action'
  },
  { 
    type: 'output', 
    label: 'Output', 
    icon: <ArrowRight className="w-4 h-4" />, 
    color: 'rose',
    description: 'End with output'
  },
];

const PLUGIN_OPTIONS = Object.entries(PLUGINS).map(([id, config]) => ({
  id: id as PluginId,
  name: config.id.charAt(0).toUpperCase() + config.id.slice(1),
}));

interface WorkflowCanvasNode extends WorkflowNode {
  position: { x: number; y: number };
}

interface WorkflowCanvasProps {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowEdge[];
  selectedNode: string | null;
  onSelectNode: (id: string | null) => void;
  onMoveNode: (id: string, x: number, y: number) => void;
}

function WorkflowCanvas({ nodes, edges, selectedNode, onSelectNode, onMoveNode }: WorkflowCanvasProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    setDragging(nodeId);
    setDragOffset({
      x: e.clientX - node.position.x,
      y: e.clientY - node.position.y,
    });
    onSelectNode(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    onMoveNode(dragging, e.clientX - dragOffset.x, e.clientY - dragOffset.y);
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  const getNodeColor = (type: WorkflowNode['type']) => {
    const colors: Record<string, string> = {
      trigger: 'border-amber-500 bg-amber-500/20',
      mode: 'border-violet-500 bg-violet-500/20',
      condition: 'border-blue-500 bg-blue-500/20',
      action: 'border-emerald-500 bg-emerald-500/20',
      output: 'border-rose-500 bg-rose-500/20',
    };
    return colors[type] || 'border-zinc-500 bg-zinc-500/20';
  };

  return (
    <div 
      className="relative w-full h-full bg-zinc-950 overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={() => onSelectNode(null)}
    >
      {/* Grid background */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(to right, #52525b 1px, transparent 1px),
            linear-gradient(to bottom, #52525b 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
        }}
      />

      {/* Edges */}
      <svg className="absolute inset-0 pointer-events-none">
        {edges.map(edge => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);
          if (!source || !target) return null;
          
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={source.position.x + 100}
              y1={source.position.y + 30}
              x2={target.position.x + 100}
              y2={target.position.y + 30}
              stroke="#52525b"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          );
        })}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#52525b" />
          </marker>
        </defs>
      </svg>

      {/* Nodes */}
      {nodes.map(node => (
        <div
          key={node.id}
          className={`
            absolute w-48 p-3 rounded-lg border-2 cursor-pointer transition-all
            ${getNodeColor(node.type)}
            ${selectedNode === node.id ? 'ring-2 ring-white/20' : ''}
            ${dragging === node.id ? 'cursor-grabbing' : 'cursor-grab'}
          `}
          style={{ left: node.position.x, top: node.position.y }}
          onMouseDown={(e) => handleMouseDown(e, node.id)}
        >
          <div className="flex items-center gap-2">
            {NODE_TYPES.find(t => t.type === node.type)?.icon}
            <span className="text-sm font-medium text-zinc-100">
              {node.type === 'mode' && node.modeId 
                ? `${node.modeId.charAt(0).toUpperCase() + node.modeId.slice(1)}`
                : node.type.charAt(0).toUpperCase() + node.type.slice(1)
              }
            </span>
          </div>
          {!!node.config?.description && (
            <p className="text-xs text-zinc-500 mt-1 truncate">{String(node.config.description)}</p>
          )}
        </div>
      ))}

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
          <div className="text-center">
            <p className="text-lg font-medium">Empty Workflow</p>
            <p className="text-sm">Add nodes from the sidebar to start building</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function WorkflowBuilder() {
  const { executeWorkflow } = useWorkflow();
  const [workflow, setWorkflow] = useState<Workflow>({
    id: 'new-workflow',
    name: 'New Workflow',
    description: '',
    nodes: [],
    edges: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nextNodeId, setNextNodeId] = useState(1);
  const [isRunning, setIsRunning] = useState(false);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    try {
      await executeWorkflow(workflow.id);
    } catch {
      // execution errors are surfaced via executions state in useWorkflow
    } finally {
      setIsRunning(false);
    }
  }, [executeWorkflow, workflow.id]);

  const addNode = (type: WorkflowNode['type']) => {
    const nodeCount = workflow.nodes.length;
    const newNode: WorkflowCanvasNode = {
      id: `node-${nextNodeId}`,
      type,
      position: { x: 100 + (nodeCount * 50), y: 200 + (nodeCount * 30) },
      modeId: type === 'mode' ? 'research' : undefined,
      config: {},
    };
    
    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      updatedAt: Date.now(),
    }));
    setNextNodeId(n => n + 1);
  };

  const removeNode = (nodeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      updatedAt: Date.now(),
    }));
    if (selectedNode === nodeId) setSelectedNode(null);
  };

  const moveNode = useCallback((id: string, x: number, y: number) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => 
        n.id === id ? { ...n, position: { x, y } } : n
      ),
    }));
  }, []);

  const connectNodes = (sourceId: string, targetId: string) => {
    setWorkflow(prev => ({
      ...prev,
      edges: [...prev.edges, { id: `${sourceId}-${targetId}`, source: sourceId, target: targetId }],
      updatedAt: Date.now(),
    }));
  };

  const nodes = workflow.nodes as WorkflowCanvasNode[];
  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  return (
    <TooltipProvider>
      <div className="flex h-[calc(100vh-4rem)] bg-zinc-950">
        {/* Sidebar */}
        <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 p-4">
          <h2 className="text-sm font-semibold text-zinc-100 mb-4">Node Types</h2>
          <div className="space-y-2">
            {NODE_TYPES.map(nodeType => (
              <Tooltip key={nodeType.type}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-zinc-800 hover:bg-zinc-800"
                    onClick={() => addNode(nodeType.type)}
                  >
                    <span className={`mr-2 text-${nodeType.color}-500`}>
                      {nodeType.icon}
                    </span>
                    {nodeType.label}
                    <Plus className="w-3 h-3 ml-auto" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{nodeType.description}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-zinc-100 mt-6 mb-4">Agent Modes</h2>
          <div className="space-y-1">
            {PLUGIN_OPTIONS.map(plugin => (
              <Button
                key={plugin.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-zinc-400 hover:text-zinc-100"
                onClick={() => {
                  const nodeCount = workflow.nodes.length;
                  const newNode: WorkflowCanvasNode = {
                    id: `node-${nextNodeId}`,
                    type: 'mode',
                    modeId: plugin.id,
                    position: { x: 100 + (nodeCount * 50), y: 200 + (nodeCount * 30) },
                    config: {},
                  };
                  setWorkflow(prev => ({
                    ...prev,
                    nodes: [...prev.nodes, newNode],
                  }));
                  setNextNodeId(n => n + 1);
                }}
              >
                {plugin.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="h-14 border-b border-zinc-800 bg-zinc-900/50 px-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Input
                value={workflow.name}
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
                className="w-64 bg-zinc-900 border-zinc-800"
              />
              <Badge variant="outline" className="border-zinc-700 text-zinc-500">
                {nodes.length} nodes
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="border-zinc-800">
                <Save className="w-4 h-4 mr-2" /> Save
              </Button>
              <Button
                size="sm"
                className="bg-violet-600 hover:bg-violet-700"
                onClick={handleRun}
                disabled={isRunning}
              >
                <Play className="w-4 h-4 mr-2" /> {isRunning ? 'Running…' : 'Run'}
              </Button>
            </div>
          </div>

          {/* Canvas area */}
          <WorkflowCanvas
            nodes={nodes}
            edges={workflow.edges}
            selectedNode={selectedNode}
            onSelectNode={setSelectedNode}
            onMoveNode={moveNode}
          />
        </div>

        {/* Properties panel */}
        <div className="w-72 border-l border-zinc-800 bg-zinc-900/50 p-4">
          {selectedNodeData ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-zinc-100">Properties</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-400 hover:text-red-300"
                  onClick={() => removeNode(selectedNodeData.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Type</label>
                  <Badge variant="secondary" className="bg-zinc-800">
                    {selectedNodeData.type}
                  </Badge>
                </div>

                {selectedNodeData.type === 'mode' && (
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Mode</label>
                    <select 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-sm"
                      value={selectedNodeData.modeId || ''}
                      onChange={(e) => {
                        const modeId = e.target.value as PluginId;
                        setWorkflow(prev => ({
                          ...prev,
                          nodes: prev.nodes.map(n => 
                            n.id === selectedNode ? { ...n, modeId } : n
                          ),
                        }));
                      }}
                    >
                      {PLUGIN_OPTIONS.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs text-zinc-500 block mb-1">Description</label>
                  <Input
                    className="bg-zinc-900 border-zinc-800 text-sm"
                    placeholder="Node description..."
                    value={String(selectedNodeData.config?.description || '')}
                    onChange={(e) => {
                      setWorkflow(prev => ({
                        ...prev,
                        nodes: prev.nodes.map(n => 
                          n.id === selectedNode 
                            ? { ...n, config: { ...n.config, description: e.target.value } }
                            : n
                        ),
                      }));
                    }}
                  />
                </div>

                {nodes.length > 1 && (
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Connect To</label>
                    <div className="space-y-1">
                      {nodes
                        .filter(n => n.id !== selectedNodeData.id)
                        .map(targetNode => (
                          <Button
                            key={targetNode.id}
                            variant="outline"
                            size="sm"
                            className="w-full justify-start border-zinc-800 text-xs"
                            onClick={() => connectNodes(selectedNodeData.id, targetNode.id)}
                          >
                            <ArrowRight className="w-3 h-3 mr-2" />
                            {targetNode.id}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center text-zinc-500 mt-8">
              <p className="text-sm">Select a node to edit properties</p>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
