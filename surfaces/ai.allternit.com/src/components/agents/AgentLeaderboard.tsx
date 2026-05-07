"use client";

import React from "react";
import { Trophy, Star, TrendingUp, Zap, Clock } from "lucide-react";
import { useAgentRatingsStore } from "@/stores/agent-ratings.store";
import { AgentAvatar } from "@/components/Avatar";
import type { Agent } from "@/lib/agents/agent.types";

interface AgentLeaderboardProps {
  agents: Agent[];
  benchmarkId?: string;
  onSelectAgent?: (agent: Agent) => void;
}

export function AgentLeaderboard({ agents, benchmarkId, onSelectAgent }: AgentLeaderboardProps) {
  const leaderboard = useAgentRatingsStore((state) =>
    state.getLeaderboard(benchmarkId)
  );

  // Merge with agent data for avatars/names
  const enriched = leaderboard
    .map((entry) => {
      const agent = agents.find((a) => a.id === entry.agentId);
      return { ...entry, agent };
    })
    .filter((e) => e.agent);

  if (enriched.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--ui-text-muted)" }}>
        <Trophy size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
        <p style={{ fontSize: 14 }}>No benchmark data yet.</p>
        <p style={{ fontSize: 12, marginTop: 4 }}>Run agents through tasks to see rankings.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {enriched.map((entry, index) => {
        const agent = entry.agent!;
        const avatarConfig = (agent.config?.avatar as Record<string, unknown>) || undefined;
        const isTop3 = index < 3;

        return (
          <div
            key={entry.agentId}
            onClick={() => onSelectAgent?.(agent)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 10,
              background: isTop3
                ? "linear-gradient(90deg, rgba(212,176,140,0.08) 0%, transparent 100%)"
                : "transparent",
              border: "1px solid",
              borderColor: isTop3 ? "var(--accent-chat)" : "var(--ui-border-muted)",
              cursor: onSelectAgent ? "pointer" : "default",
              transition: "all 0.15s ease",
            }}
          >
            {/* Rank */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                background: isTop3 ? "var(--accent-chat)" : "var(--chat-composer-soft)",
                color: isTop3 ? "#000" : "var(--ui-text-secondary)",
                flexShrink: 0,
              }}
            >
              {index + 1}
            </div>

            {/* Avatar */}
            <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
              {avatarConfig ? (
                <AgentAvatar config={avatarConfig as any} size={36} emotion="steady" isAnimating={false} showGlow={false} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--accent-chat)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>
                  {agent.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ui-text-primary)" }}>
                {agent.name}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 2, flexWrap: "wrap" }}>
                {entry.avgScore > 0 && (
                  <span style={{ fontSize: 11, color: "var(--ui-text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                    <TrendingUp size={10} />
                    {entry.avgScore} benchmark
                  </span>
                )}
                {entry.avgRating > 0 && (
                  <span style={{ fontSize: 11, color: "#f59e0b", display: "flex", alignItems: "center", gap: 3 }}>
                    <Star size={10} />
                    {entry.avgRating} ({entry.reviewCount})
                  </span>
                )}
                {entry.totalRuns > 0 && (
                  <span style={{ fontSize: 11, color: "var(--ui-text-muted)", display: "flex", alignItems: "center", gap: 3 }}>
                    <Zap size={10} />
                    {entry.totalRuns} runs
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
