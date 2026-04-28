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
  subtitle: "Browser Agent",
  emptyStateTitle: "Allternit Browser Agent",
  emptyStateDescription: "Automate browsing tasks with AI",
  readyLabel: "Ready",
  contextLabel: "Current Browser Tab",
  settingsEyebrow: "Agent Settings",
  settingsTitle: "Configure how the browser agent executes tasks.",
  settingsDescription:
    "Adjust model, API key, and behavior preferences for the page agent.",
  settingsContextLabel: "Platform Browser",
} as const;

export function BrowserChatPane() {
  const { adapter } = useBrowserExtensionPaneAdapter();

  return (
    <div className="flex flex-col h-full">
      <ExtensionSidepanelShell
        adapter={adapter}
        copy={PLATFORM_SIDEPANEL_COPY}
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
    </div>
  );
}

export default BrowserChatPane;
