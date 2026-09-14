"use client";

import React, { useEffect, useState } from "react";
import { Record } from "@phosphor-icons/react";
import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { ApiCaptureView } from "@/views/api-capture/ApiCaptureView";
import { useApiCaptureStore } from "@/lib/api-capture/store";
import React, { useState } from "react";
import { Robot, Plugs } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ApiCaptureView } from "@/views/api-capture/ApiCaptureView";
import {
  ExtensionSidepanelShell,
  useBrowserExtensionPaneAdapter,
  BrowserExtensionComposer,
  BrowserExtensionConfigPanel,
  BrowserExtensionHistoryList,
  BrowserExtensionHistoryDetail,
} from "./extension-sidepanel";

const PLATFORM_SIDEPANEL_COPY = {
  title: "Allternit",
  subtitle: "Unified Browser Agent",
  emptyStateTitle: "Allternit Computer Agent",
  emptyStateDescription:
    "Run browser tasks through the same agent used by the extension, desktop, Gizzi, and computer-use.",
  readyLabel: "Ready",
  contextLabel: "Current Browser Tab",
  settingsEyebrow: "Unified Browser Agent",
  settingsTitle: "Allternit brain connection",
  settingsDescription:
    "Browser mode uses the Allternit/Gizzi brain and computer-use harness. Model credentials and system instructions are managed by the platform runtime, not this attached extension pane.",
  settingsContextLabel: "Provider",
} as const;

function BrowserUnifiedAgentPanel(): React.ReactNode {
  const { adapter } = useBrowserExtensionPaneAdapter();

  return (
    <ExtensionSidepanelShell
      adapter={adapter}
      copy={PLATFORM_SIDEPANEL_COPY}
      containerClassName="size-full min-h-0 p-0"
      testId="browser-extension-sidepanel-shell"
      renderConfigView={({ onBack }) => (
        <BrowserExtensionConfigPanel
          config={adapter.config}
          copy={PLATFORM_SIDEPANEL_COPY}
          pageLabel={adapter.pageLabel}
          onSave={async (next) => {
            await adapter.configure(next);
            onBack();
          }}
          onBack={onBack}
        />
      )}
      renderHistoryListView={({ onSelect, onBack }) => (
        <BrowserExtensionHistoryList
          sessions={adapter.sessions}
          onSelect={onSelect}
          onBack={onBack}
          onDeleteSession={adapter.deleteSession}
          onClearSessions={adapter.clearSessions}
        />
      )}
      renderHistoryDetailView={({ sessionId, onBack }) => {
        const session =
          adapter.sessions.find((s) => s.id === sessionId) || null;
        return (
          <BrowserExtensionHistoryDetail
            session={session}
            sessionId={sessionId}
            onBack={onBack}
          />
        );
      }}
      renderComposer={(props) => <BrowserExtensionComposer {...props} />}
    />
  );
}

export function BrowserChatPane(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<"agent" | "apis">("agent");

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 shrink-0 flex items-center justify-between px-3 border-b border-solid border-[var(--shell-divider)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
            {activeTab === "agent" ? (
              <MatrixLogo state="idle" size={14} className="opacity-90" />
            ) : (
              <Record size={16} weight="fill" />
            )}
          </div>
          <span className="text-[14px] font-semibold text-[var(--text-primary)]">
            {activeTab === "agent" ? "Allternit Computer Agent" : "Teach"}
          </span>
        </div>
        <div className="flex items-center p-1 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-elevated)] backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setActiveTab("agent")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-semibold border-none cursor-pointer transition-all",
              activeTab === "agent"
                ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] shadow-sm"
                : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            )}
          >
            <MatrixLogo state="idle" size={14} className="opacity-90" />
            Agent
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("site-apis")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-semibold border-none cursor-pointer transition-all",
              activeTab === "site-apis"
                ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] shadow-sm"
                : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            )}
          >
            <Record size={14} weight={activeTab === "site-apis" ? "fill" : "regular"} />
            Teach
          </button>
        </div>
    <div className="flex flex-col h-full bg-[var(--shell-view-bg)]">
      <div className="shrink-0 flex items-center gap-1 px-3 py-2 border-b border-solid border-[var(--border-subtle)]">
        <TabButton
          active={activeTab === "agent"}
          onClick={() => setActiveTab("agent")}
          icon={<Robot size={14} />}
          label="Agent"
        />
        <TabButton
          active={activeTab === "apis"}
          onClick={() => setActiveTab("apis")}
          icon={<Plugs size={14} />}
          label="APIs"
        />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "agent" ? (
          <BrowserUnifiedAgentPanel />
        ) : (
          <ApiCaptureView compact />
        )}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors border-none cursor-pointer",
        active
          ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export default BrowserChatPane;
