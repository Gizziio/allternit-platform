"use client";

import React, { useState } from 'react';
import { DeviceMobile, Copy, ArrowSquareOut, PencilSimple, ArrowCounterClockwise } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

export interface SMSMessage {
  role: 'sender' | 'recipient';
  text: string;
}

export interface SMSDraftProps {
  to: string;
  messages: SMSMessage[];
  className?: string;
  onEdit?: (text: string) => void;
  onReset?: () => void;
}

export function SMSDraft({ to, messages, className, onEdit, onReset }: SMSDraftProps) {
  const lastMessage = messages[messages.length - 1];
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(lastMessage?.text ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenMessages = () => {
    const body = encodeURIComponent(lastMessage?.text ?? '');
    const num = to.replace(/\D/g, '');
    window.location.href = `sms:${num}&body=${body}`;
  };

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden max-w-sm", className)}>
      {/* Header */}
      <div className="flex flex-col items-center gap-0.5 border-b border-border px-4 py-3 bg-muted/30 text-center">
        <div className="flex size-8  items-center justify-center rounded-full bg-primary/10 mb-1">
          <DeviceMobile className="size-4  text-primary" />
        </div>
        <span className="text-xs text-muted-foreground">{to}</span>
      </div>

      {/* Bubbles */}
      <div className="flex flex-col gap-2 p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex", msg.role === 'sender' ? "justify-end" : "justify-start")}
          >
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              msg.role === 'sender'
                ? "bg-primary text-primary-foreground rounded-br-sm"
                : "bg-muted text-foreground rounded-bl-sm"
            )}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap border-t border-border px-4 py-3 bg-muted/20">
        <button
          type="button"
          onClick={handleOpenMessages}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 transition-colors"
        >
          <ArrowSquareOut className="size-3 " />
          Open in Messages
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
        >
          <Copy className="size-3 " />
          {copied ? 'Copied!' : 'Copy'}
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(lastMessage?.text ?? '')}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <PencilSimple className="size-3 " />
            Edit
          </button>
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors ml-auto"
          >
            <ArrowCounterClockwise className="size-3 " />
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
