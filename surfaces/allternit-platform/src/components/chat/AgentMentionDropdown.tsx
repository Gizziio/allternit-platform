"use client";

import React, { useEffect, useRef } from "react";

import { AgentAvatar } from "@/components/Avatar";
import type { Agent } from "@/lib/agents";

interface AgentMentionDropdownProps {
  agents: Agent[];
  query: string;
  selectedIndex: number;
  onSelect: (agent: Agent) => void;
  onHoverIndex?: (index: number) => void;
  onClose: () => void;
}

const THEME = {
  bg: "var(--chat-composer-menu-bg, rgba(30, 28, 26, 0.98))",
  border: "var(--chat-composer-menu-border, rgba(212, 176, 140, 0.15))",
  textPrimary: "var(--ui-text-primary, #ECECEC)",
  textSecondary: "var(--ui-text-secondary, #9B9B9B)",
  textMuted: "var(--ui-text-muted, #6E6E6E)",
  accent: "var(--accent-chat, #D4B08C)",
  hoverBg: "var(--chat-composer-hover, rgba(212, 176, 140, 0.08))",
};

export function AgentMentionDropdown({
  agents,
  query,
  selectedIndex,
  onSelect,
  onHoverIndex,
  onClose,
}: AgentMentionDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const filtered = agents.filter((agent) =>
    agent.name.toLowerCase().includes(query.toLowerCase())
  );

  // Scroll selected item into view
  useEffect(() => {
    const el = itemRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  if (filtered.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: 20,
          width: 260,
          background: THEME.bg,
          borderRadius: 12,
          border: `1px solid ${THEME.border}`,
          boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
          zIndex: 200,
          padding: "12px 16px",
          fontSize: 13,
          color: THEME.textSecondary,
        }}
      >
        No agents found matching "{query}"
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: 20,
        width: 280,
        maxHeight: 280,
        background: THEME.bg,
        borderRadius: 12,
        border: `1px solid ${THEME.border}`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        zIndex: 200,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          borderBottom: `1px solid ${THEME.border}`,
          fontSize: 11,
          fontWeight: 700,
          color: THEME.textMuted,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        Mention an agent
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
        {filtered.map((agent, index) => {
          const isSelected = index === selectedIndex;
          const avatarConfig =
            (agent.config?.avatar as Record<string, unknown>) || undefined;

          return (
            <button
              key={agent.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              type="button"
              onClick={() => onSelect(agent)}
              onMouseEnter={() => {
                onHoverIndex?.(index);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                border: "none",
                background: isSelected
                  ? "rgba(212, 176, 140, 0.12)"
                  : "transparent",
                color: THEME.textPrimary,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s",
                outline: isSelected ? `1px solid ${THEME.accent}` : "none",
                outlineOffset: -1,
              }}
              onMouseMove={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = THEME.hoverBg;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isSelected
                  ? "rgba(212, 176, 140, 0.12)"
                  : "transparent";
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: isSelected
                    ? "rgba(212, 176, 140, 0.18)"
                    : "rgba(255,255,255,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isSelected ? THEME.accent : THEME.textSecondary,
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {avatarConfig ? (
                  <AgentAvatar
                    config={avatarConfig as any}
                    size={24}
                    emotion="steady"
                    isAnimating={false}
                    showGlow={false}
                  />
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: THEME.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#fff',
                    }}
                  >
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {agent.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: THEME.textSecondary,
                    marginTop: 1,
                  }}
                >
                  {agent.provider} · {agent.model}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
