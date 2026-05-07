/**
 * Topology View - Network relationship visualization
 * 
 * Features:
 * - SVG-based node graph
 * - Animated pulse lines
 * - Orbital layout
 * - Status indicators
 * - Metrics panel
 */

import React from 'react';
import { TEXT } from '@/design/allternit.tokens';
import { SwarmAgent, TopologyNode, TopologyEdge, TopologyMetrics } from '../types';

interface TopologyViewProps {
  agents: SwarmAgent[];
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  metrics: TopologyMetrics;
  modeColors: {
    accent: string;
  };
  onAgentSelect: (agentId: string) => void;
}

export function TopologyView({ 
  agents, 
  nodes, 
  edges, 
  metrics, 
  modeColors,
  onAgentSelect,
}: TopologyViewProps) {
  const orchestrator = agents.find(a => a.role === 'orchestrator');
  const workers = agents.filter(a => a.role !== 'orchestrator');

  // Calculate SVG viewBox based on nodes
  const minX = Math.min(...nodes.map(n => n.x)) - 80;
  const maxX = Math.max(...nodes.map(n => n.x)) + 80;
  const minY = Math.min(...nodes.map(n => n.y)) - 80;
  const maxY = Math.max(...nodes.map(n => n.y)) + 80;
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <div className="h-full flex">
      {/* Main Graph */}
      <div className="flex-1 relative overflow-hidden">
        <svg 
          className="absolute inset-0 w-full h-full"
          viewBox={`${minX} ${minY} ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Gradient for edges */}
            <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={modeColors.accent} stopOpacity="0.4" />
              <stop offset="100%" stopColor={modeColors.accent} stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Connection lines */}
          {edges.map((edge, idx) => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            if (!source || !target) return null;

            return (
              <g key={`${edge.source}-${edge.target}-${idx}`}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="url(#edgeGradient)"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  className="opacity-60"
                />
                {/* Animated pulse dot */}
                <circle
                  r="3"
                  fill={modeColors.accent}
                  filter="url(#glow)"
                >
                  <animateMotion
                    dur="2s"
                    repeatCount="indefinite"
                    path={`M${source.x},${source.y} L${target.x},${target.y}`}
                  />
                </circle>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const agent = agents.find(a => a.id === node.id);
            const isWorking = agent?.status === 'working';
            
            return (
              <g 
                key={node.id}
                className="cursor-pointer"
                onClick={() => onAgentSelect(node.id)}
              >
                {/* Glow ring for active */}
                {isWorking && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size / 2 + 8}
                    fill="none"
                    stroke={node.color}
                    strokeWidth="1"
                    strokeOpacity="0.3"
                    className="animate-pulse"
                  />
                )}
                
                {/* Main node circle */}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.size / 2}
                  fill={`${node.color}30`}
                  stroke={node.color}
                  strokeWidth="2"
                />
                
                {/* Icon placeholder */}
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  fill={node.color}
                  fontSize={node.size / 3}
                  fontFamily="Font Awesome 6 Free"
                >
                  ●
                </text>
                
                {/* Label */}
                <text
                  x={node.x}
                  y={node.y + node.size / 2 + 20}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="12"
                  fontWeight="500"
                >
                  {node.name}
                </text>
                
                {/* Role label */}
                <text
                  x={node.x}
                  y={node.y + node.size / 2 + 34}
                  textAnchor="middle"
                  fill={node.color}
                  fontSize="10"
                  style={{ textTransform: 'uppercase' }}
                >
                  {node.role}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div 
          className="absolute bottom-6 left-6 p-4 rounded-xl border"
          style={{ 
            background: 'rgba(13, 11, 9, 0.9)',
            borderColor: 'var(--ui-border-muted)',
          }}
        >
          <div className="text-xs font-bold mb-2" style={{ color: TEXT.tertiary }}>LEGEND</div>
          <div className="space-y-1.5">
            {orchestrator && (
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ background: orchestrator.color }}
                />
                <span className="text-xs" style={{ color: TEXT.secondary }}>
                  Orchestrator
                </span>
              </div>
            )}
            {workers.slice(0, 2).map(worker => (
              <div key={worker.id} className="flex items-center gap-2">
                <div 
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: worker.color }}
                />
                <span className="text-xs" style={{ color: TEXT.secondary }}>
                  {worker.role === 'worker' ? 'Worker' : worker.role === 'specialist' ? 'Specialist' : 'Reviewer'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Agent List */}
      <div 
        className="w-64 border-l overflow-auto"
        style={{ 
          background: 'var(--surface-hover)',
          borderColor: 'var(--ui-border-muted)',
        }}
      >
        <div 
          className="px-4 py-3 text-xs font-bold tracking-wider"
          style={{ color: TEXT.tertiary, borderBottom: '1px solid var(--surface-hover)' }}
        >
          AGENTS
        </div>
        
        <div className="p-2 space-y-1">
          {orchestrator && (
            <button
              onClick={() => onAgentSelect(orchestrator.id)}
              className="w-full p-3 rounded-xl text-left transition-all hover:bg-white/5"
              style={{ 
                background: 'rgba(217, 119, 87, 0.1)',
                border: '1px solid rgba(217, 119, 87, 0.3)',
              }}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: orchestrator.color }}
                />
                <span className="text-sm font-medium">{orchestrator.name}</span>
              </div>
              <div className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
                {orchestrator.tasksActive} threads
              </div>
            </button>
          )}
          
          {workers.map((worker) => {
            const isWorking = worker.status === 'working';
            return (
              <button
                key={worker.id}
                onClick={() => onAgentSelect(worker.id)}
                className="w-full p-3 rounded-xl text-left transition-all hover:bg-white/5"
                style={{ 
                  background: isWorking ? `${worker.color}10` : 'transparent',
                  border: `1px solid ${isWorking ? `${worker.color}30` : 'var(--surface-hover)'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div 
                    className={`w-2 h-2 rounded-full ${isWorking ? 'animate-pulse' : ''}`}
                    style={{ background: isWorking ? worker.color : TEXT.tertiary }}
                  />
                  <span className="text-sm">{worker.name}</span>
                </div>
                <div className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
                  {isWorking ? `${worker.tasksActive} threads` : 'idle'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Metrics */}
        <div 
          className="mt-4 px-4 py-3 border-t"
          style={{ borderColor: 'var(--surface-hover)' }}
        >
          <div className="text-xs font-bold mb-3" style={{ color: TEXT.tertiary }}>
            NETWORK
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span style={{ color: TEXT.secondary }}>Message rate</span>
              <span className="mono" style={{ color: modeColors.accent }}>
                {metrics.messageRate.toFixed(1)} t/s
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: TEXT.secondary }}>Avg latency</span>
              <span className="mono" style={{ color: TEXT.primary }}>
                {metrics.avgLatency} ms
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: TEXT.secondary }}>Load balance</span>
              <span className="mono" style={{ color: TEXT.primary }}>
                {(metrics.loadBalance * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: TEXT.secondary }}>Active paths</span>
              <span className="mono" style={{ color: TEXT.primary }}>
                {metrics.activePaths}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
