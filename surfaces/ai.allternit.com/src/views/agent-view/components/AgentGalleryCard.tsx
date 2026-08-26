"use client";

import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DotsThree,
  Play,
  PencilSimple,
  Trash,
  Copy,
  Robot,
  UsersThree,
  Code,
  MagnifyingGlass,
  ShieldCheck,
  ChatTeardropText,
  Palette,
  Globe,
  Star,
  Lightning,
} from "@phosphor-icons/react";
import type { Agent, AgentType, AppMode } from "@/lib/agents/agent.types";
import { useAgentStore } from "@/lib/agents/agent.store";
import { AgentAvatar } from "@/components/Avatar";
import { MascotPreview } from "./AgentMascotPreview";
import { ConfirmModal } from "@/components/ConfirmModal";
import { cn } from "@/lib/utils";
import { isBot } from "@/lib/bots/bot-profile";

interface AgentGalleryCardProps {
  agent: Agent;
  onClick: () => void;
  index?: number;
}

const TYPE_META: Record<
  AgentType,
  { label: string; icon: React.ElementType; accent: string }
> = {
  orchestrator: { label: "Orchestrator", icon: UsersThree, accent: "var(--accent-primary)" },
  "sub-agent": { label: "Sub-agent", icon: Robot, accent: "var(--status-info)" },
  worker: { label: "Worker", icon: Code, accent: "var(--status-success)" },
  specialist: { label: "Specialist", icon: MagnifyingGlass, accent: "var(--status-warning)" },
  reviewer: { label: "Reviewer", icon: ShieldCheck, accent: "var(--status-error)" },
  assistant: { label: "Assistant", icon: Star, accent: "var(--text-tertiary)" },
};

const SOURCE_LABEL: Record<string, string> = {
  personal: "My agent",
  vendor: "Allternit",
  organization: "Organization",
};

const SURFACE_ICONS: Record<AppMode, React.ElementType> = {
  chat: ChatTeardropText,
  code: Code,
  cowork: UsersThree,
  design: Palette,
  browser: Globe,
};

function initials(name: string): string {
  return (name || "Agent")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function formatUpdatedAt(ts?: string | number | Date): string {
  if (!ts) return "";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.getTime();
  if (time >= startOfToday) return "Today";
  if (time >= startOfToday - 24 * 60 * 60 * 1000) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function AgentCardAvatar({ agent, accent }: { agent: Agent; accent: string }) {
  const avatarConfig = (agent as any).avatar || (agent.config as any)?.avatar;
  const size = 40;

  if (avatarConfig && (avatarConfig.eyes || avatarConfig.antennas || avatarConfig.baseShape)) {
    return (
      <div
        className="shrink-0 rounded-xl border-2 p-0.5"
        style={{ borderColor: accent, width: size + 6, height: size + 6 }}
      >
        <AgentAvatar config={avatarConfig} size={size} emotion="steady" isAnimating={false} showGlow={false} />
      </div>
    );
  }

  if (avatarConfig && ((avatarConfig as any).mascotTemplate || (avatarConfig as any).type === "mascot")) {
    return (
      <div
        className="shrink-0 rounded-xl border-2 p-0.5"
        style={{ borderColor: accent, width: size + 6, height: size + 6 }}
      >
        <MascotPreview config={avatarConfig} name={agent.name} />
      </div>
    );
  }

  const gradient = `linear-gradient(135deg, color-mix(in srgb, ${accent} 55%, transparent), color-mix(in srgb, ${accent} 20%, transparent))`;

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-xl text-[17px] font-bold"
      style={{
        width: size + 6,
        height: size + 6,
        background: gradient,
        color: accent,
        border: `2px solid ${accent}`,
      }}
    >
      {initials(agent.name)}
    </div>
  );
}

export function AgentGalleryCard({ agent, onClick, index = 0 }: AgentGalleryCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { setIsEditing, setIsCreating, deleteAgent, setDraftAgent } = useAgentStore();
  const source = agent.source || "personal";
  const typeMeta = TYPE_META[agent.type] || TYPE_META.worker;
  const Icon = typeMeta.icon;
  const accent = typeMeta.accent;

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    setDraftAgent({
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
      isBot: agent.isBot,
      botProfile: agent.botProfile
        ? {
            ...agent.botProfile,
            displayName: `${agent.botProfile.displayName} (Copy)`,
          }
        : undefined,
      connectorBindings: agent.connectorBindings,
      secretRefs: agent.secretRefs,
      messagingConfig: agent.messagingConfig,
      identityChannels: agent.identityChannels,
    });
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
    setConfirmDelete(true);
  };

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    // No inline prompt input on the card itself, so "Run" opens the agent's
    // detail view (where Launch Agent Dashboard > Runs can start one) rather
    // than doing nothing, which is what this previously did.
    onClick();
  };

  const isBotAgent = isBot(agent);
  const surfaces = useMemo(() => agent.allowedSurfaces?.slice(0, 4) || [], [agent.allowedSurfaces]);
  const capabilities = useMemo(() => agent.capabilities || [], [agent.capabilities]);
  const visibleCapabilities = capabilities.slice(0, 2);
  const hiddenCapabilityCount = Math.max(0, capabilities.length - visibleCapabilities.length);
  const updatedAt = formatUpdatedAt(agent.updatedAt);
  const hasRuns = typeof agent.totalRuns === "number" && agent.totalRuns > 0;
  const hasRating = typeof agent.rating === "number" && agent.rating > 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.3 }}
        onClick={() => {
          if (menuOpen) return;
          if (isBotAgent) {
            window.dispatchEvent(
              new CustomEvent("allternit:open-view", {
                detail: { viewType: "bot-home", context: { botId: agent.id } },
              })
            );
            return;
          }
          onClick();
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { setIsHovered(false); setMenuOpen(false); }}
        className={cn(
          "group relative flex h-full min-h-[190px] cursor-pointer flex-col rounded-xl border border-solid bg-[var(--bg-elevated)] transition-all duration-200",
          "border-[var(--border-subtle)] hover:border-[var(--border-hover)] hover:shadow-md"
        )}
      >
        <div className="flex h-full flex-col gap-4 p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <AgentCardAvatar agent={agent} accent={accent} />
            <div className="flex flex-1 flex-col min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-[var(--text-primary)] leading-snug">
                {agent.name}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: `color-mix(in srgb, ${accent} 12%, transparent)`, color: accent }}
                >
                  <Icon size={10} weight="duotone" />
                  {typeMeta.label}
                </span>
                {agent.category && (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize"
                    style={{ background: "var(--surface-hover)", color: "var(--text-tertiary)" }}
                  >
                    {agent.category}
                  </span>
                )}
              </div>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="flex size-8 items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                <DotsThree size={18} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--surface-panel)] p-1 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MenuItem icon={<Play size={14} />} label="Run" onClick={handleRun} />
                    <MenuItem icon={<PencilSimple size={14} />} label="Edit" onClick={handleEdit} />
                    <MenuItem icon={<Copy size={14} />} label="Duplicate" onClick={handleDuplicate} />
                    <div className="my-1 h-px bg-[var(--border-subtle)]" />
                    <MenuItem icon={<Trash size={14} />} label="Delete" danger onClick={handleDelete} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Description */}
          <p className="line-clamp-2 min-h-[2.4rem] text-[13px] leading-relaxed text-[var(--text-tertiary)]">
            {agent.agentCard?.tagline || agent.description || "No description provided"}
          </p>

          {/* Capabilities */}
          {capabilities.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {visibleCapabilities.map((cap) => (
                <span
                  key={cap}
                  className="rounded-md px-2 py-0.5 text-[10px] font-medium capitalize"
                  style={{ background: "var(--surface-hover)", color: "var(--text-secondary)" }}
                >
                  {cap.replace(/-/g, " ")}
                </span>
              ))}
              {hiddenCapabilityCount > 0 && (
                <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                  +{hiddenCapabilityCount}
                </span>
              )}
            </div>
          )}

          {/* Surfaces — only meaningful for non-bot agents */}
          {!isBotAgent && surfaces.length > 0 && (
            <div className="mt-auto flex items-center gap-2">
              <span className="text-[10px] font-medium text-[var(--text-tertiary)]">Works in</span>
              <div className="flex items-center gap-1">
                {surfaces.map((surface) => {
                  const SurfaceIcon = SURFACE_ICONS[surface];
                  return (
                    <div
                      key={surface}
                      className="flex size-6 items-center justify-center rounded-md"
                      style={{ background: "var(--surface-hover)", color: "var(--text-secondary)" }}
                      title={surface}
                    >
                      <SurfaceIcon size={12} weight="duotone" />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer meta */}
          <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-[11px] text-[var(--text-tertiary)]">
            <div className="flex items-center gap-2">
              <span className="capitalize">{SOURCE_LABEL[source] || source}</span>
              {agent.model && (
                <>
                  <span aria-hidden>&middot;</span>
                  <span className="truncate max-w-[80px]">{agent.model}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasRuns && (
                <span className="flex items-center gap-1" title="Total runs">
                  <Lightning size={11} />
                  {agent.totalRuns}
                </span>
              )}
              {hasRating && (
                <span className="flex items-center gap-1" title="Rating">
                  <Star size={11} weight="fill" className="text-yellow-500" />
                  {agent.rating?.toFixed(1)}
                </span>
              )}
              {updatedAt && <span>{updatedAt}</span>}
            </div>
          </div>

          {/* Hover quick actions */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-3 left-3 right-3 flex items-center justify-center gap-2"
              >
                <QuickAction icon={<Play size={14} />} label="Run" accent={accent} onClick={handleRun} />
                <QuickAction icon={<PencilSimple size={14} />} label="Edit" accent={accent} onClick={handleEdit} />
                <QuickAction icon={<Copy size={14} />} label="Duplicate" accent={accent} onClick={handleDuplicate} />
                <QuickAction icon={<Trash size={14} />} label="Delete" accent={accent} danger onClick={handleDelete} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <ConfirmModal
        isOpen={confirmDelete}
        title="Delete Agent"
        message={`Delete agent "${agent.name}"?`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => { setConfirmDelete(false); deleteAgent(agent.id); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
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
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-[12px] transition-colors",
        danger
          ? "text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function QuickAction({
  icon,
  label,
  accent,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  danger?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={label}
      aria-label={label}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg shadow-lg backdrop-blur-md"
      style={{
        background: danger
          ? "color-mix(in srgb, var(--status-error) 12%, var(--surface-panel))"
          : "color-mix(in srgb, var(--surface-panel) 85%, transparent)",
        color: danger ? "var(--status-error)" : accent,
        border: `1px solid ${danger ? "var(--status-error)" : accent}`,
      }}
    >
      {icon}
    </motion.button>
  );
}
