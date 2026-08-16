"use client";

import React, { useEffect, useRef } from "react";

import { AgentStorefrontCard } from "@/components/agents";
import type { Agent } from "@/lib/agents";
import { pluginCategoryIcon, type PluginMentionTarget } from "@/lib/mentions/use-mention-targets";

interface AgentMentionDropdownProps {
  agents: Agent[];
  query: string;
  selectedIndex: number;
  onSelect: (agent: Agent) => void;
  onHoverIndex?: (index: number) => void;
  onClose: () => void;
  position?: { x: number; y: number };
  /** Unified plugins + connectors section (pre-filtered by the composer). */
  pluginTargets?: PluginMentionTarget[];
  onSelectPluginTarget?: (target: PluginMentionTarget) => void;
  /** Currently selected bot/agent in the composer. */
  activeAgentId?: string | null;
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
  position,
  pluginTargets = [],
  onSelectPluginTarget,
  activeAgentId,
}: AgentMentionDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const botAgents = agents.filter((agent) => agent.isBot === true);
  const filtered = botAgents.filter((agent) =>
    (agent.botProfile?.displayName ?? agent.name)
      .toLowerCase()
      .includes(query.toLowerCase())
  );
  const targetOffset = filtered.length;

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

  if (filtered.length === 0 && pluginTargets.length === 0) {
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
        No bots or connectors matching "{query}"
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
        width: 320,
        maxHeight: 320,
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
      {filtered.length > 0 && (
        <>
          <div
            style={{
              padding: "8px 12px",
              borderBottom: `1px solid ${THEME.border}`,
              fontSize: 12,
              fontWeight: 700,
              color: THEME.textMuted,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Mention a bot
          </div>
          <div style={{ overflowY: "auto", padding: 6, flexShrink: 0, maxHeight: 140 }}>
            {filtered.map((agent, index) => {
              const isSelected = index === selectedIndex;

              return (
                <button type="button"
                  key={agent.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onClick={() => onSelect(agent)}
                  onMouseEnter={() => {
                    onHoverIndex?.(index);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "4px 6px",
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
                  <AgentStorefrontCard
                    agent={agent}
                    compact
                    style={{ background: 'transparent', border: 'none', padding: 0, flex: 1 }}
                    onClick={() => onSelect(agent)}
                  />
                  {activeAgentId && activeAgentId !== agent.id && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: 10,
                        fontWeight: 600,
                        color: THEME.accent,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Handoff
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      {pluginTargets.length > 0 && (
        <>
          <div
            style={{
              padding: "8px 12px",
              borderBottom: `1px solid ${THEME.border}`,
              fontSize: 12,
              fontWeight: 700,
              color: THEME.textMuted,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            Plugins & Connectors
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
            {pluginTargets.map((target, i) => {
              const index = targetOffset + i;
              const isSelected = index === selectedIndex;
              const CategoryIcon = pluginCategoryIcon(target);

              return (
                <button type="button"
                  key={`${target.kind}-${target.id}`}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  onClick={() => onSelectPluginTarget?.(target)}
                  onMouseEnter={() => {
                    onHoverIndex?.(index);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "6px 8px",
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
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                      background: target.iconUrl ? "transparent" : THEME.accent,
                      color: "#fff",
                    }}
                  >
                    {target.iconUrl ? (
                      <img
                        src={target.iconUrl}
                        alt=""
                        width={24}
                        height={24}
                        style={{ borderRadius: 6, objectFit: "cover" }}
                      />
                    ) : (
                      <CategoryIcon size={13} weight="bold" />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {target.name}
                      </span>
                      {target.kind === 'connector' && target.connected && (
                        <span
                          title="Connected"
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "var(--status-success, #4ade80)",
                            flexShrink: 0,
                          }}
                        />
                      )}
                    </div>
                    {target.description && (
                      <div
                        style={{
                          fontSize: 11,
                          color: THEME.textMuted,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {target.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
