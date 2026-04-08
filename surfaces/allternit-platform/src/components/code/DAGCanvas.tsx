import React from 'react';

export interface DAGNode {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
  dependencies: string[];
}

export interface DAGEdge {
  from: string;
  to: string;
}

export interface DAGCanvasProps {
  nodes: DAGNode[];
  edges: DAGEdge[];
  onNodeClick?: (node: DAGNode) => void;
}

export function DAGCanvas({ nodes, edges, onNodeClick }: DAGCanvasProps) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto', background: 'var(--bg-secondary)', padding: 40 }}>
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        {edges.map((edge, i) => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;
          return (
            <line 
              key={i} 
              x1={100} y1={nodes.indexOf(fromNode) * 100 + 50} 
              x2={300} y2={nodes.indexOf(toNode) * 100 + 50} 
              stroke="var(--border-strong)" 
              strokeWidth="2" 
            />
          );
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        {nodes.map(node => (
          <div 
            key={node.id}
            onClick={() => onNodeClick?.(node)}
            style={{
              width: 200,
              padding: 12,
              borderRadius: 8,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderLeft: '4px solid ' + (
                node.status === 'completed' ? '#34c759' : 
                node.status === 'running' ? '#0a84ff' : 
                node.status === 'failed' ? '#ff3b30' : '#8e8e93'
              ),
              cursor: 'pointer',
              zIndex: 1
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.5, marginBottom: 4 }}>{node.id}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{node.title}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
