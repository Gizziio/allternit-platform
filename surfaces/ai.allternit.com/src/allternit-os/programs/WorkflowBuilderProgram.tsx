// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAllternitRails } from '../kernel/rails-bridge/useAllternitRails';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('WorkflowBuilderProgram');

interface VisualNode {
  id: string;
  name: string;
  status: string;
  execution_mode: string;
  description: string;
  blocked_by: string[];
  terminal_context?: {
    session_id: string;
    pane_id: string;
  };
  position: { x: number; y: number };
  isSelected: boolean;
  isHovered: boolean;
}

export function WorkflowBuilderProgram({ program }: { program: any }) {
  const rails = useAllternitRails({
    workspaceId: 'default',
    autoConnect: true,
  });

  const [visualNodes, setVisualNodes] = useState<Record<string, VisualNode>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeTab, setActiveTab] = useState<'canvas' | 'messages' | 'logs'>('canvas');

  const [prevDags, setPrevDags] = useState(rails.dags);
  const [prevSelectedNodeId, setPrevSelectedNodeId] = useState(selectedNodeId);

  if (rails.dags !== prevDags || selectedNodeId !== prevSelectedNodeId) {
    setPrevDags(rails.dags);
    setPrevSelectedNodeId(selectedNodeId);

    if (rails.dags.length > 0) {
      const dag = rails.dags[0];
      const nodes: Record<string, VisualNode> = {};
      
      const levels: string[][] = [];
      const visited = new Set<string>();
      
      const findRoots = () => {
        return Object.values(dag.nodes)
          .filter(n => n.blocked_by.length === 0)
          .map(n => n.id);
      };
      
      const dependantsMap: Record<string, string[]> = {};
      for (const node of Object.values(dag.nodes)) {
        for (const depId of node.blocked_by) {
          if (!dependantsMap[depId]) dependantsMap[depId] = [];
          dependantsMap[depId].push(node.id);
        }
      }

      let currentLevel = findRoots();
      while (currentLevel.length > 0) {
        levels.push(currentLevel);
        const nextLevel: string[] = [];
        
        for (const nodeId of currentLevel) {
          visited.add(nodeId);
          const dependants = dependantsMap[nodeId] || [];
          for (const depId of dependants) {
            if (!visited.has(depId)) {
              nextLevel.push(depId);
            }
          }
        }
        
        currentLevel = Array.from(new Set(nextLevel));
      }
      
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
    }
  }

  const canvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    panStartRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!panStartRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handleCanvasMouseUp = useCallback(() => {
    panStartRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const d = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.max(0.1, Math.min(5, prev * d)));
  }, []);

  const handleSpawnForNode = useCallback(async (nodeId: string) => {
    const node = visualNodes[nodeId];
    if (!node) return;
    try {
      await rails.spawn({
        programId: program.id,
        nodeId: node.id,
      });
    } catch (err) {
      logger.error({ err, nodeId }, 'Failed to spawn terminal for node');
    }
  }, [visualNodes, rails, program.id]);

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-tight">Workflow Builder</h2>
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-md">
            {(['canvas', 'messages', 'logs'] as const).map(tab => (
              <button type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 text-xs rounded capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-zinc-700 shadow-sm font-bold text-blue-600' : 'text-zinc-500 hover:text-zinc-700'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rails.isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {rails.isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
          <button type="button" onClick={() => setScale(1)} className="text-xs text-zinc-400 hover:text-zinc-600">RESET VIEW</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {activeTab === 'canvas' && (
          <div 
            ref={canvasRef}
            className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onWheel={handleWheel}
          >
            <div 
              className="absolute inset-0 transition-transform duration-75 ease-out"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
            >
              {/* SVG connections layer */}
              <svg className="absolute inset-0 pointer-events-none w-[5000px] h-[5000px]" style={{ left: -2500, top: -2500 }}>
                {Object.values(visualNodes).map(node => (
                  node.blocked_by.map(depId => {
                    const fromNode = visualNodes[depId];
                    if (!fromNode) return null;
                    return (
                      <line 
                        key={`${depId}-${node.id}`}
                        x1={fromNode.position.x + 100}
                        y1={fromNode.position.y + 40}
                        x2={node.position.x + 100}
                        y2={node.position.y}
                        stroke={node.status === 'DONE' ? '#10b981' : '#cbd5e1'}
                        strokeWidth="2"
                        strokeDasharray={node.status === 'RUNNING' ? '5,5' : 'none'}
                        className={node.status === 'RUNNING' ? 'animate-[dash_1s_linear_infinite]' : ''}
                      />
                    );
                  })
                ))}
              </svg>

              {/* Nodes layer */}
              {Object.values(visualNodes).map(node => (
                <div 
                  key={node.id}
                  data-node
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`
                    absolute w-[200px] bg-white dark:bg-zinc-900 rounded-lg shadow-md border-2 p-3 transition-all cursor-pointer select-none
                    ${node.isSelected ? 'border-blue-500 ring-4 ring-blue-500/10 scale-105 z-10' : 'border-zinc-200 dark:border-zinc-800'}
                    ${node.status === 'RUNNING' ? 'shadow-[0_0_15px_rgba(59,130,246,0.3)]' : ''}
                  `}
                  style={{ left: node.position.x, top: node.position.y }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase">{node.execution_mode}</span>
                    <div className={`size-2  rounded-full ${node.status === 'DONE' ? 'bg-green-500' : node.status === 'FAILED' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  </div>
                  <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">{node.name}</h3>
                  <p className="text-[10px] text-zinc-500 line-clamp-1 mt-1">{node.description}</p>
                  
                  {node.status === 'RUNNING' && (
                    <div className="mt-2 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 animate-[progress_2s_ease-in-out_infinite] w-1/3" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="flex-1 overflow-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950">
            {rails.messages.map((msg, i) => (
              <div key={i} className="flex gap-3 max-w-2xl">
                <div className="size-8  rounded bg-zinc-200 dark:bg-zinc-800 shrink-0" />
                <div className="bg-white dark:bg-zinc-900 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm text-sm">
                  <p className="font-bold text-xs text-zinc-500 mb-1">{msg.role.toUpperCase()}</p>
                  <p className="text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="flex-1 overflow-auto p-4 font-mono text-xs">
            {rails.events.map((event) => (
              <div key={event.id || `${event.ts}-${event.type}`} className="mb-2 p-2 bg-zinc-100 rounded">
                <div className="flex items-center gap-2 text-zinc-600">
                  <span>{new Date(event.ts).toLocaleTimeString()}</span>
                  <span className="font-semibold text-blue-600">{event.type}</span>
                  <span className="text-zinc-400">({event.actor.type}: {event.actor.id})</span>
                </div>
                <pre className="mt-1 text-zinc-700 overflow-x-auto">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </div>
            ))}
            {rails.events.length === 0 && (
              <div className="h-full flex items-center justify-center text-zinc-400">
                Waiting for events...
              </div>
            )}
          </div>
        )}

        {/* Info Sidebar */}
        <div className="w-64 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-auto p-4 shrink-0">
          {!selectedNodeId ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400">
              <span className="text-3xl mb-2">🖱️</span>
              <p className="text-xs">Select a node to view details and controls</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase text-zinc-400 tracking-widest">Node Inspector</h3>
                <button type="button" onClick={() => setSelectedNodeId(null)} className="text-zinc-400 hover:text-zinc-600">✕</button>
              </div>

              {(() => {
                const node = visualNodes[selectedNodeId];
                if (!node) return null;
                return (
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-medium text-zinc-500 uppercase">Name</div>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{node.name}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-500 uppercase">ID</div>
                      <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">{node.id}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-500 uppercase">Status</div>
                      <span className={`
                        inline-block px-2 py-1 rounded text-xs mt-1
                        ${node.status === 'DONE' ? 'bg-green-100 text-green-800' : ''}
                        ${node.status === 'RUNNING' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${node.status === 'READY' ? 'bg-blue-100 text-blue-800' : ''}
                        ${node.status === 'FAILED' ? 'bg-red-100 text-red-800' : ''}
                        ${node.status === 'NEW' ? 'bg-zinc-100 text-zinc-800' : ''}
                      `}>
                        {node.status}
                      </span>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-500 uppercase">Execution Mode</div>
                      <p className="text-sm text-zinc-900 dark:text-zinc-100">{node.execution_mode}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-zinc-500 uppercase">Description</div>
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">{node.description}</p>
                    </div>
                    
                    {node.terminal_context ? (
                      <div>
                        <div className="text-xs font-medium text-zinc-500 uppercase">Terminal</div>
                        <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                          Session: {node.terminal_context.session_id}
                        </p>
                        <p className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
                          Pane: {node.terminal_context.pane_id}
                        </p>
                      </div>
                    ) : (
                      <button type="button"
                        onClick={() => handleSpawnForNode(selectedNodeId)}
                        className="w-full px-3 py-2 bg-green-600 text-white rounded text-sm font-bold hover:bg-green-700 transition-colors shadow-sm"
                      >
                        SPAWN TERMINAL
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
