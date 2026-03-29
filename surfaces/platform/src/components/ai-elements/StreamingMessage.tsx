import React, { useRef, useEffect } from 'react';
import { Message, MessagePart } from '../../core/contracts';
import { UnifiedMessageRenderer } from './UnifiedMessageRenderer';
import { cn } from '@/lib/utils';
import {
  CircleNotch,
} from '@phosphor-icons/react';

interface StreamingMessageProps {
  message: Message;
  className?: string;
}

export function StreamingMessage({ message, className }: StreamingMessageProps) {
  const { isStreaming } = message.streamState || {};
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [message.parts, isStreaming]);

  // Convert contract MessageParts to ExtendedUIParts for UnifiedMessageRenderer
  // For now we map them directly as they share similar structure
  const parts = message.parts.map(part => {
    if (part.type === 'text') return { type: 'text', text: part.text };
    if (part.type === 'thinking') return { type: 'reasoning', text: part.thinking, content: part.thinking, isOpen: true };
    // Add more mappings as needed
    return part;
  }) as any;

  return (
    <div className={cn(
      "group relative flex flex-col gap-4 p-4 rounded-xl transition-colors",
      message.role === 'user' ? "bg-muted/30 ml-12" : "bg-background border mr-12",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold uppercase",
            message.role === 'user' ? "bg-primary text-primary-foreground" : "bg-accent-chat text-white"
          )}>
            {message.role[0]}
          </div>
          <span className="text-xs font-semibold opacity-50 uppercase tracking-wider">
            {message.role}
          </span>
        </div>
        
        {isStreaming && (
          <div className="flex items-center gap-1.5 text-[10px] text-accent-chat font-medium animate-pulse">
            <CircleNotch className="w-3 h-3 animate-spin" />
            STREAMING
          </div>
        )}
      </div>

      <UnifiedMessageRenderer
        parts={parts}
        isStreaming={isStreaming}
      />

      <div ref={bottomRef} />
    </div>
  );
}
