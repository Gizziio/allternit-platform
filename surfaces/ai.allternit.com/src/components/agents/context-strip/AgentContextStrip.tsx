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
  LockKey,
} from "@phosphor-icons/react";

import { useToolRegistryStore } from "@/lib/agents";
import {
  getSurfacePalette,
  formatSurfaceLabel,
  compactWorkspaceScope,
} from "./context-strip.utils";
import type {
  AgentContextStripProps,
  AgentDrawerSection,
} from "./context-strip.types";
import { TEXT } from "@/design/allternit.tokens";
import { InfoChip } from "./InfoChip";
import { ActionChip } from "./ActionChip";
import { WorkspaceDrawer } from "./WorkspaceDrawer";
import { ToolsDrawer } from "./ToolsDrawer";
import { AutomationDrawer } from "./AutomationDrawer";
import { RuntimeDrawer } from "./RuntimeDrawer";

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
  runtimeEnv,
  runtimeEnvEntries,
  connectorBindings,
  secretRefs,
  missingRuntimeKeys,
  botId,
  vmOperator,
  vmSandbox,
  accentColor: accentColorOverride,
  onDismiss,
  onEditRuntime,
}: AgentContextStripProps) {
  const [activeDrawer, setActiveDrawer] = useState<AgentDrawerSection>("workspace");
  const basePalette = useMemo(() => getSurfacePalette(surface), [surface]);
  const palette = useMemo(() => {
    if (!accentColorOverride) return basePalette;
    return {
      accent: accentColorOverride,
      glow: `color-mix(in srgb, ${accentColorOverride} 28%, transparent)`,
      soft: `color-mix(in srgb, ${accentColorOverride} 14%, transparent)`,
      border: `color-mix(in srgb, ${accentColorOverride} 16%, transparent)`,
    };
  }, [basePalette, accentColorOverride]);

  const tags = useMemo(() => {
    if (!Array.isArray(rawTags)) return [];
    return rawTags.filter((t): t is string => typeof t === "string");
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
        return "Workspace";
      case "tools":
        return "Tools";
      case "automation":
        return "Automation";
      case "runtime":
        return "Runtime";
      default:
        return "Workspace";
    }
  }, [activeDrawer]);

  const fallbackDescription = `${formatSurfaceLabel(
    surface,
  )} agent context is stitched into this surface so the session keeps its own workspace, tools, and automation state.`;

  return (
    <div
      className="relative z-[2] rounded-2xl border border-[var(--palette-border)] bg-[var(--surface-floating)] overflow-hidden"
      style={{
        "--palette-border": palette.border,
        "--palette-glow": palette.glow,
      } as React.CSSProperties}
    >
      {/* Accent top edge */}
      <div
        className="h-[2px] w-full"
        style={{ background: palette.accent }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--palette-border)] bg-[var(--palette-soft)] text-[var(--palette-accent)] px-2 py-1 text-[11px] font-bold tracking-wide uppercase"
                style={{
                  "--palette-border": palette.border,
                  "--palette-soft": palette.soft,
                  "--palette-accent": palette.accent,
                } as React.CSSProperties}
              >
                <Sparkle size={11} weight="fill" />
                {formatSurfaceLabel(surface)} Bot
              </span>
              <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-secondary)] px-2 py-1 text-[11px] font-semibold tracking-wide uppercase">
                {statusLabel}
              </span>
            </div>

            <div
              className="text-[15px] font-semibold truncate"
              style={{ color: TEXT.primary }}
            >
              {sessionName}
            </div>
            <div className="mt-0.5 text-[12px] leading-relaxed text-[var(--text-secondary)] max-w-[760px]">
              {sessionDescription?.trim() || fallbackDescription}
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-2.5">
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
              className="size-8 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-hover)] text-[var(--text-tertiary)] cursor-pointer shrink-0 transition-colors hover:bg-[var(--surface-active)] hover:text-[var(--text-primary)]"
            >
              <X size={14} weight="bold" />
            </button>
          ) : null}
        </div>

        {/* Drawer toggles */}
        <div className="flex items-center gap-2 flex-wrap mt-4">
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
          <ActionChip
            active={activeDrawer === "runtime"}
            icon={LockKey}
            label="Runtime"
            palette={palette}
            onClick={() => setActiveDrawer("runtime")}
          />
        </div>

        {/* Drawer panel */}
        <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3.5 max-h-[min(460px,60vh)] overflow-y-auto">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div
              className="text-[11px] font-bold uppercase tracking-wider"
              style={{ color: palette.accent }}
            >
              {drawerTitle}
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] text-right">
              Bound to live session
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

          {activeDrawer === "runtime" ? (
            <RuntimeDrawer
              runtimeEnv={runtimeEnv}
              runtimeEnvEntries={runtimeEnvEntries}
              connectorBindings={connectorBindings}
              secretRefs={secretRefs}
              missingRuntimeKeys={missingRuntimeKeys}
              palette={palette}
              botId={botId}
              vmOperator={vmOperator}
              vmSandbox={vmSandbox}
              onEditRuntime={onEditRuntime}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
