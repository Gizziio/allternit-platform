import React, { useMemo, useEffect } from 'react';
import { useWindowManager } from '../windowing/WindowManager';
import { useDockStore } from './DockStore';
import { DockItem } from './DockItem';
import { proofRecorder } from '../../proof/ProofRecorder'; // Import proofRecorder

export const DockBar: React.FC = () => {
  useEffect(() => {
    proofRecorder.mark('DockBar mounted');
    console.log('[PROOF] DockBar mounted');
  }, []);
  const { state: { windows, focusedWindowId }, restoreWindow, focusWindow } = useWindowManager();
  const { pinnedTypes } = useDockStore();

  const dockItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: string;
      title: string;
      isMinimized: boolean;
      isActive: boolean;
      windowId?: string;
    }> = [];

    // Add pinned types first
    pinnedTypes.forEach(type => {
      // Check if there is a window of this type
      const window = Array.from(windows.values()).find(w => {
        // This is a bit heuristic, we might need a better mapping
        return w.title?.toLowerCase().includes(type) || w.capsuleId === type;
      });

      items.push({
        id: `pinned-${type}`,
        type,
        title: type.charAt(0).toUpperCase() + type.slice(1),
        isMinimized: window?.state === 'minimized',
        isActive: window?.id === focusedWindowId,
        windowId: window?.id
      });
    });

    // Add other windows that are minimized or open but not pinned
    windows.forEach(window => {
      const isAlreadyAdded = items.some(item => item.windowId === window.id);
      if (!isAlreadyAdded) {
        // Find type from title or capsuleId
        const type = window.capsuleId || 'browser'; 
        items.push({
          id: window.id,
          type,
          title: window.title || 'Capsule',
          isMinimized: window.state === 'minimized',
          isActive: window.id === focusedWindowId,
          windowId: window.id
        });
      }
    });

    return items;
  }, [windows, focusedWindowId, pinnedTypes]);

  const handleItemClick = (item: typeof dockItems[0]) => {
    if (item.windowId) {
      if (item.isMinimized) {
        restoreWindow(item.windowId);
      }
      focusWindow(item.windowId);
    } else {
      // Spawning new capsule logic would go here
      console.log('Spawn new capsule of type:', item.type);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '8px',
        padding: '8px',
        backgroundColor: 'rgba(15, 15, 15, 0.8)',
        backdropFilter: 'blur(12px)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        zIndex: 10000,
      }}
    >
      {dockItems.map(item => (
        <DockItem
          key={item.id}
          id={item.id}
          type={item.type}
          title={item.title}
          isMinimized={item.isMinimized}
          isActive={item.isActive}
          onClick={() => handleItemClick(item)}
        />
      ))}
    </div>
  );
};
