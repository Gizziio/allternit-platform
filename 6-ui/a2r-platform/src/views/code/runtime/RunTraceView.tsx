import React, { useEffect, useState } from 'react';
import { execEvents } from '../../../integration/execution/exec.events';
import { TraceFrame, ToolCall } from '../../../integration/execution/exec.types';
import { GlassCard } from '../../../design/GlassCard';

export function RunTraceView() {
  const [frames, setFrames] = useState<TraceFrame[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  useEffect(() => {
    const unsubTrace = execEvents.on('onTraceFrame', (frame) => {
      setFrames(prev => [...prev, frame]);
    });
    
    const unsubTool = execEvents.on('onToolCall', (call) => {
      setToolCalls(prev => [...prev, call]);
    });

    return () => {
      unsubTrace();
      unsubTool();
    };
  }, []);

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h3 style={{ margin: '0 0 12px 0', fontSize: 14, fontWeight: 700, opacity: 0.7 }}>RUN TRACE</h3>
      
      {frames.length === 0 && toolCalls.length === 0 && (
        <div style={{ opacity: 0.5, fontSize: 13, fontStyle: 'italic' }}>Waiting for execution...</div>
      )}

      {frames.map(frame => (
        <GlassCard key={frame.id} style={{ padding: 12, borderLeft: '3px solid var(--accent-chat)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>{frame.name}</span>
            <span style={{ opacity: 0.5 }}>{new Date(frame.timestamp).toLocaleTimeString()}</span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{frame.type.toUpperCase()} • {frame.status}</div>
        </GlassCard>
      ))}

      {toolCalls.map(call => (
        <GlassCard key={call.id} style={{ padding: 12, borderLeft: '3px solid #ff9500' }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Tool: {call.toolName}</div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', margin: '8px 0', background: 'rgba(0,0,0,0.1)', padding: 8, borderRadius: 4 }}>
            {JSON.stringify(call.args, null, 2)}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: call.status === 'complete' ? '#34c759' : '#ff9500' }}>
            {call.status.toUpperCase()}
          </div>
          {call.result && (
             <div style={{ fontSize: 11, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
               {String(call.result).substring(0, 100)}...
             </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
