import React, { useEffect, useRef } from 'react';
import { useShellState } from '../runtime/ShellState';

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

interface OperatorConsoleProps {
  eventStream?: EventLog[];
  agents?: AgentStatus[];
  workflows?: WorkflowState[];
}

export const OperatorConsole: React.FC<OperatorConsoleProps> = ({ eventStream, agents, workflows }) => {
  const { journalEvents } = useShellState();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [journalEvents]);

  // Extract agent status from events (mocking logic for now based on Kind)
  // In a real scenario, we'd have a specific 'agent_status' event kind
  const agentEvents = journalEvents.filter(e =>
    e.kind.includes('agent') ||
    e.kind.includes('capsule') ||
    e.kind === 'tools_executed' ||
    e.kind === 'intent_received'
  );

  // If eventStream is provided, combine it with journalEvents
  const combinedEvents = [...agentEvents];
  if (eventStream) {
    eventStream.forEach(log => {
      combinedEvents.push({
        eventId: log.id,
        kind: log.level,
        timestamp: log.timestamp,
        payload: {
          intent_text: log.message,
          skill_name: log.source,
          result: log.details ? JSON.stringify(log.details) : undefined
        }
      } as any);
    });
  }

  return (
    <div className="operator-console">
      <div className="operator-console-header">
        <h4>System Activity Log</h4>
        <span className="console-status">Monitoring active agents...</span>
      </div>
      <div className="operator-console-body" ref={scrollRef}>
        {combinedEvents.length === 0 ? (
          <div className="console-empty">Awaiting Agent lifecycle events...</div>
        ) : (
          combinedEvents.map((event, i) => (
            <div key={event.eventId || i} className="console-entry">
              <div className="console-entry-header">
                <span className="console-kind">{event.kind}</span>
                <span className="console-time">{new Date(event.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="console-entry-content">
                <div className="console-entry-title">
                  {event.payload.intent_text || event.payload.skill_name || 'System Process'}
                </div>
                {event.payload.state && (
                  <div className="console-entry-state">
                    Status: <span className="console-state-value">{event.payload.state}</span>
                  </div>
                )}
                {event.payload.result && (
                  <pre className="console-stdout">
                    {event.payload.result}
                  </pre>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
