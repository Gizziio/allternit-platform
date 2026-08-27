"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Robot,
  Play,
  Plus,
  FolderOpen,
  Cloud,
  Gear,
  ChatTeardropText,
  ClockCounterClockwise,
  Plugs,
  Key,
  Lightning,
  Warning,
  CheckCircle,
  Envelope,
  ArrowRight,
  House,
  CaretLeft,
  Sparkle,
  TrendUp,
  ShieldCheck,
  ComputerTower,
  Desktop,
  Globe,
  FileCode,
  Terminal,
  SquaresFour,
  X,
  PaperPlaneTilt,
  WebhooksLogo,
} from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useChatStore } from "@/views/chat/ChatStore";
import type { Agent } from "@/lib/agents/agent.types";
import {
  getBotAccentColor,
  getBotDisplayName,
  getBotTagline,
  isBot,
} from "@/lib/bots/bot-profile";
import { useStartBotSession } from "@/lib/bots/useStartBotSession";
import { getConnectorLogoUrl } from "@/lib/design/connector-logo";
import { listWebhookTriggers, type WebhookTrigger } from "@/lib/webhook-api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/design/GlassSurface";
import { BotRuntimeConfigModal } from "./BotRuntimeConfigModal";
import { BotDesktopView } from "./BotDesktopView";
import { AutomationTasksView } from "@/views/cowork/AutomationTasksView";
import { BotWebhookTriggersPanel } from "./BotWebhookTriggersPanel";
import { EditAgentForm } from "@/views/agent-view/components/EditAgentForm";
import { BotConfigTab } from "./BotConfigTab";
import { BotAvatar } from "./BotAvatar";

interface BotHomeViewProps {
  botId: string;
}

type BotHomeTab = "home" | "tasks" | "artifacts" | "runtime" | "desktop" | "automation" | "webhooks" | "config";

function botInitials(name: string): string {
  return (name || "Bot")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function groupKeyForDate(ts: string): string {
  const date = new Date(ts);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(now);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  if (d.getTime() === now.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  if (d.getTime() >= lastWeek.getTime()) return "Previous 7 Days";
  return "Older";
}

function maskValue(value: string): string {
  if (value.length <= 8) return "••••••";
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return mo === 1 ? "1 month ago" : `${mo} months ago`;
  const yr = Math.floor(mo / 12);
  return yr === 1 ? "1 year ago" : `${yr} years ago`;
}

export function BotHomeView({ botId }: BotHomeViewProps) {
  const { agents } = useAgentStore();
  const chatSessions = useChatSessionStore((s) => s.sessions);
  const createChatSession = useChatSessionStore((s) => s.createSession);
  const setActiveChatSession = useChatSessionStore((s) => s.setActiveSession);
  const chatProjects = useChatStore((s) => s.projects);
  const createChatProject = useChatStore((s) => s.createProject);

  const {
    startSession: startBotSession,
    startTask: startBotTask,
    isStarting: isStartingBot,
    error: botSessionError,
  } = useStartBotSession(
    useCallback((_sessionId: string) => {
      window.dispatchEvent(
        new CustomEvent("allternit:open-view", { detail: { viewType: "chat" } })
      );
    }, [])
  );

  const [activeTab, setActiveTab] = useState<BotHomeTab>("home");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isRuntimeModalOpen, setIsRuntimeModalOpen] = useState(false);
  const [runtimeModalSection, setRuntimeModalSection] = useState<"connectors" | "secrets" | "vm" | undefined>(undefined);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isTaskComposerOpen, setIsTaskComposerOpen] = useState(false);
  const [taskInput, setTaskInput] = useState("");

  const bot = useMemo(() => agents.find((a) => a.id === botId), [agents, botId]);

  const botSessions = useMemo(() => {
    const isLegacyGizzi =
      bot?.name?.toLowerCase() === "gizzi" &&
      bot?.botProfile?.displayName?.toLowerCase() === "gizzi";
    return chatSessions
      .filter(
        (s) =>
          s.metadata?.sessionMode === "agent" &&
          (s.metadata?.agentId === botId ||
            (s.metadata as Record<string, unknown>)?.agent_id === botId ||
            (bot?.name && String(s.metadata?.agentName).toLowerCase() === bot.name.toLowerCase()) ||
            (isLegacyGizzi && s.name === "Gizzi"))
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [chatSessions, botId, bot?.name, bot?.botProfile?.displayName]);

  const botArtifacts = useMemo(() => {
    const artifacts: Array<{
      id: string;
      sessionId: string;
      sessionName: string;
      type: string;
      title: string;
      content: string;
      updatedAt: string;
    }> = [];
    for (const session of botSessions) {
      for (const msg of session.messages) {
        if (msg.role !== "assistant") continue;
        const parts = (msg.metadata?.agentElementsParts ?? []) as Array<Record<string, unknown>>;
        for (const part of parts) {
          const partType = part.type as string;
          if (["code", "markdown", "diagram", "browser", "image"].includes(partType)) {
            artifacts.push({
              id: (part.id as string) || `artifact-${session.id}-${artifacts.length}`,
              sessionId: session.id,
              sessionName: session.name,
              type: partType,
              title: (part.title as string) || "Artifact",
              content: (part.content as string) || "",
              updatedAt: msg.timestamp,
            });
          }
        }
      }
    }
    return artifacts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [botSessions]);

  const latestSession = botSessions[0];
  const activeVM = useMemo(() => {
    const session = botSessions.find((s) => {
      const vm = s.metadata?.vmSandbox as { status?: string; id?: string } | undefined;
      return vm?.status === 'running' || vm?.status === 'creating';
    });
    return (session?.metadata?.vmSandbox as { id: string; provider: string; status: string; vncUrl?: string } | undefined) ?? null;
  }, [botSessions]);
  const hasMissingSecrets = (bot?.secretRefs?.some((s) => s.required && !s.vaultRef) ?? false);
  const connectorCount = bot?.connectorBindings?.length ?? 0;
  const secretCount = bot?.secretRefs?.length ?? 0;

  const handleStartSession = useCallback(async () => {
    if (!bot) return;
    await startBotSession(bot);
  }, [bot, startBotSession]);

  const handleCreateProjectSession = useCallback(
    async (projectId?: string) => {
      if (!bot) return;
      const sessionId = await createChatSession({
        name: `${getBotDisplayName(bot)} Session`,
        sessionMode: "agent",
        agentId: bot.id,
        agentName: bot.name,
        systemPrompt: bot.systemPrompt,
        metadata: {
          isBot: true,
          botProfile: bot.botProfile,
          projectId,
          originSurface: "chat",
        },
      });
      setActiveChatSession(sessionId);
      window.dispatchEvent(
        new CustomEvent("allternit:open-view", { detail: { viewType: "chat" } })
      );
    },
    [bot, createChatSession, setActiveChatSession]
  );

  const handleCreateProject = useCallback(async () => {
    if (!bot) return;
    setIsCreatingProject(true);
    try {
      const projectName = `${getBotDisplayName(bot)} Project`;
      const projectId = await createChatProject(projectName);
      await handleCreateProjectSession(projectId);
    } finally {
      setIsCreatingProject(false);
    }
  }, [bot, createChatProject, handleCreateProjectSession]);

  const handleOpenSession = useCallback((sessionId: string) => {
    setActiveChatSession(sessionId);
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", { detail: { viewType: "chat" } })
    );
  }, [setActiveChatSession]);

  const handleBackToHub = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", { detail: { viewType: "agent-hub" } })
    );
  }, []);

  const handleEditBot = useCallback(() => {
    setIsEditModalOpen(true);
  }, []);

  const handleOpenInbox = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-view", {
        detail: { viewType: "bot-inbox", context: { botId } },
      })
    );
  }, [botId]);

  const handleCloudHandoff = useCallback(() => {
    setIsCloudModalOpen(true);
  }, []);

  const handleOpenTaskComposer = useCallback(() => {
    setTaskInput("");
    setIsTaskComposerOpen(true);
  }, []);

  const handleSubmitTask = useCallback(async () => {
    if (!bot || !taskInput.trim()) return;
    await startBotTask(bot, taskInput.trim());
    setIsTaskComposerOpen(false);
    setTaskInput("");
  }, [bot, taskInput, startBotTask]);

  const handleRunStarter = useCallback((prompt: string) => {
    setTaskInput(prompt);
    setIsTaskComposerOpen(true);
  }, []);

  if (!bot || !isBot(bot)) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
        Bot not found.
      </div>
    );
  }

  const displayName = getBotDisplayName(bot);
  const accentColor = getBotAccentColor(bot) ?? "var(--accent-primary)";
  const tagline = getBotTagline(bot);

  const tabs = [
    { id: "home" as const, label: "Home", icon: House },
    { id: "tasks" as const, label: "Tasks", icon: ChatTeardropText },
    { id: "artifacts" as const, label: "Artifacts", icon: FolderOpen },
    { id: "runtime" as const, label: "Runtime", icon: Lightning },
    { id: "desktop" as const, label: "Desktop", icon: Desktop },
    { id: "automation" as const, label: "Automation Tasks", icon: ClockCounterClockwise },
    { id: "webhooks" as const, label: "Webhooks", icon: WebhooksLogo },
    { id: "config" as const, label: "Config", icon: Gear },
  ];

  return (
    <div className="h-full w-full flex flex-col bg-[var(--bg-elevated)] text-[var(--text-primary)] overflow-auto">
      <div className="w-full max-w-6xl mx-auto px-8 pt-10 pb-12 flex flex-col">
        {/* Breadcrumb */}
        <button
          type="button"
          onClick={handleBackToHub}
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors mb-4 w-fit"
        >
          <CaretLeft size={14} />
          Bot Hub
        </button>

        {/* Header */}
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <BotAvatar bot={bot} size={64} />
              <div>
                <h1
                  className="text-3xl font-medium tracking-tight"
                  style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)" }}
                >
                  {displayName}
                </h1>
                <p className="text-[14px] text-[var(--text-secondary)] mt-0.5">
                  {tagline || `@${bot.name}`}
                </p>
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <Badge color={accentColor}>Bot</Badge>
                  <Badge subdued>{bot.harness?.mode || "cloud"} harness</Badge>
                  {bot.vmOperator?.enabled && (
                    <Badge accent>VM Operator</Badge>
                  )}
                  {bot.messagingConfig?.photonEnabled && (
                    <Badge accent>Photon</Badge>
                  )}
                  {hasMissingSecrets && (
                    <Badge warning>Missing secrets</Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInbox}
                className="gap-1.5"
              >
                <Envelope size={14} />
                Inbox
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCloudHandoff}
                className="gap-1.5"
              >
                <Cloud size={14} />
                Cloud
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleEditBot}
                className="gap-1.5"
              >
                <Gear size={14} />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartSession}
                disabled={isStartingBot}
                className="gap-1.5"
              >
                <ChatTeardropText size={14} />
                Chat
              </Button>
              <Button
                size="sm"
                onClick={handleOpenTaskComposer}
                disabled={isStartingBot}
                className="gap-1.5"
                style={{ background: accentColor, color: "#fff" }}
              >
                <Play size={14} weight="fill" />
                {isStartingBot ? "Starting…" : "Run Task"}
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[var(--border-subtle)]">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "relative flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors",
                    isActive
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] rounded-t-lg"
                  )}
                >
                  <tab.icon size={14} weight={isActive ? "fill" : "regular"} />
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-full"
                      style={{ background: accentColor }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="mt-8">
          {activeTab === "home" && (
            <HomeTab
              bot={bot}
              accentColor={accentColor}
              sessionCount={botSessions.length}
              artifactCount={botArtifacts.length}
              connectorCount={connectorCount}
              secretCount={secretCount}
              hasMissingSecrets={hasMissingSecrets}
              latestSession={latestSession}
              onStartSession={handleStartSession}
              onRunTask={handleOpenTaskComposer}
              onRunStarter={handleRunStarter}
              onNewProject={handleCreateProject}
              onOpenSession={handleOpenSession}
              onViewTasks={() => setActiveTab("tasks")}
              onViewArtifacts={() => setActiveTab("artifacts")}
              onViewRuntime={() => setActiveTab("runtime")}
              isStarting={isStartingBot}
              isCreatingProject={isCreatingProject}
            />
          )}
          {activeTab === "tasks" && (
            <TasksTab
              bot={bot}
              sessions={botSessions}
              projects={chatProjects}
              onOpenSession={handleOpenSession}
              onNewTask={() => handleCreateProjectSession()}
              onBack={() => setActiveTab("home")}
              accentColor={accentColor}
            />
          )}
          {activeTab === "artifacts" && (
            <ArtifactsTab
              artifacts={botArtifacts}
              accentColor={accentColor}
              onBack={() => setActiveTab("home")}
            />
          )}
          {activeTab === "runtime" && (
            <RuntimeTab
              bot={bot}
              accentColor={accentColor}
              activeVM={activeVM}
              onBack={() => setActiveTab("home")}
              onEditRuntime={() => {
                setRuntimeModalSection(undefined);
                setIsRuntimeModalOpen(true);
              }}
              onEditConnectors={() => {
                setRuntimeModalSection("connectors");
                setIsRuntimeModalOpen(true);
              }}
              onEditSecrets={() => {
                setRuntimeModalSection("secrets");
                setIsRuntimeModalOpen(true);
              }}
              onEditVM={() => {
                setRuntimeModalSection("vm");
                setIsRuntimeModalOpen(true);
              }}
            />
          )}
          {activeTab === "desktop" && (
            <BotDesktopView
              bot={bot}
              accentColor={accentColor}
              activeVM={activeVM}
              onBack={() => setActiveTab("home")}
            />
          )}
          {activeTab === "automation" && (
            <AutomationTasksTab
              bot={bot}
              accentColor={accentColor}
              onBack={() => setActiveTab("home")}
            />
          )}
          {activeTab === "webhooks" && (
            <BotWebhookTriggersPanel bot={bot} accentColor={accentColor} />
          )}
          {activeTab === "config" && (
            <BotConfigTab bot={bot} accentColor={accentColor} />
          )}
        </div>
      </div>

      <BotRuntimeConfigModal
        bot={bot}
        isOpen={isRuntimeModalOpen}
        onClose={() => setIsRuntimeModalOpen(false)}
        initialSection={runtimeModalSection}
        onSaved={() => {
          // agent store will refresh via updateAgent; no-op is fine
        }}
      />

      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditModalOpen(false);
          }}
        >
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-2xl">
            <EditAgentForm
              agent={bot}
              onCancel={() => setIsEditModalOpen(false)}
              onSaved={() => setIsEditModalOpen(false)}
            />
          </div>
        </div>
      )}

      {isCloudModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCloudModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Cloud size={20} style={{ color: accentColor }} />
                  Cloud Orchestration
                </h2>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">
                  Deploy {getBotDisplayName(bot)} to a cloud runtime.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCloudModalOpen(false)}
                className="size-8 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors"
              >
                <X size={14} weight="bold" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${accentColor} 14%, transparent)` }}
                  >
                    <Lightning size={18} style={{ color: accentColor }} />
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-[var(--text-primary)]">Cloud Harness</div>
                    <div className="text-[12px] text-[var(--text-secondary)]">
                      Current mode: <span className="font-medium text-[var(--text-primary)]">{bot.harness?.mode || "cloud"}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[12px] text-[var(--text-tertiary)]">
                  The bot runs through the configured harness. Switch to a managed cloud runner or BYOK endpoint in Runtime settings.
                </p>
              </div>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${accentColor} 14%, transparent)` }}
                  >
                    <ComputerTower size={18} style={{ color: accentColor }} />
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-[var(--text-primary)]">Sandbox Runtime</div>
                    <div className="text-[12px] text-[var(--text-secondary)]">
                      {bot.vmOperator?.enabled ? "Virtual computer enabled" : "Not configured"}
                    </div>
                  </div>
                </div>
                <p className="text-[12px] text-[var(--text-tertiary)]">
                  {bot.vmOperator?.enabled
                    ? `Tasks will run in ${bot.vmOperator.provider} sandboxes.`
                    : "Enable Virtual Computer in Runtime settings to run tasks in isolated sandboxes."}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsCloudModalOpen(false)}>
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsCloudModalOpen(false);
                  setActiveTab("runtime");
                }}
                style={{ background: accentColor, color: "#fff" }}
              >
                Open Runtime
              </Button>
            </div>
          </div>
        </div>
      )}

      {isTaskComposerOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsTaskComposerOpen(false);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden flex flex-col bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-2xl">
            <div className="p-5 border-b border-[var(--border-subtle)] flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[18px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Play size={20} style={{ color: accentColor }} weight="fill" />
                  Run a task with {displayName}
                </h2>
                <p className="text-[13px] text-[var(--text-secondary)] mt-1">
                  Describe what you want done. {displayName} will start working immediately
                  {bot.vmOperator?.enabled ? " using its virtual computer when needed" : ""}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTaskComposerOpen(false)}
                className="size-8 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors shrink-0"
              >
                <X size={14} weight="bold" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {botSessionError && (
                <div className="rounded-lg border border-[var(--status-warning)]/30 bg-[var(--status-warning)]/10 p-3 text-[13px] text-[var(--status-warning)]">
                  {botSessionError}
                </div>
              )}

              <textarea
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmitTask();
                  }
                }}
                placeholder={`e.g. Research the latest ${bot.botProfile?.botCategory ?? "topic"} trends and summarize them in a doc`}
                rows={5}
                className="w-full px-4 py-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-primary)] text-[14px] outline-none focus:border-[var(--accent-primary)] resize-none"
                autoFocus
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
                  {bot.vmOperator?.enabled ? (
                    <>
                      <ComputerTower size={14} style={{ color: accentColor }} />
                      Virtual computer enabled
                    </>
                  ) : (
                    <>
                      <ChatTeardropText size={14} />
                      Task will run in chat mode
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsTaskComposerOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => void handleSubmitTask()}
                    disabled={!taskInput.trim() || isStartingBot}
                    className="gap-1.5"
                    style={{ background: accentColor, color: "#fff" }}
                  >
                    <PaperPlaneTilt size={14} weight="fill" />
                    {isStartingBot ? "Starting…" : "Run task"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Badge({
  children,
  color,
  subdued,
  accent,
  warning,
}: {
  children: React.ReactNode;
  color?: string;
  subdued?: boolean;
  accent?: boolean;
  warning?: boolean;
}) {
  if (subdued) {
    return (
      <span className="rounded-full bg-[var(--surface-hover)] px-2.5 py-0.5 text-[11px] text-[var(--text-tertiary)]">
        {children}
      </span>
    );
  }
  if (accent) {
    return (
      <span className="rounded-full bg-[var(--accent-primary)]/10 px-2.5 py-0.5 text-[11px] text-[var(--accent-primary)]">
        {children}
      </span>
    );
  }
  if (warning) {
    return (
      <span className="rounded-full bg-[var(--status-warning)]/10 px-2.5 py-0.5 text-[11px] text-[var(--status-warning)]">
        {children}
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[11px]"
      style={{
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function TabHeader({
  icon: Icon,
  title,
  subtitle,
  accentColor,
  action,
  onBack,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  accentColor: string;
  action?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <CaretLeft size={14} />
              Home
            </button>
          )}
          <div
            className="flex shrink-0 items-center justify-center rounded-xl"
            style={{
              width: 40,
              height: 40,
              background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
            }}
          >
            <Icon size={20} style={{ color: accentColor }} />
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-[var(--text-primary)]">{title}</h2>
            <p className="text-[13px] text-[var(--text-secondary)]">{subtitle}</p>
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

function WebhooksCard({
  botId,
  accentColor,
}: {
  botId: string;
  accentColor: string;
}) {
  const [triggers, setTriggers] = useState<WebhookTrigger[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listWebhookTriggers()
      .then((rows) => setTriggers(rows.filter((t) => t.target_bot_id === botId)))
      .catch(() => setTriggers([]))
      .finally(() => setLoading(false));
  }, [botId]);

  const openSettings = () => {
    window.dispatchEvent(
      new CustomEvent("allternit:open-settings", { detail: { section: "webhooks" } })
    );
  };

  return (
    <GlassSurface className="p-5 rounded-xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex shrink-0 items-center justify-center rounded-xl"
            style={{
              width: 40,
              height: 40,
              background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
            }}
          >
            <WebhooksLogo size={20} style={{ color: accentColor }} />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">
              Webhook triggers
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {loading
                ? "Loading…"
                : triggers.length === 0
                  ? "No triggers wake this bot yet"
                  : `${triggers.length} trigger${triggers.length === 1 ? "" : "s"} wake this bot`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openSettings}
          className="text-[13px] font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
        >
          Configure webhooks →
        </button>
      </div>
    </GlassSurface>
  );
}

function HomeTab({
  bot,
  accentColor,
  sessionCount,
  artifactCount,
  connectorCount,
  secretCount,
  hasMissingSecrets,
  latestSession,
  onStartSession,
  onRunTask,
  onRunStarter,
  onNewProject,
  onOpenSession,
  onViewTasks,
  onViewArtifacts,
  onViewRuntime,
  isStarting,
  isCreatingProject,
}: {
  bot: Agent;
  accentColor: string;
  sessionCount: number;
  artifactCount: number;
  connectorCount: number;
  secretCount: number;
  hasMissingSecrets: boolean;
  latestSession?: ReturnType<typeof useChatSessionStore.getState>["sessions"][number];
  onStartSession: () => void;
  onRunTask: () => void;
  onRunStarter: (prompt: string) => void;
  onNewProject: () => void;
  onOpenSession: (sessionId: string) => void;
  onViewTasks: () => void;
  onViewArtifacts: () => void;
  onViewRuntime: () => void;
  isStarting: boolean;
  isCreatingProject: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Quick actions */}
      <GlassSurface className="p-5 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
              Delegate work to {getBotDisplayName(bot)}
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)] mt-0.5">
              Run a task, start a chat, or create a project to organize related work.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onNewProject}
              disabled={isCreatingProject}
              className="gap-1.5"
            >
              <FolderOpen size={14} />
              {isCreatingProject ? "Creating…" : "New Project"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onStartSession}
              disabled={isStarting}
              className="gap-1.5"
            >
              <ChatTeardropText size={14} />
              Chat
            </Button>
            <Button
              size="sm"
              onClick={onRunTask}
              disabled={isStarting}
              className="gap-1.5"
              style={{ background: accentColor, color: "#fff" }}
            >
              <Play size={14} weight="fill" />
              {isStarting ? "Starting…" : "Run Task"}
            </Button>
          </div>
        </div>
      </GlassSurface>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ChatTeardropText}
          label="Tasks"
          value={sessionCount}
          subtitle={latestSession ? `Last active ${relativeTime(latestSession.updatedAt)}` : "No tasks yet"}
          accentColor={accentColor}
          onClick={onViewTasks}
        />
        <StatCard
          icon={FolderOpen}
          label="Artifacts"
          value={artifactCount}
          subtitle="Across all sessions"
          accentColor={accentColor}
          onClick={onViewArtifacts}
        />
        <StatCard
          icon={Plugs}
          label="Connectors"
          value={connectorCount}
          subtitle={connectorCount > 0 ? "Bound for autonomous use" : "No connectors bound"}
          accentColor={accentColor}
          onClick={connectorCount > 0 ? onViewRuntime : undefined}
        />
        <StatCard
          icon={hasMissingSecrets ? Warning : ShieldCheck}
          label="Secrets"
          value={secretCount}
          subtitle={hasMissingSecrets ? "Required secrets missing" : secretCount > 0 ? "Configured" : "No secrets declared"}
          accentColor={hasMissingSecrets ? "var(--status-warning)" : accentColor}
          warning={hasMissingSecrets}
          onClick={onViewRuntime}
        />
      </div>

      {/* Webhooks */}
      <WebhooksCard botId={bot.id} accentColor={accentColor} />

      {/* Recent session */}
      {latestSession && (
        <GlassSurface className="p-5 rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <ClockCounterClockwise size={16} style={{ color: accentColor }} />
              Recent session
            </h3>
            <button
              type="button"
              onClick={onViewTasks}
              className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              View all
            </button>
          </div>
          <button
            type="button"
            onClick={() => onOpenSession(latestSession.id)}
            className="w-full flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 text-left transition-colors hover:bg-[var(--surface-hover)]"
          >
            <ChatTeardropText size={18} style={{ color: accentColor }} />
            <div className="flex-1 min-w-0">
              <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                {latestSession.name || "Untitled Session"}
              </div>
              <div className="text-[12px] text-[var(--text-tertiary)]">
                {latestSession.messageCount} message{latestSession.messageCount === 1 ? "" : "s"} • {relativeTime(latestSession.updatedAt)}
              </div>
            </div>
            <ArrowRight size={16} className="text-[var(--text-tertiary)]" />
          </button>
        </GlassSurface>
      )}

      {/* Welcome / starter prompts */}
      {(bot.botProfile?.welcomeMessage || (bot.botProfile?.starterPrompts?.length ?? 0) > 0) && (
        <GlassSurface className="p-5 rounded-xl">
          {bot.botProfile?.welcomeMessage && (
            <div className="flex items-start gap-3 mb-5">
              <Sparkle size={18} style={{ color: accentColor }} className="shrink-0 mt-0.5" />
              <div>
                <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-1">Welcome message</h3>
                <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
                  {bot.botProfile.welcomeMessage}
                </p>
              </div>
            </div>
          )}

          {(() => {
            const starterPrompts = bot.botProfile?.starterPrompts;
            if (!starterPrompts || starterPrompts.length === 0) return null;
            return (
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <Play size={16} style={{ color: accentColor }} />
                Quick tasks
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {starterPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onRunStarter(prompt)}
                    className="text-left p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-all"
                  >
                    <div className="text-[13px] font-medium text-[var(--text-primary)] line-clamp-2">
                      {prompt}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-2 flex items-center gap-1">
                      <Play size={10} weight="fill" style={{ color: accentColor }} />
                      Run task
                    </div>
                  </button>
                ))}
              </div>
            </div>
            );
          })()}
        </GlassSurface>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accentColor,
  warning,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subtitle: string;
  accentColor: string;
  warning?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <div className="flex items-start justify-between">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          {label}
        </div>
        <div className="text-2xl font-medium text-[var(--text-primary)] mt-1">{value}</div>
        <div className={cn("text-[12px] mt-0.5", warning ? "text-[var(--status-warning)]" : "text-[var(--text-secondary)]")}>
          {subtitle}
        </div>
      </div>
      <div
        className="p-2 rounded-lg"
        style={{
          background: `color-mix(in srgb, ${accentColor} 14%, transparent)`,
        }}
      >
        <Icon size={20} style={{ color: accentColor }} />
      </div>
    </div>
  );

  if (onClick) {
    return (
      <GlassSurface
        className="p-4 rounded-xl cursor-pointer"
        hover="glow"
        onClick={onClick}
      >
        {content}
      </GlassSurface>
    );
  }

  return <GlassSurface className="p-4 rounded-xl">{content}</GlassSurface>;
}

function TasksTab({
  bot,
  sessions,
  projects,
  onOpenSession,
  onNewTask,
  onBack,
  accentColor,
}: {
  bot: Agent;
  sessions: ReturnType<typeof useChatSessionStore.getState>["sessions"];
  projects: ReturnType<typeof useChatStore.getState>["projects"];
  onOpenSession: (sessionId: string) => void;
  onNewTask: () => void;
  onBack: () => void;
  accentColor: string;
}) {
  const grouped = useMemo(() => {
    const byDate: Record<string, typeof sessions> = {};
    for (const session of sessions) {
      const key = groupKeyForDate(session.updatedAt);
      byDate[key] = byDate[key] || [];
      byDate[key].push(session);
    }
    return byDate;
  }, [sessions]);

  const projectById = useMemo(() => {
    const map = new Map<string, (typeof projects)[0]>();
    for (const p of projects) map.set(p.id, p);
    return map;
  }, [projects]);

  return (
    <div className="space-y-6">
      <TabHeader
        icon={ChatTeardropText}
        title="Tasks"
        subtitle={`Focused work, runs, and conversations delegated to ${getBotDisplayName(bot)}`}
        accentColor={accentColor}
        onBack={onBack}
        action={
          <Button variant="outline" size="sm" onClick={onNewTask} className="gap-1.5 shrink-0">
            <Plus size={14} />
            New Task
          </Button>
        }
      />

      {sessions.length === 0 ? (
        <GlassSurface className="p-10 text-center rounded-xl border border-dashed border-[var(--border-subtle)]">
          <ChatTeardropText size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">No tasks yet</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1 mb-4">
            Delegate a task to this bot. The bot will run it in its workspace or sandbox and report back.
          </p>
          <Button
            size="sm"
            onClick={onNewTask}
            className="gap-1.5"
            style={{ background: accentColor, color: "#fff" }}
          >
            <Play size={14} weight="fill" />
            Run First Task
          </Button>
        </GlassSurface>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              {date}
            </div>
            <div className="flex flex-col gap-2">
              {items.map((session) => {
                const project = session.metadata?.projectId
                  ? projectById.get(session.metadata.projectId as string)
                  : undefined;
                return (
                  <GlassSurface
                    key={session.id}
                    className="p-3 rounded-xl cursor-pointer"
                    hover="lift"
                    onClick={() => onOpenSession(session.id)}
                  >
                    <div className="flex items-center gap-3">
                      <ChatTeardropText size={18} style={{ color: accentColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[14px] font-medium text-[var(--text-primary)]">
                          {session.name || "Untitled Session"}
                        </div>
                        <div className="text-[12px] text-[var(--text-tertiary)]">
                          {session.messageCount} message{session.messageCount === 1 ? "" : "s"}
                          {project ? ` • ${project.title}` : ""}
                          {" "}• {relativeTime(session.updatedAt)}
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-[var(--text-tertiary)]" />
                    </div>
                  </GlassSurface>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ArtifactsTab({
  artifacts,
  accentColor,
  onBack,
}: {
  artifacts: Array<{
    id: string;
    sessionId: string;
    sessionName: string;
    type: string;
    title: string;
    content: string;
    updatedAt: string;
  }>;
  accentColor: string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <TabHeader
        icon={FolderOpen}
        title="Artifacts"
        subtitle="Code, documents, diagrams, and captures produced by this bot"
        accentColor={accentColor}
        onBack={onBack}
      />

      {artifacts.length === 0 ? (
        <GlassSurface className="p-10 text-center rounded-xl border border-dashed border-[var(--border-subtle)]">
          <FolderOpen size={32} className="mx-auto mb-3 text-[var(--text-tertiary)]" />
          <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">No artifacts yet</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Artifacts produced by this bot across sessions will appear here.
          </p>
        </GlassSurface>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {artifacts.map((artifact) => (
          <GlassSurface key={artifact.id} className="p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <FolderOpen size={14} style={{ color: accentColor }} />
              <span className="text-[12px] font-semibold text-[var(--text-primary)]">{artifact.type}</span>
            </div>
            <div className="text-[14px] font-medium text-[var(--text-primary)] mb-1">{artifact.title}</div>
            <div className="text-[12px] text-[var(--text-tertiary)] mb-3">
              From {artifact.sessionName} • {relativeTime(artifact.updatedAt)}
            </div>
            <pre className="text-[11px] overflow-auto p-2 rounded-lg bg-[var(--bg-primary)] text-[var(--text-secondary)] max-h-[160px]">
              {artifact.content.slice(0, 500)}
              {artifact.content.length > 500 ? "…" : ""}
            </pre>
          </GlassSurface>
        ))}
        </div>
      )}
    </div>
  );
}

function RuntimeTab({
  bot,
  accentColor,
  activeVM,
  onBack,
  onEditRuntime,
  onEditConnectors,
  onEditSecrets,
  onEditVM,
}: {
  bot: Agent;
  accentColor: string;
  activeVM: { id: string; provider: string; status: string; vncUrl?: string } | null;
  onBack: () => void;
  onEditRuntime: () => void;
  onEditConnectors: () => void;
  onEditSecrets: () => void;
  onEditVM: () => void;
}) {
  const hasMissing = (bot.secretRefs?.some((s) => s.required && !s.vaultRef) ?? false);

  return (
    <div className="space-y-6">
      <TabHeader
        icon={Lightning}
        title="Runtime"
        subtitle="Connectors, secrets, harness, and identity channels this bot can use"
        accentColor={accentColor}
        onBack={onBack}
        action={
          <Button variant="outline" size="sm" onClick={onEditRuntime} className="gap-1.5 shrink-0">
            <Plus size={14} />
            Add connector / secret
          </Button>
        }
      />

      {hasMissing && (
        <GlassSurface
          className="p-4 rounded-xl border-l-4"
          style={{ borderLeftColor: "var(--status-warning)" }}
        >
          <div className="flex items-start gap-3">
            <Warning size={18} className="text-[var(--status-warning)] shrink-0 mt-0.5" />
            <div>
              <div className="text-[13px] font-semibold text-[var(--status-warning)]">
                Missing required secrets
              </div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                Some required secrets have not been sealed yet. Open settings to configure them.
              </div>
            </div>
          </div>
        </GlassSurface>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassSurface className="p-5 rounded-xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Plugs size={18} style={{ color: accentColor }} />
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Connectors</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onEditConnectors} className="text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 h-8 px-2">
              Configure
            </Button>
          </div>
          {bot.connectorBindings?.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {bot.connectorBindings.map((binding, idx) => {
                const { url: logo } = getConnectorLogoUrl(undefined, binding.provider, 32);
                const displayName = binding.label || binding.provider;
                const caps = binding.capabilities?.length ? binding.capabilities : ["autonomous"];
                return (
                  <div
                    key={`${binding.provider}-${idx}`}
                    className={cn(
                      "group rounded-xl border p-3 flex flex-col gap-2 transition-colors",
                      binding.autonomous
                        ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5"
                        : "border-[var(--border-subtle)] bg-[var(--bg-card)] hover:bg-[var(--surface-hover)]",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {logo ? (
                        <img
                          src={logo}
                          alt={displayName}
                          className="w-8 h-8 rounded-lg object-contain bg-[var(--bg-primary)] p-1 shrink-0"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: `color-mix(in srgb, ${accentColor} 14%, transparent)` }}
                        >
                          <span
                            className="text-[12px] font-bold uppercase"
                            style={{ color: accentColor }}
                          >
                            {displayName.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                            {displayName}
                          </span>
                          {binding.autonomous && (
                            <CheckCircle size={13} className="text-[var(--accent-primary)] shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-secondary)] capitalize truncate">
                          {binding.provider}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {caps.slice(0, 3).map((cap) => (
                        <span
                          key={cap}
                          className="inline-flex items-center rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--text-secondary)] capitalize"
                        >
                          {cap}
                        </span>
                      ))}
                      {caps.length > 3 && (
                        <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                          +{caps.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-center">
              <Plugs size={24} className="mx-auto mb-2 text-[var(--text-tertiary)]" />
              <p className="text-[13px] text-[var(--text-secondary)]">No connectors bound yet.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={onEditConnectors}
                className="mt-2 text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10"
              >
                Configure connectors
              </Button>
            </div>
          )}
        </GlassSurface>

        <GlassSurface className="p-5 rounded-xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Key size={18} style={{ color: accentColor }} />
              <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Secrets</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onEditSecrets} className="text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 h-8 px-2">
              Configure
            </Button>
          </div>
          {bot.secretRefs?.length ? (
            <div className="space-y-3">
              {bot.secretRefs.map((secret, idx) => (
                <div
                  key={`${secret.key}-${idx}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3"
                >
                  <div>
                    <div className="text-[13px] font-medium text-[var(--text-primary)]">
                      {secret.name || secret.key}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">
                      {secret.key} {secret.required ? "• required" : ""}
                    </div>
                  </div>
                  <div className="text-[12px] font-mono text-[var(--text-tertiary)]">
                    {secret.vaultRef ? maskValue(secret.vaultRef) : "not set"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-[var(--text-tertiary)]">No secrets declared.</p>
          )}
        </GlassSurface>
      </div>

      <GlassSurface className="p-5 rounded-xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Lightning size={18} style={{ color: accentColor }} />
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Harness</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onEditRuntime} className="text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 h-8 px-2">
            Configure
          </Button>
        </div>
        <div className="text-[13px] text-[var(--text-secondary)]">
          Mode: <span className="text-[var(--text-primary)] font-medium">{bot.harness?.mode || "cloud"}</span>
        </div>
        {bot.harness?.mode === "byok" && bot.harness.byok && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(bot.harness.byok).map(([provider, config]) => (
              <div key={provider} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
                <div className="text-[12px] font-semibold uppercase text-[var(--text-tertiary)]">{provider}</div>
                <div className="text-[13px] text-[var(--text-primary)]">
                  {config?.apiKey ? "Configured" : "Not set"}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassSurface>

      <GlassSurface className="p-5 rounded-xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Robot size={18} style={{ color: accentColor }} />
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Identity Channels</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onEditRuntime} className="text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 h-8 px-2">
            Configure
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <IdentityChannelCard
            label="Email"
            value={bot.identityChannels?.email?.address}
            enabled={bot.identityChannels?.email?.receiveEnabled}
            accentColor={accentColor}
          />
          <IdentityChannelCard
            label="Phone"
            value={bot.identityChannels?.phone?.number}
            enabled={bot.identityChannels?.phone?.voiceEnabled || bot.identityChannels?.phone?.smsEnabled}
            accentColor={accentColor}
          />
          <IdentityChannelCard
            label="Wallet"
            value={bot.identityChannels?.wallet?.address}
            enabled={!!bot.identityChannels?.wallet?.address}
            accentColor={accentColor}
          />
        </div>
      </GlassSurface>

      <GlassSurface className="p-5 rounded-xl">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ComputerTower size={18} style={{ color: accentColor }} />
            <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">Virtual Computer</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onEditVM} className="text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 h-8 px-2">
            Configure
          </Button>
        </div>
        {bot.vmOperator?.enabled ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge color={accentColor}>{bot.vmOperator.provider}</Badge>
              {bot.vmOperator.image && <Badge subdued>{bot.vmOperator.image}</Badge>}
              <Badge subdued>{bot.vmOperator.networkPolicy || "restricted"} network</Badge>
              <Badge subdued>{bot.vmOperator.persistence || "session"} persistence</Badge>
              {bot.vmOperator.vncEnabled && <Badge accent>VNC</Badge>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(bot.vmOperator.allowedActions?.length ? bot.vmOperator.allowedActions : ['command']).map((action) => {
                const icons: Record<string, React.ElementType> = {
                  command: Terminal,
                  browser: Globe,
                  file: FileCode,
                  desktop: Desktop,
                  code: SquaresFour,
                };
                const Icon = icons[action] || Terminal;
                return (
                  <span
                    key={action}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-primary)] border border-[var(--border-subtle)] px-2.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
                  >
                    <Icon size={12} />
                    <span className="capitalize">{action}</span>
                  </span>
                );
              })}
            </div>
            {(bot.vmOperator.resources?.cpu || bot.vmOperator.resources?.memory || bot.vmOperator.resources?.disk) && (
              <div className="text-[12px] text-[var(--text-secondary)]">
                Resources:
                {bot.vmOperator.resources.cpu && ` CPU ${bot.vmOperator.resources.cpu}`}
                {bot.vmOperator.resources.memory && ` • Memory ${bot.vmOperator.resources.memory}`}
                {bot.vmOperator.resources.disk && ` • Disk ${bot.vmOperator.resources.disk}`}
              </div>
            )}
            {activeVM ? (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-semibold text-[var(--text-tertiary)]">Active sandbox</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[var(--status-success)]">
                    <span className="size-1.5 rounded-full bg-[var(--status-success)] animate-pulse" />
                    {activeVM.status}
                  </span>
                </div>
                <div className="text-[13px] font-mono text-[var(--text-primary)] truncate">{activeVM.id}</div>
                {activeVM.vncUrl && (
                  <a
                    href={activeVM.vncUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-[var(--accent-primary)] hover:underline mt-1 inline-block"
                  >
                    Open VNC stream
                  </a>
                )}
              </div>
            ) : bot.vmOperator?.enabled ? (
              <p className="text-[12px] text-[var(--text-tertiary)]">
                No active sandbox. Start a task to launch one.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[13px] text-[var(--text-tertiary)]">Virtual computer is disabled. Enable it to let this bot run tasks inside a sandbox.</p>
        )}
      </GlassSurface>
    </div>
  );
}

function IdentityChannelCard({
  label,
  value,
  enabled,
  accentColor,
}: {
  label: string;
  value?: string;
  enabled?: boolean;
  accentColor: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] font-semibold text-[var(--text-tertiary)]">{label}</span>
        {enabled ? (
          <CheckCircle size={14} className="text-[var(--status-success)]" />
        ) : (
          <span className="text-[10px] text-[var(--text-tertiary)]">off</span>
        )}
      </div>
      <div className="text-[13px] text-[var(--text-primary)] truncate">{value || "Not configured"}</div>
    </div>
  );
}

function AutomationTasksTab({
  bot,
  accentColor,
  onBack,
}: {
  bot: Agent;
  accentColor: string;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <TabHeader
        icon={ClockCounterClockwise}
        title="Automation Tasks"
        subtitle={`Scheduled work and continuous routines for ${getBotDisplayName(bot)}`}
        accentColor={accentColor}
        onBack={onBack}
      />
      <div className="-mx-2 px-2">
        <AutomationTasksView
          agentId={bot.id}
          title={`${getBotDisplayName(bot)} Automation Tasks`}
          hideAgentSelector
          initialTab="routine"
          hideTitle
          embedded
        />
      </div>
    </div>
  );
}
