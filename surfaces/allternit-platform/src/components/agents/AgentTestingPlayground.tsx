/**
 * Agent Testing Playground
 * 
 * Interactive environment for testing agents before deployment.
 * Features:
 * - Live message streaming
 * - Tool call visualization
 * - Performance metrics
 * - Conversation history
 * - Variable injection
 * 
 * @module AgentTestingPlayground
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  ArrowCounterClockwise,
  GearSix,
  Chat,
  Wrench,
  Clock,
  Lightning,
  CaretDown,
  CaretUp,
  Terminal,
  Pulse as Activity,
  FloppyDisk,
  ShareNetwork,
  Bug,
  CheckCircle,
  XCircle,
  Warning,
  CircleNotch,
} from '@phosphor-icons/react';

import {
  SAND,
  MODE_COLORS,
  createGlassStyle,
  RADIUS,
  SPACE,
  TEXT,
  SHADOW,
  ANIMATION,
  type AgentMode,
} from '@/design/allternit.tokens';

import type { Agent, AgentRun, AgentTask } from '@/lib/agents/agent.types';

// ============================================================================
// Types
// ============================================================================

export interface AgentTestingPlaygroundProps {
  agent: Agent;
  mode?: AgentMode;
  onSaveTest?: (test: TestResult) => void;
  onDeploy?: () => void;
}

interface TestMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  latency?: number;
  tokens?: number;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
  duration?: number;
}

interface TestResult {
  id: string;
  agentId: string;
  messages: TestMessage[];
  startTime: Date;
  endTime?: Date;
  totalTokens: number;
  totalLatency: number;
  toolCalls: number;
  status: 'running' | 'completed' | 'failed';
}

interface Variable {
  key: string;
  value: string;
  description?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentTestingPlayground({
  agent,
  mode = 'chat',
  onSaveTest,
  onDeploy,
}: AgentTestingPlaygroundProps) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.chat;
  const [messages, setMessages] = useState<TestMessage[]>([]);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [showMetrics, setShowMetrics] = useState(true);
  const [variables, setVariables] = useState<Variable[]>([
    { key: 'user_name', value: 'Test User', description: 'User identifier' },
    { key: 'project', value: 'Demo Project', description: 'Current project' },
  ]);
  const [metrics, setMetrics] = useState({
    totalTokens: 0,
    totalLatency: 0,
    toolCalls: 0,
    messageCount: 0,
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isRunning) return;

    const userMessage: TestMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsRunning(true);

    const startTime = Date.now();

    try {
      // Call real agent test API
      const res = await fetch('/api/v1/agents/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          variables: Object.fromEntries(variables.map(v => [v.key, v.value])),
        }),
      });

      if (!res.ok) throw new Error('Agent test API failed');
      const data = await res.json();

      // Stream the response character by character for visual effect
      const responseText = data.message?.content || 'No response';
      const assistantMsgId = `msg-${Date.now()}`;
      
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        latency: data.message?.latency || Date.now() - startTime,
        tokens: data.message?.tokens?.total || Math.floor(input.length / 4) + 50,
      }]);

      for (let i = 0; i < responseText.length; i += 3) {
        await new Promise(r => setTimeout(r, 15));
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.id === assistantMsgId) {
            return [...prev.slice(0, -1), { ...last, content: last.content + responseText.slice(i, i + 3) }];
          }
          return prev;
        });
      }

      // Append tool calls if any
      if (data.toolCalls?.length) {
        for (const tc of data.toolCalls) {
          setMessages(prev => [...prev, {
            id: `tool-${Date.now()}-${tc.id}`,
            role: 'tool',
            content: `Called ${tc.name}`,
            timestamp: new Date(),
            toolCalls: [tc],
          }]);
        }
      }

      setMetrics(m => ({
        ...m,
        totalLatency: m.totalLatency + (data.message?.latency || Date.now() - startTime),
        messageCount: m.messageCount + 1,
        totalTokens: m.totalTokens + (data.message?.tokens?.total || Math.floor(input.length / 4) + 50),
        toolCalls: m.toolCalls + (data.toolCalls?.length || 0),
      }));
    } catch (error) {
      console.error('Test failed:', error);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'system',
        content: 'Error: Failed to get agent response. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsRunning(false);
    }
  }, [input, isRunning, agent, messages, variables]);

  const handleReset = () => {
    setMessages([]);
    setMetrics({
      totalTokens: 0,
      totalLatency: 0,
      toolCalls: 0,
      messageCount: 0,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div 
      className="flex flex-col h-full overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #1A1612 0%, #0D0B09 100%)',
      }}
    >
      {/* Header */}
      <PlaygroundHeader 
        agent={agent}
        isRunning={isRunning}
        onReset={handleReset}
        onDeploy={onDeploy}
        modeColors={modeColors as typeof MODE_COLORS.chat}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <EmptyState agent={agent} modeColors={modeColors as typeof MODE_COLORS.chat} />
            ) : (
              <>
                {messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isLast={index === messages.length - 1}
                    modeColors={modeColors as typeof MODE_COLORS.chat}
                  />
                ))}
                {isRunning && <TypingIndicator modeColors={modeColors as typeof MODE_COLORS.chat} />}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <InputArea
            input={input}
            setInput={setInput}
            isRunning={isRunning}
            onSend={handleSend}
            onKeyDown={handleKeyDown}
            modeColors={modeColors as typeof MODE_COLORS.chat}
          />
        </div>

        {/* Sidebar */}
        <PlaygroundSidebar
          metrics={metrics}
          showMetrics={showMetrics}
          setShowMetrics={setShowMetrics}
          variables={variables}
          setVariables={setVariables}
          showVariables={showVariables}
          setShowVariables={setShowVariables}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function PlaygroundHeader({
  agent,
  isRunning,
  onReset,
  onDeploy,
  modeColors,
}: {
  agent: Agent;
  isRunning: boolean;
  onReset: () => void;
  onDeploy?: () => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div 
      className="flex items-center justify-between px-6 py-4 border-b"
      style={{ 
        borderColor: modeColors.border,
        background: 'rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-center gap-4">
        <div 
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{
            background: modeColors.soft,
            border: `1px solid ${modeColors.border}`,
          }}
        >
          <Bug size={20} style={{ color: modeColors.accent }} />
        </div>
        <div>
          <h2 className="text-base font-semibold" style={{ color: TEXT.primary }}>
            Testing: {agent.name}
          </h2>
          <div className="flex items-center gap-2 text-xs" style={{ color: TEXT.tertiary }}>
            <span className="flex items-center gap-1">
              <Activity size={12} />
              {isRunning ? 'Running' : 'Ready'}
            </span>
            <span>•</span>
            <span>{agent.model}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            background: 'rgba(255,255,255,0.05)',
            color: TEXT.secondary,
          }}
        >
          <ArrowCounterClockwise size={14} />
          Reset
        </button>
        {onDeploy && (
          <button
            onClick={onDeploy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: modeColors.accent,
              color: '#1A1612',
            }}
          >
            <CheckCircle size={14} />
            Deploy
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  agent,
  modeColors,
}: {
  agent: Agent;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const suggestions = [
    `Hi ${agent.name}, what can you help me with?`,
    `Can you explain how you approach ${agent.capabilities[0] || 'tasks'}?`,
    `Let's test your ${agent.tools.slice(0, 2).join(', ')} tools`,
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div 
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{
          background: modeColors.soft,
          border: `1px solid ${modeColors.border}`,
        }}
      >
        <Play size={28} style={{ color: modeColors.accent }} />
      </div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: TEXT.primary }}>
        Test Your Agent
      </h3>
      <p className="text-sm text-center max-w-md mb-6" style={{ color: TEXT.secondary }}>
        Send a message to see how {agent.name} responds. 
        Monitor tool calls, latency, and token usage in real-time.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-md">
        {suggestions.map((suggestion, i) => (
          <button
            key={i}
            className="text-left px-4 py-3 rounded-lg text-sm transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.secondary,
            }}
            onClick={() => {
              // Would set input in parent
            }}
          >
            {suggestion}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isLast,
  modeColors,
}: {
  message: TestMessage;
  isLast: boolean;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div 
        className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}
      >
        {!isUser && !isTool && (
          <div 
            className="text-xs mb-1 ml-1"
            style={{ color: TEXT.tertiary }}
          >
            Agent
          </div>
        )}
        
        <div 
          className="px-4 py-3 rounded-2xl"
          style={{
            background: isUser 
              ? modeColors.accent 
              : isTool 
                ? 'rgba(0,0,0,0.3)'
                : 'rgba(255,255,255,0.05)',
            color: isUser ? '#1A1612' : TEXT.primary,
            border: isTool ? `1px solid ${modeColors.border}` : 'none',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          }}
        >
          {isTool && message.toolCalls ? (
            <ToolCallDisplay toolCall={message.toolCalls[0]} modeColors={modeColors} />
          ) : (
            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          )}
        </div>

        {/* Metadata */}
        {(message.latency || message.tokens) && (
          <div 
            className="flex items-center gap-3 mt-1 text-xs"
            style={{ color: TEXT.tertiary }}
          >
            {message.latency && (
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {message.latency}ms
              </span>
            )}
            {message.tokens && (
              <span className="flex items-center gap-1">
                <Lightning size={10} />
                {message.tokens} tokens
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ToolCallDisplay({
  toolCall,
  modeColors,
}: {
  toolCall: ToolCall;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Wrench size={14} style={{ color: modeColors.accent }} />
        <span className="font-medium">{toolCall.name}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto"
          style={{ color: TEXT.tertiary }}
        >
          {expanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
        </button>
      </div>
      
      {expanded && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: 'auto' }}
          className="text-xs space-y-2 mt-2 pt-2 border-t"
          style={{ borderColor: modeColors.border }}
        >
          <div>
            <span style={{ color: TEXT.tertiary }}>Arguments:</span>
            <pre 
              className="mt-1 p-2 rounded"
              style={{ 
                background: 'rgba(0,0,0,0.3)',
                color: TEXT.secondary,
              }}
            >
              {`${JSON.stringify(toolCall.arguments, null, 2)}`}
            </pre>
          </div>
          {!!toolCall.result && (
            <div>
              <span style={{ color: TEXT.tertiary }}>Result:</span>
              <pre 
                className="mt-1 p-2 rounded"
                style={{ 
                  background: 'rgba(74,222,128,0.1)',
                  color: '#4ade80',
                }}
              >
                {`${JSON.stringify(toolCall.result, null, 2)}`}
              </pre>
            </div>
          )}
          {toolCall.error && (
            <div 
              className="p-2 rounded"
              style={{ 
                background: 'rgba(248,113,113,0.1)',
                color: '#f87171',
              }}
            >
              Error: {toolCall.error}
            </div>
          )}
          {toolCall.duration && (
            <div style={{ color: TEXT.tertiary }}>
              Duration: {toolCall.duration}ms
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function TypingIndicator({
  modeColors,
}: {
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div className="flex justify-start">
      <div 
        className="px-4 py-3 rounded-2xl flex items-center gap-1"
        style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '18px 18px 18px 4px',
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{ background: modeColors.accent }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function InputArea({
  input,
  setInput,
  isRunning,
  onSend,
  onKeyDown,
  modeColors,
}: {
  input: string;
  setInput: (value: string) => void;
  isRunning: boolean;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div 
      className="p-4 border-t"
      style={{ borderColor: modeColors.border }}
    >
      <div 
        className="flex items-end gap-2 p-3 rounded-xl"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: `1px solid ${modeColors.border}`,
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a message to test your agent..."
          rows={1}
          className="flex-1 bg-transparent outline-none resize-none text-sm"
          style={{ color: TEXT.primary, minHeight: '20px', maxHeight: '120px' }}
        />
        <button
          onClick={onSend}
          disabled={!input.trim() || isRunning}
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
          style={{
            background: input.trim() && !isRunning ? modeColors.accent : 'rgba(255,255,255,0.1)',
            color: input.trim() && !isRunning ? '#1A1612' : TEXT.tertiary,
          }}
        >
          {isRunning ? (
            <CircleNotch size={16} className="animate-spin" />
          ) : (
            <CaretUp size={16} />
          )}
        </button>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs" style={{ color: TEXT.tertiary }}>
        <span>Press Enter to send, Shift+Enter for new line</span>
        <span>{input.length} chars</span>
      </div>
    </div>
  );
}

function PlaygroundSidebar({
  metrics,
  showMetrics,
  setShowMetrics,
  variables,
  setVariables,
  showVariables,
  setShowVariables,
  modeColors,
}: {
  metrics: {
    totalTokens: number;
    totalLatency: number;
    toolCalls: number;
    messageCount: number;
  };
  showMetrics: boolean;
  setShowMetrics: (show: boolean) => void;
  variables: Variable[];
  setVariables: (vars: Variable[]) => void;
  showVariables: boolean;
  setShowVariables: (show: boolean) => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const avgLatency = metrics.messageCount > 0 
    ? Math.round(metrics.totalLatency / metrics.messageCount)
    : 0;

  return (
    <div 
      className="w-64 border-l flex flex-col overflow-y-auto"
      style={{ 
        borderColor: modeColors.border,
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      {/* Metrics Section */}
      <div className="border-b" style={{ borderColor: modeColors.border }}>
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
          style={{ color: TEXT.primary }}
        >
          <span className="flex items-center gap-2">
            <Activity size={16} style={{ color: modeColors.accent }} />
            Performance
          </span>
          {showMetrics ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </button>
        
        <AnimatePresence>
          {showMetrics && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="px-4 pb-4 space-y-3"
            >
              <MetricCard
                label="Total Tokens"
                value={metrics.totalTokens.toLocaleString()}
                icon={Lightning}
                modeColors={modeColors}
              />
              <MetricCard
                label="Avg Latency"
                value={`${avgLatency}ms`}
                icon={Clock}
                modeColors={modeColors}
              />
              <MetricCard
                label="Tool Calls"
                value={metrics.toolCalls.toString()}
                icon={Wrench}
                modeColors={modeColors}
              />
              <MetricCard
                label="Messages"
                value={metrics.messageCount.toString()}
                icon={Chat}
                modeColors={modeColors}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Variables Section */}
      <div className="flex-1">
        <button
          onClick={() => setShowVariables(!showVariables)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
          style={{ color: TEXT.primary }}
        >
          <span className="flex items-center gap-2">
            <Terminal size={16} style={{ color: modeColors.accent }} />
            Variables
          </span>
          {showVariables ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </button>

        <AnimatePresence>
          {showVariables && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              className="px-4 pb-4 space-y-2"
            >
              {variables.map((variable, index) => (
                <div 
                  key={index}
                  className="p-2 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${modeColors.border}`,
                  }}
                >
                  <div 
                    className="text-xs font-mono mb-1"
                    style={{ color: modeColors.accent }}
                  >
                    {variable.key}
                  </div>
                  <input
                    type="text"
                    value={variable.value}
                    onChange={(e) => {
                      const newVars = [...variables];
                      newVars[index].value = e.target.value;
                      setVariables(newVars);
                    }}
                    className="w-full bg-transparent text-sm outline-none"
                    style={{ color: TEXT.primary }}
                  />
                  {variable.description && (
                    <div className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
                      {variable.description}
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => setVariables([...variables, { key: '', value: '' }])}
                className="w-full py-2 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: TEXT.secondary,
                  border: `1px dashed ${modeColors.border}`,
                }}
              >
                + Add Variable
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  modeColors,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{size?: number | string; style?: React.CSSProperties}>;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div 
      className="flex items-center justify-between p-3 rounded-lg"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${modeColors.border}`,
      }}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: modeColors.accent }} />
        <span className="text-xs" style={{ color: TEXT.secondary }}>
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold" style={{ color: TEXT.primary }}>
        {value}
      </span>
    </div>
  );
}

// Real agent test API is called directly in handleSend above.
// The /api/v1/agents/test endpoint handles test execution and metrics recording.
