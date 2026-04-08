/**
 * Orca Tab Bar
 * 
 * Tabbed interface for multiple open documents
 */

import React from 'react';
import { OpenTab } from './types';
import { cn } from './cn';
import { X, FileText, Circle } from '@phosphor-icons/react';

interface TabBarProps {
  tabs: OpenTab[];
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onTabCloseOthers: (tabId: string) => void;
  onTabCloseAll: () => void;
  onTabCloseToRight: (tabId: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  onTabSelect,
  onTabClose,
  onTabCloseOthers,
  onTabCloseAll,
  onTabCloseToRight,
}) => {
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; tab: OpenTab } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, tab: OpenTab) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tab });
  };

  return (
    <>
      <div className="flex items-center overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab)}
            className={cn(
              'group flex items-center gap-2 px-3 py-2 min-w-[120px] max-w-[200px] text-sm transition-colors border-r border-zinc-800',
              tab.isActive
                ? 'bg-zinc-800/50 text-zinc-200'
                : 'bg-transparent text-zinc-500 hover:bg-zinc-800/30 hover:text-zinc-300'
            )}
          >
            <FileText size={14} className={tab.isModified ? 'text-yellow-500' : ''} />
            <span className="flex-1 truncate text-left">{tab.title}</span>
            {tab.isModified && <Circle size={6} weight="fill" className="text-yellow-500" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 rounded"
            >
              <X size={12} />
            </button>
          </button>
        ))}
        
        {tabs.length === 0 && (
          <div className="px-3 py-2 text-sm text-zinc-600 italic">
            No open files
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed z-50 py-1 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl min-w-[160px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                onTabSelect(contextMenu.tab.id);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Switch to Tab
            </button>
            <div className="my-1 border-t border-zinc-800" />
            <button
              onClick={() => {
                onTabCloseOthers(contextMenu.tab.id);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Close Others
            </button>
            <button
              onClick={() => {
                onTabCloseToRight(contextMenu.tab.id);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Close to the Right
            </button>
            <button
              onClick={() => {
                onTabCloseAll();
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
            >
              Close All
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default TabBar;
