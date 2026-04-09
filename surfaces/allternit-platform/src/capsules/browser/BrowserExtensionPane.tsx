"use client";

import React from "react";

import { useBrowserExtensionPaneAdapter } from "./browserExtensionPane.adapter";
import { BrowserNativeComposer } from "./BrowserNativeComposer";
import {
  BrowserExtensionConfigView,
  BrowserExtensionHistoryDetailView,
  BrowserExtensionHistoryListView,
} from "./BrowserExtensionViews";
import { ExtensionSidepanelShell } from "./extension-sidepanel/ExtensionSidepanelShell";

const BROWSER_EXTENSION_COPY = {
  title: "Allternit Extension",
  subtitle: "Browser Sidepanel",
  emptyStateTitle: "Allternit Extension",
  emptyStateDescription: "Execute multi-page tasks",
  readyLabel: "Ready",
  contextLabel: "Current Browser Tab",
  settingsEyebrow: "Sidepanel Settings",
  settingsTitle: "Configure how the sidepanel executes tasks.",
  settingsDescription:
    "This view is adapter-driven in browser mode, but the sidepanel layout stays aligned to the packaged extension.",
  settingsContextLabel: "Runtime",
} as const;

export function BrowserExtensionPane() {
  const adapter = useBrowserExtensionPaneAdapter();
  return (
    <ExtensionSidepanelShell
      adapter={adapter}
      copy={BROWSER_EXTENSION_COPY}
      testId="browser-extension-pane"
      containerClassName="h-full"
      renderConfigView={(props) => <BrowserExtensionConfigView {...props} />}
      renderHistoryListView={(props) => <BrowserExtensionHistoryListView {...props} />}
      renderHistoryDetailView={(props) => <BrowserExtensionHistoryDetailView {...props} />}
      renderComposer={(props) => <BrowserNativeComposer {...props} />}
    />
  );
}

export default BrowserExtensionPane;
