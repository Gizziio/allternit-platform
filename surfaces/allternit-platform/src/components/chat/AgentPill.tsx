"use client";

import React from "react";
import { X } from "@phosphor-icons/react";
import { AgentAvatar } from "@/components/Avatar";
import type { Agent } from "@/lib/agents";

interface AgentPillProps {
  agent: Agent;
  onRemove: () => void;
}

const THEME = {
  bg: "var(--chat-composer-soft, rgba(212, 176, 140, 0.08))",
  border: "var(--ui-border-muted, rgba(212, 176, 140, 0.12))",
  textPrimary: "var(--ui-text-primary, #ECECEC)",
  textSecondary: "var(--ui-text-secondary, #9B9B9B)",
  accent: "var(--accent-chat, #D4B08C)",
};

export function AgentPill({ agent, onRemove }: AgentPillProps) {
  const avatarConfig =
    (agent.config?.avatar as Record<string, unknown>) || undefined;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 8px 4px 4px",
        borderRadius: 8,
        background: THEME.bg,
        border: `1px solid ${THEME.border}`,
        fontSize: 13,
        fontWeight: 600,
        color: THEME.textPrimary,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {avatarConfig ? (
          <AgentAvatar
            config={avatarConfig as any}
            size={20}
            emotion="steady"
            isAnimating={false}
            showGlow={false}
          />
        ) : (
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: THEME.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
            }}
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: 160,
        }}
      >
        {agent.name}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 16,
          height: 16,
          borderRadius: 4,
          border: "none",
          background: "transparent",
          color: THEME.textSecondary,
          cursor: "pointer",
          padding: 0,
          marginLeft: 2,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--ui-border-muted)";
          e.currentTarget.style.color = THEME.textPrimary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = THEME.textSecondary;
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}
