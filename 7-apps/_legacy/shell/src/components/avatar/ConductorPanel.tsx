import React, { useMemo, useState, useEffect } from 'react';
import { useBrain } from '../../runtime/BrainContext';
import { useBrainEventCursor } from '../../hooks/brain/useBrainEventCursor';
import { TerminalPane } from '../terminal/TerminalPane';

interface TimelineNode {
  ts: number;
  type: string;
  label: string;
  payload: any;
}

interface ConductorPanelProps {
  /** Close handler */
  onClose: () => void;
}

export const ConductorPanel: React.FC<ConductorPanelProps> = ({ onClose }) => {
  const { sessions, activeSessionId, sendInput } = useBrain();
  const { sessionId: activeSessionIdFromCursor, newEvents, reset: resetCursor } = useBrainEventCursor('conductor');

  const [timeline, setTimeline] = useState<TimelineNode[]>([]);
  const [terminalBuffer, setTerminalBuffer] = useState('');

  const activeSession = useMemo(
    () => sessions.find(s => s.session.id === activeSessionId),
    [sessions, activeSessionId]
  );
  const isCliBrain = activeSession?.session.brain_name?.toLowerCase().includes('cli') ?? false;

  useEffect(() => {
    if (!isCliBrain || newEvents.length === 0) return;

    setTimeline(prev => {
      const next = [...prev];
      const nextTerminalBuffer = terminalBuffer;

      for (const event of newEvents) {
        const ts = Date.now();

        switch (event.type) {
          case 'integration.profile.registered':
            next.push({ ts, type: 'integration', label: 'Profile registered', payload: event.payload });
            break;
          case 'integration.pty.initializing':
            next.push({ ts, type: 'integration', label: 'PTY initializing', payload: event.payload });
            break;
          case 'integration.pty.ready':
            next.push({ ts, type: 'integration', label: `PTY ready (pid: ${event.payload.pid})`, payload: event.payload });
            break;
          case 'integration.dispatcher.connected':
            next.push({ ts, type: 'integration', label: 'Dispatcher connected', payload: event.payload });
            break;
          case 'integration.tools.verified':
            next.push({ ts, type: 'integration', label: `Tools verified (${event.payload.count})`, payload: event.payload });
            break;
          case 'integration.context.synced':
            next.push({ ts, type: 'integration', label: 'Context synced', payload: event.payload });
            break;
          case 'integration.complete':
            next.push({ ts, type: 'integration', label: 'Integration complete', payload: event.payload });
            break;
          case 'tool.call':
            next.push({ ts, type: 'tool', label: `Tool call: ${event.payload.tool_id}`, payload: event.payload });
            break;
          case 'tool.result':
            next.push({ ts, type: 'tool_result', label: `Tool result: ${event.payload.tool_id}`, payload: event.payload });
            break;
          case 'chat.message.completed':
            next.push({ ts, type: 'chat', label: 'Message completed', payload: event.payload });
            break;
          case 'error':
            next.push({ ts, type: 'error', label: `Error: ${event.payload.message}`, payload: event.payload });
            break;
          case 'terminal.delta':
            setTerminalBuffer(prev => prev + event.payload.data);
            break;
        }
      }

      return next;
    });
  }, [newEvents, isCliBrain, terminalBuffer]);

  const handleTerminalSend = (input: string) => {
    if (activeSessionId) {
      sendInput(activeSessionId, input);
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 });
  };

  return (
    <div className="gizzi-conductor-panel">
      <div className="gizzi-panel-header">
        <h3>Conductor</h3>
        <button className="gizzi-close-btn" onClick={onClose}>×</button>
      </div>

      <div className="gizzi-conductor-content">
        {isCliBrain ? (
          <>
            <div className="gizzi-timeline-section">
              <h4>Timeline</h4>
              <div className="gizzi-timeline">
                {timeline.length === 0 && <p className="gizzi-timeline-empty">No events yet...</p>}
                {timeline.map((node, idx) => (
                  <div key={idx} className={`gizzi-timeline-node gizzi-timeline-${node.type}`}>
                    <span className="gizzi-timestamp">{formatTimestamp(node.ts)}</span>
                    <span className="gizzi-timeline-label">{node.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="gizzi-terminal-section">
              <h4>Terminal</h4>
              <TerminalPane buffer={terminalBuffer} onSend={handleTerminalSend} maxHeight={400} />
            </div>
          </>
        ) : (
          <div className="gizzi-conductor-placeholder">
            <p>Conductor mode requires a CLI brain session.</p>
            <p className="gizzi-hint">Select or create a CLI brain session to see timeline and terminal output.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConductorPanel;
