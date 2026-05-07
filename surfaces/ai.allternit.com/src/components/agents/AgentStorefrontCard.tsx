"use client";

import React from "react";
import { Star, Zap, Shield, Users, TrendingUp, Clock } from "lucide-react";
import { AgentAvatar } from "@/components/Avatar";
import type { Agent } from "@/lib/agents/agent.types";

interface AgentStorefrontCardProps {
  agent: Agent;
  onClick?: (agent: Agent) => void;
  onMention?: (agent: Agent) => void;
  compact?: boolean;
  style?: React.CSSProperties;
}

const TRUST_TIER_COLORS: Record<string, string> = {
  safe: "#22c55e",
  low: "#84cc16",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

const CATEGORY_LABELS: Record<string, string> = {
  engineering: "Engineering",
  design: "Design",
  marketing: "Marketing",
  product: "Product",
  research: "Research",
  operations: "Operations",
  creative: "Creative",
  general: "General",
};

function RatingStars({ rating, count }: { rating?: number; count?: number }) {
  if (!rating) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ display: "flex", gap: 1 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            size={12}
            fill={i < Math.round(rating) ? "#f59e0b" : "transparent"}
            color={i < Math.round(rating) ? "#f59e0b" : "#4b5563"}
          />
        ))}
      </div>
      {count !== undefined && (
        <span style={{ fontSize: 11, color: "var(--ui-text-muted)" }}>
          ({count})
        </span>
      )}
    </div>
  );
}

export function AgentStorefrontCard({ agent, onClick, onMention, compact, style }: AgentStorefrontCardProps) {
  const avatarConfig = (agent.config?.avatar as Record<string, unknown>) || undefined;
  const trustTier = agent.agentCard?.trustTier;
  const isSwarm = !!agent.swarmId;

  if (compact) {
    return (
      <div
        onClick={() => onClick?.(agent)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          borderRadius: 10,
          background: "var(--chat-composer-soft)",
          border: "1px solid var(--ui-border-muted)",
          cursor: onClick ? "pointer" : "default",
          transition: "all 0.15s ease",
          ...style,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent-chat)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--ui-border-muted)";
        }}
      >
        <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
          {avatarConfig ? (
            <AgentAvatar config={avatarConfig as any} size={32} emotion="steady" isAnimating={false} showGlow={false} />
          ) : (
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--accent-chat)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ui-text-primary)" }}>{agent.name}</span>
            {isSwarm && (
              <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "#8b5cf620", color: "#8b5cf6", fontWeight: 600 }}>
                SWARM
              </span>
            )}
          </div>
          <RatingStars rating={agent.rating} count={agent.reviewCount} />
        </div>
        {onMention && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMention(agent);
            }}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              background: "var(--accent-chat)",
              color: "#000",
              border: "none",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            @mention
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(agent)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        borderRadius: 14,
        background: "var(--surface-floating)",
        border: "1px solid var(--ui-border-muted)",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-chat)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--ui-border-muted)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
          {avatarConfig ? (
            <AgentAvatar config={avatarConfig as any} size={48} emotion="steady" isAnimating={false} showGlow={false} />
          ) : (
            <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--accent-chat)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 700 }}>
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ui-text-primary)" }}>{agent.name}</span>
            {isSwarm && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "#8b5cf620", color: "#8b5cf6", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <Users size={10} />
                SWARM
              </span>
            )}
            {agent.category && (
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "var(--chat-composer-soft)", color: "var(--ui-text-secondary)", fontWeight: 500 }}>
                {CATEGORY_LABELS[agent.category] || agent.category}
              </span>
            )}
          </div>
          <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--ui-text-secondary)", lineHeight: 1.4 }}>
            {agent.agentCard?.tagline || agent.description}
          </p>
          <div style={{ marginTop: 6 }}>
            <RatingStars rating={agent.rating} count={agent.reviewCount} />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        {agent.totalRuns !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ui-text-muted)" }}>
            <Zap size={12} />
            {agent.totalRuns.toLocaleString()} runs
          </div>
        )}
        {agent.successRate !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ui-text-muted)" }}>
            <TrendingUp size={12} />
            {agent.successRate}% success
          </div>
        )}
        {agent.avgResponseTime !== undefined && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--ui-text-muted)" }}>
            <Clock size={12} />
            {(agent.avgResponseTime / 1000).toFixed(1)}s avg
          </div>
        )}
        {trustTier && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: TRUST_TIER_COLORS[trustTier] || "var(--ui-text-muted)" }}>
            <Shield size={12} />
            {trustTier}
          </div>
        )}
      </div>

      {/* Tags */}
      {agent.tags && agent.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {agent.tags.map((tag) => (
            <span key={tag} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "var(--chat-composer-soft)", color: "var(--ui-text-secondary)" }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Mention button */}
      {onMention && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMention(agent);
          }}
          style={{
            width: "100%",
            padding: "8px",
            borderRadius: 8,
            background: "var(--accent-chat)",
            color: "#000",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Zap size={14} />
          Use @{agent.name.split(" ")[0]}
        </button>
      )}
    </div>
  );
}
