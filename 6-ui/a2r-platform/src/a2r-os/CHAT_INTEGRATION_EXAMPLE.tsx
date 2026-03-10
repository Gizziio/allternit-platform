/**
 * A2rchitect Super-Agent OS - Chat Integration Example
 * 
 * Full example showing how to integrate the A2rCanvas and Agent Runtime
 * into a chat interface with automatic program launching.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  A2rCanvas,
  useAgentRuntime,
  useChatWithPrograms,
  useProgramStreaming,
  useSidecarStore,
} from './index';

// ============================================================================
// Example 1: Complete Chat Shell with A2rCanvas
// ============================================================================

export function ChatShell() {
  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader />
        <ChatMessages />
        <ChatInput />
      </div>
      
      {/* Utility Pane - persists across all views */}
      <A2rCanvas className="flex-shrink-0" />
    </div>
  );
}

// ============================================================================
// Example 2: Chat with Automatic Program Launching
// ============================================================================

const THREAD_ID = 'thread-main-001';

function ChatWithPrograms() {
  const { messages, sendMessage, receiveMessage, isConnected, isStreaming } = 
    useChatWithPrograms(THREAD_ID);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    
    sendMessage(inputValue);
    setInputValue('');
    
    // Simulate agent response (in real app, this comes from kernel)
    simulateAgentResponse(inputValue, receiveMessage);
  }, [inputValue, sendMessage, receiveMessage]);

  return (
    <div className="flex flex-col h-full">
      {/* Connection status */}
      <div className={`px-4 py-2 text-xs ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
        {isConnected ? '● Connected to Kernel' : '● Disconnected'}
        {isStreaming && <span className="ml-2 text-blue-600">● Streaming...</span>}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {isStreaming ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 3: Message Bubble with Program Indicators
// ============================================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
        isUser 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
      }`}>
        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Example 4: Simulated Agent Responses
// ============================================================================

async function simulateAgentResponse(userInput: string, receiveMessage: (content: string) => void) {
  const lower = userInput.toLowerCase();
  
  // Simulate network delay
  await new Promise(r => setTimeout(r, 1000));
  
  if (lower.includes('research') || lower.includes('mars')) {
    // Research document response
    receiveMessage(`I'll create a comprehensive research document on that topic.

<launch_research_doc title="Mars Colonization Research">
{
  "topic": "Mars Colonization",
  "isGenerating": true
}
</launch_research_doc>

Gathering the latest data on SpaceX Starship, NASA missions, and habitat technologies...`);

  } else if (lower.includes('data') || lower.includes('table') || lower.includes('csv')) {
    // Data grid response
    receiveMessage(`I'll analyze that data for you.

<launch_data_grid title="Market Analysis">
{
  "columns": [
    { "id": "company", "header": "Company", "type": "text" },
    { "id": "revenue", "header": "Revenue", "type": "number" },
    { "id": "growth", "header": "Growth %", "type": "number" }
  ]
}
</launch_data_grid>

Processing market data and building your spreadsheet...`);

  } else if (lower.includes('slide') || lower.includes('presentation')) {
    // Presentation response
    receiveMessage(`I'll create a presentation for you.

<launch_presentation title="Q1 Review">
{
  "theme": "modern"
}
</launch_presentation>

Generating slides with key insights and visuals...`);

  } else {
    // Simple text response
    receiveMessage(`I've received your message: "${userInput}". How else can I help you today?`);
  }
}

// ============================================================================
// Example 5: Advanced Runtime with Manual Controls
// ============================================================================

function AdvancedChatControls() {
  const runtime = useAgentRuntime({
    threadId: THREAD_ID,
    autoLaunch: true,
    onProgramLaunch: (programId, type) => {
      console.log(`Launched ${type}: ${programId}`);
    },
  });

  const handleManualLaunch = (type: 'research-doc' | 'data-grid' | 'presentation') => {
    const titles = {
      'research-doc': 'Manual Research Doc',
      'data-grid': 'Manual Data Grid',
      'presentation': 'Manual Presentation',
    };
    
    const id = runtime.launchProgram(type, titles[type]);
    console.log('Launched:', id);
  };

  return (
    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Manual Controls</span>
        <span className={`text-xs ${runtime.isConnected ? 'text-green-600' : 'text-red-600'}`}>
          {runtime.isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => handleManualLaunch('research-doc')}
          className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          📄 Research
        </button>
        <button
          onClick={() => handleManualLaunch('data-grid')}
          className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
        >
          📊 Data
        </button>
        <button
          onClick={() => handleManualLaunch('presentation')}
          className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
        >
          🎬 Slides
        </button>
        <button
          onClick={runtime.reconnect}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
        >
          🔄 Reconnect
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Example 6: Streaming Content Display
// ============================================================================

function StreamingIndicator({ programId }: { programId: string }) {
  const { isStreaming, buffer } = useProgramStreaming(programId);
  
  if (!isStreaming) return null;
  
  return (
    <div className="flex items-center gap-2 text-xs text-blue-600">
      <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
      <span>Streaming{buffer.length > 0 && ` (${buffer.length} chars buffered)`}</span>
    </div>
  );
}

// ============================================================================
// Placeholder Components
// ============================================================================

function ChatHeader() {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
      <h1 className="font-semibold text-gray-900 dark:text-white">Chat</h1>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Thread: {THREAD_ID}</span>
      </div>
    </div>
  );
}

function ChatMessages() {
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="text-center text-gray-400 text-sm">
        Messages will appear here
      </div>
    </div>
  );
}

function ChatInput() {
  return (
    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
      <input
        type="text"
        placeholder="Type a message..."
        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
      />
    </div>
  );
}

// ============================================================================
// Export Examples
// ============================================================================

export default {
  ChatShell,
  ChatWithPrograms,
  AdvancedChatControls,
  StreamingIndicator,
};
