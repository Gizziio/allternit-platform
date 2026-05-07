import React, { useEffect, useState } from 'react';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import {
  Warning,
  User,
  ArrowsClockwise,
} from '@phosphor-icons/react';

import { KanbanDAG } from './KanbanDAG';

const COLUMNS: { id: string; label: string; color: string }[] = [
  { id: 'open', label: 'Backlog', color: 'var(--ui-text-muted)' },
  { id: 'ready', label: 'Ready', color: 'var(--status-info)' },
  { id: 'signed', label: 'In Progress', color: 'var(--status-warning)' },
  { id: 'blocked', label: 'Blocked', color: 'var(--status-error)' },
  { id: 'closed', label: 'Done', color: 'var(--status-success)' }
];

export function KanbanBoard() {
  const { 
    wihs, 
    selectedWihId, 
    selectWih,
    pickupWih,
    closeWih,
    fetchWihs,
    setActiveMainTab,
    isLoading,
  } = useUnifiedStore();

  const [view, setView] = useState<'board' | 'dag'>('board');
  const [draggedWih, setDraggedWih] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Fetch WIHs on mount
  useEffect(() => {
    fetchWihs();
  }, [fetchWihs]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWihs();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchWihs]);

  const handleWihClick = (wihId: string): void => {
    selectWih(wihId);
    setActiveMainTab('work');
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, wihId: string): void => {
    setDraggedWih(wihId);
    e.dataTransfer.effectAllowed = 'move';
    // Set drag image if needed
  };

  const handleDragOver = (e: React.DragEvent, columnId: string): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(columnId);
  };

  const handleDragLeave = (): void => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string): Promise<void> => {
    e.preventDefault();
    setDropTarget(null);
    
    if (!draggedWih) return;
    
    const wih = wihs.find(w => w.wih_id === draggedWih);
    if (!wih) return;
    
    // Don't do anything if dropping in same column
    if (wih.status === targetStatus) {
      setDraggedWih(null);
      return;
    }

    setIsUpdating(true);
    
    try {
      // Perform the appropriate action based on the transition
      if ((wih.status === 'open' || wih.status === 'ready') && targetStatus === 'signed') {
        // Pickup the WIH
        if (wih.dag_id) {
          await pickupWih(wih.dag_id, wih.node_id, `agent_${Date.now()}`, 'builder');
        }
      } else if ((wih.status === 'signed' || wih.status === 'in_progress') && targetStatus === 'closed') {
        // Complete the WIH
        await closeWih(wih.wih_id, 'completed');
      } else if ((wih.status === 'signed' || wih.status === 'in_progress') && targetStatus === 'blocked') {
        // Fail the WIH (transition to blocked via failure)
        await closeWih(wih.wih_id, 'failed');
      } else if (wih.status === 'blocked' && targetStatus === 'ready') {
        // Unblock - would need API endpoint for this
        console.log('Unblocking WIH:', wih.wih_id);
        // For now, just refresh to get updated state
        await fetchWihs();
      } else {
        // For other transitions, just log (would need specific API endpoints)
        console.log(`Transitioning WIH ${wih.wih_id} from ${wih.status} to ${targetStatus}`);
        // Refresh to get current state from server
        await fetchWihs();
      }
    } catch (err) {
      console.error('Failed to update WIH status:', err);
    } finally {
      setDraggedWih(null);
      setIsUpdating(false);
    }
  };

  const selectedWih = wihs.find(w => w.wih_id === selectedWihId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        padding: '8px 16px', 
        borderBottom: '1px solid var(--border-subtle)', 
        background: 'rgba(0,0,0,0.02)',
        alignItems: 'center'
      }}>
        <button 
          onClick={() => setView('board')} 
          style={{ 
            padding: '4px 12px', 
            borderRadius: 6, 
            fontSize: 11, 
            fontWeight: 700, 
            cursor: 'pointer', 
            border: 'none', 
            background: view === 'board' ? 'var(--accent-chat)' : 'transparent', 
            color: view === 'board' ? 'white' : 'var(--text-tertiary)' 
          }}
        >
          BOARD
        </button>
        <button 
          onClick={() => setView('dag')} 
          style={{ 
            padding: '4px 12px', 
            borderRadius: 6, 
            fontSize: 11, 
            fontWeight: 700, 
            cursor: 'pointer', 
            border: 'none', 
            background: view === 'dag' ? 'var(--accent-chat)' : 'transparent', 
            color: view === 'dag' ? 'white' : 'var(--text-tertiary)' 
          }}
        >
          DAG VIEW
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => fetchWihs()}
          disabled={isLoading}
          style={{
            padding: '6px 12px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            opacity: isLoading ? 0.5 : 1
          }}
        >
          <ArrowsClockwise size={12} className={isLoading ? 'animate-spin' : ''} />
          Refresh
        </button>
        {isUpdating && (
          <span style={{ fontSize: 11, color: 'var(--ui-text-muted)' }}>Updating...</span>
        )}
      </div>
      
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {view === 'board' ? (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            gap: 16, 
            padding: 16, 
            overflowX: 'auto',
            background: draggedWih ? 'rgba(10,132,255,0.02)' : undefined
          }}>
            {COLUMNS.map(col => (
              <div 
                key={col.id} 
                style={{ 
                  width: 280, 
                  flexShrink: 0, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 12,
                  opacity: draggedWih && dropTarget && dropTarget !== col.id ? 0.5 : 1
                }}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
              >
                {/* Column Header */}
                <div style={{ 
                  fontSize: 11, 
                  fontWeight: 800, 
                  textTransform: 'uppercase',
                  padding: '8px 12px',
                  background: dropTarget === col.id ? `${col.color}30` : 'var(--bg-secondary)',
                  border: `2px solid ${dropTarget === col.id ? col.color : 'transparent'}`,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}>
                  <span style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: col.color 
                  }} />
                  {col.label}
                  <span style={{ 
                    marginLeft: 'auto',
                    padding: '2px 8px',
                    background: 'var(--bg-primary)',
                    borderRadius: 10,
                    fontSize: 10
                  }}>
                    {wihs.filter(n => n.status === col.id).length}
                  </span>
                </div>

                {/* Drop Zone Indicator */}
                {dropTarget === col.id && draggedWih && (
                  <div style={{
                    padding: 12,
                    border: `2px dashed ${col.color}`,
                    borderRadius: 8,
                    background: `${col.color}10`,
                    textAlign: 'center',
                    fontSize: 12,
                    color: col.color
                  }}>
                    Drop here to move to {col.label}
                  </div>
                )}

                {/* WIH Cards */}
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 10,
                  overflowY: 'auto',
                  padding: 4
                }}>
                  {wihs.filter(n => n.status === col.id).map(wih => (
                    <div 
                      key={wih.wih_id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, wih.wih_id)}
                      onClick={() => handleWihClick(wih.wih_id)}
                      style={{
                        opacity: draggedWih === wih.wih_id ? 0.5 : 1,
                        cursor: 'grab'
                      }}
                    >
                      <TaskCard 
                        wih={wih} 
                        isActive={selectedWihId === wih.wih_id}
                      />
                    </div>
                  ))}
                  {wihs.filter(n => n.status === col.id).length === 0 && (
                    <div style={{
                      padding: 20,
                      textAlign: 'center',
                      color: 'var(--ui-text-muted)',
                      fontSize: 12,
                      border: '1px dashed var(--border-subtle)',
                      borderRadius: 8
                    }}>
                      No items
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <KanbanDAG />
        )}
      </div>

      {/* Task Inspector Panel */}
      {selectedWih && (
        <div style={{ 
          width: 350, 
          background: 'var(--bg-secondary)', 
          borderLeft: '1px solid var(--border-subtle)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          animation: 'slideIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{selectedWih.title || selectedWih.wih_id}</h3>
            <button onClick={() => selectWih(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}>✕</button>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {COLUMNS.map(col => (
              <button
                key={col.id}
                onClick={() => {
                  // Status change would go here via API
                  console.log('Change status to:', col.id);
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: '1px solid var(--border-subtle)',
                  background: selectedWih.status === col.id ? col.color : 'transparent',
                  color: selectedWih.status === col.id ? 'white' : 'var(--text-secondary)'
                }}
              >
                {col.label.toUpperCase()}
              </button>
            ))}
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <div><strong>WIH ID:</strong> {selectedWih.wih_id}</div>
            <div><strong>Node ID:</strong> {selectedWih.node_id}</div>
            {selectedWih.dag_id && <div><strong>DAG ID:</strong> {selectedWih.dag_id}</div>}
            {selectedWih.assignee && <div><strong>Assignee:</strong> {selectedWih.assignee}</div>}
          </div>

          {selectedWih.blocked_by && selectedWih.blocked_by.length > 0 && (
            <div style={{
              padding: 12,
              background: 'var(--status-error-bg)',
              border: '1px solid #ff3b3030',
              borderRadius: 6
            }}>
              <div style={{ 
                fontSize: 11, 
                fontWeight: 700, 
                color: 'var(--status-error)',
                marginBottom: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Warning size={12} />
                BLOCKED BY
              </div>
              {selectedWih.blocked_by.map(depId => (
                <div key={depId} style={{ 
                  fontSize: 12, 
                  fontFamily: 'var(--font-mono)',
                  padding: '4px 8px',
                  background: 'var(--bg-primary)',
                  borderRadius: 4,
                  marginBottom: 4
                }}>
                  {depId}
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.5, marginBottom: 8 }}>ACTIONS</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(selectedWih.status === 'open' || selectedWih.status === 'ready') && selectedWih.dag_id && (
                <button
                  onClick={() => selectedWih.dag_id && pickupWih(selectedWih.dag_id, selectedWih.node_id, `agent_${Date.now()}`, 'builder')}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'var(--status-info)',
                    border: 'none',
                    borderRadius: 6,
                    color: 'var(--ui-text-inverse)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Pickup Work
                </button>
              )}
              {(selectedWih.status === 'signed' || selectedWih.status === 'in_progress') && (
                <>
                  <button
                    onClick={() => closeWih(selectedWih.wih_id, 'completed')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: 'var(--status-success)',
                      border: 'none',
                      borderRadius: 6,
                      color: 'var(--ui-text-inverse)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Complete
                  </button>
                  <button
                    onClick={() => closeWih(selectedWih.wih_id, 'failed')}
                    style={{
                      flex: 1,
                      padding: '8px',
                      background: 'var(--status-error)',
                      border: 'none',
                      borderRadius: 6,
                      color: 'var(--ui-text-inverse)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Fail
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface WihInfo {
  wih_id: string;
  node_id: string;
  dag_id?: string;
  status: string;
  title?: string;
  assignee?: string;
  blocked_by?: string[];
}

function TaskCard({ wih, isActive }: { wih: WihInfo; isActive: boolean }) {
  const column = COLUMNS.find(c => c.id === wih.status);
  
  return (
    <div 
      style={{ 
        padding: 12, 
        cursor: 'grab', 
        border: isActive ? '1px solid var(--accent-chat)' : '1px solid var(--border-subtle)',
        background: isActive ? 'rgba(10, 132, 255, 0.05)' : 'var(--glass-bg-thick)',
        borderLeft: `3px solid ${column?.color || 'var(--ui-text-muted)'}`,
        borderRadius: 8
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{wih.title || wih.wih_id}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.5, fontSize: 10 }}>
          <User size={12} />
          {wih.node_id}
        </div>
        {wih.blocked_by && wih.blocked_by.length > 0 && (
          <div style={{ 
            fontSize: 10, 
            background: 'rgba(255,59,48,0.1)', 
            color: 'var(--status-error)', 
            padding: '2px 6px', 
            borderRadius: 4, 
            fontWeight: 700 
          }}>
            BLOCKED
          </div>
        )}
        {wih.assignee && (
          <div style={{ 
            fontSize: 10, 
            background: 'rgba(16,185,129,0.1)', 
            color: 'var(--status-success)', 
            padding: '2px 6px', 
            borderRadius: 4, 
            fontWeight: 700 
          }}>
            ASSIGNED
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanBoard;
