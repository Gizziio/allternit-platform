"use client";

import React from "react";
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
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-hidden">
        <BrowserUnifiedAgentPanel />
      </div>
    </div>
  );
}

export default BrowserChatPane;
