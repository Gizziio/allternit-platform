import * as React from 'react';
import { CanvasVisualizer } from './CanvasVisualizer';

interface MiniMapItem {
  id: string;
  type: 'zone' | 'agent' | 'task';
  name: string;
  status: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

interface Zone {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive' | 'warning' | 'error';
  capacity?: number;
  limits?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
}

interface Agent {
  id: string;
  name: string;
  avatar: string;
  status: 'idle' | 'working' | 'paused' | 'error';
  zoneId?: string;
  position: { x: number; y: number };
}

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assigneeId?: string;
  zoneId?: string;
}

interface ActionEvent {
  id: string;
  type: 'task-assigned' | 'tool-call' | 'spawn';
  sourceId: string;
  targetId: string;
  timestamp: number;
  active: boolean;
}

interface ObserveViewProps {
  items?: MiniMapItem[];
  onItemSelect?: (itemId: string, itemType: string) => void;
  onZoomToItem?: (itemId: string) => void;
  eventStream?: EventLog[];
  agents?: AgentStatus[];
  workflows?: WorkflowState[];
  tasks?: Task[];
  agentsList?: Agent[];
  zones?: Zone[];
}

interface EventLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  source: string;
  message: string;
  details?: Record<string, any>;
}

interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'working' | 'paused' | 'error';
  lastActivity: string;
  workload: number;
}

interface WorkflowState {
  id: string;
  name: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  progress: number;
  startTime: string;
  estimatedCompletion?: string;
}

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in-progress' | 'review' | 'done';
  assigneeId?: string;
  createdAt: string;
  updatedAt: string;
}

interface Agent {
  id: string;
  name: string;
  avatar: string;
}

interface ObserveViewProps {
  items?: MiniMapItem[];
  onItemSelect?: (itemId: string, itemType: string) => void;
  onZoomToItem?: (itemId: string) => void;
  eventStream?: EventLog[];
  agents?: AgentStatus[];
  workflows?: WorkflowState[];
  tasks?: Task[];
  agentsList?: Agent[];
}

export const ObserveView: React.FC<ObserveViewProps> = ({
  items = [],
  onItemSelect,
  onZoomToItem,
  eventStream,
  agents,
  workflows,
  tasks,
  agentsList,
  zones
}) => {
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'minimap' | 'inspector'>('minimap');

  // Convert the provided data to MiniMapItems
  const convertedItems: MiniMapItem[] = [];

  // Convert zones
  if (zones && zones.length > 0) {
    zones.forEach((zone, index) => {
      convertedItems.push({
        id: zone.id,
        type: 'zone',
        name: zone.name,
        status: zone.status,
        position: { x: 10 + (index * 90), y: 10 },
        size: zone.size
      });
    });
  }

  // Convert agents
  if (agents && agents.length > 0) {
    agents.forEach((agent, index) => {
      convertedItems.push({
        id: agent.id,
        type: 'agent',
        name: agent.name,
        status: agent.status,
        position: { x: 20 + (index * 90), y: 30 }
      });
    });
  }

  // Convert tasks
  if (tasks && tasks.length > 0) {
    tasks.forEach((task, index) => {
      convertedItems.push({
        id: task.id,
        type: 'task',
        name: task.title,
        status: task.status,
        position: { x: 30 + (index * 90), y: 50 }
      });
    });
  }

  // Add any items that were passed directly
  if (items && items.length > 0) {
    convertedItems.push(...items);
  }

  const selectedItem = selectedItemId ? convertedItems.find(item => item.id === selectedItemId) : null;

  const handleItemClick = (item: MiniMapItem) => {
    setSelectedItemId(item.id);
    onItemSelect?.(item.id, item.type);
    setViewMode('inspector');
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return '#4ade80';
      case 'inactive': return '#94a3b8';
      case 'warning': return '#fbbf24';
      case 'error': return '#f87171';
      case 'idle': return '#94a3b8';
      case 'working': return '#60a5fa';
      case 'todo': return '#94a3b8';
      case 'in-progress': return '#60a5fa';
      case 'review': return '#fbbf24';
      case 'done': return '#4ade80';
      default: return '#9ca3af';
    }
  };

  return (
    <div className="observe-view" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: '#f8fafc'
    }}>
      <div className="observe-header" style={{
        padding: '12px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{
          margin: 0,
          fontSize: '16px',
          color: '#1e293b'
        }}>
          {viewMode === 'minimap' ? 'Mini-Map Inspector' : 'Inspector Detail'}
        </h3>
        <div className="view-mode-toggle">
          <button
            className={`mode-btn ${viewMode === 'minimap' ? 'active' : ''}`}
            onClick={() => setViewMode('minimap')}
            style={{
              padding: '4px 12px',
              border: '1px solid #cbd5e1',
              backgroundColor: viewMode === 'minimap' ? '#e2e8f0' : 'white',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '4px'
            }}
          >
            Mini-Map
          </button>
          <button
            className={`mode-btn ${viewMode === 'inspector' ? 'active' : ''}`}
            onClick={() => setViewMode('inspector')}
            style={{
              padding: '4px 12px',
              border: '1px solid #cbd5e1',
              backgroundColor: viewMode === 'inspector' ? '#e2e8f0' : 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Inspector
          </button>
        </div>
      </div>

      <div className="observe-content" style={{
        flex: 1,
        overflow: 'hidden',
        padding: '8px'
      }}>
        {viewMode === 'minimap' ? (
          <div className="minimap-container" style={{
            position: 'relative',
            width: '100%',
            height: 'calc(100% - 40px)', // Account for header
            backgroundColor: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            {/* Full-size CanvasVisualizer */}
            <CanvasVisualizer
              zones={zones || []}
              agents={agentsList?.map((agent, index) => ({
                id: agent.id,
                name: agent.name,
                avatar: agent.avatar || '🤖',
                status: agent.status || 'idle',
                position: { x: 100 + (index * 80), y: 100 + (index * 60) } // Position agents in a grid
              })) || []}
              tasks={tasks?.map(task => ({
                id: task.id,
                title: task.title,
                status: task.status,
                assigneeId: task.assigneeId
              })) || []}
              actions={[]}
              onAgentClick={(id) => onItemSelect?.(id, 'agent')}
              onZoneClick={(id) => onItemSelect?.(id, 'zone')}
            />
          </div>
        ) : selectedItem ? (
          <div className="inspector-detail" style={{
            padding: '16px',
            backgroundColor: 'white',
            borderRadius: '6px',
            border: '1px solid #cbd5e1',
            height: 'calc(100% - 40px)', // Account for header
            overflowY: 'auto'
          }}>
            <div className="inspector-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              paddingBottom: '8px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <h4 style={{
                margin: 0,
                color: '#1e293b'
              }}>
                {selectedItem.name} ({selectedItem.type})
              </h4>
              <span style={{
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: getStatusColor(selectedItem.status),
                color: 'white',
                fontSize: '12px'
              }}>
                {selectedItem.status}
              </span>
            </div>

            <div className="inspector-properties" style={{
              marginBottom: '16px'
            }}>
              <h5 style={{
                margin: '0 0 8px 0',
                color: '#334155',
                fontSize: '14px'
              }}>
                Properties
              </h5>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px'
              }}>
                <div><strong>ID:</strong> {selectedItem.id}</div>
                <div><strong>Type:</strong> {selectedItem.type}</div>
                <div><strong>Status:</strong> {selectedItem.status}</div>
                <div><strong>Position:</strong> {selectedItem.position.x}, {selectedItem.position.y}</div>
                {selectedItem.size && (
                  <>
                    <div><strong>Width:</strong> {selectedItem.size.width}%</div>
                    <div><strong>Height:</strong> {selectedItem.size.height}%</div>
                  </>
                )}
              </div>
            </div>

            <div className="inspector-actions" style={{
              display: 'flex',
              gap: '8px'
            }}>
              <button
                className="btn-zoom"
                onClick={() => onZoomToItem?.(selectedItem.id)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Zoom to Item
              </button>
              <button
                className="btn-back"
                onClick={() => setViewMode('minimap')}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#64748b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Back to Map
              </button>
            </div>
          </div>
        ) : (
          <div className="inspector-placeholder" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 'calc(100% - 40px)', // Account for header
            color: '#94a3b8',
            fontStyle: 'italic'
          }}>
            Select an item from the canvas to inspect
          </div>
        )}
      </div>
    </div>
  );
};