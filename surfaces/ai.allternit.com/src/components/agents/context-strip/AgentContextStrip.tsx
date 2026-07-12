"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowsOutCardinal,
  ClockCounterClockwise,
  Cpu,
  FolderSimple,
  Lightning,
  Sparkle,
  Wrench,
  X,
} from "@phosphor-icons/react";

import { useToolRegistryStore } from "@/lib/agents";
import { 
  getSurfacePalette, 
  formatSurfaceLabel, 
  compactWorkspaceScope 
} from "./context-strip.utils";
import type { 
  AgentContextStripProps, 
  AgentDrawerSection 
} from "./context-strip.types";
import { InfoChip } from "./InfoChip";
import { ActionChip } from "./ActionChip";
import { WorkspaceDrawer } from "./WorkspaceDrawer";
import { ToolsDrawer } from "./ToolsDrawer";
import { AutomationDrawer } from "./AutomationDrawer";

export function AgentContextStrip({
  surface,
  sessionName,
  sessionDescription,
  agentName,
  harnessMode,
  statusLabel,
  messageCount,
  workspaceScope,
  canvasCount = 0,
  tags: rawTags = [],
  toolsEnabled = false,
  automationEnabled = false,
  onDismiss,
}: AgentContextStripProps) {
  const [activeDrawer, setActiveDrawer] = useState<AgentDrawerSection>("workspace");
  const palette = useMemo(() => getSurfacePalette(surface), [surface]);
  
  const tags = useMemo(() => {
    if (!Array.isArray(rawTags)) return [];
    return rawTags.filter((t): t is string => typeof t === 'string');
  }, [rawTags]);
  
  const tools = useToolRegistryStore((state) => Object.values(state.tools));
  const isLoadingTools = useToolRegistryStore((state) => state.isLoading);
  const fetchTools = useToolRegistryStore((state) => state.fetchKernelTools);
  
  useEffect(() => {
    if (activeDrawer === "tools" && tools.length === 0 && !isLoadingTools) {
      void fetchTools();
    }
  }, [activeDrawer, fetchTools, isLoadingTools, tools.length]);

  const drawerTitle = useMemo(() => {
    switch (activeDrawer) {
      case "workspace":
        return "Workspace Lens";
      case "tools":
        return "Toolchain";
      case "automation":
        return "Runs & Automation";
      default:
        return "Workspace Lens";
    }
  }, [activeDrawer]);

  const fallbackDescription = `${formatSurfaceLabel(
    surface,
  )} agent context is stitched into this surface so the session keeps its own workspace, tools, and automation state.`;

  return (
    <div
      className="mb-[18px] relative z-[2] rounded-[22px] border border-solid border-[var(--palette-border)] bg-[linear-gradient(180deg,var(--surface-floating)_0%,var(--surface-floating)_100%)] shadow-[inset_0_1px_0_var(--surface-hover),0_18px_44px_var(--surface-hover),0_0_0_1px_var(--palette-glow)] overflow-hidden"
      style={{
        '--palette-border': palette.border,
        '--palette-glow': palette.glow,
      } as React.CSSProperties}
    >
      <div
        className="h-[3px] bg-[linear-gradient(90deg,var(--palette-accent),rgba(255,255,255,0))]"
        style={{ '--palette-accent': palette.accent } as React.CSSProperties}
      />

      <div
        className="flex items-start justify-between gap-4 p-[14px_16px_12px] bg-[linear-gradient(110deg,var(--palette-soft),rgba(255,255,255,0.015)_56%,var(--surface-hover)_100%)]"
        style={{ '--palette-soft': palette.soft } as React.CSSProperties}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-2.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-solid border-[var(--palette-border)] bg-[var(--palette-soft)] text-[var(--palette-accent)] px-2 py-1 text-[12px] font-extrabold tracking-[0.08em] uppercase"
              style={{
                '--palette-border': palette.border,
                '--palette-soft': palette.soft,
                '--palette-accent': palette.accent,
              } as React.CSSProperties}
            >
              <Sparkle size={12} weight="fill" />
              {formatSurfaceLabel(surface)} Agent
            </span>
            <span className="rounded-full border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)] text-[#d1c3b4] px-2 py-1 text-[12px] font-bold tracking-[0.08em] uppercase">
              {statusLabel}
            </span>
          </div>

          <div className="text-[16px] font-bold text-[#f6eee7] overflow-hidden text-ellipsis whitespace-nowrap">
            {sessionName}
          </div>
          <div className="mt-1 text-[12px] leading-relaxed text-[#b3a395] max-w-[760px]">
            {sessionDescription?.trim() || fallbackDescription}
          </div>

          <div className="flex items-center gap-2 flex-wrap pt-3">
            <InfoChip
              icon={Cpu}
              label={`${messageCount} message${messageCount === 1 ? "" : "s"}`}
              palette={palette}
            />
            {agentName ? (
              <InfoChip
                icon={ArrowsOutCardinal}
                label={agentName}
                palette={palette}
              />
            ) : null}
            {harnessMode ? (
              <InfoChip
                icon={Lightning}
                label={`Harness: ${harnessMode}`}
                palette={palette}
              />
            ) : null}
            <InfoChip
              icon={FolderSimple}
              label={compactWorkspaceScope(workspaceScope)}
              palette={palette}
            />
          </div>
        </div>

        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Leave agent session"
            className="size-[34px] inline-flex items-center justify-center rounded-[11px] border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)] text-[#b6a89b] cursor-pointer shrink-0 transition-colors hover:bg-[var(--surface-active)]"
          >
            <X size={14} weight="bold" />
          </button>
        ) : null}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 flex-wrap pt-3">
          <ActionChip
            active={activeDrawer === "workspace"}
            icon={FolderSimple}
            label="Workspace"
            palette={palette}
            onClick={() => setActiveDrawer("workspace")}
          />
          <ActionChip
            active={activeDrawer === "tools"}
            icon={Wrench}
            label="Tools"
            palette={palette}
            onClick={() => setActiveDrawer("tools")}
          />
          <ActionChip
            active={activeDrawer === "automation"}
            icon={ClockCounterClockwise}
            label="Automation"
            palette={palette}
            onClick={() => setActiveDrawer("automation")}
          />
        </div>

        <div className="mt-3 rounded-[18px] border border-solid border-[var(--surface-hover)] bg-[var(--surface-hover)] p-3.5">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div
              className="text-[12px] font-extrabold text-[var(--palette-accent)] uppercase tracking-[0.08em]"
              style={{ '--palette-accent': palette.accent } as React.CSSProperties}
            >
              {drawerTitle}
            </div>
            <div className="text-[12px] text-[#a8998c] text-right">
              Bound to the live surface session
            </div>
          </div>

          {activeDrawer === "workspace" ? (
            <WorkspaceDrawer
              workspaceScope={workspaceScope}
              canvasCount={canvasCount}
              tags={tags}
              palette={palette}
            />
          ) : null}

          {activeDrawer === "tools" ? (
            <ToolsDrawer
              tools={tools}
              isLoading={isLoadingTools}
              toolsEnabled={toolsEnabled}
              palette={palette}
            />
          ) : null}

          {activeDrawer === "automation" ? (
            <AutomationDrawer
              automationEnabled={automationEnabled}
              palette={palette}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
