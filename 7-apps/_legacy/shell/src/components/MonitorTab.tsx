import React, { useEffect, useState, useRef } from 'react';

interface CanvasEvent {
  type: string;
  topic: string;
  payload: any;
  ts: number;
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

interface MonitorTabProps {
  eventStream?: EventLog[];
  agents?: AgentStatus[];
  workflows?: WorkflowState[];
}

export const MonitorTab: React.FC<MonitorTabProps> = ({ eventStream, agents, workflows }) => {
  const [events, setEvents] = useState<CanvasEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/v1/events/ws`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          setEvents(prev => [...prev, parsed]);
        } catch (e) {
          console.error('[Monitor] Failed to parse event', e);
        }
      };

      ws.onclose = () => {
        setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  const getEventColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'render': return '#4caf50';
      case 'status': return '#ffeb3b';
      case 'toolresult': return '#2196f3';
      case 'notification': return '#e91e63';
      default: return '#ffffff';
    }
  };

  // Combine WebSocket events with event stream data if provided
  const combinedEvents = [...events];
  if (eventStream) {
    eventStream.forEach(log => {
      combinedEvents.push({
        type: log.level,
        topic: 'log',
        payload: { message: log.message, source: log.source, details: log.details },
        ts: Date.parse(log.timestamp)
      });
    });
  }

  return (
    <div className="monitor-tab" style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#000',
      color: '#fff',
      fontFamily: 'Consolas, monospace',
      fontSize: '13px',
      overflow: 'hidden'
    }}>
      <div style={{ padding: '4px 8px', background: '#111', borderBottom: '1px solid #333', color: '#888' }}>
        Canvas Event Stream
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {combinedEvents.map((e, i) => (
          <div key={i} style={{ marginBottom: '4px', display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ color: '#666', marginRight: '8px', minWidth: '70px', fontSize: '0.9em' }}>
              {new Date(e.ts).toLocaleTimeString()}
            </span>
            <div style={{ flex: 1 }}>
              <span style={{ color: getEventColor(e.type), marginRight: '8px', fontWeight: 'bold' }}>
                [{e.topic}]
              </span>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#ddd' }}>
                {JSON.stringify(e.payload)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
