/**
 * Agentation Panel Component
 * 
 * UI panel for interacting with agentation in development mode
 */

import React, { useState } from 'react';
import { useAgentation, useAgentRole } from './hooks';

export function AgentationPanel(): JSX.Element | null {
  const { config, messages, isProcessing, sendMessage, clearMessages, updateConfig } = useAgentation();
  const [input, setInput] = useState('');
  const currentRole = useAgentRole();

  // Don't render if not in dev mode or disabled
  if (!config.enabled) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;
    
    await sendMessage(input);
    setInput('');
  };

  const roleColors: Record<string, string> = {
    UI_ARCHITECT: 'bg-purple-100 text-purple-800',
    UI_IMPLEMENTER: 'bg-blue-100 text-blue-800',
    UI_TESTER: 'bg-green-100 text-green-800',
    UI_REVIEWER: 'bg-orange-100 text-orange-800',
  };

  return (
    <div className="fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Agentation</span>
          {currentRole && (
            <span className={`text-xs px-2 py-0.5 rounded ${roleColors[currentRole] || 'bg-gray-100'}`}>
              {currentRole}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
          <select
            value={config.role}
            onChange={(e) => updateConfig({ role: e.target.value as any })}
            className="text-xs border rounded px-2 py-1"
          >
            <option value="UI_ARCHITECT">Architect</option>
            <option value="UI_IMPLEMENTER">Implementer</option>
            <option value="UI_TESTER">Tester</option>
            <option value="UI_REVIEWER">Reviewer</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8">
            Start a conversation with the A2R agent...
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`text-sm ${
                msg.role === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <span
                className={`inline-block px-3 py-2 rounded-lg ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {msg.content}
              </span>
            </div>
          ))
        )}
        {isProcessing && (
          <div className="text-left">
            <span className="inline-block px-3 py-2 rounded-lg bg-gray-100 text-gray-500">
              Thinking...
            </span>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={isProcessing || !input.trim()}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
