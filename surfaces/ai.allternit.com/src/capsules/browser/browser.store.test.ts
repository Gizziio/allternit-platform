import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_BROWSER_WORKSPACE_ID, useBrowserStore } from './browser.store';

describe('Allternit browser workspaces and split views', () => {
  beforeEach(() => {
    useBrowserStore.setState({
      tabs: [],
      activeTabId: null,
      activeWorkspaceId: DEFAULT_BROWSER_WORKSPACE_ID,
      workspaces: [{ id: DEFAULT_BROWSER_WORKSPACE_ID, name: 'Focus', icon: '◎', color: '#7c6df2', createdAt: 0 }],
      splitViews: {},
      glanceViews: {},
    });
  });

  it('keeps new tabs in the active workspace', () => {
    const workspaceId = useBrowserStore.getState().addWorkspace('Research');
    const tabId = useBrowserStore.getState().addTab('https://example.com');

    expect(useBrowserStore.getState().tabs.find((tab) => tab.id === tabId)?.workspaceId).toBe(workspaceId);
  });

  it('creates, lays out, and closes a persisted split view', () => {
    const first = useBrowserStore.getState().addTab('https://example.com');
    const second = useBrowserStore.getState().addTab('https://example.org');
    useBrowserStore.getState().setActiveTab(first);
    useBrowserStore.getState().addTabToSplit(second);
    useBrowserStore.getState().setSplitLayout('grid');

    expect(useBrowserStore.getState().splitViews[DEFAULT_BROWSER_WORKSPACE_ID]).toMatchObject({
      tabIds: [first, second],
      layout: 'grid',
    });

    useBrowserStore.getState().closeTab(second);
    expect(useBrowserStore.getState().splitViews[DEFAULT_BROWSER_WORKSPACE_ID]).toBeUndefined();
  });

  it('makes Essentials visible independently of workspace ownership', () => {
    const tabId = useBrowserStore.getState().addTab('https://allternit.com');
    useBrowserStore.getState().toggleEssential(tabId);
    useBrowserStore.getState().addWorkspace('Build');

    expect(useBrowserStore.getState().tabs.find((tab) => tab.id === tabId)?.essential).toBe(true);
  });

  it('promotes a temporary Glance into the existing Split View harness', () => {
    const source = useBrowserStore.getState().addTab('https://example.com');
    useBrowserStore.getState().openGlance('example.org', 'Preview', source);
    const preview = useBrowserStore.getState().splitGlance();

    expect(preview).toBeTruthy();
    expect(useBrowserStore.getState().glanceViews[DEFAULT_BROWSER_WORKSPACE_ID]).toBeUndefined();
    expect(useBrowserStore.getState().splitViews[DEFAULT_BROWSER_WORKSPACE_ID]?.tabIds).toEqual([source, preview]);
  });

  it('duplicates and reorders workspace context without copying live tabs', () => {
    const sourceId = useBrowserStore.getState().addWorkspace('Research');
    useBrowserStore.getState().updateWorkspace(sourceId, { agentId: 'research-agent', skillIds: ['capture'] });
    const duplicateId = useBrowserStore.getState().duplicateWorkspace(sourceId)!;
    const duplicate = useBrowserStore.getState().workspaces.find((workspace) => workspace.id === duplicateId);
    expect(duplicate).toMatchObject({ name: 'Research Copy', agentId: 'research-agent', skillIds: ['capture'] });
    expect(useBrowserStore.getState().tabs.some((tab) => tab.workspaceId === duplicateId)).toBe(false);

    useBrowserStore.getState().reorderWorkspace(duplicateId, -1);
    expect(useBrowserStore.getState().workspaces.findIndex((workspace) => workspace.id === duplicateId)).toBe(1);
  });

  it('persists attached extension capabilities on both tabs and workspaces', () => {
    const tabId = useBrowserStore.getState().addTab('https://word.office.com');
    useBrowserStore.getState().updateTab(tabId, { extensionIds: ['allternit-office-word'] });
    useBrowserStore.getState().updateWorkspace(DEFAULT_BROWSER_WORKSPACE_ID, { extensionIds: ['allternit-office-word'] });

    expect(useBrowserStore.getState().tabs.find((tab) => tab.id === tabId)?.extensionIds).toEqual(['allternit-office-word']);
    expect(useBrowserStore.getState().workspaces.find((workspace) => workspace.id === DEFAULT_BROWSER_WORKSPACE_ID)?.extensionIds).toEqual(['allternit-office-word']);
  });
});
