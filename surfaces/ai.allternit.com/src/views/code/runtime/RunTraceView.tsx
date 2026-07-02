import React, { useEffect, useState } from 'react';
import { execEvents } from '../../../integration/execution/exec.events';
import { TraceFrame, ToolCall } from '../../../integration/execution/exec.types';
import { GlassCard } from '../../../design/glass/GlassCard';
import { cn } from '@/lib/utils';

export function RunTraceView(): React.ReactNode {
  const [frames, setFrames] = useState<TraceFrame[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  useEffect(() => {
    const unsubTrace = execEvents.subscribe('onTraceFrame', (frame) => {
      setFrames(prev => [...prev, frame]);
    });
    
    const unsubTool = execEvents.subscribe('onToolCall', (call) => {
      setToolCalls(prev => [...prev, call]);
    });

    return () => {
      unsubTrace();
      unsubTool();
    };
  }, []);

  return (
    <div className="p-4 flex flex-col gap-3">
      <h3 className="m-0 mb-3 text-[14px] font-bold opacity-70 uppercase tracking-wider">RUN TRACE</h3>
      
      {frames.length === 0 && toolCalls.length === 0 && (
        <div className="opacity-50 text-[13px] italic">Waiting for execution…</div>
      )}

      {frames.map(frame => (
        <GlassCard key={frame.id} className="p-3 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[var(--accent-chat)]" />
          <div className="text-[12px] font-semibold flex justify-between">
            <span>{frame.name}</span>
            <span className="opacity-50">{new Date(frame.timestamp).toLocaleTimeString()}</span>
          </div>
          <div className="text-[12px] opacity-70 mt-1">{frame.type.toUpperCase()} • {frame.status}</div>
        </GlassCard>
      ))}

      {toolCalls.map(call => (
        <GlassCard key={call.id} className="p-3 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ff9500]" />
          <div className="text-[12px] font-semibold">Tool: {call.toolName}</div>
          <div className="text-[12px] font-mono my-2 bg-black/10 p-2 rounded">
            {JSON.stringify(call.args, null, 2)}
          </div>
          <div className={cn(
            "text-[12px] font-semibold uppercase",
            call.status === 'complete' ? "text-[var(--status-success)]" : "text-[var(--status-warning)]"
          )}>
            {call.status.toUpperCase()}
          </div>
          {call.result && (
             <div className="text-[12px] mt-2 pt-2 border-t border-black/10">
               {String(call.result).substring(0, 100)}...
             </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}
