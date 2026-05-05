"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { DotsThree, Play, PencilSimple, Trash, Copy } from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents/agent.types";
import { useAgentStore } from "@/lib/agents/agent.store";
import { STUDIO_THEME } from "../AgentView.constants";
import { AgentAvatar } from "@/components/Avatar";
import { MascotPreview } from "./AgentMascotPreview";

interface AgentGalleryCardProps {
  agent: Agent;
  onClick: () => void;
  index?: number;
}

const SOURCE_COLORS: Record<string, { bg: string; text: string }> = {
  personal: { bg: "#6366f120", text: "#818cf8" },
  vendor: { bg: "#0ea5e920", text: "#38bdf8" },
  organization: { bg: "#10b98120", text: "#34d399" },
};

const AVATAR_PALETTE = [
  { bg: "#4f46e5", text: "#fff" },
  { bg: "#0ea5e9", text: "#fff" },
  { bg: "#10b981", text: "#fff" },
  { bg: "#f59e0b", text: "#fff" },
  { bg: "#ec4899", text: "#fff" },
  { bg: "#8b5cf6", text: "#fff" },
  { bg: "#ef4444", text: "#fff" },
  { bg: "#14b8a6", text: "#fff" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function AgentCardAvatar({ agent }: { agent: Agent }) {
  const avatarConfig = (agent as any).avatar || (agent.config as any)?.avatar;
  const initial = agent.name.charAt(0).toUpperCase();

  // Real SVG avatar — render at 48px for better visibility
  if (avatarConfig && (avatarConfig.eyes || avatarConfig.antennas || avatarConfig.baseShape)) {
    return (
      <div style={{ width: 48, height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AgentAvatar config={avatarConfig} size={48} emotion="steady" isAnimating={false} showGlow={false} />
      </div>
    );
  }

  // Mascot-style avatar — icons scale perfectly at any size
  if (avatarConfig && ((avatarConfig as any).mascotTemplate || (avatarConfig as any).type === "mascot")) {
    return (
      <div style={{ width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <MascotPreview config={avatarConfig} name={agent.name} />
      </div>
    );
  }

  // Fallback: colored initial square
  const color = getAvatarColor(agent.name);
  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: color.bg,
        color: color.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        fontWeight: 700,
        flexShrink: 0,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {initial}
    </div>
  );
}

export function AgentGalleryCard({ agent, onClick, index = 0 }: AgentGalleryCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { setIsEditing, setIsCreating, deleteAgent, agents } = useAgentStore();
  const initial = agent.name.charAt(0).toUpperCase();
  const source = agent.source || "personal";
  const sourceColor = SOURCE_COLORS[source] || SOURCE_COLORS.personal;

  const attribution = source === "vendor"
    ? "By Allternit"
    : source === "organization"
      ? "By Corp"
      : null;

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    sessionStorage.setItem(
      "agentTemplate",
      JSON.stringify({
        name: `${agent.name} (Copy)`,
        description: agent.description,
        type: agent.type,
        model: agent.model,
        provider: agent.provider,
        capabilities: agent.capabilities,
        systemPrompt: agent.systemPrompt,
        tools: agent.tools,
        maxIterations: agent.maxIterations,
        temperature: agent.temperature,
        source: "personal",
      })
    );
    setIsCreating(true);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onClick();
    setTimeout(() => setIsEditing(agent.id), 100);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    if (confirm(`Delete agent "${agent.name}"?`)) {
      deleteAgent(agent.id);
    }
  };

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    // Trigger agent run
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setMenuOpen(false); }}
      onClick={() => !menuOpen && onClick()}
      style={{
        cursor: "pointer",
        borderRadius: "14px",
        border: `1px solid ${isHovered ? STUDIO_THEME.border : STUDIO_THEME.borderSubtle}`,
        background: isHovered ? STUDIO_THEME.bg : STUDIO_THEME.bgCard,
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      <div style={{ padding: "16px" }}>
        {/* Top row: avatar + name + menu */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          {/* Avatar */}
          <AgentCardAvatar agent={agent} />

          {/* Name + description */}
          <div style={{ flex: 1, minWidth: 0, marginTop: "2px" }}>
            <h3
              style={{
                fontSize: "14px",
                fontWeight: 600,
                color: STUDIO_THEME.textPrimary,
                margin: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {agent.name}
            </h3>
            {attribution && (
              <p
                style={{
                  fontSize: "11px",
                  color: STUDIO_THEME.textMuted,
                  margin: "2px 0 0 0",
                }}
              >
                {attribution}
              </p>
            )}
          </div>

          {/* 3-dot menu */}
          <div style={{ position: "relative" }}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                border: "none",
                background: menuOpen ? `${STUDIO_THEME.accent}15` : "transparent",
                color: STUDIO_THEME.textMuted,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `${STUDIO_THEME.accent}15`; }}
              onMouseLeave={(e) => { if (!menuOpen) e.currentTarget.style.background = "transparent"; }}
            >
              <DotsThree size={18} />
            </button>

            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  width: "140px",
                  background: "#1a1a2e",
                  border: "1px solid var(--ui-border-muted)",
                  borderRadius: "10px",
                  padding: "6px",
                  zIndex: 50,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                <MenuItem icon={<Play size={14} />} label="Run" onClick={handleRun} />
                <MenuItem icon={<PencilSimple size={14} />} label="Edit" onClick={handleEdit} />
                <MenuItem icon={<Copy size={14} />} label="Duplicate" onClick={handleDuplicate} />
                <div style={{ height: "1px", background: STUDIO_THEME.borderSubtle, margin: "4px 0" }} />
                <MenuItem icon={<Trash size={14} />} label="Delete" danger onClick={handleDelete} />
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: "12px",
            color: STUDIO_THEME.textSecondary,
            margin: "10px 0 0 0",
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "36px",
          }}
        >
          {agent.description || "No description provided"}
        </p>

        {/* Source badge */}
        <div style={{ marginTop: "10px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {source !== "personal" && (
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "999px",
                background: sourceColor.bg,
                color: sourceColor.text,
                fontSize: "10px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {source}
            </span>
          )}
          <span
            style={{
              padding: "2px 8px",
              borderRadius: "999px",
              background: "var(--surface-hover)",
              color: STUDIO_THEME.textMuted,
              fontSize: "10px",
              fontWeight: 500,
            }}
          >
            {agent.model}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 8px",
        borderRadius: "6px",
        border: "none",
        background: "transparent",
        color: danger ? "#f87171" : STUDIO_THEME.textSecondary,
        fontSize: "12px",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${STUDIO_THEME.accent}10`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {icon}
      {label}
    </button>
  );
}
