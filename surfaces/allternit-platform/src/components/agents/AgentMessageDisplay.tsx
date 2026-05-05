/**
 * Agent Message Display Component
 * 
 * Displays agent-to-agent communication messages in the chat UI.
 * Shows messages with sender info, mentions, and read status.
 */

import React, { useState, useEffect } from "react"
import {
  ChatCircle,
  At,
  Hash,
  Radio,
  Check,
  CheckFat,

  Clock,
} from '@phosphor-icons/react';

// ============================================================================
// Types
// ============================================================================

export interface AgentMessage {
  id: string
  from: {
    agentId: string
    agentName: string
    agentRole: string
  }
  to: {
    agentName?: string
    agentRole?: string
    channel?: string
  }
  content: string
  type: "direct" | "channel" | "broadcast"
  timestamp: number
  correlationId?: string
  inReplyTo?: string
  mentions?: string[]
  read: boolean
  readAt?: number
}

export interface AgentMessageDisplayProps {
  messages: AgentMessage[]
  currentAgentId?: string
  onReply?: (message: AgentMessage) => void
  accentColor?: string
  maxMessages?: number
}

// ============================================================================
// Component
// ============================================================================

export function AgentMessageDisplay({
  messages,
  currentAgentId,
  onReply,
  accentColor = "#D4956A",
  maxMessages = 50,
}: AgentMessageDisplayProps) {
  const [expandedThreads, setExpandedThreads] = useState<Set<string>>(new Set())

  // Sort messages by timestamp
  const sortedMessages = [...messages].sort((a, b) => b.timestamp - a.timestamp).slice(0, maxMessages)

  // Group by correlation ID for threading
  const threads = new Map<string, AgentMessage[]>()
  const standaloneMessages: AgentMessage[] = []

  for (const msg of sortedMessages) {
    if (msg.correlationId) {
      const thread = threads.get(msg.correlationId) || []
      thread.push(msg)
      threads.set(msg.correlationId, thread)
    } else {
      standaloneMessages.push(msg)
    }
  }

  if (messages.length === 0) {
    return (
      <div
        style={{
          padding: 24,
          textAlign: "center",
          color: "#7a6b5d",
          fontSize: 13,
        }}
      >
        <ChatCircle size={32} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
        No agent messages yet
      </div>
    )
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {/* Standalone messages */}
      {standaloneMessages.map((message) => (
        <AgentMessageBubble
          key={message.id}
          message={message}
          isFromSelf={message.from.agentId === currentAgentId}
          onReply={onReply}
          accentColor={accentColor}
        />
      ))}

      {/* Threaded messages */}
      {Array.from(threads.entries()).map(([correlationId, threadMessages]) => {
        const isExpanded = expandedThreads.has(correlationId)
        const displayMessages = isExpanded ? threadMessages : threadMessages.slice(0, 2)
        const hasMore = threadMessages.length > 2

        return (
          <div key={correlationId} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {displayMessages.map((message) => (
              <AgentMessageBubble
                key={message.id}
                message={message}
                isFromSelf={message.from.agentId === currentAgentId}
                onReply={onReply}
                accentColor={accentColor}
                showThreadIndicator={message !== displayMessages[0]}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedThreads)
                  if (isExpanded) {
                    newExpanded.delete(correlationId)
                  } else {
                    newExpanded.add(correlationId)
                  }
                  setExpandedThreads(newExpanded)
                }}
                style={{
                  padding: "6px 12px",
                  background: "transparent",
                  border: `1px solid ${accentColor}30`,
                  borderRadius: 8,
                  color: accentColor,
                  fontSize: 12,
                  cursor: "pointer",
                  alignSelf: "center",
                }}
              >
                {isExpanded
                  ? `Hide ${threadMessages.length - 2} messages`
                  : `Show ${threadMessages.length - 2} more messages`}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// Message Bubble Component
// ============================================================================

interface MessageBubbleProps {
  message: AgentMessage
  isFromSelf: boolean
  onReply?: (message: AgentMessage) => void
  accentColor: string
  showThreadIndicator?: boolean
}

function AgentMessageBubble({
  message,
  isFromSelf,
  onReply,
  accentColor,
  showThreadIndicator = false,
}: MessageBubbleProps) {
  const messageType = message.to.channel ? "channel" : message.to.agentName ? "direct" : "broadcast"

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: 10,
        borderRadius: 12,
        background: isFromSelf ? `${accentColor}10` : "var(--surface-hover)",
        border: message.read ? "1px solid var(--surface-hover)" : `1px solid ${accentColor}30`,
        marginLeft: showThreadIndicator ? 24 : 0,
        position: "relative",
      }}
    >
      {/* Thread indicator line */}
      {showThreadIndicator && (
        <div
          style={{
            position: "absolute",
            left: -16,
            top: 0,
            bottom: 0,
            width: 2,
            background: `${accentColor}30`,
            borderRadius: 2,
          }}
        />
      )}

      {/* Type icon */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: getMessageTypeColor(messageType, accentColor),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {messageType === "channel" ? (
          <Hash size={14} color="#fff" />
        ) : messageType === "broadcast" ? (
          <Radio size={14} color="#fff" />
        ) : (
          <At size={14} color="#fff" />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isFromSelf ? accentColor : "#f6eee7",
            }}
          >
            {message.from.agentName}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "#7a6b5d",
              background: "var(--surface-hover)",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {message.from.agentRole}
          </span>
          {message.to.channel && (
            <span
              style={{
                fontSize: 11,
                color: accentColor,
                background: `${accentColor}15`,
                padding: "2px 6px",
                borderRadius: 4,
              }}
            >
              #{message.to.channel}
            </span>
          )}
          <span
            style={{
              fontSize: 11,
              color: "#5a4d3f",
              marginLeft: "auto",
            }}
          >
            {formatTimestamp(message.timestamp)}
          </span>
        </div>

        {/* Message content */}
        <div
          style={{
            fontSize: 13,
            color: "#d1c3b4",
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          {highlightMentions(message.content, accentColor)}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 6,
          }}
        >
          {/* Read status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11,
              color: message.read ? "#7a6b5d" : accentColor,
            }}
          >
            {message.read ? (
              <>
                <CheckFat size={12} />
                Read
              </>
            ) : (
              <>
                <Clock size={12} />
                Unread
              </>
            )}
          </div>

          {/* Reply button */}
          {onReply && !isFromSelf && (
            <button
              onClick={() => onReply(message)}
              style={{
                padding: "2px 8px",
                background: "transparent",
                border: `1px solid ${accentColor}30`,
                borderRadius: 4,
                color: accentColor,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Reply
            </button>
          )}

          {/* Correlation ID */}
          {message.correlationId && (
            <span
              style={{
                fontSize: 10,
                color: "#5a4d3f",
                fontFamily: "var(--font-mono)",
                marginLeft: "auto",
              }}
            >
              Thread: {message.correlationId.slice(0, 8)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function getMessageTypeColor(type: string, accentColor: string): string {
  switch (type) {
    case "channel":
      return "#6366f1"
    case "broadcast":
      return "#f59e0b"
    case "direct":
      return accentColor
    default:
      return "#6b7280"
  }
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return date.toLocaleDateString()
}

function highlightMentions(content: string, accentColor: string): React.ReactNode {
  const mentionRegex = /\B@([A-Za-z][A-Za-z0-9_-]*)/g
  const parts = content.split(mentionRegex)
  const result: React.ReactNode[] = []

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      // This is a mention
      result.push(
        <span
          key={i}
          style={{
            color: accentColor,
            fontWeight: 600,
            background: `${accentColor}15`,
            padding: "1px 4px",
            borderRadius: 3,
          }}
        >
          @{parts[i]}
        </span>,
      )
    } else if (parts[i]) {
      result.push(parts[i])
    }
  }

  return <>{result}</>
}

export default AgentMessageDisplay
