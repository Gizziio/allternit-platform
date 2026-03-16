"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { 
  GitBranch, 
  Save, 
  Play, 
  Plus,
  Trash2,
  Settings,
  MousePointer2,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  LayoutGrid,
  Wand2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { GlassSurface } from '@/design/GlassSurface';
import { useWorkflow } from '@/hooks/useWorkflow';
import { WorkflowPhase } from '@/types/workflow';
import { 
  DesignerNode, 
  DesignerEdge, 
  ValidationError,
  NodeCategory,
} from '@/types/workflow';

interface NodeType {
  id: string;
  name: string;
  icon: string;
  category: NodeCategory;
}

const NODE_TYPES: NodeType[] = [
  { id: 'input', name: 'Input', icon: '📥', category: NodeCategory.Source },
  { id: 'process', name: 'Process', icon: '⚙️', category: NodeCategory.Transform },
  { id: 'output', name: 'Output', icon: '📤', category: NodeCategory.Sink },
  { id: 'condition', name: 'Condition', icon: '🔀', category: NodeCategory.Control },
  { id: 'delay', name: 'Delay', icon: '⏱️', category: NodeCategory.Control },
];

export function WorkflowDesignerView() {
  // Use workflow hook for engine integration
  const { 
    validateDesign, 
    autoLayout, 
    wouldCreateCycle,
  } = useWorkflow();

  // Local state for workflow design
  const [nodes, setNodes] = useState<DesignerNode[]>([
    { 
      id: 'node-1', 
      node_type: 'input', 
      name: 'Start', 
      position: { x: 100, y: 200 },
      phase: WorkflowPhase.Draft,
      inputs: [],
      outputs: ['output'],
      config: {} 
    },
    { 
      id: 'node-2', 
      node_type: 'process', 
      name: 'Build', 
      position: { x: 300, y: 200 },
      phase: WorkflowPhase.Draft,
      inputs: ['input'],
      outputs: ['output'],
      config: {} 
    },
    { 
      id: 'node-3', 
      node_type: 'output', 
      name: 'Deploy', 
      position: { x: 500, y: 200 },
      phase: WorkflowPhase.Draft,
      inputs: ['input'],
      outputs: [],
      config: {} 
    },
  ]);
  
  const [edges, setEdges] = useState<DesignerEdge[]>([
    { id: 'edge-1', from: 'node-1', to: 'node-2' },
    { id: 'edge-2', from: 'node-2', to: 'node-3' },
  ]);
  
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationError[];
  } | null>(null);
  const [showValidationPanel, setShowValidationPanel] = useState(false);

  // Validate workflow using WorkflowEngine.validateWorkflow()
  const handleValidate = useCallback(() => {
    setIsValidating(true);
    // Use the engine's validateWorkflow method
    const result = validateDesign(nodes, edges);
    setValidationResult(result);
    setShowValidationPanel(true);
    setIsValidating(false);
    return result;
  }, [nodes, edges, validateDesign]);

  // Auto-layout using WorkflowEngine.autoLayout()
  const handleAutoLayout = useCallback(() => {
    // Use the engine's autoLayout method
    const newPositions = autoLayout(nodes, edges);
    
    // Apply new positions to nodes
    setNodes(prev => prev.map(node => {
      const newPos = newPositions.get(node.id);
      if (newPos) {
        return { ...node, position: newPos };
      }
      return node;
    }));
  }, [nodes, edges, autoLayout]);

  // Check if adding an edge would create a cycle
  const canConnect = useCallback((from: string, to: string): boolean => {
    return !wouldCreateCycle(from, to, edges);
  }, [edges, wouldCreateCycle]);

  const handleAddNode = (type: string) => {
    const nodeType = NODE_TYPES.find(t => t.id === type);
    const newNode: DesignerNode = {
      id: `node-${Date.now()}`,
      node_type: type,
      name: nodeType?.name || 'Node',
      position: { 
        x: 200 + Math.random() * 200, 
        y: 200 + Math.random() * 100 
      },
      phase: WorkflowPhase.Draft,
      inputs: type === 'input' ? [] : ['input'],
      outputs: type === 'output' ? [] : ['output'],
      config: {},
    };
    setNodes(prev => [...prev, newNode]);
    // Clear validation when structure changes
    setValidationResult(null);
  };

  const handleDeleteNode = (id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.from !== id && e.to !== id));
    if (selectedNode === id) setSelectedNode(null);
    setValidationResult(null);
  };

  const handleAddEdge = (from: string, to: string) => {
    // Check if connection would create a cycle
    if (!canConnect(from, to)) {
      alert('Cannot connect: This would create a cycle in the workflow');
      return;
    }
    
    const newEdge: DesignerEdge = {
      id: `edge-${Date.now()}`,
      from,
      to,
    };
    setEdges(prev => [...prev, newEdge]);
    setValidationResult(null);
  };

  const handleDeleteEdge = (id: string) => {
    setEdges(prev => prev.filter(e => e.id !== id));
    if (selectedEdge === id) setSelectedEdge(null);
    setValidationResult(null);
  };

  const selectedNodeData = nodes.find(n => n.id === selectedNode);

  // Get severity color for validation messages
  const getSeverityColor = (severity: 'error' | 'warning') => {
    return severity === 'error' ? 'text-red-500' : 'text-yellow-500';
  };

  const getSeverityBg = (severity: 'error' | 'warning') => {
    return severity === 'error' ? 'bg-red-500/10' : 'bg-yellow-500/10';
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Node Palette */}
      <div className="w-64 border-r border-border bg-secondary/20 flex flex-col">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium flex items-center gap-2">
            <MousePointer2 className="w-4 h-4" />
            Node Palette
          </h3>
        </div>
        <div className="p-4 space-y-2 overflow-y-auto flex-1">
          {NODE_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => handleAddNode(type.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-primary hover:bg-secondary transition-colors text-left"
            >
              <span className="text-xl">{type.icon}</span>
              <div>
                <p className="text-sm font-medium">{type.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{type.category}</p>
              </div>
            </button>
          ))}
        </div>
        
        {/* Validation Summary */}
        {validationResult && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 mb-2">
              {validationResult.valid ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {validationResult.valid ? 'Valid' : 'Invalid'}
              </span>
            </div>
            {validationResult.errors.length > 0 && (
              <p className="text-xs text-red-500">
                {validationResult.errors.length} error(s)
              </p>
            )}
            {validationResult.warnings.length > 0 && (
              <p className="text-xs text-yellow-500">
                {validationResult.warnings.length} warning(s)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Center - Canvas */}
      <div className="flex-1 flex flex-col bg-secondary/10">
        {/* Toolbar */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <GitBranch className="w-5 h-5 text-accent" />
            <div>
              <h2 className="font-medium">CI/CD Pipeline</h2>
              <p className="text-xs text-muted-foreground">v1.2.0 • Draft</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Auto Layout Button */}
            <button 
              onClick={handleAutoLayout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-secondary transition-colors"
              title="Auto Layout"
            >
              <Wand2 className="w-4 h-4" />
              Auto Layout
            </button>
            
            {/* Validate Button */}
            <button 
              onClick={handleValidate}
              disabled={isValidating}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                validationResult?.valid 
                  ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20' 
                  : validationResult?.errors.length 
                    ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                    : 'hover:bg-secondary'
              }`}
            >
              {isValidating ? (
                <LayoutGrid className="w-4 h-4 animate-spin" />
              ) : validationResult?.valid ? (
                <CheckCircle className="w-4 h-4" />
              ) : validationResult?.errors.length ? (
                <AlertCircle className="w-4 h-4" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Validate
            </button>
            
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg hover:bg-secondary transition-colors">
              <Save className="w-4 h-4" />
              Save
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors">
              <Play className="w-4 h-4" />
              Execute
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}>
            {/* Edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {edges.map((edge) => {
                const fromNode = nodes.find(n => n.id === edge.from);
                const toNode = nodes.find(n => n.id === edge.to);
                if (!fromNode || !toNode) return null;
                return (
                  <g key={edge.id}>
                    <line
                      x1={fromNode.position.x + 60}
                      y1={fromNode.position.y + 30}
                      x2={toNode.position.x}
                      y2={toNode.position.y + 30}
                      stroke={selectedEdge === edge.id ? 'var(--accent)' : 'var(--border)'}
                      strokeWidth={selectedEdge === edge.id ? "3" : "2"}
                      markerEnd="url(#arrowhead)"
                      className="cursor-pointer pointer-events-auto"
                      onClick={() => setSelectedEdge(edge.id)}
                    />
                  </g>
                );
              })}
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill="var(--accent)" />
                </marker>
              </defs>
            </svg>

            {/* Nodes */}
            {nodes.map((node) => {
              const nodeType = NODE_TYPES.find(t => t.id === node.node_type);
              const hasErrors = validationResult?.errors.some(e => e.node_id === node.id);
              const hasWarnings = validationResult?.warnings.some(e => e.node_id === node.id);
              
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node.id)}
                  className={`absolute w-[120px] p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedNode === node.id
                      ? 'border-accent bg-accent/10 shadow-lg'
                      : hasErrors
                        ? 'border-red-500 bg-red-500/10'
                        : hasWarnings
                          ? 'border-yellow-500 bg-yellow-500/10'
                          : 'border-border bg-primary hover:border-accent/50'
                  }`}
                  style={{ left: node.position.x, top: node.position.y }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{nodeType?.icon}</span>
                    <span className="text-sm font-medium truncate">{node.name}</span>
                  </div>
                  {hasErrors && (
                    <AlertTriangle className="absolute -top-2 -right-2 w-4 h-4 text-red-500" />
                  )}
                  {hasWarnings && !hasErrors && (
                    <AlertCircle className="absolute -top-2 -right-2 w-4 h-4 text-yellow-500" />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNode(node.id);
                    }}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white opacity-0 hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Sidebar - Properties & Validation */}
      <div className="w-72 border-l border-border bg-secondary/20 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setShowValidationPanel(false)}
            className={`flex-1 p-3 text-sm font-medium transition-colors ${
              !showValidationPanel ? 'bg-secondary/50 border-b-2 border-accent' : ''
            }`}
          >
            Properties
          </button>
          <button
            onClick={() => setShowValidationPanel(true)}
            className={`flex-1 p-3 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              showValidationPanel ? 'bg-secondary/50 border-b-2 border-accent' : ''
            }`}
          >
            Validation
            {validationResult && (validationResult.errors.length > 0 || validationResult.warnings.length > 0) && (
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                validationResult.errors.length > 0 ? 'bg-red-500 text-white' : 'bg-yellow-500 text-black'
              }`}>
                {validationResult.errors.length + validationResult.warnings.length}
              </span>
            )}
          </button>
        </div>

        {/* Properties Panel */}
        {!showValidationPanel && (
          <div className="p-4 flex-1 overflow-y-auto">
            {selectedNodeData ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Node ID</label>
                  <code className="text-xs bg-secondary px-2 py-1 rounded">{selectedNodeData.id}</code>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                  <input
                    type="text"
                    value={selectedNodeData.name}
                    onChange={(e) => {
                      setNodes(prev => prev.map(n => 
                        n.id === selectedNodeData.id ? { ...n, name: e.target.value } : n
                      ));
                    }}
                    className="w-full px-3 py-2 rounded bg-primary border border-border text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                  <select
                    value={selectedNodeData.node_type}
                    onChange={(e) => {
                      setNodes(prev => prev.map(n => 
                        n.id === selectedNodeData.id ? { ...n, node_type: e.target.value } : n
                      ));
                    }}
                    className="w-full px-3 py-2 rounded bg-primary border border-border text-sm"
                  >
                    {NODE_TYPES.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Position</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      value={Math.round(selectedNodeData.position.x)}
                      onChange={(e) => {
                        const x = parseInt(e.target.value);
                        setNodes(prev => prev.map(n => 
                          n.id === selectedNodeData.id ? { ...n, position: { ...n.position, x } } : n
                        ));
                      }}
                      className="px-2 py-1 rounded bg-primary border border-border text-sm"
                    />
                    <input
                      type="number"
                      value={Math.round(selectedNodeData.position.y)}
                      onChange={(e) => {
                        const y = parseInt(e.target.value);
                        setNodes(prev => prev.map(n => 
                          n.id === selectedNodeData.id ? { ...n, position: { ...n.position, y } } : n
                        ));
                      }}
                      className="px-2 py-1 rounded bg-primary border border-border text-sm"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <MousePointer2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a node to edit properties</p>
              </div>
            )}
          </div>
        )}

        {/* Validation Panel */}
        {showValidationPanel && (
          <div className="p-4 flex-1 overflow-y-auto">
            {!validationResult ? (
              <div className="text-center text-muted-foreground py-8">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Click Validate to check workflow</p>
                <button
                  onClick={handleValidate}
                  className="mt-4 px-4 py-2 rounded-lg bg-accent/20 text-accent hover:bg-accent/30 transition-colors text-sm"
                >
                  Run Validation
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Validation Status */}
                <div className={`p-3 rounded-lg ${
                  validationResult.valid ? 'bg-green-500/10' : 'bg-red-500/10'
                }`}>
                  <div className="flex items-center gap-2">
                    {validationResult.valid ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className={validationResult.valid ? 'text-green-500' : 'text-red-500'}>
                      {validationResult.valid ? 'Valid workflow' : 'Validation failed'}
                    </span>
                  </div>
                </div>

                {/* Errors */}
                {validationResult.errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <X className="w-4 h-4 text-red-500" />
                      Errors ({validationResult.errors.length})
                    </h4>
                    <div className="space-y-2">
                      {validationResult.errors.map((error, idx) => (
                        <div 
                          key={idx} 
                          className="p-2 rounded bg-red-500/10 text-xs"
                          onClick={() => {
                            if (error.node_id) setSelectedNode(error.node_id);
                          }}
                        >
                          <p className="font-medium text-red-500">{error.code}</p>
                          <p className="text-muted-foreground">{error.message}</p>
                          {(error.node_id || error.edge_id) && (
                            <p className="text-accent mt-1 cursor-pointer hover:underline">
                              Click to highlight
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {validationResult.warnings.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      Warnings ({validationResult.warnings.length})
                    </h4>
                    <div className="space-y-2">
                      {validationResult.warnings.map((warning, idx) => (
                        <div 
                          key={idx} 
                          className="p-2 rounded bg-yellow-500/10 text-xs"
                          onClick={() => {
                            if (warning.node_id) setSelectedNode(warning.node_id);
                          }}
                        >
                          <p className="font-medium text-yellow-500">{warning.code}</p>
                          <p className="text-muted-foreground">{warning.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {validationResult.valid && validationResult.warnings.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-4">
                    No issues found! Workflow is valid.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={handleValidate}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm"
          >
            <CheckCircle className="w-4 h-4" />
            Validate Workflow
          </button>
          <button
            onClick={handleAutoLayout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm"
          >
            <LayoutGrid className="w-4 h-4" />
            Auto Layout
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkflowDesignerView;
