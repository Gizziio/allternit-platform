import React, { useEffect } from 'react';
import { useTabsetStore } from './TabsetStore';
import { Tab } from './Tab';
import { useWindowManager } from '../windowing/WindowManager';
import { proofRecorder } from '../../proof/ProofRecorder'; // Import proofRecorder

export const TabStrip: React.FC = () => {
  const { tabsets, activeTabsetId, removeTab } = useTabsetStore();
  const { restoreWindow, focusWindow, state: { focusedWindowId } } = useWindowManager();

  useEffect(() => {
    proofRecorder.mark('TabStrip mounted');
    console.log('[PROOF] TabStrip mounted');
  }, []);

  const activeTabset = tabsets.find(ts => ts.id === activeTabsetId);

  if (!activeTabset) return null;

  const handleTabClick = (windowId: string) => {
    restoreWindow(windowId);
    focusWindow(windowId);
  };

  const handleTabClose = (tabId: string, windowId: string) => {
    removeTab(activeTabset.id, tabId);
    // Optionally close the window too? 
    // The prompt says "Tabs can be closed (policy: minimize vs close)."
    // We'll just leave it tabbed but removed from strip for now, or just minimize it.
  };

  return (
    <div
      className="workspace-tab-strip"
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '4px',
        padding: '0 8px',
        height: '36px',
        backgroundColor: 'rgba(10, 10, 10, 0.5)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      {activeTabset.tabs.map(tab => (
        <Tab
          key={tab.id}
          id={tab.id}
          title={tab.title}
          type={tab.type}
          isActive={tab.windowId === focusedWindowId}
          onClick={() => handleTabClick(tab.windowId)}
          onClose={() => handleTabClose(tab.id, tab.windowId)}
        />
      ))}
    </div>
  );
};
