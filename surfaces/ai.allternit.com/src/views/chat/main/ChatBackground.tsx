"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { AgentModeBackdrop } from "../agentModeSurfaceTheme";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";

interface ChatBackgroundProps {
  isAgentSessionEmbedded: boolean;
  mode: 'chat' | 'cowork' | 'bot' | 'code';
  effectiveAgentModeEnabled: boolean;
  agentSurface: AgentModeSurface;
  hudMode?: boolean;
  children: React.ReactNode;
}

export const ChatBackground: React.FC<ChatBackgroundProps> = ({
  isAgentSessionEmbedded,
  mode,
  effectiveAgentModeEnabled,
  agentSurface,
  hudMode = false,
  children,
}) => {
  const getEmbeddedChatBackground = () => {
    if (!isAgentSessionEmbedded) {
      if (mode === 'cowork' || mode === 'bot') return 'transparent';
      return 'var(--view-chat-bg, var(--surface-canvas))';
    }
    // Opaque view base first so the open session matches the white shell views
    // and occludes the warm agent glow painted by the shell frame behind it.
    return 'linear-gradient(var(--view-chat-bg, var(--shell-view-bg)), var(--view-chat-bg, var(--shell-view-bg))), radial-gradient(circle at top right, color-mix(in srgb, var(--accent-chat) 10%, transparent), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 18%, transparent) 0%, transparent 18%)';
  };

  const getEmbeddedChatBoxShadow = () => {
    if (!isAgentSessionEmbedded) return 'none';
    return 'inset 0 0 0 1px color-mix(in srgb, var(--accent-chat) 12%, transparent), inset 0 24px 120px color-mix(in srgb, var(--accent-chat) 8%, transparent)';
  };

  return (
    <div 
      className={cn('flex flex-col w-full relative isolation-isolate', hudMode ? 'h-auto' : 'h-full overflow-hidden')}
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
