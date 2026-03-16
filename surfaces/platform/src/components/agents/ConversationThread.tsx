/**
 * Agent Conversation Thread - AutoGen-inspired
 *
 * Production-ready conversation viewer for multi-agent communication.
 * Shows agent-to-agent messages with threading and human review.
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Bot,
  User,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  MoreVertical,
  Copy,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Archive,
  Reply,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type AgentMessageType = 'request' | 'response' | 'tool_result' | 'approval' | 'info' | 'human_review';

export interface AgentMessage {
  id: string;
  from: {
    id: string;
    name: string;
    role: string;
    isHuman?: boolean;
    avatar?: string;
  };
  to: Array<{
    id: string;
    name: string;
    role: string;
  }>;
  content: string;
  type: AgentMessageType;
  timestamp: string;
  inReplyTo?: string;
  reactions?: Array<{
    type: 'approve' | 'reject' | 'flag';
    userId: string;
    timestamp: string;
  }>;
  metadata?: {
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    duration?: number;
    tokensUsed?: number;
  };
}

export interface ConversationThreadProps {
  messages: AgentMessage[];
  onSendMessage?: (content: string, to?: string[]) => void;
  onReact?: (messageId: string, reaction: 'approve' | 'reject' | 'flag') => void;
  onReply?: (messageId: string, content: string) => void;
  isLoading?: boolean;
  readOnly?: boolean;
}

// ============================================================================
// Message Bubble
// ============================================================================

function MessageBubble({
  message,
  isOwn,
  onReact,
  onReply,
  showReactions = true,
}: {
  message: AgentMessage;
  isOwn: boolean;
  onReact?: (messageId: string, reaction: 'approve' | 'reject' | 'flag') => void;
  onReply?: (messageId: string, content: string) => void;
  showReactions?: boolean;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');

  const typeConfig: Record<AgentMessageType, { color: string; icon: any; label: string }> = {
    request: { color: '#60a5fa', icon: MessageSquare, label: 'Request' },
    response: { color: '#4ade80', icon: CheckCircle2, label: 'Response' },
    tool_result: { color: '#fb923c', icon: AlertCircle, label: 'Tool Result' },
    approval: { color: '#22c55e', icon: CheckCircle2, label: 'Approved' },
    info: { color: '#9ca3af', icon: MessageSquare, label: 'Info' },
    human_review: { color: '#a78bfa', icon: User, label: 'Human Review' },
  };

  const config = typeConfig[message.type];
  const TypeIcon = config.icon;

  const handleReply = () => {
    if (replyContent.trim() && onReply) {
      onReply(message.id, replyContent.trim());
      setReplyContent('');
      setShowReplyInput(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`group relative p-4 rounded-xl border transition-all ${
        isOwn
          ? 'bg-blue-500/10 border-blue-500/20 ml-8'
          : 'bg-white/5 border-white/5 mr-8'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: message.from.isHuman
              ? 'rgba(167, 139, 250, 0.2)'
              : `${config.color}22`,
          }}
        >
          {message.from.isHuman ? (
            <User size={16} style={{ color: '#a78bfa' }} />
          ) : (
            <Bot size={16} style={{ color: config.color }} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white/90">
              {message.from.name}
            </span>
            <span className="text-xs text-white/40">
              {message.from.role}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider"
              style={{
                background: `${config.color}22`,
                color: config.color,
              }}
            >
              {config.label}
            </span>
          </div>

          <div className="text-xs text-white/40 flex items-center gap-2">
            <span>{new Date(message.timestamp).toLocaleString()}</span>
            {message.metadata?.duration && (
              <>
                <span>•</span>
                <span>{message.metadata.duration}ms</span>
              </>
            )}
            {message.metadata?.tokensUsed && (
              <>
                <span>•</span>
                <span>{message.metadata.tokensUsed.toLocaleString()} tokens</span>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <AnimatePresence>
          {showActions && !message.from.isHuman && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1"
            >
              {showReactions && (
                <>
                  <button
                    onClick={() => onReact?.(message.id, 'approve')}
                    className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-green-400"
                    title="Approve"
                  >
                    <ThumbsUp size={14} />
                  </button>
                  <button
                    onClick={() => onReact?.(message.id, 'reject')}
                    className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-red-400"
                    title="Reject"
                  >
                    <ThumbsDown size={14} />
                  </button>
                  <button
                    onClick={() => onReact?.(message.id, 'flag')}
                    className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-yellow-400"
                    title="Flag"
                  >
                    <Flag size={14} />
                  </button>
                </>
              )}
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-white/70"
                title="Reply"
              >
                <Reply size={14} />
              </button>
              <div className="relative">
                <button className="p-1.5 hover:bg-white/5 rounded transition-colors text-white/40 hover:text-white/70">
                  <MoreVertical size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content */}
      <div className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap mb-3">
        {message.content}
      </div>

      {/* Recipients */}
      {message.to.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-white/40 mb-2">
          <span>To:</span>
          {message.to.map((recipient, idx) => (
            <span key={idx} className="px-2 py-0.5 rounded bg-white/5">
              {recipient.name}
            </span>
          ))}
        </div>
      )}

      {/* Reactions */}
      {message.reactions && message.reactions.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
          {message.reactions.map((reaction, idx) => (
            <span
              key={idx}
              className={`text-xs px-2 py-0.5 rounded ${
                reaction.type === 'approve'
                  ? 'bg-green-500/10 text-green-400'
                  : reaction.type === 'reject'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}
            >
              {reaction.type === 'approve' ? '👍' : reaction.type === 'reject' ? '👎' : '🚩'}
            </span>
          ))}
        </div>
      )}

      {/* Reply Input */}
      {showReplyInput && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-3 pt-3 border-t border-white/5"
        >
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReply();
                if (e.key === 'Escape') setShowReplyInput(false);
              }}
              autoFocus
            />
            <button
              onClick={handleReply}
              disabled={!replyContent.trim()}
              className="px-3 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-blue-400"
            >
              <Send size={14} />
            </button>
            <button
              onClick={() => setShowReplyInput(false)}
              className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-white/40"
            >
              <XCircle size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Human Review Request
// ============================================================================

function HumanReviewRequest({
  message,
  onApprove,
  onReject,
  onComment,
}: {
  message: AgentMessage;
  onApprove: () => void;
  onReject: () => void;
  onComment: (comment: string) => void;
}) {
  const [comment, setComment] = useState('');

  return (
    <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <User size={20} className="text-purple-400" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-purple-300 mb-1">
            Human Review Required
          </h4>
          <p className="text-sm text-white/70 mb-3">{message.content}</p>

          {/* Review Actions */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={onApprove}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 transition-colors text-green-400 text-sm font-medium"
            >
              <CheckCircle2 size={16} />
              Approve
            </button>
            <button
              onClick={onReject}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition-colors text-red-400 text-sm font-medium"
            >
              <XCircle size={16} />
              Reject
            </button>
          </div>

          {/* Comment Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment (optional)..."
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white/90 placeholder-white/30 outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && comment.trim()) {
                  onComment(comment.trim());
                  setComment('');
                }
              }}
            />
            <button
              onClick={() => {
                if (comment.trim()) {
                  onComment(comment.trim());
                  setComment('');
                }
              }}
              className="px-3 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 transition-colors text-purple-400 text-sm font-medium"
            >
              Add Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Conversation Thread Component
// ============================================================================

export function ConversationThread({
  messages,
  onSendMessage,
  onReact,
  onReply,
  isLoading = false,
  readOnly = false,
}: ConversationThreadProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim() && onSendMessage) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Group human review messages
  const reviewMessages = messages.filter((m) => m.type === 'human_review');
  const regularMessages = messages.filter((m) => m.type !== 'human_review');

  return (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {regularMessages.map((message, idx) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.from.isHuman || false}
            onReact={onReact}
            onReply={onReply}
          />
        ))}

        {/* Human Review Requests */}
        {reviewMessages.map((message) => (
          <HumanReviewRequest
            key={message.id}
            message={message}
            onApprove={() => onReact?.(message.id, 'approve')}
            onReject={() => onReact?.(message.id, 'reject')}
            onComment={(comment) => onReply?.(message.id, comment)}
          />
        ))}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-center gap-2 text-white/40 text-sm">
            <Clock size={14} className="animate-pulse" />
            Agent is typing...
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {!readOnly && (
        <div className="p-4 border-t border-white/5">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                rows={1}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-white/90 placeholder-white/30 outline-none focus:border-white/20 resize-none"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="p-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-blue-400"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-xs text-white/30 mt-2">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      )}
    </div>
  );
}

export default ConversationThread;
