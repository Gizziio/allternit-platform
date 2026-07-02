"use client";

import React from "react";
import { AgentModeBackdrop } from "../agentModeSurfaceTheme";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";

interface ChatBackgroundProps {
  isAgentSessionEmbedded: boolean;
  mode: 'chat' | 'cowork' | 'code';
  effectiveAgentModeEnabled: boolean;
  agentSurface: AgentModeSurface;
  children: React.ReactNode;
}

export const ChatBackground: React.FC<ChatBackgroundProps> = ({
  isAgentSessionEmbedded,
  mode,
  effectiveAgentModeEnabled,
  agentSurface,
  children,
}) => {
  const getEmbeddedChatBackground = () => {
    if (!isAgentSessionEmbedded) {
      if (mode === 'cowork') return 'transparent';
      return 'var(--view-chat-bg, var(--surface-canvas))';
    }
    return 'radial-gradient(circle at top right, color-mix(in srgb, var(--accent-chat) 10%, transparent), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 18%, transparent) 0%, transparent 18%)';
  };

  const getEmbeddedChatBoxShadow = () => {
    if (!isAgentSessionEmbedded) return 'none';
    return 'inset 0 0 0 1px color-mix(in srgb, var(--accent-chat) 12%, transparent), inset 0 24px 120px color-mix(in srgb, var(--accent-chat) 8%, transparent)';
  };

  return (
    <div 
      className="flex flex-col h-full w-full relative overflow-hidden isolation-isolate"
      style={{
        background: getEmbeddedChatBackground(),
        boxShadow: getEmbeddedChatBoxShadow(),
      }}
    >
      <AgentModeBackdrop
        active={effectiveAgentModeEnabled}
        surface={agentSurface}
        dataTestId={`agent-mode-${agentSurface}-backdrop`}
      />
      {children}
    </div>
  );
};
