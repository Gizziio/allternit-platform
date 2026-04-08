/**
 * MailTab - Agent Messaging and Reviews
 * 
 * Features:
 * - Thread list sidebar
 * - Conversation view
 * - Message composition
 * - Review requests
 * - Approval/rejection actions
 */

import React, { useState, useEffect } from "react";
import {
  PaperPlaneTilt,
  Tray,
  Chat,
  CheckCircle,
  XCircle,
  CaretLeft,
  Clock,
  User,
  Warning,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { useUnifiedStore } from "@/lib/agents/unified.store";
import type { MailThread, MailMessage } from "@/lib/agents";

export function MailTab() {
  const {
    mailThreads,
    mailMessages,
    selectedThreadId,
    mailUnreadCount,
    isLoading,
    fetchMailThreads,
    fetchMailMessages,
    sendMail,
    requestReview,
    decideReview,
    ackMessage,
    selectThread,
  } = useUnifiedStore();

  const [messageText, setMessageText] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewWihId, setReviewWihId] = useState("");
  const [reviewDiffRef, setReviewDiffRef] = useState("");

  // Fetch threads on mount
  useEffect(() => {
    fetchMailThreads();
  }, [fetchMailThreads]);

  // Fetch messages when thread is selected
  useEffect(() => {
    if (selectedThreadId) {
      fetchMailMessages(selectedThreadId);
    }
  }, [selectedThreadId, fetchMailMessages]);

  const handleSendMessage = async () => {
    if (!selectedThreadId || !messageText.trim()) return;
    try {
      await sendMail(selectedThreadId, messageText);
      setMessageText("");
    } catch (err) {
      // Error handled by store
    }
  };

  const handleRequestReview = async () => {
    if (!selectedThreadId || !reviewWihId || !reviewDiffRef) return;
    try {
      await requestReview(selectedThreadId, reviewWihId, reviewDiffRef);
      setShowReviewModal(false);
      setReviewWihId("");
      setReviewDiffRef("");
    } catch (err) {
      // Error handled by store
    }
  };

  const handleDecideReview = async (approve: boolean) => {
    if (!selectedThreadId) return;
    try {
      await decideReview(selectedThreadId, approve);
    } catch (err) {
      // Error handled by store
    }
  };

  const selectedThread = mailThreads.find((t) => t.thread_id === selectedThreadId);
  const threadMessages = mailMessages.filter((m) => m.thread_id === selectedThreadId);

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Left Panel: Thread List */}
      <div
        style={{
          width: 280,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border-subtle, #333)",
          background: "var(--bg-secondary, #141414)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid var(--border-subtle, #333)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Tray size={18} />
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              Inbox
            </span>
            {mailUnreadCount > 0 && (
              <span
                style={{
                  background: "#ff3b30",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {mailUnreadCount}
              </span>
            )}
          </div>
          <button
            onClick={() => fetchMailThreads()}
            style={{
              padding: 6,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowsClockwise size={14} color="#888" />
          </button>
        </div>

        {/* Thread List */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
          }}
        >
          {mailThreads.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "#666",
              }}
            >
              <Chat size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p>No messages yet</p>
            </div>
          ) : (
            mailThreads.map((thread) => (
              <ThreadItem
                key={thread.thread_id}
                thread={thread}
                isSelected={selectedThreadId === thread.thread_id}
                onClick={() => selectThread(thread.thread_id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Conversation */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-primary, #0a0a0a)",
        }}
      >
        {selectedThread ? (
          <>
            {/* Thread Header */}
            <div
              style={{
                padding: 16,
                borderBottom: "1px solid var(--border-subtle, #333)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  {selectedThread.topic}
                </h3>
                <span
                  style={{
                    fontSize: 12,
                    color: "#888",
                  }}
                >
                  {threadMessages.length} messages
                </span>
              </div>
              <button
                onClick={() => setShowReviewModal(true)}
                style={{
                  padding: "8px 16px",
                  background: "#f59e0b",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Warning size={14} />
                Request Review
              </button>
            </div>

            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflow: "auto",
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {threadMessages.map((message) => (
                <MessageBubble
                  key={message.message_id}
                  message={message}
                  onAck={() => ackMessage(message.thread_id, message.message_id)}
                />
              ))}
            </div>

            {/* Review Actions (if pending) */}
            {threadMessages.some((m) => m.body.includes("review")) && (
              <div
                style={{
                  padding: 16,
                  borderTop: "1px solid var(--border-subtle, #333)",
                  background: "#f59e0b10",
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                }}
              >
                <button
                  onClick={() => handleDecideReview(true)}
                  style={{
                    padding: "10px 24px",
                    background: "#10b981",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <CheckCircle size={16} />
                  Approve
                </button>
                <button
                  onClick={() => handleDecideReview(false)}
                  style={{
                    padding: "10px 24px",
                    background: "#ff3b30",
                    border: "none",
                    borderRadius: 6,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <XCircle size={16} />
                  Reject
                </button>
              </div>
            )}

            {/* Message Input */}
            <div
              style={{
                padding: 16,
                borderTop: "1px solid var(--border-subtle, #333)",
                display: "flex",
                gap: 12,
              }}
            >
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Type a message..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  background: "var(--bg-secondary, #141414)",
                  border: "1px solid var(--border-subtle, #333)",
                  borderRadius: 8,
                  color: "var(--text-primary, #f0f0f0)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || isLoading}
                style={{
                  padding: "12px 20px",
                  background: "#0a84ff",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: messageText.trim() && !isLoading ? "pointer" : "not-allowed",
                  opacity: messageText.trim() && !isLoading ? 1 : 0.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <PaperPlaneTilt size={16} />
                Send
              </button>
            </div>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
            }}
          >
            <Chat size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Select a thread to view messages</p>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: 400,
              background: "var(--bg-secondary, #141414)",
              border: "1px solid var(--border-subtle, #333)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                margin: "0 0 16px 0",
              }}
            >
              Request Review
            </h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 24,
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "#888",
                    marginBottom: 4,
                  }}
                >
                  WIH ID
                </label>
                <input
                  type="text"
                  value={reviewWihId}
                  onChange={(e) => setReviewWihId(e.target.value)}
                  placeholder="Enter WIH ID"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-primary, #0a0a0a)",
                    border: "1px solid var(--border-subtle, #333)",
                    borderRadius: 6,
                    color: "var(--text-primary, #f0f0f0)",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "#888",
                    marginBottom: 4,
                  }}
                >
                  Diff Reference
                </label>
                <input
                  type="text"
                  value={reviewDiffRef}
                  onChange={(e) => setReviewDiffRef(e.target.value)}
                  placeholder="Enter diff reference"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    background: "var(--bg-primary, #0a0a0a)",
                    border: "1px solid var(--border-subtle, #333)",
                    borderRadius: 6,
                    color: "var(--text-primary, #f0f0f0)",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setShowReviewModal(false)}
                style={{
                  padding: "10px 20px",
                  background: "transparent",
                  border: "1px solid var(--border-subtle, #333)",
                  borderRadius: 6,
                  color: "#888",
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestReview}
                disabled={!reviewWihId || !reviewDiffRef}
                style={{
                  padding: "10px 20px",
                  background: "#0a84ff",
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: !reviewWihId || !reviewDiffRef ? "not-allowed" : "pointer",
                  opacity: !reviewWihId || !reviewDiffRef ? 0.5 : 1,
                }}
              >
                Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Thread Item Component
function ThreadItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: MailThread;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 12,
        background: isSelected ? "#0a84ff10" : "transparent",
        borderLeft: `3px solid ${isSelected ? "#0a84ff" : "transparent"}`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#0a84ff20",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Chat size={18} color="#0a84ff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary, #f0f0f0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {thread.topic}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#888",
          }}
        >
          {new Date(thread.created_at).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

// Message Bubble Component
function MessageBubble({
  message,
  onAck,
}: {
  message: MailMessage;
  onAck: () => void;
}) {
  const isMe = message.from_agent === "me";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isMe ? "row-reverse" : "row",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: isMe ? "#0a84ff20" : "#10b98120",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <User size={16} color={isMe ? "#0a84ff" : "#10b981"} />
      </div>
      <div
        style={{
          maxWidth: "70%",
          padding: 12,
          background: isMe ? "#0a84ff" : "var(--bg-secondary, #141414)",
          borderRadius: 12,
          borderBottomRightRadius: isMe ? 4 : 12,
          borderBottomLeftRadius: isMe ? 12 : 4,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isMe ? "#fff" : "#888",
            marginBottom: 4,
          }}
        >
          {message.from_agent}
        </div>
        <div
          style={{
            fontSize: 14,
            color: isMe ? "#fff" : "var(--text-primary, #f0f0f0)",
            lineHeight: 1.5,
          }}
        >
          {message.body}
        </div>
        <div
          style={{
            fontSize: 11,
            color: isMe ? "rgba(255,255,255,0.6)" : "#666",
            marginTop: 4,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Clock size={10} />
          {new Date(message.timestamp).toLocaleTimeString()}
          {!message.acknowledged && !isMe && (
            <button
              onClick={onAck}
              style={{
                marginLeft: 8,
                padding: "2px 8px",
                background: "#0a84ff",
                border: "none",
                borderRadius: 4,
                color: "#fff",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              Ack
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default MailTab;
