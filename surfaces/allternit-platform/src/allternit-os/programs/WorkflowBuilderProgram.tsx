/**
 * allternit Super-Agent OS - Workflow Builder Program
 * 
 * Visual workflow builder that integrates with the Allternit Agent System Rails:
 * - Visualizes DAGs from .allternit/work/dags/
 * - Shows WIH (Work In Hand) state
 * - Sends/receives Bus messages
 * - Integrates with existing AgentCommunicationPanel
 * - Uses existing OrchestratorEngine patterns
 * 
 * Built on top of existing infrastructure:
 * - AllternitRailsBridge (connects to Rust Rails service)
 * - useSidecarStore (program state management)
 * - AgentCommunicationPanel (agent chat)
 * - OrchestratorEngine (task orchestration)
 */

import * as React from 'react';
const { useState, useCallback, useEffect, useRef } = React;
import { useAllternitRails, DagNode, BusMessage } from '../kernel/AllternitRailsBridge';
import type { AllternitProgram } from '../types/programs';

interface WorkflowBuilderProgramProps {
  program: AllternitProgram;
}

// ============================================================================
// Types
// ============================================================================

interface NodePosition {
  x: number;
  y: number;
}

interface VisualNode extends DagNode {
  position: NodePosition;
  isSelected: boolean;
  isHovered: boolean;
  dag_id?: string;
  terminal_context?: {
    session_id: string;
    pane_id: string;
    log_stream_endpoint: string;
  };
}

interface VisualEdge {
  from: string;
  to: string;
  type: 'blocked_by' | 'related_to';
}

// ============================================================================
// Sub-Components
// ============================================================================

const DagNodeComponent: React.FC<{
  node: VisualNode;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDrag: (deltaX: number, deltaY: number) => void;
}> = ({ node, onClick, onMouseEnter, onMouseLeave, onDrag }) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const statusColors = {
    NEW: 'bg-gray-200 border-gray-300',
    READY: 'bg-blue-100 border-blue-300',
    RUNNING: 'bg-yellow-100 border-yellow-300',
    DONE: 'bg-green-100 border-green-300',
    FAILED: 'bg-red-100 border-red-300',
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    e.stopPropagation();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    onDrag(deltaX, deltaY);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`
        absolute w-48 p-3 rounded-lg border-2 shadow-md cursor-pointer
        transition-all duration-150 select-none
        ${statusColors[node.status]}
        ${node.isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''}
        ${node.isHovered ? 'shadow-xl scale-105' : ''}
      `}
      style={{
        left: node.position.x,
        top: node.position.y,
      }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={(e) => {
        onMouseLeave();
        handleMouseUp();
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`
          w-2 h-2 rounded-full
          ${node.status === 'DONE' ? 'bg-green-500' : ''}
          ${node.status === 'RUNNING' ? 'bg-yellow-500 animate-pulse' : ''}
          ${node.status === 'READY' ? 'bg-blue-500' : ''}
          ${node.status === 'FAILED' ? 'bg-red-500' : ''}
          ${node.status === 'NEW' ? 'bg-gray-400' : ''}
        `} />
        <span className="text-xs font-medium text-gray-500 uppercase">
          {node.execution_mode}
        </span>
      </div>
      <h4 className="font-semibold text-gray-900 text-sm">{node.name}</h4>
      <p className="text-xs text-gray-600 mt-1 line-clamp-2">{node.description}</p>
      
      {node.blocked_by.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {node.blocked_by.map(dep => (
            <span key={dep} className="text-xs bg-gray-200 px-1.5 py-0.5 rounded">
              → {dep}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const EdgeComponent: React.FC<{
  from: NodePosition;
  to: NodePosition;
  type: 'blocked_by' | 'related_to';
}> = ({ from, to, type }) => {
  const startX = from.x + 192; // Node width
  const startY = from.y + 40;  // Node height / 2
  const endX = to.x;
  const endY = to.y + 40;

  const path = `M ${startX} ${startY} C ${startX + 50} ${startY}, ${endX - 50} ${endY}, ${endX} ${endY}`;

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <path
        d={path}
        fill="none"
        stroke={type === 'blocked_by' ? '#94a3b8' : '#cbd5e1'}
        strokeWidth={type === 'blocked_by' ? 2 : 1}
        strokeDasharray={type === 'related_to' ? '5,5' : undefined}
        markerEnd="url(#arrowhead)"
      />
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
        </marker>
      </defs>
    </svg>
  );
};

const BusMessagePanel: React.FC<{
  messages: BusMessage[];
  onSendMessage: (to: string, kind: string, payload: Record<string, unknown>) => void;
}> = ({ messages, onSendMessage }) => {
  const [recipient, setRecipient] = useState('');
  const [kind, setKind] = useState('command');
  const [payload, setPayload] = useState('{}');

  const handleSend = () => {
    try {
      const parsedPayload = JSON.parse(payload);
      onSendMessage(recipient, kind, parsedPayload);
      setRecipient('');
      setPayload('{}');
    } catch (e) {
      alert('Invalid JSON payload');
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-4 space-y-2">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`
              p-3 rounded-lg text-sm
              ${msg.status === 'pending' ? 'bg-yellow-50 border border-yellow-200' : ''}
              ${msg.status === 'delivered' ? 'bg-green-50 border border-green-200' : ''}
              ${msg.status === 'failed' ? 'bg-red-50 border border-red-200' : ''}
            `}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium">{msg.from} → {msg.to}</span>
              <span className={`
                text-xs px-2 py-0.5 rounded
                ${msg.status === 'pending' ? 'bg-yellow-200 text-yellow-800' : ''}
                ${msg.status === 'delivered' ? 'bg-green-200 text-green-800' : ''}
                ${msg.status === 'failed' ? 'bg-red-200 text-red-800' : ''}
              `}>
                {msg.status}
              </span>
            </div>
            <div className="text-gray-600">{msg.kind}</div>
            <pre className="text-xs text-gray-500 mt-1 overflow-x-auto">
              {JSON.stringify(msg.payload, null, 2)}
            </pre>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">No messages</div>
        )}
      </div>

      <div className="border-t border-gray-200 p-4 space-y-2">
        <input
          type="text"
          placeholder="Recipient (agent_id)"
          value={recipient}
          onChange={e => setRecipient(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
        <input
          type="text"
          placeholder="Message kind"
          value={kind}
          onChange={e => setKind(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
        />
        <textarea
          placeholder="Payload (JSON)"
          value={payload}
          onChange={e => setPayload(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-mono"
          rows={3}
        />
        <button
          onClick={handleSend}
          disabled={!recipient || !kind}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
        >
          Send Message
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const WorkflowBuilderProgram: React.FC<WorkflowBuilderProgramProps> = ({ program }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  
  // Get workspace ID from program state or use default
  const workspaceId = (program.state as Record<string, unknown>)?.workspaceId as string || 'default';
  
  // Connect to Allternit Rails
  const rails = useAllternitRails({
    workspaceId,
    autoPoll: true,
    pollInterval: 3000,
  });

  // Local state for visualization
  const [visualNodes, setVisualNodes] = useState<Record<string, VisualNode>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'canvas' | 'messages' | 'logs'>('canvas');

  // Initialize visual nodes from DAG data
  useEffect(() => {
    if (rails.dags.length === 0) return;

    const dag = rails.dags[0]; // Show first DAG
    const nodes: Record<string, VisualNode> = {};
    
    // Simple layout algorithm
    const levels: string[][] = [];
    const visited = new Set<string>();
    
    // Find root nodes (no dependencies)
    const findRoots = () => {
      return Object.values(dag.nodes)
        .filter(n => n.blocked_by.length === 0)
        .map(n => n.id);
    };
    
    // BFS to build levels
    const buildLevels = () => {
      let currentLevel = findRoots();
      while (currentLevel.length > 0) {
        levels.push(currentLevel);
        const nextLevel: string[] = [];
        
        for (const nodeId of currentLevel) {
          visited.add(nodeId);
          // Find nodes that depend on this one
          for (const [id, node] of Object.entries(dag.nodes)) {
            if (node.blocked_by.includes(nodeId) && !visited.has(id)) {
              nextLevel.push(id);
            }
          }
        }
        
        currentLevel = Array.from(new Set(nextLevel));
      }
    };
    
    buildLevels();
    
    // Position nodes
    const levelHeight = 120;
    const nodeWidth = 200;
    
    levels.forEach((level, levelIndex) => {
      const levelWidth = level.length * nodeWidth;
      const startX = -levelWidth / 2 + nodeWidth / 2;
      
      level.forEach((nodeId, index) => {
        const dagNode = dag.nodes[nodeId];
        if (dagNode) {
          nodes[nodeId] = {
            ...dagNode,
            position: {
              x: startX + index * nodeWidth + 50,
              y: levelIndex * levelHeight + 50,
            },
            isSelected: nodeId === selectedNodeId,
            isHovered: false,
          };
        }
      });
    });
    
    setVisualNodes(nodes);
  }, [rails.dags, selectedNodeId]);

  // Handle node drag
  const handleNodeDrag = useCallback((nodeId: string, deltaX: number, deltaY: number) => {
    setVisualNodes(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        position: {
          x: prev[nodeId].position.x + deltaX,
          y: prev[nodeId].position.y + deltaY,
        },
      },
    }));
  }, []);

  // Handle sending bus message
  const handleSendMessage = useCallback(async (
    to: string,
    kind: string,
    payload: Record<string, unknown>
  ) => {
    await rails.sendMessage({
      to,
      from: 'workflow-builder',
      kind,
      payload,
      transport: 'internal',
      correlation_id: `wf-${Date.now()}`,
    });
  }, [rails]);

  // Handle creating new session/pane for a node
  const handleSpawnForNode = useCallback(async (nodeId: string) => {
    const node = visualNodes[nodeId];
    if (!node) return;

    try {
      const session = await rails.createTerminalSession(`dag-${node.dag_id}`);
      const pane = await rails.createPane(
        session.id,
        node.name,
        `echo "Working on: ${node.description}"`
      );
      
      // Update node with terminal context
      setVisualNodes(prev => ({
        ...prev,
        [nodeId]: {
          ...prev[nodeId],
          terminal_context: {
            session_id: session.id,
            pane_id: pane.id,
            log_stream_endpoint: '',
          },
        },
      }));
    } catch (err) {
      console.error('Failed to spawn terminal:', err);
    }
  }, [rails, visualNodes]);

  // Get current DAG
  const currentDag = rails.dags[0];
  
  // Build edges from visual nodes
  const edges: VisualEdge[] = [];
  for (const node of Object.values(visualNodes)) {
    for (const depId of node.blocked_by) {
      if (visualNodes[depId]) {
        edges.push({
          from: depId,
          to: node.id,
          type: 'blocked_by',
        });
      }
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-xl">🌊</span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              {currentDag ? `DAG: ${currentDag.dag_id}` : 'Workflow Builder'}
            </h2>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className={`
                w-2 h-2 rounded-full
                ${rails.isConnected ? 'bg-green-500' : 'bg-red-500'}
              `} />
              {rails.isConnected ? 'Connected to Allternit Rails' : 'Disconnected'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('canvas')}
            className={`
              px-3 py-1.5 rounded text-sm
              ${activeTab === 'canvas' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
            `}
          >
            Canvas
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`
              px-3 py-1.5 rounded text-sm relative
              ${activeTab === 'messages' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
            `}
          >
            Messages
            {rails.messages.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {rails.messages.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`
              px-3 py-1.5 rounded text-sm
              ${activeTab === 'logs' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
            `}
          >
            Logs
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            −
          </button>
          <span className="text-sm text-gray-600 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale(s => Math.min(2, s + 0.1))}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            +
          </button>
          <button
            onClick={rails.refresh}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {activeTab === 'canvas' && (
          <>
            {/* Canvas */}
            <div
              ref={canvasRef}
              className="flex-1 relative overflow-auto bg-gray-50"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                  linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
              }}
            >
              <div
                className="relative min-w-full min-h-full"
                style={{
                  transform: `scale(${scale}) translate(${pan.x}px, ${pan.y}px)`,
                  transformOrigin: 'center center',
                  width: '2000px',
                  height: '1500px',
                }}
              >
                {/* Edges */}
                {edges.map(edge => {
                  const fromNode = visualNodes[edge.from];
                  const toNode = visualNodes[edge.to];
                  if (!fromNode || !toNode) return null;
                  return (
                    <EdgeComponent
                      key={`${edge.from}-${edge.to}`}
                      from={fromNode.position}
                      to={toNode.position}
                      type={edge.type}
                    />
                  );
                })}

                {/* Nodes */}
                {Object.values(visualNodes).map(node => (
                  <DagNodeComponent
                    key={node.id}
                    node={node}
                    onClick={() => setSelectedNodeId(node.id)}
                    onMouseEnter={() => setVisualNodes(prev => ({
                      ...prev,
                      [node.id]: { ...prev[node.id], isHovered: true },
                    }))}
                    onMouseLeave={() => setVisualNodes(prev => ({
                      ...prev,
                      [node.id]: { ...prev[node.id], isHovered: false },
                    }))}
                    onDrag={(dx, dy) => handleNodeDrag(node.id, dx / scale, dy / scale)}
                  />
                ))}
              </div>
            </div>

            {/* Properties Panel */}
            {selectedNodeId && visualNodes[selectedNodeId] && (
              <div className="w-72 bg-white border-l border-gray-200 p-4 overflow-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Node Properties</h3>
                  <button
                    onClick={() => setSelectedNodeId(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>

                {(() => {
                  const node = visualNodes[selectedNodeId];
                  return (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Name</label>
                        <p className="text-sm text-gray-900">{node.name}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">ID</label>
                        <p className="text-xs font-mono text-gray-600">{node.id}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Status</label>
                        <span className={`
                          inline-block px-2 py-1 rounded text-xs mt-1
                          ${node.status === 'DONE' ? 'bg-green-100 text-green-800' : ''}
                          ${node.status === 'RUNNING' ? 'bg-yellow-100 text-yellow-800' : ''}
                          ${node.status === 'READY' ? 'bg-blue-100 text-blue-800' : ''}
                          ${node.status === 'FAILED' ? 'bg-red-100 text-red-800' : ''}
                          ${node.status === 'NEW' ? 'bg-gray-100 text-gray-800' : ''}
                        `}>
                          {node.status}
                        </span>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Execution Mode</label>
                        <p className="text-sm text-gray-900">{node.execution_mode}</p>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 uppercase">Description</label>
                        <p className="text-sm text-gray-700">{node.description}</p>
                      </div>
                      
                      {node.terminal_context ? (
                        <div>
                          <label className="text-xs font-medium text-gray-500 uppercase">Terminal</label>
                          <p className="text-xs font-mono text-gray-600">
                            Session: {node.terminal_context.session_id}
                          </p>
                          <p className="text-xs font-mono text-gray-600">
                            Pane: {node.terminal_context.pane_id}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleSpawnForNode(selectedNodeId)}
                          className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Spawn Terminal
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {activeTab === 'messages' && (
          <div className="flex-1">
            <BusMessagePanel
              messages={rails.messages}
              onSendMessage={handleSendMessage}
            />
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex-1 overflow-auto p-4 font-mono text-xs">
            {rails.events.map((event, i) => (
              <div key={i} className="mb-2 p-2 bg-gray-100 rounded">
                <div className="flex items-center gap-2 text-gray-600">
                  <span>{new Date(event.ts).toLocaleTimeString()}</span>
                  <span className="font-semibold text-blue-600">{event.type}</span>
                  <span className="text-gray-400">({event.actor.type}: {event.actor.id})</span>
                </div>
                <pre className="mt-1 text-gray-700 overflow-x-auto">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))}
            {rails.events.length === 0 && (
              <div className="text-center text-gray-400 py-8">No events</div>
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center gap-4">
          <span>{Object.keys(visualNodes).length} nodes</span>
          <span>{edges.length} edges</span>
          <span>{rails.messages.filter(m => m.status === 'pending').length} pending messages</span>
        </div>
        <div>
          Workspace: {workspaceId}
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilderProgram;
