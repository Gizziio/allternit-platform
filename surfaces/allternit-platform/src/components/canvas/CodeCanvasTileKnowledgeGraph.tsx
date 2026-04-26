"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { fetchH5iClaims, fetchH5iSummaries, type H5iClaim, type H5iSummary } from '@/lib/h5i/client';

interface CodeCanvasTileKnowledgeGraphProps {
  workspacePath?: string;
}

interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  status: 'live' | 'stale' | 'file' | 'summary';
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
}

const NODE_COLORS: Record<string, string> = {
  live: '#10b981',
  stale: '#ef4444',
  file: '#8b5cf6',
  summary: '#f59e0b',
};

function buildGraph(claims: H5iClaim[], summaries: H5iSummary[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let nodeId = 0;
  const fileNodeMap = new Map<string, string>();

  claims.forEach((claim) => {
    const id = `claim-${nodeId++}`;
    nodes.push({
      id,
      label: claim.text.slice(0, 60),
      status: claim.status,
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 200,
    });

    claim.paths.forEach((path) => {
      let fileId = fileNodeMap.get(path);
      if (!fileId) {
        fileId = `file-${nodeId++}`;
        fileNodeMap.set(path, fileId);
        nodes.push({
          id: fileId,
          label: path.split('/').pop() || path,
          sublabel: path,
          status: 'file',
          x: 100 + Math.random() * 300,
          y: 100 + Math.random() * 200,
        });
      }
      edges.push({ source: id, target: fileId });
    });
  });

  summaries.forEach((summary) => {
    const id = `summary-${nodeId++}`;
    const fileName = summary.path.split('/').pop() || summary.path;
    nodes.push({
      id,
      label: fileName,
      sublabel: summary.text.slice(0, 80),
      status: 'summary',
      x: 100 + Math.random() * 300,
      y: 100 + Math.random() * 200,
    });

    const fileId = fileNodeMap.get(summary.path);
    if (fileId) {
      edges.push({ source: fileId, target: id });
    }
  });

  // Simple force-directed layout
  for (let i = 0; i < 30; i++) {
    const positions = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y, fx: 0, fy: 0 }]));

    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const pa = positions.get(nodes[a].id)!;
        const pb = positions.get(nodes[b].id)!;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = 3000 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        pa.fx += fx; pa.fy += fy;
        pb.fx -= fx; pb.fy -= fy;
      }
    }

    edges.forEach((e) => {
      const pa = positions.get(e.source)!;
      const pb = positions.get(e.target)!;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - 100) * 0.05;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      pa.fx += fx; pa.fy += fy;
      pb.fx -= fx; pb.fy -= fy;
    });

    positions.forEach((p) => {
      p.fx += (250 - p.x) * 0.02;
      p.fy += (200 - p.y) * 0.02;
    });

    nodes.forEach((n) => {
      const p = positions.get(n.id)!;
      n.x += Math.max(-15, Math.min(15, p.fx));
      n.y += Math.max(-15, Math.min(15, p.fy));
    });
  }

  const minX = Math.min(...nodes.map((n) => n.x));
  const minY = Math.min(...nodes.map((n) => n.y));
  nodes.forEach((n) => {
    n.x -= minX - 20;
    n.y -= minY - 20;
  });

  return { nodes, edges };
}

export function CodeCanvasTileKnowledgeGraph({ workspacePath }: CodeCanvasTileKnowledgeGraphProps) {
  const [claims, setClaims] = useState<H5iClaim[]>([]);
  const [summaries, setSummaries] = useState<H5iSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!workspacePath) return;
    setLoading(true);
    setError('');
    try {
      const [c, s] = await Promise.all([fetchH5iClaims(workspacePath), fetchH5iSummaries(workspacePath)]);
      setClaims(c.claims ?? []);
      setSummaries(s.summaries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  const { nodes, edges } = React.useMemo(() => buildGraph(claims, summaries), [claims, summaries]);

  if (loading && claims.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Loading knowledge graph...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: 12, gap: 8 }}>
        <div>{error}</div>
        <button onClick={load} style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No knowledge data. Run an audit or create claims.
      </div>
    );
  }

  const maxX = Math.max(...nodes.map((n) => n.x));
  const maxY = Math.max(...nodes.map((n) => n.y));

  return (
    <div style={{ height: '100%', width: '100%', overflow: 'auto', background: '#0b0e10' }}>
      <svg width={maxX + 120} height={maxY + 120} style={{ minWidth: '100%', minHeight: '100%' }}>
        {edges.map((e, i) => {
          const src = nodes.find((n) => n.id === e.source);
          const tgt = nodes.find((n) => n.id === e.target);
          if (!src || !tgt) return null;
          return (
            <line
              key={i}
              x1={src.x + 60}
              y1={src.y + 20}
              x2={tgt.x + 60}
              y2={tgt.y + 20}
              stroke={NODE_COLORS[src.status] + '50'}
              strokeWidth={1.5}
            />
          );
        })}
        {nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
            <rect
              width={120}
              height={40}
              rx={8}
              fill={NODE_COLORS[n.status] + '15'}
              stroke={NODE_COLORS[n.status] + '40'}
              strokeWidth={1}
            />
            <text x={60} y={18} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={600}>
              {n.label.length > 18 ? n.label.slice(0, 18) + '...' : n.label}
            </text>
            {n.sublabel && (
              <text x={60} y={32} textAnchor="middle" fill="#888" fontSize={8}>
                {n.sublabel.length > 22 ? n.sublabel.slice(0, 22) + '...' : n.sublabel}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
