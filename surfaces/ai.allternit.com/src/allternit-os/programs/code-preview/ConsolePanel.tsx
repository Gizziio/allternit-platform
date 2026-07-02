"use client";

import React from 'react';

export interface ConsoleMessage {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  timestamp: number;
  stack?: string;
}

interface ConsolePanelProps {
  messages: ConsoleMessage[];
  onClear: () => void;
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({ messages, onClear }) => {
  const getLevelColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400 bg-red-400/5';
      case 'warn': return 'text-yellow-400 bg-yellow-400/5';
      case 'info': return 'text-blue-400 bg-blue-400/5';
      default: return 'text-zinc-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black border-t border-zinc-800">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">Console</span>
        <button type="button" 
          onClick={onClear}
          className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase font-semibold"
        >
          Clear
        </button>
      </div>
      <div className="flex-1 overflow-auto p-2 font-mono text-[12px] space-y-0.5">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-700 italic">
            No console output
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`px-2 py-1 rounded flex gap-3 ${getLevelColor(msg.type)}`}
            >
              <span className="text-zinc-600 shrink-0 select-none">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className="whitespace-pre-wrap break-all">{msg.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
