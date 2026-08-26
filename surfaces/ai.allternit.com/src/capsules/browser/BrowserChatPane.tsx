"use client";

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
