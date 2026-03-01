import * as React from 'react';

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

interface CanvasVisualizerProps {
  zones?: Zone[];
  agents?: Agent[];
  tasks?: Task[];
  actions?: ActionEvent[];
  onAgentClick?: (agentId: string) => void;
  onZoneClick?: (zoneId: string) => void;
}

export const CanvasVisualizer: React.FC<CanvasVisualizerProps> = ({
  zones = [],
  agents = [],
  tasks = [],
  actions = [],
  onAgentClick,
  onZoneClick
}) => {
  // Use actual data provided, no sample data
  const currentZones: Zone[] = zones || [];
  const currentAgents: Agent[] = agents || [];
  const currentActions: ActionEvent[] = actions || [];

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'active': return '#4ade80';
      case 'inactive': return '#94a3b8';
      case 'warning': return '#fbbf24';
      case 'error': return '#f87171';
      case 'idle': return '#94a3b8';
      case 'working': return '#60a5fa';
      case 'paused': return '#fbbf24';
      default: return '#94a3b8';
    }
  };

  const getTypeColor = (type: string) => {
    switch(type) {
      case 'code': return '#60a5fa';
      case 'qa': return '#fbbf24';
      case 'ops': return '#8b5cf6';
      case 'storage': return '#34d399';
      case 'network': return '#f472b6';
      default: return '#9ca3af';
    }
  };

  const renderZone = (zone: Zone) => (
    <div
      key={zone.id}
      className={`zone zone-${zone.status}`}
      style={{
        position: 'absolute',
        left: `${zone.position.x}px`,
        top: `${zone.position.y}px`,
        width: `${zone.size.width}px`,
        height: `${zone.size.height}px`,
        border: `2px solid ${getStatusColor(zone.status)}`,
        backgroundColor: `${getTypeColor(zone.type)}20`,
        borderRadius: '8px',
        padding: '8px',
        zIndex: 1
      }}
      onClick={() => onZoneClick?.(zone.id)}
    >
      <div className="zone-header">
        <strong>{zone.name}</strong>
        <span className="zone-type">{zone.type}</span>
      </div>
      {zone.capacity && (
        <div className="zone-capacity">
          Capacity: {zone.capacity}
        </div>
      )}
      {zone.limits && (
        <div className="zone-limits">
          Limits: {zone.limits}
        </div>
      )}
    </div>
  );

  const renderAgent = (agent: Agent) => (
    <div
      key={agent.id}
      className={`agent agent-${agent.status}`}
      style={{
        position: 'absolute',
        left: `${agent.position.x}px`,
        top: `${agent.position.y}px`,
        width: '60px',
        height: '80px',
        backgroundColor: '#ffffff',
        border: `2px solid ${getStatusColor(agent.status)}`,
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px',
        zIndex: 2,
        cursor: 'pointer',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}
      onClick={() => onAgentClick?.(agent.id)}
    >
      <div className="agent-avatar" style={{ fontSize: '24px' }}>
        {agent.avatar}
      </div>
      <div className="agent-name" style={{ fontSize: '10px', textAlign: 'center' }}>
        {agent.name}
      </div>
    </div>
  );

  const renderAction = (action: ActionEvent) => {
    if (!action.active) return null;

    // Find positions of source and target
    let sourcePos = { x: 100, y: 100 }; // default
    let targetPos = { x: 200, y: 200 }; // default

    if (action.sourceId !== 'queue') {
      const sourceAgent = currentAgents.find(a => a.id === action.sourceId);
      if (sourceAgent) sourcePos = sourceAgent.position;
    }

    const targetAgent = currentAgents.find(a => a.id === action.targetId);
    if (targetAgent) targetPos = targetAgent.position;

    const midX = (sourcePos.x + targetPos.x) / 2;
    const midY = (sourcePos.y + targetPos.y) / 2;

    return (
      <div
        key={action.id}
        className={`action action-${action.type}`}
        style={{
          position: 'absolute',
          left: `${midX}px`,
          top: `${midY}px`,
          transform: 'translate(-50%, -50%)',
          zIndex: 3,
          animation: 'pulse 1.5s infinite'
        }}
      >
        {action.type === 'task-assigned' && '📩'}
        {action.type === 'tool-call' && '⚡'}
        {action.type === 'spawn' && '🔄'}
      </div>
    );
  };

  return (
    <div className="canvas-visualizer" style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: '#f1f5f9',
      overflow: 'hidden'
    }}>
      <style>
        {`
          @keyframes pulse {
            0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
            50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.7; }
            100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          }

          .zone-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 4px;
          }

          .zone-type {
            font-size: 10px;
            background-color: #64748b;
            color: white;
            padding: 2px 6px;
            border-radius: 10px;
          }

          .zone-capacity, .zone-limits {
            font-size: 11px;
            color: #64748b;
          }

          .agent-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
        `}
      </style>

      {/* Render zones */}
      {currentZones.map(renderZone)}

      {/* Render agents */}
      {currentAgents.map(renderAgent)}

      {/* Render actions */}
      {currentActions.map(renderAction)}

      {/* Grid pattern for depth effect */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 0, 0, 0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 0, 0, 0.05) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px',
        pointerEvents: 'none',
        zIndex: 0
      }} />
    </div>
  );
};