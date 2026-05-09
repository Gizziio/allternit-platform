"use client";

import React from 'react';
import { cn } from '@/lib/utils';

export type MockChatStyle = 'claude' | 'gpt' | 'grok' | 'gemini';

export interface MockChatMessage {
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
}

export interface MockChatProps {
  style?: MockChatStyle;
  messages: MockChatMessage[];
  className?: string;
}

const styleConfig: Record<MockChatStyle, {
  accentClass: string;
  assistantBubble: string;
  userBubble: string;
  label: string;
}> = {
  claude: {
    accentClass: 'bg-orange-500',
    assistantBubble: 'bg-muted text-foreground',
    userBubble: 'bg-orange-500 text-white',
    label: 'Claude',
  },
  gpt: {
    accentClass: 'bg-green-500',
    assistantBubble: 'bg-muted text-foreground',
    userBubble: 'bg-green-500 text-white',
    label: 'ChatGPT',
  },
  grok: {
    accentClass: 'bg-foreground',
    assistantBubble: 'bg-muted text-foreground',
    userBubble: 'bg-foreground text-background',
    label: 'Grok',
  },
  gemini: {
    accentClass: 'bg-blue-500',
    assistantBubble: 'bg-muted text-foreground',
    userBubble: 'bg-blue-500 text-white',
    label: 'Gemini',
  },
};

export function MockChat({ style = 'claude', messages, className }: MockChatProps) {
  const config = styleConfig[style];

  return (
    <div className={cn("rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Chrome bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-muted/30">
        <div className={cn("h-2 w-2 rounded-full", config.accentClass)} />
        <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-4 p-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
            {msg.role === 'assistant' && (
              <div className={cn(
                "mr-2 mt-0.5 h-6 w-6 flex-shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white",
                config.accentClass
              )}>
                {config.label[0]}
              </div>
            )}
            <div className="max-w-[80%]">
              {msg.thinking && (
                <div className="mb-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground italic">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 block mb-1 not-italic">
                    Thinking
                  </span>
                  {msg.thinking}
                </div>
              )}
              <div className={cn(
                "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                msg.role === 'assistant'
                  ? cn(config.assistantBubble, "rounded-tl-sm")
                  : cn(config.userBubble, "rounded-tr-sm")
              )}>
                {msg.content}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
