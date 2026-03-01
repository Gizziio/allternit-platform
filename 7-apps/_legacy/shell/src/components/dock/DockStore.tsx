import React, { createContext, useContext, useState, useCallback } from 'react';

export type CapsuleType = 'browser' | 'inspector' | 'agent-steps' | 'studio' | 'templates' | 'artifacts' | string;

interface DockItem {
  id: string;
  capsuleId?: string;
  type: CapsuleType;
  title: string;
  isPinned: boolean;
  isMinimized: boolean;
  isRecent: boolean;
  windowId?: string;
}

interface DockStoreContextValue {
  items: DockItem[];
  pinnedTypes: CapsuleType[];
  pinType: (type: CapsuleType) => void;
  unpinType: (type: CapsuleType) => void;
  addRecent: (item: Omit<DockItem, 'isRecent' | 'isPinned' | 'isMinimized'>) => void;
}

const DockStoreContext = createContext<DockStoreContextValue | null>(null);

export const useDockStore = () => {
  const context = useContext(DockStoreContext);
  if (!context) throw new Error('useDockStore must be used within DockStoreProvider');
  return context;
};

export const DockStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pinnedTypes, setPinnedTypes] = useState<CapsuleType[]>(['browser', 'inspector']);
  const [recents, setRecents] = useState<DockItem[]>([]);

  const pinType = useCallback((type: CapsuleType) => {
    setPinnedTypes(prev => prev.includes(type) ? prev : [...prev, type]);
  }, []);

  const unpinType = useCallback((type: CapsuleType) => {
    setPinnedTypes(prev => prev.filter(t => t !== type));
  }, []);

  const addRecent = useCallback((item: Omit<DockItem, 'isRecent' | 'isPinned' | 'isMinimized'>) => {
    setRecents(prev => {
      const filtered = prev.filter(i => i.id !== item.id);
      return [{ ...item, isRecent: true, isPinned: false, isMinimized: false }, ...filtered].slice(0, 10);
    });
  }, []);

  // items is a computed list of pinned + recents + (maybe we should inject minimized from WindowManager here?)
  // Actually, DockBar can consume both WindowManager and DockStore.
  
  return (
    <DockStoreContext.Provider value={{ items: recents, pinnedTypes, pinType, unpinType, addRecent }}>
      {children}
    </DockStoreContext.Provider>
  );
};
