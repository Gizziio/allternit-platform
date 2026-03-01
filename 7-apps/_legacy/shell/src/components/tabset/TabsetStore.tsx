import React, { createContext, useContext, useState, useCallback } from 'react';

interface Tab {
  id: string;
  windowId: string;
  title: string;
  type: string;
}

interface Tabset {
  id: string;
  name: string;
  tabs: Tab[];
}

interface TabsetStoreContextValue {
  tabsets: Tabset[];
  activeTabsetId: string | null;
  addTab: (tabsetId: string, tab: Tab) => void;
  removeTab: (tabsetId: string, tabId: string) => void;
  setActiveTabset: (id: string) => void;
}

const TabsetStoreContext = createContext<TabsetStoreContextValue | null>(null);

export const useTabsetStore = () => {
  const context = useContext(TabsetStoreContext);
  if (!context) throw new Error('useTabsetStore must be used within TabsetStoreProvider');
  return context;
};

export const TabsetStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tabsets, setTabsets] = useState<Tabset[]>([
    { id: 'default', name: 'Workspace 1', tabs: [] }
  ]);
  const [activeTabsetId, setActiveTabsetId] = useState<string | null>('default');

  const addTab = useCallback((tabsetId: string, tab: Tab) => {
    setTabsets(prev => prev.map(ts => {
      if (ts.id === tabsetId) {
        // Prevent duplicate tabs for same window
        if (ts.tabs.find(t => t.windowId === tab.windowId)) return ts;
        return { ...ts, tabs: [...ts.tabs, tab] };
      }
      return ts;
    }));
  }, []);

  const removeTab = useCallback((tabsetId: string, tabId: string) => {
    setTabsets(prev => prev.map(ts => {
      if (ts.id === tabsetId) {
        return { ...ts, tabs: ts.tabs.filter(t => t.id !== tabId) };
      }
      return ts;
    }));
  }, []);

  const setActiveTabset = useCallback((id: string) => {
    setActiveTabsetId(id);
  }, []);

  return (
    <TabsetStoreContext.Provider value={{ tabsets, activeTabsetId, addTab, removeTab, setActiveTabset }}>
      {children}
    </TabsetStoreContext.Provider>
  );
};
