// ============================================================================
// Capsule/MiniApp Browser System
// ============================================================================
// Enhanced browser that supports multiple content types:
// - Web: Traditional URL-based browsing via webview
// - A2UI: Agent-generated UI via JSON payloads
// - Miniapp: Capsule-based mini applications
// - Component: Direct React component rendering
// ============================================================================

'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  X,
  Globe,
  Lock,
  Terminal,
  SquaresFour,
  PuzzlePiece as Puzzle,
  DotsThreeOutline,
  ArrowsClockwise,
  CaretLeft,
  CaretRight,
  House,
  Star,
  Warning,
} from '@phosphor-icons/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isElectronShell, getWebProxyUrl } from '@/lib/platform';

// Store and Types
import { useBrowserStore, useActiveTab, parseBrowserInput } from './browser.store';
import type { BrowserTab, WebTab, A2UITab, MiniappTab, ComponentTab, A2UIPayload } from './browser.types';

// Extension Bridge
import { useExtensionBridge } from './useExtensionBridge';

// A2UI Renderer
import { A2UIRenderer } from '../a2ui/A2UIRenderer';

// Design System
import { GlassCard } from '../../design/GlassCard';

// ============================================================================
// Utility Functions
// ============================================================================

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Get icon for tab based on content type */
function TabIcon({ tab, className }: { tab: BrowserTab; className?: string }) {
  switch (tab.contentType) {
    case 'web':
      return <Globe className={cn('w-4 h-4', className)} />;
    case 'a2ui':
      return <SquaresFour className={cn('w-4 h-4', className)} />;
    case 'miniapp':
      return <Puzzle className={cn('w-4 h-4', className)} />;
    case 'component':
      return <Terminal className={cn('w-4 h-4', className)} />;
    default:
      return <Globe className={cn('w-4 h-4', className)} />;
  }
}

/** Get URL display string based on tab type */
function getTabUrl(tab: BrowserTab): string {
  switch (tab.contentType) {
    case 'web':
      return (tab as WebTab).url;
    case 'a2ui':
      return `a2ui://${(tab as A2UITab).source || 'local'}`;
    case 'miniapp':
      return `miniapp://${(tab as MiniappTab).capsuleId}`;
    case 'component':
      return `component://${(tab as ComponentTab).componentId}`;
    default:
      return '';
  }
}

// ============================================================================
// Tab Bar Component
// ============================================================================

function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useBrowserStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="flex items-center gap-2 mb-3">
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            onMouseDown={(e) => e.button === 1 && closeTab(tab.id)} // Middle click to close
            className={cn(
              'group flex items-center gap-2 px-3 py-2 rounded-lg min-w-[140px] max-w-[200px]',
              'cursor-pointer transition-all duration-150 select-none',
              'border',
              tab.id === activeTabId
                ? 'bg-[var(--glass-bg-elevated)] border-[var(--border-hover)]'
                : 'bg-[var(--glass-bg-base)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]'
            )}
          >
            <TabIcon tab={tab} className="shrink-0 opacity-70" />
            <span className="flex-1 truncate text-sm font-medium">{tab.title}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--glass-bg-hover)] transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* New Tab Button */}
      <button
        onClick={() => addTab('https://www.google.com', 'New Tab')}
        className="p-2 rounded-lg bg-[var(--glass-bg-base)] border border-[var(--border-subtle)]
                   hover:bg-[var(--glass-bg-hover)] hover:border-[var(--border-hover)]
                   transition-colors shrink-0"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

// ============================================================================
// Navigation Bar Component
// ============================================================================

function NavigationBar() {
  const { tabs, activeTabId, updateTab, addTab } = useBrowserStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [inputValue, setInputValue] = useState('');

  // Update input when tab changes
  useEffect(() => {
    if (activeTab) {
      setInputValue(getTabUrl(activeTab));
    }
  }, [activeTab?.id]);

  const handleNavigate = useCallback(() => {
    if (!activeTabId || !inputValue.trim()) return;

    const parsed = parseBrowserInput(inputValue);

    if (parsed.type === 'web') {
      updateTab(activeTabId, { url: parsed.resource });
    }
    // For other types, we'd need specific handling
  }, [activeTabId, inputValue, updateTab]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNavigate();
    }
  };

  const handleRefresh = () => {
    // For web tabs, reload the webview
    const webview = document.querySelector('webview');
    if (webview && (webview as any).reload) {
      (webview as any).reload();
    }
  };

  const showWebNav = activeTab?.contentType === 'web';

  return (
    <GlassCard style={{ padding: 8, marginBottom: 12 }}>
      <div className="flex items-center gap-2">
        {/* Web Navigation Controls */}
        {showWebNav && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const webview = document.querySelector('webview');
                if (webview && (webview as any).canGoBack) {
                  (webview as any).goBack();
                }
              }}
              className="p-1.5 rounded-md hover:bg-[var(--glass-bg-hover)] text-[var(--text-tertiary)]"
            >
              <CaretLeft size={16} />
            </button>
            <button
              onClick={() => {
                const webview = document.querySelector('webview');
                if (webview && (webview as any).canGoForward) {
                  (webview as any).goForward();
                }
              }}
              className="p-1.5 rounded-md hover:bg-[var(--glass-bg-hover)] text-[var(--text-tertiary)]"
            >
              <CaretRight size={16} />
            </button>
          </div>
        )}

        {/* URL/Input Bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
          <Lock className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleNavigate}
            placeholder="Enter URL, search, or use a2ui://, miniapp://, component://"
            className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)]
                       placeholder:text-[var(--text-tertiary)]"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          {showWebNav && (
            <button
              onClick={handleRefresh}
              className="p-1.5 rounded-md hover:bg-[var(--glass-bg-hover)] text-[var(--text-tertiary)]"
            >
              <ArrowsClockwise size={16} />
            </button>
          )}
          <button
            onClick={() => addTab('https://www.google.com', 'New Tab')}
            className="p-1.5 rounded-md hover:bg-[var(--glass-bg-hover)] text-[var(--text-tertiary)]"
          >
            <House size={16} />
          </button>
        </div>
      </div>
    </GlassCard>
  );
}

// ============================================================================
// Content Renderers
// ============================================================================

/** Web content renderer using Electron webview */
function WebContent({ tab }: { tab: WebTab }) {
  const webviewRef = useRef<HTMLElement>(null);

  // Ensure URL has protocol
  const url = useMemo(() => {
    if (!tab.url) return 'about:blank';
    if (!tab.url.match(/^https?:\/\//)) {
      return 'https://' + tab.url;
    }
    return tab.url;
  }, [tab.url]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'white', borderRadius: 8, overflow: 'hidden' }}>
      {isElectronShell() ? (
        /* @ts-ignore - webview is Electron specific */
        <webview
          ref={webviewRef}
          src={url}
          style={{ width: '100%', height: '100%', border: 'none' }}
          /* @ts-ignore - webview attributes */
          allowpopups="true"
          /* @ts-ignore - webview attributes  */
          webpreferences="contextIsolation=yes,nodeIntegration=no"
        />
      ) : (
        /* Proxy through Terminal Server to strip X-Frame-Options */
        <iframe
          src={getWebProxyUrl(url)}
          style={{ width: '100%', height: '100%', border: 'none' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      )}
    </div>
  );
}

/** A2UI content renderer */
function A2UIContent({ tab }: { tab: A2UITab }) {
  const { updateTab } = useBrowserStore();

  const handleAction = useCallback(
    (actionId: string, payload?: Record<string, unknown>) => {
      console.log('[Browser:A2UI] Action triggered:', actionId, payload);
      // Here you would typically send the action to the agent or backend
      // For now, just log it
    },
    []
  );

  const handleDataModelChange = useCallback(
    (dataModel: Record<string, unknown>) => {
      // Optionally persist data model changes
      console.log('[Browser:A2UI] Data model changed:', dataModel);
    },
    []
  );

  return (
    <div className="w-full h-full overflow-auto p-4">
      <A2UIRenderer
        payload={tab.payload}
        onAction={handleAction}
        onDataModelChange={handleDataModelChange}
      />
    </div>
  );
}

/** Miniapp content renderer */
function MiniappContent({ tab }: { tab: MiniappTab }) {
  const { manifest, entryPoint } = tab;

  // Render based on entry type
  switch (manifest.entry.type) {
    case 'a2ui':
      // If the miniapp uses A2UI, render the A2UI surfaces
      if (manifest.surfaces) {
        const payload: A2UIPayload = {
          version: manifest.version,
          surfaces: manifest.surfaces,
          dataModel: manifest.entry.initialData || {},
          actions: manifest.actions,
        };
        return (
          <div className="w-full h-full overflow-auto p-4">
            <A2UIRenderer
              payload={payload}
              initialDataModel={manifest.entry.initialData}
            />
          </div>
        );
      }
      break;

    case 'html':
      return (
        <div className="relative w-full h-full bg-white rounded-lg overflow-hidden">
          {/* @ts-ignore - webview is Electron specific */}
          <webview
            src={manifest.entry.src}
            className="w-full h-full border-none"
            allowpopups={true}
          />
        </div>
      );

    case 'component':
      // Would need a component registry to resolve and render
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <Puzzle className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-[var(--text-secondary)]">Component miniapps not yet implemented</p>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">Entry: {manifest.entry.src}</p>
          </div>
        </div>
      );
  }

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <Warning className="w-12 h-12 mx-auto mb-4 text-yellow-500 opacity-50" />
        <p className="text-[var(--text-secondary)]">Unknown miniapp entry type</p>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">{manifest.entry.type}</p>
      </div>
    </div>
  );
}

/** Component content renderer */
function ComponentContent({ tab }: { tab: ComponentTab }) {
  // Would need a component registry to resolve and render
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="text-center">
        <Terminal className="w-12 h-12 mx-auto mb-4 opacity-30" />
        <p className="text-[var(--text-secondary)]">Component rendering</p>
        <p className="text-sm text-[var(--text-tertiary)] mt-1">ID: {tab.componentId}</p>
        {tab.props && (
          <pre className="mt-4 p-3 rounded-lg bg-[var(--bg-secondary)] text-xs text-left max-w-md">
            {JSON.stringify(tab.props, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

/** Main content dispatcher */
function TabContent({ tab }: { tab: BrowserTab }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {(() => {
        switch (tab.contentType) {
          case 'web':
            return <WebContent tab={tab as WebTab} />;
          case 'a2ui':
            return <A2UIContent tab={tab as A2UITab} />;
          case 'miniapp':
            return <MiniappContent tab={tab as MiniappTab} />;
          case 'component':
            return <ComponentContent tab={tab as ComponentTab} />;
          default:
            return (
              <div className="w-full h-full flex items-center justify-center text-[var(--text-tertiary)]">
                Unknown content type
              </div>
            );
        }
      })()}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

function EmptyState() {
  const { addTab } = useBrowserStore();

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center">
        <Globe className="w-16 h-16 mx-auto mb-6 opacity-20" />
        <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">No tabs open</h3>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Open a new tab to start browsing
        </p>
        <button
          onClick={() => addTab('https://www.google.com', 'Google')}
          className="px-4 py-2 rounded-lg bg-[var(--accent-chat)] text-white font-medium
                     hover:opacity-90 transition-opacity"
        >
          Open New Tab
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Browser Capsule Component
// ============================================================================

export function BrowserCapsule() {
  const { tabs, activeTabId, consoleOpen, toggleConsole } = useBrowserStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  
  // Initialize extension bridge for direct Chrome extension communication
  const { isConnected: isExtensionConnected } = useExtensionBridge();

  return (
    <div className="h-full flex flex-col p-3">
      {/* Tab Bar */}
      <TabBar />

      {/* Navigation Bar */}
      <NavigationBar />

      {/* Content Area */}
      <GlassCard style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {activeTab ? (
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <TabContent tab={activeTab} />
            </div>
          ) : (
            <EmptyState />
          )}

          {/* Console Toggle Button */}
          <button
            onClick={toggleConsole}
            className={cn(
              'absolute bottom-4 right-4 p-2 rounded-lg transition-colors z-10',
              consoleOpen
                ? 'bg-[var(--accent-chat)] text-white'
                : 'bg-[var(--glass-bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            <Terminal size={16} />
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

// ============================================================================
// Demo/Test Functions
// ============================================================================

/** Sample A2UI payload for testing */
export const sampleA2UIPayload: A2UIPayload = {
  version: '1.0.0',
  surfaces: [
    {
      id: 'main',
      name: 'Dashboard',
      root: {
        type: 'Container',
        props: {
          direction: 'column',
          gap: 16,
          padding: 24,
          children: [
            {
              type: 'Card',
              props: {
                title: 'Welcome to A2UI',
                subtitle: 'Agent-generated user interface',
                children: [
                  {
                    type: 'Text',
                    props: {
                      content: 'This UI was generated by an AI agent using the A2UI protocol.',
                      variant: 'body',
                    },
                  },
                ],
              },
            },
            {
              type: 'Stack',
              props: {
                direction: 'horizontal',
                gap: 12,
                children: [
                  {
                    type: 'Button',
                    props: {
                      label: 'Primary Action',
                      variant: 'primary',
                      action: 'primary-click',
                    },
                  },
                  {
                    type: 'Button',
                    props: {
                      label: 'Secondary',
                      variant: 'secondary',
                      action: 'secondary-click',
                    },
                  },
                ],
              },
            },
            {
              type: 'Card',
              props: {
                title: 'Form Example',
                children: [
                  {
                    type: 'TextField',
                    props: {
                      label: 'Your Name',
                      placeholder: 'Enter your name...',
                      valuePath: 'form.name',
                    },
                  },
                  {
                    type: 'TextField',
                    props: {
                      label: 'Email',
                      placeholder: 'Enter your email...',
                      type: 'email',
                      valuePath: 'form.email',
                    },
                  },
                ],
              },
            },
            {
              type: 'Alert',
              props: {
                title: 'Info',
                message: 'This is an example alert component.',
                variant: 'info',
                dismissible: true,
              },
            },
          ],
        },
      },
    },
  ],
  dataModel: {
    form: {
      name: '',
      email: '',
    },
  },
  actions: [
    { id: 'primary-click', type: 'ui', handler: 'handlePrimary' },
    { id: 'secondary-click', type: 'ui', handler: 'handleSecondary' },
  ],
};

/** Function to open a sample A2UI tab for testing */
export function openSampleA2UITab() {
  const { addA2UITab } = useBrowserStore.getState();
  addA2UITab(sampleA2UIPayload as any, 'A2UI Demo', 'demo');
}

export default BrowserCapsule;
