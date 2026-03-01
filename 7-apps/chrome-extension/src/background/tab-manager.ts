/**
 * Tab Manager
 * 
 * Manages browser tabs for automation sessions.
 */

export class TabManager {
  private activeTabs: Map<number, {
    sessionId: string;
    startTime: number;
  }> = new Map();

  async initialize(): Promise<void> {
    // Load active tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.id) {
        this.activeTabs.set(tab.id, {
          sessionId: '',
          startTime: Date.now(),
        });
      }
    }
  }

  async createTab(url?: string): Promise<chrome.tabs.Tab> {
    const tab = await chrome.tabs.create({ url });
    if (tab.id) {
      this.activeTabs.set(tab.id, {
        sessionId: '',
        startTime: Date.now(),
      });
    }
    return tab;
  }

  async closeTab(tabId: number): Promise<void> {
    await chrome.tabs.remove(tabId);
    this.activeTabs.delete(tabId);
  }

  getTabInfo(tabId: number): { sessionId: string; startTime: number } | undefined {
    return this.activeTabs.get(tabId);
  }

  listActiveTabs(): number[] {
    return Array.from(this.activeTabs.keys());
  }
}
