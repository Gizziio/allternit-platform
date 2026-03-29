/**
 * KanbanDAG - Real DAG Visualization with Interactive Orchestration
 * 
 * Features:
 * - Fetches and displays real DAGs from Rails backend
 * - Interactive node execution
 * - Real-time status updates
 * - Click to view details and execute
 */

import React, { useEffect, useState } from 'react';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import {
  GitBranch,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Warning,
  ArrowsClockwise,
  CaretRight,
  DotsThreeOutline,
} from '@phosphor-icons/react';
import { GlassCard } from '../../design/GlassCard';

interface DagNode {
  id: string;
  title: string;
  status: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'blocked';
  dependencies: string[];
  wih_id?: string;
}

interface DagEdge {
  from: string;
  to: string;
}

export function KanbanDAG() {
  const {
    dags,
    currentDag,
    selectedDagId,
    executions,
    isLoading,
    fetchDags,
    fetchDagDetails,
    executeDag,
    selectDag,
    setActiveMainTab,
  } = useUnifiedStore();

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dagData, setDagData] = useState<{ nodes: DagNode[]; edges: DagEdge[] }>({ nodes: [], edges: [] });

  // Fetch DAGs on mount
  useEffect(() => {
    fetchDags();
  }, [fetchDags]);

  // Fetch detailed DAG data when selected
  useEffect(() => {
    if (selectedDagId) {
      fetchDagDetails(selectedDagId).then(dag => {
        if (dag && dag.nodes) {
          // Transform nodes to include status from WIHs if available
          const nodesWithStatus = dag.nodes.map((node: any) => ({
            id: node.node_id || node.id,
            title: node.title || node.node_id || node.id,
            status: node.status || 'pending',
            dependencies: node.dependencies || node.parents || [],
            wih_id: node.wih_id,
          }));
          setDagData({
            nodes: nodesWithStatus,
            edges: dag.edges || [],
          });
        }
      });
    }
  }, [selectedDagId, fetchDagDetails, executions]);

  const handleExecuteDag = async (dagId: string) => {
    try {
      await executeDag(dagId);
    } catch (err) {
      console.error('Failed to execute DAG:', err);
    }
  };

  const handleOpenInPlan = () => {
    setActiveMainTab('plan');
    if (selectedDagId) {
      selectDag(selectedDagId);
    }
  };

  // Calculate node positions for simple tree layout
  const calculateLayout = () => {
    const levels: Record<string, number> = {};
    const visited = new Set<string>();

    const getLevel = (nodeId: string): number => {
      if (levels[nodeId] !== undefined) return levels[nodeId];
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const node = dagData.nodes.find(n => n.id === nodeId);
      if (!node || !node.dependencies || node.dependencies.length === 0) {
        levels[nodeId] = 0;
        return 0;
      }

      const maxDepLevel = Math.max(...node.dependencies.map(getLevel));
      levels[nodeId] = maxDepLevel + 1;
      return levels[nodeId];
    };

    dagData.nodes.forEach(node => getLevel(node.id));
    return levels;
  };

  const nodeLevels = calculateLayout();
  const maxLevel = Math.max(0, ...Object.values(nodeLevels));

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      overflow: 'hidden',
      background: 'var(--bg-primary)'
    }}>
      {/* DAG List Sidebar */}
      <div style={{ 
        width: 280, 
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ 
          padding: 16, 
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>DAG Plans</h3>
          <button 
            onClick={() => fetchDags()}
            disabled={isLoading}
            style={{
              padding: 6,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <ArrowsClockwise size={14} color="#888" className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
          {dags.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
              <GitBranch size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p style={{ fontSize: 13 }}>No DAGs yet</p>
              <button
                onClick={handleOpenInPlan}
                style={{
                  marginTop: 12,
                  padding: '8px 16px',
                  background: '#0a84ff',
                  border: 'none',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Create DAG
              </button>
            </div>
          ) : (
            dags.map(dag => (
              <div
                key={dag.dagId}
                onClick={() => selectDag(dag.dagId)}
                style={{
                  padding: 12,
                  marginBottom: 8,
                  background: selectedDagId === dag.dagId ? '#0a84ff20' : 'var(--bg-primary)',
                  border: `1px solid ${selectedDagId === dag.dagId ? '#0a84ff' : 'var(--border-subtle)'}`,
                  borderRadius: 8,
                  cursor: 'pointer'
                }}
              >
                <div style={{ 
                  fontSize: 13, 
                  fontWeight: 600,
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {dag.metadata?.title || dag.dagId}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {dag.nodes?.length || 0} nodes • v{dag.version}
                </div>
                <div style={{ 
                  display: 'flex', 
                  gap: 8, 
                  marginTop: 8,
                  fontSize: 10,
                  color: '#666'
                }}>
                  <span>{new Date(dag.createdAt).toLocaleDateString()}</span>
                  {executions.some(e => e.dagId === dag.dagId && e.status === 'running') && (
                    <span style={{ color: '#f59e0b' }}>Running</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {selectedDagId && (
          <div style={{ 
            padding: 12, 
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            gap: 8
          }}>
            <button
              onClick={() => handleExecuteDag(selectedDagId)}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '10px',
                background: '#0a84ff',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Play size={14} />
              Execute DAG
            </button>
            <button
              onClick={handleOpenInPlan}
              style={{
                padding: '10px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                color: '#888',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              <CaretRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* DAG Visualization */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: 24,
        position: 'relative'
      }}>
        {!selectedDagId ? (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#666'
          }}>
            <GitBranch size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Select a DAG to view its structure</p>
          </div>
        ) : dagData.nodes.length === 0 ? (
          <div style={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            color: '#666'
          }}>
            {isLoading ? (
              <>
                <ArrowsClockwise size={48} className="animate-spin" style={{ marginBottom: 16 }} />
                <p>Loading DAG structure...</p>
              </>
            ) : (
              <>
                <Warning size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
                <p>No nodes in this DAG</p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 40, minHeight: '100%' }}>
            {Array.from({ length: maxLevel + 1 }, (_, level) => (
              <div key={level} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 16,
                minWidth: 220
              }}>
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 700, 
                  color: '#888',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  padding: '0 8px'
                }}>
                  Level {level}
                </div>
                {dagData.nodes
                  .filter(node => nodeLevels[node.id] === level)
                  .map(node => (
                    <DagNodeCard
                      key={node.id}
                      node={node}
                      isSelected={selectedNode === node.id}
                      onClick={() => setSelectedNode(node.id)}
                    />
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div style={{ 
          width: 300,
          borderLeft: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Node Details</h4>
          {(() => {
            const node = dagData.nodes.find(n => n.id === selectedNode);
            if (!node) return null;
            return (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>ID</label>
                  <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{node.id}</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Title</label>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{node.title}</div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Status</label>
                  <NodeStatusBadge status={node.status} />
                </div>
                {node.dependencies.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Dependencies</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {node.dependencies.map(depId => (
                        <div key={depId} style={{ 
                          fontSize: 12, 
                          padding: '4px 8px',
                          background: 'var(--bg-primary)',
                          borderRadius: 4
                        }}>
                          {depId}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {node.wih_id && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>WIH ID</label>
                    <div style={{ fontSize: 12, fontFamily: 'monospace' }}>{node.wih_id}</div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function DagNodeCard({ 
  node, 
  isSelected, 
  onClick 
}: { 
  node: DagNode; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  return (
    <div onClick={onClick} style={{ cursor: 'pointer' }}>
    <GlassCard
      style={{
        padding: 12,
        border: `1px solid ${isSelected ? '#0a84ff' : 'var(--border-subtle)'}`,
        background: isSelected ? '#0a84ff10' : undefined
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 8,
        marginBottom: 8
      }}>
        <NodeStatusIcon status={node.status} />
        <span style={{ 
          fontSize: 13, 
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {node.title}
        </span>
      </div>
      <div style={{ fontSize: 10, color: '#888' }}>
        {node.dependencies.length} dependencies
      </div>
    </GlassCard>
    </div>
  );
}

function NodeStatusIcon({ status }: { status: string }) {
  const iconProps = { size: 14 };
  switch (status) {
    case 'completed':
      return <CheckCircle {...iconProps} color="#34c759" />;
    case 'failed':
      return <XCircle {...iconProps} color="#ff3b30" />;
    case 'running':
      return <Clock {...iconProps} color="#0a84ff" />;
    case 'blocked':
      return <Warning {...iconProps} color="#f59e0b" />;
    default:
      return <DotsThreeOutline {...iconProps} color="#888" />;
  }
}

function NodeStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: '#888',
    ready: '#0a84ff',
    running: '#f59e0b',
    completed: '#34c759',
    failed: '#ff3b30',
    blocked: '#ff9500',
  };

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '4px 10px',
      background: `${colors[status] || '#888'}20`,
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      color: colors[status] || '#888',
      textTransform: 'uppercase'
    }}>
      <NodeStatusIcon status={status} />
      {status}
    </span>
  );
}

export default KanbanDAG;
