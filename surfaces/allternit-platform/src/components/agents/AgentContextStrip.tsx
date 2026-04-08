import React, { useEffect, useMemo, useState } from "react";
import { filesApi } from "@/lib/agents/files-api";
import {
  ArrowsOutCardinal,
  ClockCounterClockwise,
  Cpu,
  FolderSimple,
  Sparkle,
  Wrench,
  X,
  Check,
  Prohibit,
  FileText,
  Calendar,
  Play,
  Pause,
  Trash,
  Plus,
  Pencil,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";

import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import {
  useNativeAgentStore,
  type Tool,
  useToolRegistryStore,
  type ToolRegistryEntry,
  listScheduledJobs,
  createScheduledJob,
  updateScheduledJob,
  deleteScheduledJob,
  runScheduledJobNow,
  pauseScheduledJob,
  resumeScheduledJob,
  describeCronExpression,
  calculateNextRun,
  getExecutionHistory,
  clearExecutionHistory,
  useJobRunner,
  type CronJobConfig,
  type JobExecution,
} from "@/lib/agents";
import { CronJobWizard } from "./CronJobWizard";

type AgentDrawerSection = "workspace" | "tools" | "automation";

interface AgentContextStripProps {
  surface: AgentModeSurface;
  sessionName: string;
  sessionDescription?: string;
  agentName?: string;
  statusLabel: string;
  messageCount: number;
  workspaceScope?: string;
  canvasCount?: number;
  tags?: string[];
  localDraft?: boolean;
  toolsEnabled?: boolean;
  automationEnabled?: boolean;
  onDismiss?: () => void;
}

interface SurfacePalette {
  accent: string;
  glow: string;
  soft: string;
  border: string;
}

function formatSurfaceLabel(surface: AgentModeSurface): string {
  switch (surface) {
    case "chat":
      return "Chat";
    case "cowork":
      return "Cowork";
    case "code":
      return "Code";
    case "browser":
      return "Browser";
    default:
      return "Agent";
  }
}

function getSurfacePalette(surface: AgentModeSurface): SurfacePalette {
  switch (surface) {
    case "browser":
      return {
        accent: "#69A8C8",
        glow: "rgba(105,168,200,0.26)",
        soft: "rgba(105,168,200,0.14)",
        border: "rgba(105,168,200,0.16)",
      };
    case "code":
      return {
        accent: "#79C47C",
        glow: "rgba(121,196,124,0.28)",
        soft: "rgba(121,196,124,0.14)",
        border: "rgba(121,196,124,0.16)",
      };
    case "cowork":
      return {
        accent: "#A78BFA",
        glow: "rgba(167,139,250,0.28)",
        soft: "rgba(167,139,250,0.14)",
        border: "rgba(167,139,250,0.16)",
      };
    case "chat":
    default:
      return {
        accent: "#D4956A",
        glow: "rgba(212,149,106,0.28)",
        soft: "rgba(212,149,106,0.14)",
        border: "rgba(212,149,106,0.14)",
      };
  }
}

function compactWorkspaceScope(workspaceScope?: string): string {
  if (!workspaceScope) {
    return "Session scoped workspace";
  }

  if (workspaceScope.length <= 44) {
    return workspaceScope;
  }

  const segments = workspaceScope.split("/").filter(Boolean);
  if (segments.length <= 2) {
    return workspaceScope;
  }

  return `.../${segments.slice(-2).join("/")}`;
}

function ActionChip({
  active,
  icon: Icon,
  label,
  palette,
  onClick,
}: {
  active: boolean;
  icon: React.ComponentType<any>;
  label: string;
  palette: SurfacePalette;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        border: "1px solid",
        borderColor: active ? palette.border : "rgba(255,255,255,0.08)",
        background: active ? palette.soft : "rgba(255,255,255,0.03)",
        color: active ? palette.accent : "#c2b4a6",
        cursor: "pointer",
        padding: "6px 10px",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <Icon size={13} weight={active ? "fill" : "bold"} />
      {label}
    </button>
  );
}

function InfoChip({
  icon: Icon,
  label,
  palette,
}: {
  icon: React.ComponentType<any>;
  label: string;
  palette: SurfacePalette;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 999,
        padding: "5px 9px",
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${palette.border}`,
        color: "#eadfd4",
        fontSize: 11,
        lineHeight: 1,
      }}
    >
      <Icon size={12} weight="bold" style={{ color: palette.accent }} />
      {label}
    </span>
  );
}

export function AgentContextStrip({
  surface,
  sessionName,
  sessionDescription,
  agentName,
  statusLabel,
  messageCount,
  workspaceScope,
  canvasCount = 0,
  tags = [],
  localDraft = false,
  toolsEnabled = false,
  automationEnabled = false,
  onDismiss,
}: AgentContextStripProps) {
  const [activeDrawer, setActiveDrawer] = useState<AgentDrawerSection>("workspace");
  const palette = useMemo(() => getSurfacePalette(surface), [surface]);
  
  // Fetch real tools from store
  const tools = useNativeAgentStore((state) => state.tools);
  const isLoadingTools = useNativeAgentStore((state) => state.isLoadingTools);
  const fetchTools = useNativeAgentStore((state) => state.fetchTools);
  
  // Fetch tools when drawer is opened
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
      style={{
        marginBottom: 18,
        position: "relative",
        zIndex: 2,
        borderRadius: 22,
        border: `1px solid ${palette.border}`,
        background:
          "linear-gradient(180deg, rgba(35,30,28,0.9) 0%, rgba(24,21,20,0.95) 100%)",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 44px rgba(0,0,0,0.2), 0 0 0 1px ${palette.glow}`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 3,
          background: `linear-gradient(90deg, ${palette.accent}, rgba(255,255,255,0))`,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          padding: "14px 16px 12px",
          background: `linear-gradient(110deg, ${palette.soft}, rgba(255,255,255,0.015) 56%, rgba(255,255,255,0.02) 100%)`,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 999,
                border: `1px solid ${palette.border}`,
                background: palette.soft,
                color: palette.accent,
                padding: "4px 8px",
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              <Sparkle size={12} weight="fill" />
              {formatSurfaceLabel(surface)} Agent
            </span>
            <span
              style={{
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.06)",
                background: localDraft
                  ? "rgba(245,158,11,0.12)"
                  : "rgba(255,255,255,0.04)",
                color: localDraft ? "#fcd34d" : "#d1c3b4",
                padding: "4px 8px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {statusLabel}
            </span>
          </div>

          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: "#f6eee7",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sessionName}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              lineHeight: 1.5,
              color: "#b3a395",
              maxWidth: 760,
            }}
          >
            {sessionDescription?.trim() || fallbackDescription}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              paddingTop: 12,
            }}
          >
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
            style={{
              width: 34,
              height: 34,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 11,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(255,255,255,0.04)",
              color: "#b6a89b",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={14} weight="bold" />
          </button>
        ) : null}
      </div>

      <div style={{ padding: "0 16px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            paddingTop: 12,
          }}
        >
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

        <div
          style={{
            marginTop: 12,
            borderRadius: 18,
            border: "1px solid rgba(255,255,255,0.05)",
            background: "rgba(255,255,255,0.03)",
            padding: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: palette.accent,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {drawerTitle}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#a8998c",
                textAlign: "right",
              }}
            >
              {localDraft ? "Offline-ready draft state" : "Bound to the live surface session"}
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
              localDraft={localDraft}
              palette={palette}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetaCard({
  accent,
  label,
  value,
}: {
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(16,12,10,0.24)",
        padding: "12px 12px 11px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          color: accent,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.45,
          color: "#efe4da",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================================
// Tools Drawer - Shows real available tools
// ============================================================================

interface ToolsDrawerProps {
  tools: Tool[];
  isLoading: boolean;
  toolsEnabled: boolean;
  palette: SurfacePalette;
  sessionId?: string;
}

function ToolsDrawer({ tools, isLoading, toolsEnabled, palette, sessionId }: ToolsDrawerProps) {
  const [showRegistry, setShowRegistry] = useState(false);
  
  if (showRegistry) {
    return (
      <ToolRegistryPanel
        palette={palette}
        sessionId={sessionId}
        onBack={() => setShowRegistry(false)}
      />
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#a8998c" }}>
        <div style={{ fontSize: 13 }}>Loading tools...</div>
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div
        style={{
          borderRadius: 14,
          border: `1px solid ${palette.border}`,
          background: "rgba(16,12,10,0.24)",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: palette.accent,
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}
        >
          <Wrench size={12} weight="bold" />
          No Tools Available
        </div>
        <div style={{ fontSize: 12, color: "#b3a395", lineHeight: 1.5, marginBottom: 12 }}>
          {toolsEnabled
            ? "Tool access is enabled but no tools are registered. Tools will appear here when the runtime makes them available."
            : "Tool access is not configured for this session. Enable tools to see available capabilities."}
        </div>
        <button
          onClick={() => setShowRegistry(true)}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: `1px solid ${palette.border}`,
            background: palette.soft,
            color: palette.accent,
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Open Tool Registry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: palette.accent,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          <Wrench size={12} weight="bold" style={{ marginRight: 6, verticalAlign: "middle" }} />
          Available Tools ({tools.length})
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowRegistry(true)}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              border: `1px solid ${palette.border}`,
              background: "transparent",
              color: palette.accent,
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Manage
          </button>
          <div
            style={{
              fontSize: 10,
              color: toolsEnabled ? "#79C47C" : "#a8998c",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {toolsEnabled ? (
              <>
                <Check size={10} weight="bold" />
                Enabled
              </>
            ) : (
              <>
                <Prohibit size={10} weight="bold" />
                Disabled
              </>
            )}
          </div>
        </div>
      </div>

      {tools.slice(0, 5).map((tool) => (
        <ToolItem key={tool.id} tool={tool} palette={palette} />
      ))}
      
      {tools.length > 5 && (
        <button
          onClick={() => setShowRegistry(true)}
          style={{
            padding: "8px",
            borderRadius: 8,
            border: `1px dashed ${palette.border}`,
            background: "transparent",
            color: "#7a6b5d",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          + {tools.length - 5} more tools
        </button>
      )}

      <div
        style={{
          marginTop: 8,
          padding: 10,
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${palette.border}`,
          fontSize: 11,
          color: "#a8998c",
          lineHeight: 1.5,
        }}
      >
        Tools are executed in the native agent runtime. Click "Manage" to enable/disable tools or configure confirmation requirements.
      </div>
    </div>
  );
}

function ToolRegistryPanel({
  palette,
  sessionId,
  onBack,
}: {
  palette: SurfacePalette;
  sessionId?: string;
  onBack: () => void;
}) {
  const tools = useToolRegistryStore((state) => Object.values(state.tools));
  const isLoading = useToolRegistryStore((state) => state.isLoading);
  const fetchKernelTools = useToolRegistryStore((state) => state.fetchKernelTools);
  const toggleTool = useToolRegistryStore((state) => state.toggleTool);
  const toggleToolForSession = useToolRegistryStore((state) => state.toggleToolForSession);
  const setToolRequiresConfirmation = useToolRegistryStore((state) => state.setToolRequiresConfirmation);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (tools.length === 0 && !isLoading) {
      void fetchKernelTools();
    }
  }, [tools.length, isLoading, fetchKernelTools]);

  const categories = [...new Set(tools.map((t) => t.category))];
  
  const filteredTools = tools.filter((tool) => {
    if (selectedCategory && tool.category !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        tool.name.toLowerCase().includes(query) ||
        tool.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const enabledCount = tools.filter((t) => t.isEnabled).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <button
          onClick={onBack}
          style={{
            padding: "4px 8px",
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "transparent",
            color: "#a8998c",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          ← Back
        </button>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f6eee7" }}>
          Tool Registry
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: "#7a6b5d" }}>
          {enabledCount}/{tools.length} enabled
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search tools..."
        style={{
          padding: "8px 12px",
          borderRadius: 8,
          border: `1px solid ${palette.border}`,
          background: "rgba(0,0,0,0.2)",
          color: "#f6eee7",
          fontSize: 12,
          outline: "none",
        }}
      />

      {/* Categories */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button
          onClick={() => setSelectedCategory(null)}
          style={{
            padding: "4px 10px",
            borderRadius: 999,
            border: "none",
            background: selectedCategory === null ? palette.soft : "rgba(255,255,255,0.05)",
            color: selectedCategory === null ? palette.accent : "#a8998c",
            fontSize: 10,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "none",
              background: selectedCategory === cat ? palette.soft : "rgba(255,255,255,0.05)",
              color: selectedCategory === cat ? palette.accent : "#a8998c",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {cat.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Tools List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflow: "auto" }}>
        {filteredTools.map((tool) => (
          <RegistryToolItem
            key={tool.id}
            tool={tool}
            palette={palette}
            onToggle={(enabled) => {
              if (sessionId) {
                toggleToolForSession(tool.id, sessionId, enabled);
              } else {
                toggleTool(tool.id, enabled);
              }
            }}
            onToggleConfirmation={() => setToolRequiresConfirmation(tool.id, !tool.requiresConfirmation)}
          />
        ))}
      </div>
    </div>
  );
}

function RegistryToolItem({
  tool,
  palette,
  onToggle,
  onToggleConfirmation,
}: {
  tool: ToolRegistryEntry;
  palette: SurfacePalette;
  onToggle: (enabled: boolean) => void;
  onToggleConfirmation: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${tool.isEnabled ? palette.border : "rgba(255,255,255,0.05)"}`,
        background: tool.isEnabled ? "rgba(16,12,10,0.24)" : "rgba(0,0,0,0.1)",
        overflow: "hidden",
        opacity: tool.isEnabled ? 1 : 0.7,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
        }}
      >
        {/* Toggle Switch */}
        <button
          onClick={() => onToggle(!tool.isEnabled)}
          style={{
            width: 36,
            height: 20,
            borderRadius: 10,
            border: "none",
            background: tool.isEnabled ? "#79C47C" : "#444",
            position: "relative",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#fff",
              position: "absolute",
              top: 2,
              left: tool.isEnabled ? 18 : 2,
              transition: "left 0.2s",
            }}
          />
        </button>

        {/* Tool Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: tool.isEnabled ? "#f6eee7" : "#888",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tool.name}
          </div>
          <div style={{ fontSize: 10, color: "#7a6b5d" }}>{tool.category}</div>
        </div>

        {/* Confirmation Toggle */}
        {tool.isEnabled && (
          <button
            onClick={onToggleConfirmation}
            title={tool.requiresConfirmation ? "Requires confirmation" : "No confirmation needed"}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              border: `1px solid ${tool.requiresConfirmation ? "#fbbf24" : "rgba(255,255,255,0.1)"}`,
              background: tool.requiresConfirmation ? "rgba(251,191,36,0.1)" : "transparent",
              color: tool.requiresConfirmation ? "#fbbf24" : "#7a6b5d",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            {tool.requiresConfirmation ? "⚠️ Confirm" : "Auto"}
          </button>
        )}

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: 4,
            borderRadius: 4,
            border: "none",
            background: "transparent",
            color: "#7a6b5d",
            cursor: "pointer",
            transform: expanded ? "rotate(180deg)" : "none",
          }}
        >
          ▼
        </button>
      </div>

      {expanded && (
        <div style={{ padding: "0 10px 10px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ paddingTop: 8, fontSize: 11, color: "#a8998c", lineHeight: 1.4 }}>
            {tool.description}
          </div>
        </div>
      )}
    </div>
  );
}

function ToolItem({ tool, palette }: { tool: Tool; palette: SurfacePalette }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(255,255,255,0.02)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: palette.accent }}>{tool.name}</span>
        </div>
        <div
          style={{
            fontSize: 10,
            color: palette.accent,
            transform: expanded ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          ▼
        </div>
      </button>

      {expanded && (
        <div
          style={{
            padding: "0 12px 12px",
            borderTop: `1px solid rgba(255,255,255,0.04)`,
          }}
        >
          <div style={{ paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: "#b3a395", lineHeight: 1.5, marginBottom: 8 }}>
              {tool.description || "No description available."}
            </div>
            {tool.parameters && Object.keys(tool.parameters).length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#9f8a78",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  Parameters
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {Object.entries(tool.parameters).map(([key, value]) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: 8,
                        fontSize: 11,
                      }}
                    >
                      <span style={{ color: palette.accent, fontFamily: "monospace" }}>
                        {key}
                      </span>
                      <span style={{ color: "#7a6b5d" }}>
                        {(value as any)?.type || "unknown"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Workspace Drawer - Shows workspace files, canvases, and tags
// ============================================================================

interface WorkspaceDrawerProps {
  workspaceScope?: string;
  canvasCount: number;
  tags: string[];
  palette: SurfacePalette;
}

interface FileNode {
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
  modified?: Date;
}

function WorkspaceDrawer({ workspaceScope, canvasCount, tags, palette }: WorkspaceDrawerProps) {
  const [activeTab, setActiveTab] = useState<"files" | "canvases" | "info">("files");
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Fetch files when workspace tab is opened
  useEffect(() => {
    if (activeTab === "files" && fileTree.length === 0 && !isLoadingFiles) {
      setIsLoadingFiles(true);
      filesApi.listDirectory({ path: workspaceScope || '.' })
        .then((entries) => {
          const toNode = (entry: (typeof entries)[number]): FileNode => ({
            name: entry.name,
            type: entry.type === 'directory' ? 'directory' : 'file',
          });
          setFileTree(entries.map(toNode));
        })
        .catch(() => {})
        .finally(() => setIsLoadingFiles(false));
    }
  }, [activeTab, fileTree.length, isLoadingFiles, workspaceScope]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${palette.border}`, paddingBottom: 8 }}>
        <WorkspaceTab
          active={activeTab === "files"}
          label="Files"
          icon={<FolderSimple size={12} weight="bold" />}
          palette={palette}
          onClick={() => setActiveTab("files")}
        />
        <WorkspaceTab
          active={activeTab === "canvases"}
          label={`Canvases (${canvasCount})`}
          icon={<FileText size={12} weight="bold" />}
          palette={palette}
          onClick={() => setActiveTab("canvases")}
        />
        <WorkspaceTab
          active={activeTab === "info"}
          label="Info"
          icon={<Cpu size={12} weight="bold" />}
          palette={palette}
          onClick={() => setActiveTab("info")}
        />
      </div>

      {/* Tab Content */}
      {activeTab === "files" && (
        <FileBrowser
          fileTree={fileTree}
          isLoading={isLoadingFiles}
          workspaceScope={workspaceScope}
          palette={palette}
        />
      )}

      {activeTab === "canvases" && (
        <CanvasesView canvasCount={canvasCount} palette={palette} />
      )}

      {activeTab === "info" && (
        <WorkspaceInfo
          workspaceScope={workspaceScope}
          tags={tags}
          palette={palette}
        />
      )}
    </div>
  );
}

function WorkspaceTab({
  active,
  label,
  icon,
  palette,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  palette: SurfacePalette;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 8,
        border: "none",
        background: active ? palette.soft : "transparent",
        color: active ? palette.accent : "#a8998c",
        fontSize: 11,
        fontWeight: 700,
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function FileBrowser({
  fileTree,
  isLoading,
  workspaceScope,
  palette,
}: {
  fileTree: FileNode[];
  isLoading: boolean;
  workspaceScope?: string;
  palette: SurfacePalette;
}) {
  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#a8998c" }}>
        <div style={{ fontSize: 13 }}>Loading workspace files...</div>
      </div>
    );
  }

  if (!workspaceScope) {
    return (
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: "rgba(16,12,10,0.24)",
          border: `1px solid ${palette.border}`,
          textAlign: "center",
        }}
      >
        <FolderSimple size={24} style={{ color: palette.accent, marginBottom: 8 }} />
        <div style={{ fontSize: 12, color: "#b3a395", lineHeight: 1.5 }}>
          No workspace scope configured. This session uses a default scoped workspace.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          padding: "8px 10px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: 8,
          fontSize: 11,
          color: "#a8998c",
          fontFamily: "monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <FolderSimple size={12} />
        {workspaceScope}
      </div>

      {fileTree.length === 0 ? (
        <div style={{ textAlign: "center", padding: 20, color: "#7a6b5d", fontSize: 12 }}>
          No files found in workspace
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            maxHeight: 200,
            overflow: "auto",
          }}
        >
          {fileTree.map((node, index) => (
            <FileNodeItem key={index} node={node} depth={0} palette={palette} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileNodeItem({
  node,
  depth,
  palette,
}: {
  node: FileNode;
  depth: number;
  palette: SurfacePalette;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDirectory = node.type === "directory";

  return (
    <div>
      <button
        type="button"
        onClick={() => isDirectory && setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 8px",
          paddingLeft: 8 + depth * 16,
          background: "transparent",
          border: "none",
          borderRadius: 6,
          cursor: isDirectory ? "pointer" : "default",
          textAlign: "left",
          fontSize: 12,
          color: "#d1c3b4",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        {isDirectory ? (
          <span style={{ color: palette.accent, fontSize: 10 }}>{expanded ? "▼" : "▶"}</span>
        ) : (
          <span style={{ color: "#7a6b5d", fontSize: 10 }}>•</span>
        )}
        <span style={{ color: isDirectory ? palette.accent : "#d1c3b4" }}>{node.name}</span>
      </button>

      {isDirectory && expanded && node.children && (
        <div>
          {node.children.map((child, index) => (
            <FileNodeItem key={index} node={child} depth={depth + 1} palette={palette} />
          ))}
        </div>
      )}
    </div>
  );
}

function CanvasesView({ canvasCount, palette }: { canvasCount: number; palette: SurfacePalette }) {
  return (
    <div>
      {canvasCount === 0 ? (
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "rgba(16,12,10,0.24)",
            border: `1px solid ${palette.border}`,
            textAlign: "center",
          }}
        >
          <FileText size={24} style={{ color: palette.accent, marginBottom: 8 }} />
          <div style={{ fontSize: 12, color: "#b3a395", lineHeight: 1.5 }}>
            No canvases attached to this session yet. Canvases will appear here when created.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Array.from({ length: canvasCount }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: 10,
                borderRadius: 10,
                background: "rgba(16,12,10,0.24)",
                border: `1px solid ${palette.border}`,
              }}
            >
              <FileText size={16} style={{ color: palette.accent }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: "#f6eee7" }}>Canvas {i + 1}</div>
                <div style={{ fontSize: 10, color: "#7a6b5d" }}>Session artifact</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WorkspaceInfo({
  workspaceScope,
  tags,
  palette,
}: {
  workspaceScope?: string;
  tags: string[];
  palette: SurfacePalette;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <MetaCard
        accent={palette.accent}
        label="Workspace Path"
        value={workspaceScope || "Session scoped (no explicit path)"}
      />
      <div
        style={{
          borderRadius: 14,
          border: `1px solid rgba(255,255,255,0.04)`,
          background: "rgba(16,12,10,0.24)",
          padding: "12px 12px 11px",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            color: palette.accent,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 8,
          }}
        >
          Tags
        </div>
        {tags.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "3px 8px",
                  borderRadius: 999,
                  background: palette.soft,
                  color: palette.accent,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "#7a6b5d" }}>No tags</div>
        )}
      </div>
    </div>
  );
}


// ============================================================================
// Automation Drawer - Shows scheduled jobs and run history
// ============================================================================

interface AutomationDrawerProps {
  automationEnabled: boolean;
  localDraft: boolean;
  palette: SurfacePalette;
}

interface DisplayJob {
  id: string;
  name: string;
  schedule: string;
  lastRun?: Date;
  nextRun?: Date;
  status: "active" | "paused" | "failed";
  description?: string;
  runCount: number;
  lastError?: string;
}

function AutomationDrawer({ automationEnabled, localDraft, palette }: AutomationDrawerProps) {
  const [activeTab, setActiveTab] = useState<"scheduled" | "history" | "config">("scheduled");
  const [jobs, setJobs] = useState<DisplayJob[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [editingJob, setEditingJob] = useState<DisplayJob | null>(null);

  // Load jobs from service
  const loadJobs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const jobConfigs = await listScheduledJobs();
      const displayJobs: DisplayJob[] = jobConfigs.map((job) => ({
        id: job.id || "",
        name: job.name,
        schedule: job.schedule,
        status: job.enabled ? "active" : "paused",
        description: job.description,
        lastRun: job.lastRunAt ? new Date(job.lastRunAt) : undefined,
        nextRun: job.nextRunAt ? new Date(job.nextRunAt) : (calculateNextRun(job.schedule) ?? undefined),
        runCount: job.runCount || 0,
        lastError: job.lastError,
      }));
      setJobs(displayJobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setIsLoading(false);
    }
  };

  // Load jobs on mount and when tab changes
  useEffect(() => {
    if (activeTab === "scheduled") {
      loadJobs();
    }
  }, [activeTab]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (activeTab !== "scheduled") return;
    const interval = setInterval(loadJobs, 30000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleCreateJob = async (config: CronJobConfig) => {
    try {
      await createScheduledJob(config);
      setShowCreateWizard(false);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    }
  };

  const handleUpdateJob = async (jobId: string, updates: Partial<CronJobConfig>) => {
    try {
      await updateScheduledJob(jobId, updates);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update job");
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to delete this scheduled job?")) return;
    try {
      await deleteScheduledJob(jobId);
      loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete job");
    }
  };

  const handleRunNow = async (jobId: string) => {
    try {
      await runScheduledJobNow(jobId);
      // Show success feedback
      setTimeout(loadJobs, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run job");
    }
  };

  const handleToggleJob = async (job: DisplayJob) => {
    if (job.status === "active") {
      await pauseScheduledJob(job.id);
    } else {
      await resumeScheduledJob(job.id);
    }
    loadJobs();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Create/Edit Wizard Modal */}
      {(showCreateWizard || editingJob) && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateWizard(false);
              setEditingJob(null);
            }
          }}
        >
          <div style={{ maxHeight: "90vh", overflow: "auto" }}>
            <CronJobWizard
              initialConfig={editingJob ? {
                name: editingJob.name,
                schedule: editingJob.schedule,
                description: editingJob.description || "",
                prompt: "",
                taskType: "custom-task",
                parameters: {},
                enabled: editingJob.status === "active",
                maxRetries: 3,
                timeout: 30,
                notifyOnSuccess: false,
                notifyOnFailure: true,
              } : undefined}
              onClose={() => {
                setShowCreateWizard(false);
                setEditingJob(null);
              }}
              onSubmit={editingJob 
                ? (config: CronJobConfig) => handleUpdateJob(editingJob.id, config)
                : handleCreateJob
              }
              onComplete={() => {
                setShowCreateWizard(false);
                setEditingJob(null);
                loadJobs();
              }}
              onCancel={() => {
                setShowCreateWizard(false);
                setEditingJob(null);
              }}
            />
          </div>
        </div>
      )}

      {/* Status Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 10,
          background: localDraft ? "rgba(245,158,11,0.12)" : "rgba(16,12,10,0.24)",
          border: `1px solid ${localDraft ? "rgba(245,158,11,0.2)" : palette.border}`,
        }}
      >
        <ClockCounterClockwise
          size={14}
          weight="bold"
          style={{ color: localDraft ? "#fbbf24" : palette.accent }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#f6eee7" }}>
            {localDraft ? "Local Draft Mode" : "Runtime-Managed Session"}
          </div>
          <div style={{ fontSize: 10, color: "#a8998c" }}>
            {localDraft
              ? "Automation is disabled in local draft mode"
              : automationEnabled
                ? `Automation hooks are active • ${jobs.length} job${jobs.length !== 1 ? "s" : ""}`
                : "Enable automation to schedule jobs"}
          </div>
        </div>
        <div
          style={{
            padding: "3px 8px",
            borderRadius: 999,
            background: automationEnabled ? "rgba(121,196,124,0.2)" : "rgba(255,255,255,0.08)",
            color: automationEnabled ? "#79C47C" : "#a8998c",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {automationEnabled ? "Enabled" : "Disabled"}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${palette.border}`, paddingBottom: 8 }}>
        <WorkspaceTab
          active={activeTab === "scheduled"}
          label={`Scheduled (${jobs.length})`}
          icon={<Calendar size={12} weight="bold" />}
          palette={palette}
          onClick={() => setActiveTab("scheduled")}
        />
        <WorkspaceTab
          active={activeTab === "history"}
          label="History"
          icon={<ClockCounterClockwise size={12} weight="bold" />}
          palette={palette}
          onClick={() => setActiveTab("history")}
        />
        <WorkspaceTab
          active={activeTab === "config"}
          label="Config"
          icon={<Wrench size={12} weight="bold" />}
          palette={palette}
          onClick={() => setActiveTab("config")}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <X size={14} style={{ color: "#ef4444" }} />
          <span style={{ fontSize: 11, color: "#fca5a5", flex: 1 }}>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{
              padding: "2px 6px",
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: "#fca5a5",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === "scheduled" && (
        <ScheduledJobsView
          jobs={jobs}
          isLoading={isLoading}
          palette={palette}
          automationEnabled={automationEnabled && !localDraft}
          onCreate={() => setShowCreateWizard(true)}
          onEdit={setEditingJob}
          onDelete={handleDeleteJob}
          onRunNow={handleRunNow}
          onToggle={handleToggleJob}
          onRefresh={loadJobs}
        />
      )}

      {activeTab === "history" && <JobHistoryView palette={palette} />}

      {activeTab === "config" && <AutomationConfigView palette={palette} />}
    </div>
  );
}

interface ScheduledJobsViewProps {
  jobs: DisplayJob[];
  isLoading: boolean;
  palette: SurfacePalette;
  automationEnabled: boolean;
  onCreate: () => void;
  onEdit: (job: DisplayJob) => void;
  onDelete: (jobId: string) => void;
  onRunNow: (jobId: string) => void;
  onToggle: (job: DisplayJob) => void;
  onRefresh: () => void;
}

function ScheduledJobsView({
  jobs,
  isLoading,
  palette,
  automationEnabled,
  onCreate,
  onEdit,
  onDelete,
  onRunNow,
  onToggle,
  onRefresh,
}: ScheduledJobsViewProps) {
  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#a8998c" }}>
        <div style={{ fontSize: 13 }}>Loading scheduled jobs...</div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          borderRadius: 12,
          background: "rgba(16,12,10,0.24)",
          border: `1px solid ${palette.border}`,
          textAlign: "center",
        }}
      >
        <Calendar size={24} style={{ color: palette.accent, marginBottom: 8 }} />
        <div style={{ fontSize: 12, color: "#b3a395", marginBottom: 8 }}>
          No scheduled jobs configured
        </div>
        <button
          type="button"
          onClick={onCreate}
          disabled={!automationEnabled}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 999,
            border: `1px solid ${palette.border}`,
            background: automationEnabled ? palette.soft : "rgba(255,255,255,0.05)",
            color: automationEnabled ? palette.accent : "#666",
            fontSize: 11,
            fontWeight: 700,
            cursor: automationEnabled ? "pointer" : "not-allowed",
          }}
        >
          <Plus size={12} weight="bold" />
          Create Job
        </button>
        {!automationEnabled && (
          <div style={{ fontSize: 10, color: "#888", marginTop: 8 }}>
            Enable automation to create scheduled jobs
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Header with create button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "#a8998c" }}>
          {jobs.filter((j) => j.status === "active").length} active
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={onRefresh}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              borderRadius: 6,
              border: `1px solid ${palette.border}`,
              background: "transparent",
              color: "#a8998c",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            <ArrowCounterClockwise size={12} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={!automationEnabled}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 6,
              border: `1px solid ${palette.border}`,
              background: automationEnabled ? palette.soft : "rgba(255,255,255,0.05)",
              color: automationEnabled ? palette.accent : "#666",
              fontSize: 10,
              fontWeight: 600,
              cursor: automationEnabled ? "pointer" : "not-allowed",
            }}
          >
            <Plus size={12} weight="bold" />
            New Job
          </button>
        </div>
      </div>

      {/* Job Cards */}
      {jobs.map((job) => (
        <JobCard
          key={job.id}
          job={job}
          palette={palette}
          automationEnabled={automationEnabled}
          onEdit={() => onEdit(job)}
          onDelete={() => onDelete(job.id)}
          onRunNow={() => onRunNow(job.id)}
          onToggle={() => onToggle(job)}
        />
      ))}
    </div>
  );
}

interface JobCardProps {
  job: DisplayJob;
  palette: SurfacePalette;
  automationEnabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onRunNow: () => void;
  onToggle: () => void;
}

function JobCard({ job, palette, automationEnabled, onEdit, onDelete, onRunNow, onToggle }: JobCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  const statusColors = {
    active: "#79C47C",
    paused: "#fbbf24",
    failed: "#ef4444",
  };

  const scheduleDescription = describeCronExpression(job.schedule);

  return (
    <div
      style={{
        borderRadius: 12,
        border: `1px solid ${palette.border}`,
        background: "rgba(16,12,10,0.24)",
        overflow: "hidden",
      }}
    >
      {/* Main Row */}
      <div style={{ padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Calendar size={14} style={{ color: palette.accent, flexShrink: 0 }} />
            <span 
              style={{ 
                fontSize: 12, 
                fontWeight: 600, 
                color: "#f6eee7",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={job.name}
            >
              {job.name}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {/* Status Badge */}
            <button
              type="button"
              onClick={onToggle}
              disabled={!automationEnabled}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 8px",
                borderRadius: 999,
                background: `${statusColors[job.status]}20`,
                color: statusColors[job.status],
                fontSize: 10,
                fontWeight: 700,
                border: "none",
                cursor: automationEnabled ? "pointer" : "not-allowed",
              }}
              title={automationEnabled ? "Click to toggle" : "Automation disabled"}
            >
              {job.status === "active" && <Play size={10} weight="fill" />}
              {job.status === "paused" && <Pause size={10} weight="fill" />}
              {job.status}
            </button>
          </div>
        </div>

        {/* Schedule Display */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 8px",
            background: "rgba(0,0,0,0.2)",
            borderRadius: 6,
            fontSize: 11,
            marginBottom: 8,
          }}
        >
          <span style={{ fontFamily: "monospace", color: palette.accent }}>{job.schedule}</span>
          <span style={{ color: "#666" }}>•</span>
          <span style={{ color: "#a8998c" }}>{scheduleDescription}</span>
        </div>

        {/* Run Info */}
        <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#a8998c", flexWrap: "wrap" }}>
          {job.runCount > 0 && (
            <span title="Total runs">{job.runCount} run{job.runCount !== 1 ? "s" : ""}</span>
          )}
          {job.lastRun && (
            <span title={`Last run: ${job.lastRun.toLocaleString()}`}>
              Last: {formatRelativeTime(job.lastRun)}
            </span>
          )}
          {job.nextRun && job.status === "active" && (
            <span style={{ color: palette.accent }} title={`Next run: ${job.nextRun.toLocaleString()}`}>
              Next: {formatRelativeTime(job.nextRun)}
            </span>
          )}
          {job.lastError && (
            <span style={{ color: "#ef4444" }} title={job.lastError}>
              Last failed
            </span>
          )}
        </div>

        {/* Description */}
        {job.description && (
          <div style={{ marginTop: 8, fontSize: 10, color: "#888", lineHeight: 1.4 }}>
            {job.description}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <ActionButton
            icon={<Play size={12} weight="bold" />}
            label="Run Now"
            onClick={onRunNow}
            disabled={!automationEnabled}
            palette={palette}
          />
          <ActionButton
            icon={<Pencil size={12} weight="bold" />}
            label="Edit"
            onClick={onEdit}
            disabled={!automationEnabled}
            palette={palette}
          />
          <ActionButton
            icon={<Trash size={12} weight="bold" />}
            label="Delete"
            onClick={onDelete}
            palette={palette}
            danger
          />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  palette,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  palette: SurfacePalette;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${danger ? "rgba(239,68,68,0.3)" : palette.border}`,
        background: danger ? "rgba(239,68,68,0.1)" : "transparent",
        color: disabled ? "#666" : danger ? "#ef4444" : "#a8998c",
        fontSize: 10,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (Math.abs(diffMins) < 60) {
    return diffMins > 0 ? `in ${diffMins}m` : `${Math.abs(diffMins)}m ago`;
  }
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `in ${diffHours}h` : `${Math.abs(diffHours)}h ago`;
  }
  return diffDays > 0 ? `in ${diffDays}d` : `${Math.abs(diffDays)}d ago`;
}

function JobHistoryView({ palette }: { palette: SurfacePalette }) {
  const [history, setHistory] = useState<JobExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        // Get execution history from runner
        const executions = getExecutionHistory();
        setHistory(executions);
      } finally {
        setIsLoading(false);
      }
    };
    loadHistory();
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#a8998c" }}>
        <div style={{ fontSize: 13 }}>Loading execution history...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div
        style={{
          padding: 20,
          borderRadius: 12,
          background: "rgba(16,12,10,0.24)",
          border: `1px solid ${palette.border}`,
          textAlign: "center",
        }}
      >
        <ClockCounterClockwise size={24} style={{ color: palette.accent, marginBottom: 8 }} />
        <div style={{ fontSize: 12, color: "#b3a395" }}>
          No execution history yet
        </div>
        <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>
          Job runs will be recorded here
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    completed: "#79C47C",
    failed: "#ef4444",
    running: "#3b82f6",
    cancelled: "#888",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#a8998c" }}>
          Last {history.length} execution{history.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => {
            clearExecutionHistory();
            setHistory([]);
          }}
          style={{
            fontSize: 10,
            color: "#888",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          Clear History
        </button>
      </div>
      {history.slice(0, 10).map((execution) => (
        <div
          key={execution.executionId}
          style={{
            padding: 10,
            borderRadius: 8,
            background: "rgba(16,12,10,0.24)",
            border: `1px solid ${palette.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: statusColors[execution.status] || "#888",
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#f6eee7", fontWeight: 500 }}>
              {execution.jobId}
            </div>
            <div style={{ fontSize: 10, color: "#888" }}>
              {new Date(execution.startedAt).toLocaleString()}
            </div>
          </div>
          <div
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: `${statusColors[execution.status]}20`,
              color: statusColors[execution.status],
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            {execution.status}
          </div>
        </div>
      ))}
    </div>
  );
}

function AutomationConfigView({ palette }: { palette: SurfacePalette }) {
  const { isRunning, start, stop } = useJobRunner();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <MetaCard
        accent={palette.accent}
        label="Execution Mode"
        value="Native agent session with durable state"
      />
      <MetaCard
        accent={palette.accent}
        label="Persistence"
        value="Session state is saved automatically"
      />
      <MetaCard
        accent={palette.accent}
        label="Scheduling Backend"
        value="Runtime-managed (when enabled)"
      />
      <MetaCard
        accent={palette.accent}
        label="Job Runner"
        value={isRunning ? "Running (polling every 60s)" : "Stopped"}
      />

      {/* Runner Controls */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => start()}
          disabled={isRunning}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(121,196,124,0.3)",
            background: isRunning ? "rgba(255,255,255,0.05)" : "rgba(121,196,124,0.15)",
            color: isRunning ? "#666" : "#79C47C",
            fontSize: 11,
            fontWeight: 600,
            cursor: isRunning ? "not-allowed" : "pointer",
          }}
        >
          {isRunning ? "Runner Active" : "Start Runner"}
        </button>
        <button
          type="button"
          onClick={() => stop()}
          disabled={!isRunning}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid rgba(239,68,68,0.3)",
            background: !isRunning ? "rgba(255,255,255,0.05)" : "rgba(239,68,68,0.15)",
            color: !isRunning ? "#666" : "#ef4444",
            fontSize: 11,
            fontWeight: 600,
            cursor: !isRunning ? "not-allowed" : "pointer",
          }}
        >
          Stop Runner
        </button>
      </div>

      <div
        style={{
          marginTop: 8,
          padding: 10,
          borderRadius: 10,
          background: "rgba(255,255,255,0.03)",
          border: `1px solid ${palette.border}`,
          fontSize: 11,
          color: "#a8998c",
          lineHeight: 1.5,
        }}
      >
        The job runner polls for due jobs every minute and executes them via native agent sessions. 
        Enable automation to allow scheduled jobs and background tasks.
      </div>
    </div>
  );
}
