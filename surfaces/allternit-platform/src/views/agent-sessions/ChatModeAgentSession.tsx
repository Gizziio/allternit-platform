/**
 * Chat Mode Agent Session
 * 
 * Conversation-focused agent experience for chat mode.
 * Features:
 * - Streaming message interface
 * - Suggested prompts
 * - Message history
 * - Tool call visualization
 * - File attachments
 * 
 * Uses Allternit chat mode accent colors (warm terracotta)
 * 
 * @module ChatModeAgentSession
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PaperPlaneTilt,
  Paperclip,
  Sparkle,
  Robot,
  User,
  CircleNotch,
  Copy,
  Check,
  ArrowsClockwise,
  DotsThreeOutline,
  Plus,
  Clock,
  Chat,
  GearSix,
} from '@phosphor-icons/react';

import {
  MODE_COLORS,
  createGlassStyle,
  TEXT,
} from '@/design/allternit.tokens';

import {
  ToolCallVisualization,
  useToolCallAccent,
  ToolConfirmation,
  ToolQuestionDisplay,
} from '@/components/agents';

import { AgentSessionLayout, WorkbenchSection, WorkbenchItem, CanvasPanel } from './AgentSessionLayout';
import type { ChatModeAgentSessionProps, AgentSessionMessage, AgentSessionCanvas } from './types';

// ============================================================================
// Component
// ============================================================================

export function ChatModeAgentSession({
  sessionId,
  agentId,
  enableStreaming = true,
  showSuggestions = true,
  context,
  onClose,
}: ChatModeAgentSessionProps) {
  const mode = 'chat';
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;
  const accentColor = useToolCallAccent(mode);
  
  // State
  const [messages, setMessages] = useState<AgentSessionMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showCanvas, setShowCanvas] = useState(true);
  const [showWorkbench, setShowWorkbench] = useState(true);
  const [canvases, setCanvases] = useState<AgentSessionCanvas[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Send message handler
  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    
    const userMessage: AgentSessionMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);
    
    // Simulate agent response (replace with actual API)
    setTimeout(() => {
      const agentMessage: AgentSessionMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'agent',
        content: 'This is a simulated response. In production, this would stream from the agent.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMessage]);
      setIsStreaming(false);
    }, 1500);
  }, [input, isStreaming]);
  
  // Suggested prompts
  const suggestions = [
    'Help me understand this codebase',
    'Create a new React component',
    'Debug this error message',
    'Optimize this function',
  ];

  return (
    <AgentSessionLayout
      mode={mode}
      title="Agent Chat Session"
      agentName="Allternit Assistant"
      status={isStreaming ? 'streaming' : 'idle'}
      onClose={onClose}
      computerView={<ChatCanvasPanel mode={mode} canvases={canvases} />}
      headerActions={
        <>
          <button
            className="p-2 rounded-lg transition-colors"
            style={{ color: TEXT.tertiary }}
            title="Session Settings"
          >
            <GearSix size={16} />
          </button>
        </>
      }
    >
      {/* Chat Interface - Background matches regular chat */}
      <div 
        className="flex flex-col h-full relative"
        style={{ background: '#0D0B09' }}
      >
        {/* Regular Mode Wash Background (Subtle) */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ 
            background: `radial-gradient(120% 88% at 50% 0%, ${modeColors.fog} 0%, transparent 58%)` 
          }}
        />

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-1">
          {messages.length === 0 && showSuggestions && (
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: modeColors.soft }}
              >
                <Sparkle size={32} style={{ color: modeColors.accent }} />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2" style={{ color: TEXT.primary }}>
                  How can I help you today?
                </h3>
                <p className="text-sm" style={{ color: TEXT.secondary }}>
                  Start a conversation or try one of these suggestions
                </p>
              </div>
              
              {/* Suggested Prompts */}
              <div className="grid grid-cols-2 gap-3 max-w-lg">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInput(suggestion)}
                    className="p-3 rounded-xl text-left text-sm transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: `1px solid ${modeColors.border}`,
                      color: TEXT.secondary,
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {messages.map((message) => (
            <ChatMessage 
              key={message.id} 
              message={message} 
              mode={mode}
              accentColor={accentColor}
            />
          ))}
          
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 p-4"
            >
              <CircleNotch size={16} className="animate-spin" style={{ color: modeColors.accent }} />
              <span className="text-sm" style={{ color: TEXT.tertiary }}>
                Agent is thinking...
              </span>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* Input Area */}
        <div 
          className="p-4 border-t"
          style={{ borderColor: modeColors.border, background: 'rgba(0,0,0,0.3)' }}
        >
          <div className="flex items-end gap-2">
            <button
              className="p-3 rounded-xl transition-colors shrink-0"
              style={{ 
                background: 'rgba(255,255,255,0.05)',
                color: TEXT.tertiary,
              }}
              title="Attach file"
            >
              <Paperclip size={20} />
            </button>
            
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type your message..."
                rows={1}
                className="w-full px-4 py-3 rounded-xl outline-none resize-none"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: `1px solid ${modeColors.border}`,
                  color: TEXT.primary,
                  minHeight: '48px',
                  maxHeight: '120px',
                }}
              />
            </div>
            
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="p-3 rounded-xl transition-all disabled:opacity-50 shrink-0"
              style={{ 
                background: modeColors.accent,
                color: '#0D0B09',
              }}
              title="Send message"
            >
              <PaperPlaneTilt size={20} />
            </button>
          </div>
        </div>
      </div>
    </AgentSessionLayout>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function ChatMessage({ 
  message, 
  mode,
  accentColor,
}: { 
  message: AgentSessionMessage; 
  mode: 'chat';
  accentColor: string;
}) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;
  const isUser = message.role === 'user';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div 
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ 
          background: isUser ? modeColors.soft : `${accentColor}20`,
        }}
      >
        {isUser ? (
          <User size={16} style={{ color: modeColors.accent }} />
        ) : (
          <Robot size={16} style={{ color: accentColor }} />
        )}
      </div>
      
      {/* Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'text-right' : ''}`}>
        <div 
          className="inline-block px-4 py-3 rounded-2xl text-left"
          style={{
            background: isUser ? modeColors.soft : 'rgba(255,255,255,0.05)',
            border: `1px solid ${isUser ? modeColors.border : 'transparent'}`,
            color: TEXT.primary,
            borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
          }}
        >
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
        
        {/* Tool Calls */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mt-2 space-y-2">
            <ToolCallVisualization
              toolCalls={message.toolCalls}
              isLoading={true}
              accentColor={accentColor}
            />
          </div>
        )}
        
        {/* Timestamp */}
        <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: TEXT.tertiary }}>
          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {!isUser && (
            <button className="hover:text-white transition-colors">
              <Copy size={12} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ChatWorkbenchRail({ mode }: { mode: 'chat' }) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;
  
  return (
    <div className="py-2">
      <WorkbenchSection title="Conversations" mode={mode}>
        <div className="space-y-1">
          <WorkbenchItem
            icon={Chat}
            label="Current Session"
            active
            mode={mode}
          />
          <WorkbenchItem
            icon={Clock}
            label="Recent"
            badge={3}
            mode={mode}
          />
          <WorkbenchItem
            icon={Robot}
            label="All Agents"
            mode={mode}
          />
        </div>
      </WorkbenchSection>
      
      <WorkbenchSection title="Context" mode={mode}>
        <div className="space-y-1">
          <WorkbenchItem
            icon={Sparkle}
            label="Attached Files"
            mode={mode}
          />
          <WorkbenchItem
            icon={Clock}
            label="History"
            mode={mode}
          />
        </div>
      </WorkbenchSection>
    </div>
  );
}

function ChatCanvasPanel({ mode, canvases }: { mode: 'chat'; canvases: AgentSessionCanvas[] }) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;
  
  if (canvases.length === 0) {
    return (
      <CanvasPanel title="Canvas" mode={mode}>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
            style={{ background: modeColors.soft }}
          >
            <Sparkle size={24} style={{ color: modeColors.accent }} />
          </div>
          <p className="text-sm" style={{ color: TEXT.secondary }}>
            Agent outputs will appear here
          </p>
          <p className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
            Code, images, and other artifacts
          </p>
        </div>
      </CanvasPanel>
    );
  }
  
  return (
    <CanvasPanel 
      title="Canvas" 
      mode={mode}
      actions={
        <button style={{ color: TEXT.tertiary }}>
          <DotsThreeOutline size={16} />
        </button>
      }
    >
      <div className="space-y-4">
        {canvases.map((canvas) => (
          <div 
            key={canvas.id}
            className="p-3 rounded-xl"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${modeColors.border}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: TEXT.primary }}>
                {canvas.title}
              </span>
              {canvas.isPinned && (
                <Sparkle size={12} style={{ color: modeColors.accent }} />
              )}
            </div>
            <pre 
              className="text-xs overflow-auto p-2 rounded"
              style={{ 
                background: 'rgba(0,0,0,0.3)',
                color: TEXT.secondary,
                maxHeight: 200,
              }}
            >
              {canvas.content}
            </pre>
          </div>
        ))}
      </div>
    </CanvasPanel>
  );
}

export default ChatModeAgentSession;
