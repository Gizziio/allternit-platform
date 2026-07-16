"use client";

import React, { useMemo } from 'react';
import { Copy, Check } from '@phosphor-icons/react';
import { useCodeSessionStore } from './CodeSessionStore';

interface CodeTranscriptPaneProps {
  sessionId?: string;
}

export function CodeTranscriptPane({ sessionId }: CodeTranscriptPaneProps): React.ReactNode {
  const session = useCodeSessionStore((state) =>
    sessionId ? state.sessions.find((s) => s.id === sessionId) ?? null : null,
  );
  const [copied, setCopied] = React.useState(false);

  const transcriptText = useMemo(() => {
    if (!session) return '';
    return session.messages
      .map((message) => {
        const time = new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
        const label = message.role === 'user' ? 'You' : message.role === 'assistant' ? 'Assistant' : message.role;
        return `[${time}] ${label}:\n${message.content}`;
      })
      .join('\n\n');
  }, [session]);

  const copyToClipboard = () => {
    if (!transcriptText) return;
    const write = navigator.clipboard?.writeText?.(transcriptText);
    if (write && typeof write.then === 'function') {
      void write.then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      });
    } else {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }
  };

  if (!session) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[var(--surface-canvas)] px-6">
        <p className="text-center text-[12px] text-[var(--text-tertiary)]">No session selected.</p>
      </div>
    );
  }

  if (session.messages.length === 0) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center bg-[var(--surface-canvas)] px-6">
        <p className="text-center text-[12px] text-[var(--text-tertiary)]">No messages in this session yet.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--surface-canvas)]">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2">
        <span className="text-[11px] text-[var(--text-tertiary)]">{session.messages.length} message{session.messages.length === 1 ? '' : 's'}</span>
        <button
          type="button"
          onClick={copyToClipboard}
          disabled={copied}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-70"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="flex flex-col gap-3">
          {session.messages.map((message) => {
            const isUser = message.role === 'user';
            const time = new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return (
              <div key={message.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold ${isUser ? 'text-[var(--accent-code)]' : 'text-[var(--text-secondary)]'}`}>
                    {isUser ? 'You' : message.role === 'assistant' ? 'Assistant' : message.role}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">{time}</span>
                </div>
                <div className="whitespace-pre-wrap rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-panel)] px-3 py-2 text-[11px] leading-5 text-[var(--text-primary)]">
                  {message.content}
                </div>
                {message.thinking ? (
                  <div className="whitespace-pre-wrap rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-3 py-2 text-[10px] leading-4 text-[var(--text-tertiary)]">
                    {message.thinking}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
