"use client";

import { useBrowserStore } from '@/capsules/browser';
import { isElectronShell } from '@/lib/platform';
import type { OfficeHost } from './AciAddinView';
import { useBrowserAgentStore } from '@/capsules/browser/browserAgent.store';

const OFFICE_WEB_URLS: Record<OfficeHost, string> = {
  word: 'https://word.office.com',
  excel: 'https://excel.office.com',
  powerpoint: 'https://powerpoint.office.com',
};

const OFFICE_WEB_TITLES: Record<OfficeHost, string> = {
  word: 'Word on the web',
  excel: 'Excel on the web',
  powerpoint: 'PowerPoint on the web',
};

type ShellViewType = 'browser' | 'browserview' | 'addin-word' | 'addin-excel' | 'addin-ppt';

function dispatchShellEvent<T>(name: string, detail: T) {
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function openShellView(viewType: ShellViewType, context?: unknown) {
  if (viewType === 'browser' || viewType === 'browserview') {
    dispatchShellEvent('allternit:switch-mode', { mode: 'browser' });
  }
  dispatchShellEvent('allternit:open-view', { viewType, context });
}

export function openOfficeCompanion(host: OfficeHost) {
  const viewType = host === 'word' ? 'addin-word' : host === 'excel' ? 'addin-excel' : 'addin-ppt';
  openShellView(viewType);
}

export function openOfficeWebInBrowser(host: OfficeHost) {
  if (!isElectronShell()) {
    return false;
  }

  const targetUrl = OFFICE_WEB_URLS[host];
  const targetTitle = OFFICE_WEB_TITLES[host];
  const browser = useBrowserStore.getState();
  const existingTab = browser.tabs.find(
    (tab) => tab.contentType === 'web' && tab.url === targetUrl,
  );

  openShellView('browserview');

  if (existingTab) {
    browser.setActiveTab(existingTab.id);
    browser.setTabLoading(existingTab.id, false);
    return true;
  }

  browser.addTab(targetUrl, targetTitle);
  return true;
}

export function startOfficeWebDeveloperSetup(host: OfficeHost) {
  if (!openOfficeWebInBrowser(host)) return false;
  const browser = useBrowserStore.getState();
  const activeTab = browser.tabs.find((tab) => tab.id === browser.activeTabId);
  if (activeTab) {
    browser.updateTab(activeTab.id, { extensionIds: Array.from(new Set([...(activeTab.extensionIds ?? []), `allternit-office-${host}`])) });
  }
  useBrowserAgentStore.getState().setGoal(
    `Set up Allternit for ${OFFICE_WEB_TITLES[host]} in developer mode. Open a document, go to Home > Add-ins > More Settings > Upload My Add-in, and pause for me to confirm Microsoft's developer-mode prompt and select the ${host}.xml manifest. Verify the Allternit ribbon command appears; do not claim success before verification.`,
  );
  return true;
}

const OFFICE_DESKTOP_SCHEMES: Record<OfficeHost, string> = {
  word: 'ms-word:',
  excel: 'ms-excel:',
  powerpoint: 'ms-powerpoint:',
};

export function openOfficeDesktopApp(host: OfficeHost) {
  const scheme = OFFICE_DESKTOP_SCHEMES[host];

  if (window.allternit?.shell?.openExternal) {
    void window.allternit.shell.openExternal(scheme);
    return;
  }

  window.location.href = scheme;
}
