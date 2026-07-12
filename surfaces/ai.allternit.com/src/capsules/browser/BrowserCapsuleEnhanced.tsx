import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowsClockwise,
  Camera,
  CaretDown,
  CaretLeft,
  CaretRight,
  CircleNotch,
  Copy,
  DotsThreeVertical,
  DownloadSimple,
  GearSix,
  Globe,
  Lock,
  MagnifyingGlass,
  Minus,
  Plus,
  PushPin as Pin,
  PuzzlePiece as Puzzle,
  Shield,
  Sparkle,
  SquaresFour,
  Star,
  Trash,
  Warning,
  X,
} from "@phosphor-icons/react";

// @ts-nocheck
/**
 * BrowserCapsuleEnhanced - P5.2.2
 * Chrome-style browser with Claude-style chat sidebar
 *
 * Migrated to Tailwind CSS for architectural compliance.
 */

"use client";
import { AllternitLogo } from '@/components/AllternitLogo';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';
import { isElectronShell, getWebProxyUrl } from '@/lib/platform';
import { cn } from '@/lib/utils';

import {
  BROWSER_CHAT_PANE_MIN_WIDTH,
  useBrowserStore,
} from './browser.store';
import { BrowserTab, WebTab, A2UITab, A2UIPayload } from './browser.types';
import { useBrowserAgentStore } from './browserAgent.store';
import { BrowserAgentMode } from './browserAgent.types';
import { A2UIRenderer } from '../a2ui/A2UIRenderer';
import { useSidecarStore } from '../../stores/sidecar-store';
import { useBrowserShortcutsStore, getFaviconUrl } from './browserShortcuts.store';

import { ACIGlassPill } from './ACIGlassPill';
import { BrowserAgentOverlay } from './BrowserAgentOverlay';
import { BrowserChatPane } from './BrowserChatPane';
import { ACIComputerUseView } from './ACIComputerUseView';
import { PageAgentTakeoverOverlay } from './PageAgentTakeoverOverlay';
import { useExtensionBridge } from './useExtensionBridge';
import { m, LazyMotion, domAnimation, AnimatePresence } from 'framer-motion';
import { BrowserIframeSkeleton } from './BrowserIframeSkeleton';
import { BrowserNewTabPage } from './BrowserNewTabPage';
import { BrowserFindBar } from './BrowserFindBar';
import { BrowserDownloadBar } from './BrowserDownloadBar';

// ============================================================================
// Types & Constants
// ============================================================================

export interface BrowserCapsuleEnhancedProps {
  initialUrl?: string;
  agentMode?: 'guided' | 'autonomous';
  guidanceMessages?: string[];
  onHumanCheckpoint?: () => void;
}

export const sampleA2UIPayload: A2UIPayload = {
  version: '1.0.0',
  surfaces: [{
    id: 'main', name: 'Demo',
    root: {
      type: 'Container',
      props: {
        direction: 'column', gap: 16, padding: 24,
        children: [{
          type: 'Card',
          props: {
            title: '✨ A2UI Enhanced Browser', subtitle: 'Multi-Mode Support',
            children: [{ type: 'Text', props: { content: 'This browser supports Web, Canvas, and A2UI Studio modes.' } }],
          },
        }],
      },
    },
  }],
};

type ContentMode = 'web' | 'canvas' | 'studio';

function isTrustedOfficeHost(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return [
      'word.office.com',
      'excel.office.com',
      'powerpoint.office.com',
      'office.com',
      'microsoft365.com',
      'login.microsoftonline.com',
    ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

// ============================================================================
// Extension Store (Zustand with persist)
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createModuleLogger } from '@/lib/logger';
const logger = createModuleLogger('BrowserCapsuleEnhanced');

type PermissionValue = 'allow' | 'block' | 'ask';

interface BrowserExtension {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  version: string;
  // Real install fields
  chromeStoreId?: string;
  storeUrl?: string;
  installStatus?: 'not-installed' | 'pending' | 'installed' | 'error';
  // Per-extension permission settings
  permissions?: Record<string, PermissionValue>;
}

const CLAUDE_CHROME_STORE_ID = 'claude-chrome-store-id';

const EXTENSION_PERMISSIONS = [
  { key: 'cookies',       label: 'Cookies & Site Data',  icon: '🍪' },
  { key: 'scripts',       label: 'JavaScript / Scripts',  icon: '⚡' },
  { key: 'notifications', label: 'Notifications',         icon: '🔔' },
  { key: 'camera',        label: 'Camera',                icon: '📷' },
  { key: 'microphone',    label: 'Microphone',            icon: '🎙️' },
  { key: 'location',      label: 'Location',              icon: '📍' },
  { key: 'clipboard',     label: 'Clipboard',             icon: '📋' },
  { key: 'downloads',     label: 'Downloads',             icon: '⬇️' },
] as const;

interface CatalogExtension {
  catalogId: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  chromeStoreId: string;
  storeUrl: string;
  featured?: boolean;
  publisher?: string;
}

// Curated extension catalog — featured extensions available to install
const EXTENSION_CATALOG: CatalogExtension[] = [
  {
    catalogId: 'claude-in-chrome',
    name: 'Claude in Chrome',
    description: 'AI assistant that automates web tasks, fills forms, navigates sites & runs multi-step workflows',
    icon: '🤖',
    version: 'latest',
    chromeStoreId: 'fcoeoabgfenejglbffodgkkbkcdhcgfn',
    storeUrl: 'https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn',
    featured: true,
    publisher: 'Anthropic',
  },
  {
    catalogId: 'ublock-origin',
    name: 'uBlock Origin',
    description: 'Efficient ad blocker — fast, lightweight, and privacy-first',
    icon: '🛡️',
    version: 'latest',
    chromeStoreId: 'cjpalhdlnbpafiamejdnhcphjbkeiagm',
    storeUrl: 'https://chromewebstore.google.com/detail/ublock-origin/cjpalhdlnbpafiamejdnhcphjbkeiagm',
    featured: false,
    publisher: 'Raymond Hill',
  },
  {
    catalogId: '1password',
    name: '1Password',
    description: 'Password manager & digital wallet for secure autofill across all sites',
    icon: '🔑',
    version: 'latest',
    chromeStoreId: 'aeblfdkhhhdcdjpifhhbdiojplfjncoa',
    storeUrl: 'https://chromewebstore.google.com/detail/1password-password-manage/aeblfdkhhhdcdjpifhhbdiojplfjncoa',
    featured: false,
    publisher: '1Password',
  },
  {
    catalogId: 'grammarly',
    name: 'Grammarly',
    description: 'AI writing assistant that checks grammar, spelling, and style in real time',
    icon: '✏️',
    version: 'latest',
    chromeStoreId: 'kbfnbcaeplbcioakkpcpgfkobkghlhen',
    storeUrl: 'https://chromewebstore.google.com/detail/grammarly-grammar-checker/kbfnbcaeplbcioakkpcpgfkobkghlhen',
    featured: false,
    publisher: 'Grammarly',
  },
];

interface ExtensionsStore {
  extensions: BrowserExtension[];
  addExtension: (ext: Omit<BrowserExtension, 'id'>) => void;
  removeExtension: (id: string) => void;
  toggleExtension: (id: string) => void;
  setEnabled: (id: string, enabled: boolean) => void;
  updateExtension: (id: string, patch: Partial<BrowserExtension>) => void;
  setExtensionPermission: (id: string, permKey: string, value: PermissionValue) => void;
}

const DEFAULT_EXTENSIONS: BrowserExtension[] = [
  { id: 'allternit-agent', name: 'Allternit Computer Agent', description: 'AI-powered computer automation', icon: '🤖', enabled: true, version: '1.0.0', installStatus: 'installed' },
];

const useExtensionsStore = create<ExtensionsStore>()(
  persist(
    (set) => ({
      extensions: DEFAULT_EXTENSIONS,
      addExtension: (ext) =>
        set((state) => ({
          extensions: [...state.extensions, { ...ext, id: `ext-${Date.now()}` }],
        })),
      removeExtension: (id) =>
        set((state) => ({
          extensions: state.extensions.filter((e) => e.id !== id),
        })),
      toggleExtension: (id) =>
        set((state) => ({
          extensions: state.extensions.map((e) =>
            e.id === id ? { ...e, enabled: !e.enabled } : e
          ),
        })),
      setEnabled: (id, enabled) =>
        set((state) => ({
          extensions: state.extensions.map((e) =>
            e.id === id ? { ...e, enabled } : e
          ),
        })),
      updateExtension: (id, patch) =>
        set((state) => ({
          extensions: state.extensions.map((e) =>
            e.id === id ? { ...e, ...patch } : e
          ),
        })),
      setExtensionPermission: (id, permKey, value) =>
        set((state) => ({
          extensions: state.extensions.map((e) =>
            e.id === id
              ? { ...e, permissions: { ...(e.permissions ?? {}), [permKey]: value } }
              : e
          ),
        })),
    }),
    { name: 'allternit.browser.extensions' }
  )
);

// ============================================================================
// Canvas / Studio placeholders
// ============================================================================

function CanvasMode({ tab }: { tab?: A2UITab }) {
  if (tab) return <div className="size-full overflow-auto"><A2UIRenderer payload={tab.payload} /></div>;
  return (
    <div className="size-full flex flex-col p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="size-10 rounded bg-[#a855f7]/10 flex items-center justify-center border border-solid border-[#a855f7]/20">
          <SquaresFour className="size-5 text-[#a855f7]/60" />
        </div>
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.3em] text-[#a855f7]/80">Canvas_Surface</div>
        </div>
      </div>
      <div className="flex-1 bg-[var(--surface-hover)] rounded border border-solid border-[var(--surface-hover)] flex items-center justify-center">
        <div className="text-center opacity-10">
          <SquaresFour className="size-16 mx-auto mb-4" />
          <p className="text-[12px] font-mono uppercase tracking-[0.5em]">Waiting_for_signal…</p>
        </div>
      </div>
    </div>
  );
}

function StudioMode() {
  return (
    <div className="size-full flex flex-col p-8">
      <div className="flex items-center gap-4 mb-8">
        <div className="size-10 rounded bg-[var(--status-warning-bg)] flex items-center justify-center border border-solid border-[#f59e0b]/20">
          <Sparkle className="size-5 text-[#f59e0b]/60" />
        </div>
        <div>
          <div className="text-[12px] font-black uppercase tracking-[0.3em] text-[#f59e0b]/80">A2UI_Studio</div>
        </div>
      </div>
      <div className="flex-1 bg-[var(--surface-hover)] rounded border border-solid border-[var(--surface-hover)] flex items-center justify-center">
        <div className="text-center opacity-10">
          <Sparkle className="size-16 mx-auto mb-4" />
          <p className="text-[12px] font-mono uppercase tracking-[0.5em]">Initialize_Workspace…</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Tab Overflow Dropdown
// ============================================================================

function TabOverflowDropdown({ open, onClose, tabs, activeTabId, onSelect, onCloseTab }: {
  open: boolean; onClose: () => void; tabs: BrowserTab[]; activeTabId: string | null;
  onSelect: (id: string) => void; onCloseTab: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-56 max-h-[288px] overflow-y-auto bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-lg shadow-md z-[50] py-1">
      <div className="px-3 py-1.5 text-[12px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Open Tabs ({tabs.length})</div>
      {tabs.map((tab) => (
        <div role="button" tabIndex={0} key={tab.id} 
          onClick={() => { onSelect(tab.id); onClose(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onSelect(tab.id); onClose(); } }}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[12px] truncate",
            tab.id === activeTabId ? "bg-[var(--bg-active)] text-[var(--text-primary)]" : "bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"
          )}>
          <TabFavicon url={tab.contentType === 'web' ? (tab as WebTab).url : undefined} size={12} />
          <span className="flex-1 truncate">{tab.title || 'New Tab'}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }} className="p-0.5 rounded hover:bg-black/10 opacity-40 border-none bg-transparent cursor-pointer text-inherit">
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Tab Favicon Component
// ============================================================================

function TabFavicon({ url, size = 12 }: { url?: string; size?: number }) {
  const [error, setError] = useState(false);
  const faviconSrc = useMemo(() => {
    if (!url) return '';
    return getFaviconUrl(url, 32);
  }, [url]);

  if (!url || !faviconSrc || error) {
    return <Globe size={size} className="shrink-0 opacity-50" />;
  }

  return (
    <img
      src={faviconSrc}
      alt=""
      onError={() => setError(true)}
      width={size}
      height={size}
      className="shrink-0 rounded-sm"
    />
  );
}

// ============================================================================
// Tab Context Menu
// ============================================================================

const GROUP_COLORS = ['#69A8C8', '#A78BFA', '#79C47C', 'var(--accent-primary)', 'var(--status-warning)', 'var(--status-error)'];

function TabContextMenu({ x, y, tabId, onClose }: {
  x: number; y: number; tabId: string; onClose: () => void;
}) {
  const { closeTab, closeOtherTabs, closeTabsToRight, duplicateTab, pinTab, unpinTab, setTabGroup, removeTabFromGroup } = useBrowserStore();
  const tab = useBrowserStore((s) => s.tabs.find((t) => t.id === tabId));
  const allGroups = useBrowserStore((s) => {
    const groups = new Map<string, string>();
    s.tabs.forEach((t) => { if (t.group) groups.set(t.group, t.groupColor || '#69A8C8'); });
    return groups;
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const isPinned = tab?.pinned ?? false;
  const inGroup = !!tab?.group;
  const items = [
    { label: isPinned ? 'Unpin Tab' : 'Pin Tab', icon: <Pin className="size-3" />, action: () => isPinned ? unpinTab(tabId) : pinTab(tabId) },
    { label: 'Duplicate Tab', icon: <Copy className="size-3" />, action: () => duplicateTab(tabId) },
  ];

  const groupItems = Array.from(allGroups.entries()).map(([name, color]) => ({
    label: `Group: ${name}`,
    icon: <div className="size-2.5 rounded-[3px]" style={{ background: color }} />,
    action: () => setTabGroup(tabId, name, color),
    active: tab?.group === name,
  }));

  const newGroupItems = GROUP_COLORS.map((color, i) => ({
    label: `New Group ${i + 1}`,
    icon: <div className="size-2.5 rounded-[3px]" style={{ background: color }} />,
    action: () => setTabGroup(tabId, `Group ${i + 1}`, color),
  }));

  return (
    <div ref={ref} className="fixed w-[180px] bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-lg shadow-md z-[100] py-1 text-[12px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button type="button" key={`browser-idx-${i}`} onClick={() => { item.action(); onClose(); }}
          className="flex items-center gap-2 w-full px-3 py-1.5 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[12px] text-left hover:bg-[var(--bg-hover)] transition-colors">
          {item.icon}
          {item.label}
        </button>
      ))}
      <div className="h-px bg-[var(--text-tertiary)]/20 my-1 mx-2" />
      {groupItems.map((item, i) => (
        <button type="button" key={`g-${i}`} onClick={() => { item.action(); onClose(); }}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-1.5 border-none bg-transparent cursor-pointer text-[12px] text-left hover:bg-[var(--bg-hover)] transition-colors",
            item.active ? "text-[var(--accent-primary)] font-semibold bg-[var(--bg-active)]" : "text-[var(--text-secondary)]"
          )}>
          {item.icon}
          {item.label}
        </button>
      ))}
      {groupItems.length > 0 && <div className="h-px bg-[var(--text-tertiary)]/20 my-1 mx-2" />}
      {newGroupItems.map((item, i) => (
        <button type="button" key={`ng-${i}`} onClick={() => { item.action(); onClose(); }}
          className="flex items-center gap-2 w-full px-3 py-1.5 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[12px] text-left hover:bg-[var(--bg-hover)] transition-colors">
          {item.icon}
          {item.label}
        </button>
      ))}
      {inGroup && (
        <>
          <div className="h-px bg-[var(--text-tertiary)]/20 my-1 mx-2" />
          <button type="button" onClick={() => { removeTabFromGroup(tabId); onClose(); }}
            className="flex items-center gap-2 w-full px-3 py-1.5 border-none bg-transparent cursor-pointer text-[var(--text-tertiary)] text-[12px] text-left hover:bg-[var(--bg-hover)] transition-colors">
            <X className="size-3" />
            Remove from Group
          </button>
        </>
      )}
      <div className="h-px bg-[var(--text-tertiary)]/20 my-1 mx-2" />
      <button type="button" onClick={() => { closeTab(tabId); onClose(); }}
        className="flex items-center gap-2 w-full px-3 py-1.5 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[12px] text-left hover:bg-[var(--bg-hover)] transition-colors">
        <X className="size-3" />
        Close Tab
      </button>
      <button type="button" onClick={() => { closeOtherTabs(tabId); onClose(); }}
        className="flex items-center gap-2 w-full px-3 py-1.5 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[12px] text-left hover:bg-[var(--bg-hover)] transition-colors">
        <X className="size-3" />
        Close Other Tabs
      </button>
      <button type="button" onClick={() => { closeTabsToRight(tabId); onClose(); }}
        className="flex items-center gap-2 w-full px-3 py-1.5 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[12px] text-left hover:bg-[var(--bg-hover)] transition-colors">
        <CaretRight className="size-3" />
        Close Tabs to Right
      </button>
    </div>
  );
}

// ============================================================================
// URL Autocomplete Dropdown
// ============================================================================

function UrlAutocomplete({ query, onSelect, visible }: {
  query: string; onSelect: (url: string) => void; visible: boolean;
}) {
  const recentVisits = useBrowserStore((s) => s.recentVisits);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query || query.length < 2) return [];
    const q = query.toLowerCase();
    return recentVisits
      .filter((v) => v.url.toLowerCase().includes(q) || v.title.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, recentVisits]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div ref={ref} className="absolute left-0 right-0 top-full mt-1 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-lg shadow-md z-[100] py-1 max-h-[200px] overflow-y-auto">
      {filtered.map((visit, i) => (
        <button type="button" key={`browser-idx-${i}`} onClick={() => onSelect(visit.url)}
          className="flex items-center gap-3 w-full px-4 py-2 border-none bg-transparent cursor-pointer text-left hover:bg-[var(--bg-hover)] group transition-colors">
          <TabFavicon url={visit.url} size={14} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">{visit.title}</div>
            <div className="text-[11px] text-[var(--text-tertiary)] truncate">{visit.url}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Three-Dot Menu
// ============================================================================

interface MenuItemProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  color?: string;
  disabled?: boolean;
  onClick: () => void;
  onClose: () => void;
}

const MenuItem = ({ label, icon, active, color, disabled, onClick, onClose }: MenuItemProps) => (
  <button type="button" onClick={() => { onClick(); onClose(); }} disabled={disabled}
    className={cn(
      "flex items-center gap-2 w-full px-3 py-1.5 border-none bg-transparent text-[12px] text-left transition-colors",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[var(--bg-hover)]",
      color ? "" : active ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"
    )}
    style={color ? { color } : {}}
  >
    {icon || <div className={cn("size-1.5 rounded-full", active ? "bg-[var(--accent-primary)]" : "bg-transparent")} />}
    {label}
  </button>
);

function ThreeDotMenu({ open, onClose, contentMode, setContentMode, agentModeControl, setAgentMode, agentStatus, onNewTab, onToggleChatPane, chatPaneOpen, onCloseAllTabs, onScreenshot, zoomLevel, onZoomIn, onZoomOut, onZoomReset }: {
  open: boolean; onClose: () => void; contentMode: ContentMode; setContentMode: (m: ContentMode) => void;
  agentModeControl: BrowserAgentMode; setAgentMode: (m: BrowserAgentMode) => void; agentStatus: string;
  onNewTab: () => void; onToggleChatPane: () => void; chatPaneOpen: boolean; onCloseAllTabs: () => void;
  onScreenshot: () => void; zoomLevel: number; onZoomIn: () => void; onZoomOut: () => void; onZoomReset: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);
  if (!open) return null;

  return (
    <div ref={menuRef} className="absolute right-0 top-full mt-1 w-52 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-lg shadow-md z-[50] py-1 text-[14px]">
      <div className="px-3 py-1.5 text-[12px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">View Mode</div>
      {(['web', 'canvas', 'studio'] as ContentMode[]).map((m) => <MenuItem key={m} label={m.charAt(0).toUpperCase() + m.slice(1)} active={contentMode === m} onClick={() => setContentMode(m)} onClose={onClose} />)}
      <div className="h-px bg-[var(--text-tertiary)]/20 my-1 mx-2" />
      <div className="px-3 py-1.5 text-[12px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Agent Mode</div>
      {(['Human', 'Assist', 'Agent'] as BrowserAgentMode[]).map((m) => <MenuItem key={m} label={m} active={agentModeControl === m} disabled={agentStatus === 'Running'} onClick={() => setAgentMode(m)} onClose={onClose} />)}
      <div className="h-px bg-[var(--text-tertiary)]/20 my-1 mx-2" />
      <MenuItem label={chatPaneOpen ? 'Hide Chat Pane' : 'Open Chat Pane'} icon={<Sparkle className="size-3.5" />} onClick={onToggleChatPane} onClose={onClose} />
      <MenuItem label="Screenshot" icon={<Camera className="size-3.5" />} onClick={onScreenshot} onClose={onClose} />
      <MenuItem label="New Tab" icon={<Plus className="size-3.5" />} onClick={onNewTab} onClose={onClose} />
      <div className="h-px bg-[var(--text-tertiary)]/20 my-1 mx-2" />
      <div className="px-3 py-1.5 text-[12px] uppercase tracking-widest text-[var(--text-tertiary)] font-semibold">Zoom</div>
      <MenuItem label={`Zoom In (${Math.round((zoomLevel + 0.1) * 100)}%)`} icon={<Plus className="size-3.5" />} onClick={onZoomIn} onClose={onClose} />
      <MenuItem label={`Zoom Out (${Math.round((zoomLevel - 0.1) * 100)}%)`} icon={<Minus className="size-3.5" />} onClick={onZoomOut} onClose={onClose} />
      <MenuItem label="Reset Zoom" icon={<ArrowsClockwise className="size-3.5" />} onClick={onZoomReset} onClose={onClose} />
      <div className="h-px bg-[var(--text-tertiary)]/20 my-1 mx-2" />
      <MenuItem label="Close All Tabs" icon={<X className="size-3.5" />} color="rgba(248,113,113,0.7)" onClick={onCloseAllTabs} onClose={onClose} />
    </div>
  );
}

// ============================================================================
// Agent Popup (MatrixLogo dropdown — agent mode/status)
// ============================================================================

function AgentPopup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { status, mode, setMode, connectedEndpoints } = useBrowserAgentStore();
  const [operatorOk, setOperatorOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const check = () => {
      fetch('http://localhost:3000/health', { mode: 'no-cors' })
        .then(() => { if (!cancelled) setOperatorOk(true); })
        .catch(() => { if (!cancelled) setOperatorOk(false); });
    };
    check();
    const interval = setInterval(check, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [open]);

  if (!open) return null;

  const agentActive = mode !== 'Human';
  const extensionPaired = connectedEndpoints.length > 0;

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-56 bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-lg shadow-md z-[50] py-0 text-[12px]">
      <div className="flex items-center justify-between p-[10px_12px] border-b border-solid border-[var(--ui-border-muted)]">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-semibold">
          <ScaledMatrixLogo state={agentActive ? 'thinking' : 'idle'} displaySize={14} />
          <span>Allternit Computer Agent</span>
        </div>
        <button type="button"
          onClick={() => setMode(agentActive ? 'Human' : 'Assist')}
          className={cn(
            "px-2.5 py-0.5 rounded-[10px] border-none text-[12px] font-bold cursor-pointer transition-colors",
            agentActive ? "bg-[var(--accent-primary)] text-[var(--bg-primary)]" : "bg-[var(--text-tertiary)] text-[var(--text-tertiary)]"
          )}
        >
          {agentActive ? 'On' : 'Off'}
        </button>
      </div>

      <div className="p-2 px-3 border-b border-solid border-[var(--ui-border-muted)]">
        <div className="text-[var(--text-tertiary)] mb-1.5">Status: <span className="text-[var(--text-secondary)]">{status}</span></div>
        <div className="text-[var(--text-tertiary)] mb-1">Mode:</div>
        <div className="pl-2 flex flex-col gap-0.5">
          {(['Human', 'Assist', 'Agent'] as BrowserAgentMode[]).map((m) => (
            <label key={m} className="flex items-center gap-2 cursor-pointer py-0.5">
              <input aria-label="Radio" type="radio" name="agent-mode" checked={mode === m} onChange={() => setMode(m)} className="cursor-pointer" />
              <span className={cn(mode === m ? "text-[var(--text-primary)]" : "text-[var(--text-tertiary)]")}>{m}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="p-2 px-3 flex flex-col gap-1 text-[var(--text-tertiary)]">
        <div>
          Operator: {operatorOk === null ? '…' : operatorOk ? (
            <span className="text-[var(--status-success)]">Connected ✓</span>
          ) : (
            <span className="text-[var(--status-error)]">Offline ✗</span>
          )}
        </div>
        <div>
          Extension: {extensionPaired ? (
            <span className="text-[var(--status-success)]">Paired ✓</span>
          ) : (
            <span className="text-[var(--text-tertiary)]">Not paired</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Scaled MatrixLogo — renders at base 48px and CSS-scales to displaySize
// ============================================================================

function ScaledMatrixLogo({ state, displaySize }: { state: "idle" | "listening" | "thinking" | "speaking" | "asleep" | "compacting"; displaySize: number }) {
  const baseSize = 48;
  const scale = displaySize / baseSize;
  return (
    <div className="flex items-center justify-center shrink-0 overflow-hidden" style={{ width: displaySize, height: displaySize }}>
      <div className="shrink-0" style={{ transform: `scale(${scale})`, transformOrigin: 'center center', width: baseSize, height: baseSize }}>
        <MatrixLogo state={state} size={baseSize} />
      </div>
    </div>
  );
}

// ============================================================================
// Extension Manager Popup (Puzzle piece — install/manage extensions)
// ============================================================================

// The official Anthropic asterisk / starburst icon for Claude in Chrome
function AnthropicAsteriskIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Orange rounded-rect background matching Anthropic brand */}
      <rect width="100" height="100" rx="22" fill="#E8753A" />
      {/* Asterisk / starburst — 8 arms */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
        <rect
          key={deg}
          x="46"
          y="14"
          width="8"
          height="40"
          rx="4"
          fill="white"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
    </svg>
  );
}

function ExtensionStoreIcon({ storeUrl, fallbackIcon, size }: { storeUrl?: string; fallbackIcon: string; size: number }) {
  const [imgError, setImgError] = useState(false);

  // Special-case: Claude in Chrome always uses the Anthropic asterisk SVG
  if (storeUrl?.includes(CLAUDE_CHROME_STORE_ID)) {
    return <AnthropicAsteriskIcon size={size} />;
  }

  const iconSrc = storeUrl ? getFaviconUrl(storeUrl, size * 2) : '';
  if (imgError || !iconSrc) {
    return <span className="shrink-0 leading-none" style={{ fontSize: size }}>{fallbackIcon}</span>;
  }
  return (
    <img
      src={iconSrc}
      alt=""
      onError={() => setImgError(true)}
      width={size}
      height={size}
      className="shrink-0 rounded-sm object-contain"
    />
  );
}

function ExtensionManagerPopup({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (url: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { extensions, addExtension, removeExtension, toggleExtension, updateExtension, setExtensionPermission } = useExtensionsStore();
  const { setMode: setAgentMode } = useBrowserAgentStore();
  const [activeTab, setActiveTab] = useState<'installed' | 'discover'>('installed');
  const [customInstalling, setCustomInstalling] = useState(false);
  const [installName, setInstallName] = useState('');
  const [installUrl, setInstallUrl] = useState('');
  // Settings panel — which extension's settings are open
  const [settingsExtId, setSettingsExtId] = useState<string | null>(null);

  // Wire Allternit Computer Agent extension toggle to agent store + chat pane
  const { isOpen: sidecarOpen, toggle: toggleSidecar, setActivePanel } = useSidecarStore();
  const handleToggle = (extId: string) => {
    const ext = extensions.find(e => e.id === extId);
    if (!ext) return;
    toggleExtension(extId);
    if (extId === 'allternit-agent') {
      if (ext.enabled) {
        setAgentMode('Human');
        if (sidecarOpen) toggleSidecar();
      } else {
        setAgentMode('Assist');
        if (!sidecarOpen) {
          setActivePanel('agent');
          toggleSidecar();
        }
      }
    }
  };

  // Install from catalog — navigate the in-app browser to the Chrome Web Store page
  const handleCatalogInstall = (item: CatalogExtension) => {
    onNavigate(item.storeUrl);
    onClose();
    const alreadyAdded = extensions.some((e) => e.chromeStoreId === item.chromeStoreId);
    if (!alreadyAdded) {
      addExtension({
        name: item.name,
        description: item.description,
        icon: item.icon,
        enabled: false,
        version: item.version,
        chromeStoreId: item.chromeStoreId,
        storeUrl: item.storeUrl,
        installStatus: 'pending',
      });
    }
  };

  const handleConfirmInstalled = (extId: string) => {
    updateExtension(extId, { installStatus: 'installed', enabled: true });
  };

  const handleCustomInstall = () => {
    if (!installName.trim()) return;
    addExtension({
      name: installName.trim(),
      description: installUrl.trim() || 'Custom extension',
      icon: '🧩',
      enabled: true,
      version: '1.0.0',
      storeUrl: installUrl.trim() || undefined,
      installStatus: 'installed',
    });
    setInstallName('');
    setInstallUrl('');
    setCustomInstalling(false);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const catalogNotInstalled = EXTENSION_CATALOG.filter(
    (item) => !extensions.some((e) => e.chromeStoreId === item.chromeStoreId)
  );

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-[290px] bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-lg shadow-md z-[50] py-0 text-[12px] max-h-[420px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-[10px_12px] border-b border-solid border-[var(--ui-border-muted)] shrink-0">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-semibold">
          <Puzzle className="size-3.5" />
          <span>Extensions</span>
        </div>
        <button type="button"
          onClick={onClose}
          className="p-1 rounded bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer flex hover:text-[var(--text-secondary)] transition-colors"
        >
          <X className="size-3" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-solid border-[var(--ui-border-muted)] shrink-0">
        {(['installed', 'discover'] as const).map((tab) => (
          <button type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 border-none bg-transparent cursor-pointer text-[12px] font-semibold uppercase tracking-wider transition-all border-b-2 border-solid",
              activeTab === tab ? "text-[var(--accent-primary)] border-[var(--accent-primary)]" : "text-[var(--text-tertiary)] border-transparent"
            )}
          >
            {tab === 'installed' ? `Installed (${extensions.length})` : `Discover${catalogNotInstalled.length > 0 ? ` (${catalogNotInstalled.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto flex-1">
        {activeTab === 'installed' && (
          <>
            {extensions.map((ext) => (
              <div key={ext.id} className="flex items-center gap-2 px-3 py-2 border-b border-solid border-[var(--surface-hover)]">
                {ext.id === 'allternit-agent' ? (
                  <ScaledMatrixLogo state={ext.enabled ? 'listening' : 'idle'} displaySize={20} />
                ) : (
                  <ExtensionStoreIcon storeUrl={ext.storeUrl} fallbackIcon={ext.icon} size={20} />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={cn("text-[12px] font-medium", ext.enabled ? "text-[var(--text-secondary)]" : "text-[var(--text-tertiary)]")}>{ext.name}</span>
                    {ext.installStatus === 'pending' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--status-warning)] bg-[var(--status-warning-bg)] rounded px-1 py-px">Pending</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-tertiary)] truncate">
                    {ext.description}
                    {ext.version !== 'latest' && ` · v${ext.version}`}
                  </div>
                  {ext.installStatus === 'pending' && (
                    <div className="flex gap-1 mt-1">
                      <button type="button" onClick={() => handleConfirmInstalled(ext.id)} className="px-1.5 py-0.5 rounded border-none bg-[var(--status-success)]/15 text-[var(--status-success)] text-[11px] font-semibold cursor-pointer">✓ Mark installed</button>
                      {ext.storeUrl && <button type="button" onClick={() => { onNavigate(ext.storeUrl!); onClose(); }} className="px-1.5 py-0.5 rounded border-none bg-[var(--ui-border-muted)] text-[var(--text-tertiary)] text-[11px] font-semibold cursor-pointer">Open store</button>}
                    </div>
                  )}
                </div>
                {ext.installStatus !== 'pending' && (
                  <button type="button"
                    onClick={() => handleToggle(ext.id)}
                    className={cn(
                      "w-8 h-4.5 rounded-full border-none cursor-pointer p-0 relative shrink-0 transition-colors duration-200",
                      ext.enabled ? "bg-[var(--accent-primary)]" : "bg-[var(--text-tertiary)]"
                    )}
                  >
                    <div className={cn("size-3.5 rounded-full bg-[var(--text-primary)] absolute top-0.5 transition-all duration-200", ext.enabled ? "left-4" : "left-0.5")} />
                  </button>
                )}
                {ext.installStatus !== 'pending' && (
                  <button type="button" onClick={() => setSettingsExtId(ext.id)} className="p-1 rounded border-none bg-transparent text-[var(--text-tertiary)] cursor-pointer flex shrink-0 hover:text-[var(--accent-primary)] transition-colors"><GearSix className="size-3" /></button>
                )}
                {ext.id !== 'allternit-agent' && (
                  <button type="button" onClick={() => removeExtension(ext.id)} className="p-1 rounded border-none bg-transparent text-[var(--text-tertiary)] cursor-pointer flex shrink-0 hover:text-[var(--status-error)] transition-colors"><Trash className="size-3" /></button>
                )}
              </div>
            ))}
            {!customInstalling ? (
              <div className="p-2 px-3">
                <button type="button"
                  onClick={() => setCustomInstalling(true)}
                  className="w-full py-1.5 rounded-md border border-dashed border-[var(--text-tertiary)] bg-transparent text-[var(--text-tertiary)] text-[11px] cursor-pointer flex items-center justify-center gap-1 hover:border-[var(--text-secondary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  <Plus className="size-2.5" /> Add custom extension
                </button>
              </div>
            ) : (
              <div className="p-2 px-3 border-t border-solid border-[var(--border-subtle)] flex flex-col gap-1.5">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)]">Custom Extension</div>
                <input aria-label="Input" value={installName} onChange={(e) => setInstallName(e.target.value)} placeholder="Extension name" autoFocus className="w-full px-2 py-1.5 bg-[var(--surface-panel)] border border-solid border-[var(--ui-border-muted)] rounded text-[var(--text-primary)] text-[12px] outline-none" />
                <input aria-label="Input" value={installUrl} onChange={(e) => setInstallUrl(e.target.value)} placeholder="Store URL (optional)" className="w-full px-2 py-1.5 bg-[var(--surface-panel)] border border-solid border-[var(--ui-border-muted)] rounded text-[var(--text-primary)] text-[12px] outline-none" />
                <div className="flex gap-1.5 mt-0.5">
                  <button type="button" onClick={handleCustomInstall} className="flex-1 py-1 rounded bg-[var(--accent-primary)] border-none text-[var(--bg-primary)] text-[11px] font-bold cursor-pointer">Add Extension</button>
                  <button type="button" onClick={() => { setCustomInstalling(false); setInstallName(''); setInstallUrl(''); }} className="flex-1 py-1 rounded bg-[var(--ui-border-muted)] border-none text-[var(--text-tertiary)] text-[11px] font-bold cursor-pointer">Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
        {activeTab === 'discover' && (
          <>
            <div className="m-2 px-2.5 py-2 rounded-md bg-[rgba(212,176,140,0.06)] border border-solid border-[rgba(212,176,140,0.15)] text-[11px] text-[var(--text-tertiary)] leading-relaxed">
              Clicking <strong className="text-[var(--accent-primary)]">Add to Chrome</strong> navigates to the Chrome Web Store — install it there, then open Extensions and click <strong className="text-[var(--status-success)]">Mark installed</strong>.
            </div>
            {EXTENSION_CATALOG.map((item) => (
              <div key={item.catalogId} className={cn("px-3 py-2.5 border-b border-solid border-[var(--surface-hover)]", item.featured && "bg-[rgba(212,176,140,0.03)]")}>
                <div className="flex items-start gap-2.5">
                  <ExtensionStoreIcon storeUrl={item.storeUrl} fallbackIcon={item.icon} size={28} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{item.name}</span>
                      {item.featured && <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-[var(--accent-primary)]/10 rounded px-1 py-px">Featured</span>}
                    </div>
                    {item.publisher && <div className="text-[11px] text-[var(--text-tertiary)] mb-0.5">by {item.publisher}</div>}
                    <div className="text-[11px] text-[var(--text-tertiary)] leading-normal mb-2">{item.description}</div>
                    {extensions.some((e) => e.chromeStoreId === item.chromeStoreId) ? (
                      <span className="text-[11px] font-bold text-[var(--status-success)] flex items-center gap-1">✓ Added</span>
                    ) : (
                      <button type="button"
                        onClick={() => handleCatalogInstall(item)}
                        className={cn(
                          "px-2 py-1 rounded border-none text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors",
                          item.featured ? "bg-[var(--accent-primary)] text-[var(--bg-primary)]" : "bg-[var(--ui-border-muted)] text-[var(--text-secondary)] hover:bg-[var(--ui-border-default)]"
                        )}
                      >
                        <DownloadSimple className="size-2.5" /> Add to Chrome
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="p-3 text-center">
              <button type="button" onClick={() => { onNavigate('https://chromewebstore.google.com'); onClose(); }} className="bg-transparent border-none p-0 text-[11px] text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--accent-primary)] transition-colors">Browse Chrome Web Store →</button>
            </div>
          </>
        )}
      </div>

      {/* ── SETTINGS PANEL OVERLAY ── */}
      <AnimatePresence>
        {settingsExtId && (() => {
          const settingsExt = extensions.find((e) => e.id === settingsExtId);
          if (!settingsExt) return null;
          return (
            <m.div
              initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
              className="absolute inset-0 bg-[var(--bg-secondary)] rounded-lg flex flex-col z-10"
            >
              <div className="flex items-center gap-2 p-[10px_12px] border-b border-solid border-[var(--ui-border-muted)] shrink-0">
                <button type="button" onClick={() => setSettingsExtId(null)} className="p-1 rounded bg-transparent border-none text-[var(--text-tertiary)] cursor-pointer flex hover:text-[var(--text-secondary)] transition-colors"><ArrowLeft className="size-3.5" /></button>
                {settingsExt.id === 'allternit-agent' ? <ScaledMatrixLogo state="idle" displaySize={16} /> : <ExtensionStoreIcon storeUrl={settingsExt.storeUrl} fallbackIcon={settingsExt.icon} size={16} />}
                <span className="text-[12px] font-bold text-[var(--text-secondary)] flex-1 truncate">{settingsExt.name}</span>
                <GearSix className="size-3 text-[var(--text-tertiary)]" />
              </div>

              <div className="overflow-y-auto flex-1 py-2">
                <div className="px-3 py-1 mb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--text-tertiary)] flex items-center gap-1.5"><Shield className="size-2.5" /> Permissions</div>
                {EXTENSION_PERMISSIONS.map(({ key, label, icon }) => {
                  const current: PermissionValue = settingsExt.permissions?.[key] ?? 'ask';
                  return (
                    <div key={key} className="flex items-center gap-2 px-3 py-1.5 border-b border-solid border-[var(--surface-hover)]">
                      <span className="text-[14px] shrink-0">{icon}</span>
                      <span className="text-[12px] text-[var(--text-secondary)] flex-1">{label}</span>
                      <div className="flex rounded-md overflow-hidden border border-solid border-[var(--border-subtle)] shrink-0">
                        {(['allow', 'ask', 'block'] as PermissionValue[]).map((val) => {
                          const active = current === val;
                          const colors: Record<PermissionValue, string> = { allow: 'text-[var(--status-success)]', ask: 'text-[var(--accent-primary)]', block: 'text-[var(--status-error)]' };
                          const bgColors: Record<PermissionValue, string> = { allow: 'bg-[var(--status-success)]/15', ask: 'bg-[var(--accent-primary)]/15', block: 'bg-[var(--status-error)]/15' };
                          return (
                            <button type="button"
                              key={val}
                              onClick={() => setExtensionPermission(settingsExt.id, key, val)}
                              className={cn(
                                "px-2 py-0.5 border-none cursor-pointer text-[10px] font-bold uppercase tracking-tight transition-colors border-r border-solid border-[var(--border-subtle)] last:border-r-0",
                                active ? cn(colors[val], bgColors[val]) : "bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]"
                              )}
                            >{val}</button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <div className="p-2.5">
                  <button type="button"
                    onClick={() => EXTENSION_PERMISSIONS.forEach(({ key }) => setExtensionPermission(settingsExt.id, key, 'ask'))}
                    className="w-full py-1 rounded border border-dashed border-[var(--border-subtle)] bg-transparent text-[var(--text-tertiary)] text-[11px] cursor-pointer hover:border-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                  >Reset all to Ask</button>
                </div>
              </div>
            </m.div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Main Browser Component
// ============================================================================

const NavBtn = ({ children, title, onClick, active, disabled }: { children: React.ReactNode; title: string; onClick?: () => void; active?: boolean; disabled?: boolean }) => (
  <m.button
    onClick={onClick} title={title} disabled={disabled}
    whileHover={disabled ? {} : { y: -1, scale: 1.05 }}
    whileTap={disabled ? {} : { scale: 0.95 }}
    transition={{ duration: 0.15 }}
    className={cn(
      "p-1.5 rounded-full border-none bg-transparent flex items-center justify-center transition-colors",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[var(--ui-border-default)]",
      active ? "text-[var(--accent-primary)]" : "text-[var(--text-tertiary)]"
    )}
  >
    {children}
  </m.button>
);

export function BrowserCapsuleEnhanced({
  initialUrl,
  agentMode = 'autonomous',
  guidanceMessages = [],
  onHumanCheckpoint,
}: BrowserCapsuleEnhancedProps = {}) {
  const ALLTERNIT_DESKTOP_DEV_COMMAND = 'cd /Users/macbook/Desktop/allternit-workspace/allternit/surfaces/allternit-desktop && pnpm dev';
  const {
    tabs, activeTabId, addTab, closeTab, closeAllTabs, setActiveTab, updateTab,
    goBack, goForward, canGoBack, canGoForward, pushHistory,
    tabLoading, setTabLoading,
    chatPaneOpen, chatPaneWidth, toggleChatPane, setChatPaneWidth,
  } = useBrowserStore();
  
  const handleCloseAllTabs = useCallback(() => {
    closeAllTabs();
    setShowHomePage(true);
  }, [closeAllTabs]);
  
  const {
    status: agentStatus,
    mode: agentModeControl,
    setMode: setAgentMode,
    currentAction: agentCurrentAction,
    setIsBrowserCapsuleMounted,
    goal: pageAgentGoal,
    pageAgentStatus,
    pageAgentTargetTabId,
  } = useBrowserAgentStore();
  const showAciViewport = agentStatus === 'Running' || agentStatus === 'WaitingApproval' || agentStatus === 'Blocked';
  const showPageAgentTakeover = pageAgentStatus === 'running';

  useEffect(() => {
    setIsBrowserCapsuleMounted(true);
    return () => { setIsBrowserCapsuleMounted(false); };
  }, [setIsBrowserCapsuleMounted]);
  const { shortcuts, addShortcut } = useBrowserShortcutsStore();
  const allExtensions = useExtensionsStore((s) => s.extensions);
  const enabledExtensions = useMemo(() => allExtensions.filter((e) => e.enabled && e.installStatus !== 'pending'), [allExtensions]);
  useExtensionBridge();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const [contentMode, setContentMode] = useState<ContentMode>('web');
  const [urlInput, setUrlInput] = useState('');
  const [isHoveringTab, setIsHoveringTab] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const proxyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);
  const [agentPopupOpen, setAgentPopupOpen] = useState(false);
  const [extensionPopupOpen, setExtensionPopupOpen] = useState(false);
  const agentActive = agentModeControl !== 'Human';
  const [urlFocused, setUrlFocused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const trustedOfficeHost = activeTab?.contentType === 'web' ? isTrustedOfficeHost((activeTab as WebTab).url) : false;
  const officeHostRequiresDesktopEmbed = trustedOfficeHost && !isElectronShell();
  const [copiedDesktopCommand, setCopiedDesktopCommand] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showHomePage, setShowHomePage] = useState(false);
  const [isResizingChatPane, setIsResizingChatPane] = useState(false);
  const [findBarOpen, setFindBarOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const chatPaneResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [tooltipTab, setTooltipTab] = useState<BrowserTab | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isBookmarked = useMemo(() => {
    if (!activeTab || activeTab.contentType !== 'web') return false;
    const url = (activeTab as WebTab).url;
    return shortcuts.some((s) => s.url === url);
  }, [activeTab, shortcuts]);

  useEffect(() => { setFindBarOpen(false); }, [activeTabId]);

  useEffect(() => {
    if (activeTab) {
      if (activeTab.contentType === 'web') {
        setUrlInput((activeTab as WebTab).url);
        setContentMode('web');
        setIframeLoaded(false);
        setIframeError(false);
        if (proxyTimeoutRef.current) clearTimeout(proxyTimeoutRef.current);
        proxyTimeoutRef.current = setTimeout(() => { setIframeLoaded(true); proxyTimeoutRef.current = null; }, 3000);
        return () => { if (proxyTimeoutRef.current) { clearTimeout(proxyTimeoutRef.current); proxyTimeoutRef.current = null; } };
      } else if (activeTab.contentType === 'a2ui') {
        setContentMode('canvas');
      }
    } else { setUrlInput(''); }
  }, [activeTabId, activeTab]);

  const handleNavigate = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!urlInput.trim()) return;
    let targetUrl = urlInput.trim();
    if (!targetUrl.match(/^https?:\/\//)) {
      if (targetUrl.includes('.') && !targetUrl.includes(' ')) targetUrl = `https://${targetUrl}`;
      else targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
    }
    setIframeLoaded(false);
    setIframeError(false);
    if (activeTabId) {
      updateTab(activeTabId, { url: targetUrl, title: targetUrl } as Partial<WebTab>);
      pushHistory(activeTabId, targetUrl);
      setTabLoading(activeTabId, true);
    } else addTab(targetUrl);
    setUrlFocused(false);
  }, [urlInput, activeTabId, updateTab, pushHistory, setTabLoading, addTab]);

  const handleIframeLoad = useCallback(() => {
    if (proxyTimeoutRef.current) { clearTimeout(proxyTimeoutRef.current); proxyTimeoutRef.current = null; }
    setIframeLoaded(true);
    if (activeTabId) {
      setTabLoading(activeTabId, false);
      try {
        const url = activeTab && activeTab.contentType === 'web' ? (activeTab as WebTab).url : '';
        if (url) {
          const hostname = new URL(url).hostname.replace('www.', '');
          const prettyTitle = hostname.charAt(0).toUpperCase() + hostname.slice(1);
          updateTab(activeTabId, { title: prettyTitle } as Partial<WebTab>);
        }
      } catch {}
    }
  }, [activeTabId, activeTab, setTabLoading, updateTab]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'allternit-navigate') return;
      const rawUrl: string = event.data.url;
      if (!rawUrl) return;
      let targetUrl = rawUrl;
      try {
        const proxyParam = new URL(rawUrl, window.location.href).searchParams.get('url');
        if (proxyParam) targetUrl = proxyParam;
      } catch {}
      if (activeTabId) {
        updateTab(activeTabId, { url: targetUrl, title: targetUrl } as Partial<WebTab>);
        pushHistory(activeTabId, targetUrl);
        setTabLoading(activeTabId, true);
        setIframeLoaded(false);
        setIframeError(false);
        setUrlInput(targetUrl);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [activeTabId, updateTab, pushHistory, setTabLoading]);

  const handleScreenshot = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    try {
      const canvas = document.createElement('canvas');
      const rect = viewport.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = 'var(--bg-primary)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'var(--accent-primary)';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      const url = activeTab && activeTab.contentType === 'web' ? (activeTab as WebTab).url : 'No active tab';
      ctx.fillText(`Screenshot: ${url}`, canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = 'var(--text-muted)';
      ctx.font = '12px system-ui';
      ctx.fillText(new Date().toLocaleString(), canvas.width / 2, canvas.height / 2 + 20);
      canvas.toBlob((blob) => { if (!blob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `browser-screenshot-${Date.now()}.png`; a.click(); URL.revokeObjectURL(a.href); });
    } catch (err) { logger.error({ err: err }, 'Screenshot failed:'); }
  }, [activeTab]);

  const handleBookmark = useCallback(() => {
    if (!activeTab || activeTab.contentType !== 'web') return;
    const url = (activeTab as WebTab).url;
    const title = activeTab.title || url;
    if (isBookmarked) return;
    addShortcut({ label: title, url, icon: '⭐' });
  }, [activeTab, isBookmarked, addShortcut]);

  const canBack = activeTabId ? canGoBack(activeTabId) : false;
  const canForward = activeTabId ? canGoForward(activeTabId) : false;

  const startChatPaneResize = useCallback((clientX: number) => {
    chatPaneResizeRef.current = { startX: clientX, startWidth: chatPaneWidth };
    setIsResizingChatPane(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [chatPaneWidth]);

  const updateChatPaneResize = useCallback((clientX: number) => {
    const resizeState = chatPaneResizeRef.current;
    if (!resizeState) return;
    const delta = resizeState.startX - clientX;
    setChatPaneWidth(resizeState.startWidth + delta);
  }, [setChatPaneWidth]);

  const stopChatPaneResize = useCallback(() => {
    chatPaneResizeRef.current = null;
    setIsResizingChatPane(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleChatPaneResizePointerStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); startChatPaneResize(event.clientX); }, [startChatPaneResize]);
  const handleChatPaneResizeMouseStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => { event.preventDefault(); startChatPaneResize(event.clientX); }, [startChatPaneResize]);

  useEffect(() => {
    if (!isResizingChatPane) return;
    const handlePointerMove = (event: PointerEvent) => updateChatPaneResize(event.clientX);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopChatPaneResize);
    window.addEventListener('pointercancel', stopChatPaneResize);
    window.addEventListener('blur', stopChatPaneResize);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopChatPaneResize);
      window.removeEventListener('pointercancel', stopChatPaneResize);
      window.removeEventListener('blur', stopChatPaneResize);
    };
  }, [isResizingChatPane, stopChatPaneResize, updateChatPaneResize]);

  return (
    <LazyMotion features={domAnimation}>
      <div data-testid="browser-capsule-enhanced-root" className="flex flex-col size-full flex-1 min-h-0 min-w-0 relative overflow-hidden bg-[var(--view-browser-bg,#f6f8fc)] text-[var(--text-primary)] font-sans select-none">
        
        {/* ━━━ ROW 1: TAB BAR ━━━ */}
        <div 
          className="h-9 min-h-9 max-h-9 flex flex-row items-end px-1 bg-[var(--bg-primary)] shrink-0 relative"
          onDoubleClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-tab-bar-space]')) addTab('about:blank'); }}
        >
          <div data-tab-bar-space ref={tabBarRef} onWheel={(e) => { e.preventDefault(); tabBarRef.current?.scrollBy({ left: e.deltaY, behavior: 'smooth' }); }} className="flex-1 flex flex-row items-end overflow-x-auto overflow-y-hidden [scrollbar-width:none] min-w-0 gap-0.5 pb-1 pl-0.5">
            {tabs.map((tab, index) => {
              const isActive = tab.id === activeTabId;
              const isLoading = tabLoading[tab.id];
              const isMounted = pageAgentTargetTabId === tab.id;
              const isAgentRunning = isMounted && pageAgentStatus === 'running';
              const isPinned = tab.pinned ?? false;
              const showTitle = isActive || isHoveringTab === tab.id || tabs.length <= 3;
              const isDragOver = dragOverIndex === index;
              return (
                <div 
                  key={tab.id} 
                  role="button"
                  tabIndex={0}
                  draggable={!isPinned} 
                  onDragStart={(e) => { if (!isPinned) { e.dataTransfer.setData('text/plain', String(index)); e.dataTransfer.effectAllowed = 'move'; setDraggedIndex(index); } }} 
                  onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }} 
                  onDragOver={(e) => { if (!isPinned && draggedIndex !== null) { e.preventDefault(); setDragOverIndex(index); } }} 
                  onDrop={(e) => { if (!isPinned && draggedIndex !== null) { e.preventDefault(); const fromIndex = draggedIndex; const toIndex = index; if (fromIndex !== toIndex) useBrowserStore.getState().reorderTabs(fromIndex, toIndex); setDraggedIndex(null); setDragOverIndex(null); } }} 
                  onMouseEnter={() => { setIsHoveringTab(tab.id); if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current); tooltipTimeoutRef.current = setTimeout(() => setTooltipTab(tab), 300); }} 
                  onMouseLeave={() => { setIsHoveringTab(null); if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current); tooltipTimeoutRef.current = setTimeout(() => setTooltipTab(null), 150); }} 
                  onClick={() => setActiveTab(tab.id)} 
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setActiveTab(tab.id); }}
                  onMouseDown={(e) => { if (e.button === 1 && !isPinned) { e.preventDefault(); closeTab(tab.id); } }} 
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id }); }}
                  className={cn(
                    "flex flex-row items-center justify-center transition-all duration-150 overflow-hidden relative shrink-0",
                    isPinned ? "h-6 w-7 px-1" : cn("h-7", showTitle ? "w-auto min-w-[110px] max-w-[180px] px-2.5" : "w-11 px-2"),
                    isPinned ? "cursor-pointer" : "cursor-grab",
                    isActive ? "bg-[var(--bg-secondary)] text-[var(--text-primary)]" : "bg-transparent text-[var(--text-tertiary)]",
                    isMounted || isDragOver ? "bg-[var(--accent-primary)]/8" : "",
                    isMounted ? "border border-solid border-[var(--accent-primary)]/16 shadow-[0_0_8px_var(--accent-primary)/14]" : "border border-solid border-transparent",
                    draggedIndex === index && "opacity-50"
                  )}
                  style={isDragOver ? { borderColor: 'var(--accent-primary)' } : {}}
                >
                  {isMounted && <div className={cn("absolute top-0.5 right-0.5 size-1 rounded-full bg-[var(--accent-primary)] z-10", isAgentRunning && "animate-pulse")} />}
                  {tab.group && <div className="absolute bottom-0 left-1 right-1 h-0.5 rounded-t bg-[var(--accent-primary)] z-10" style={{ background: tab.groupColor || 'var(--accent-primary)' }} />}
                  {isPinned && !isMounted && <div className="absolute bottom-0.5 right-0.5 size-1 rounded-full bg-[var(--text-tertiary)] z-10" />}
                  {isAgentRunning || isLoading ? <CircleNotch size={13} className="shrink-0 opacity-80 animate-spin" /> : <TabFavicon url={tab.contentType === 'web' ? (tab as WebTab).url : undefined} size={isPinned ? 12 : 13} />}
                  {showTitle && !isPinned && <span className="text-[12px] font-medium truncate flex-1 min-w-0">{tab.title || 'New Tab'}</span>}
                  {(isActive || isHoveringTab === tab.id) && !isPinned && <button type="button" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="ml-0.5 p-0.5 rounded-full border-none bg-transparent cursor-pointer text-inherit opacity-50 flex shrink-0 hover:bg-[var(--ui-border-default)] hover:opacity-100"><X size={10} /></button>}
                </div>
              );
            })}
            <m.button onClick={() => addTab('about:blank')} title="New Tab" whileHover={{ y: -1, scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ duration: 0.15 }} className="h-7 w-7 flex items-center justify-center rounded border-none bg-transparent cursor-pointer text-[var(--text-tertiary)] shrink-0 ml-0.5 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"><Plus size={14} /></m.button>
          </div>
          <div className="relative flex items-center h-full pr-1 gap-0.5">
            <NavBtn title="Show all tabs" onClick={() => setTabDropdownOpen(!tabDropdownOpen)}><CaretDown className="size-4" /></NavBtn>
            <TabOverflowDropdown open={tabDropdownOpen} onClose={() => setTabDropdownOpen(false)} tabs={tabs} activeTabId={activeTabId} onSelect={setActiveTab} onCloseTab={closeTab} />
            {tabs.length > 0 && <NavBtn title="Close all tabs" onClick={handleCloseAllTabs}><X className="size-4" /></NavBtn>}
          </div>
        </div>

        {/* Tab context menu */}
        <AnimatePresence>
          {contextMenu && <TabContextMenu x={contextMenu.x} y={contextMenu.y} tabId={contextMenu.tabId} onClose={() => setContextMenu(null)} />}
        </AnimatePresence>

        {/* Tab preview tooltip */}
        {tooltipTab && (
          <div className="fixed bottom-[calc(100%-40px)] left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
            <div className="bg-[var(--bg-secondary)] border border-solid border-[var(--border-subtle)] rounded-lg shadow-md px-2.5 py-1.5 max-w-[240px]">
              <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{tooltipTab.title || 'New Tab'}</div>
              {'url' in tooltipTab && (tooltipTab as WebTab).url && <div className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">{(tooltipTab as WebTab).url}</div>}
            </div>
          </div>
        )}

        {/* ━━━ ACCENT LINE ━━━ */}
        <div className="h-0.5 shrink-0 bg-[linear-gradient(90deg,transparent,var(--accent-primary),transparent)] opacity-40 origin-left animate-[browserAccentSlide_1.2s_ease-out]" />

        {/* ━━━ ROW 2: NAV BAR ━━━ */}
        <div className="h-10 min-h-10 max-h-10 flex flex-row items-center gap-2 px-2 bg-[var(--bg-secondary)] border-b border-solid border-[var(--border-subtle)] shrink-0 z-20">
          <div className="flex flex-row items-center gap-0.5">
            <NavBtn title="Back" onClick={() => activeTabId && goBack(activeTabId)} disabled={!canBack}><CaretLeft className="size-4" /></NavBtn>
            <NavBtn title="Forward" onClick={() => activeTabId && goForward(activeTabId)} disabled={!canForward}><CaretRight className="size-4" /></NavBtn>
            <NavBtn title="Refresh" onClick={() => { if (activeTabId) { setIframeLoaded(false); setIframeError(false); setTabLoading(activeTabId, true); const currentUrl = activeTab && activeTab.contentType === 'web' ? (activeTab as WebTab).url : ''; if (currentUrl) { updateTab(activeTabId, { url: '' } as Partial<WebTab>); setTimeout(() => updateTab(activeTabId, { url: currentUrl } as Partial<WebTab>), 50); } } }}><ArrowsClockwise className="size-4" /></NavBtn>
          </div>
          <form onSubmit={handleNavigate} className="flex-1 min-w-0 relative flex items-center gap-2">
            <div className="flex items-center h-8 bg-[var(--bg-primary)] rounded-full px-4 flex-1">
              {activeTab && <Lock className="size-3.5 text-[var(--text-tertiary)] mr-2 shrink-0" />}
              <input aria-label="Input" type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNavigate(); } }} onFocus={() => setUrlFocused(true)} onBlur={() => setTimeout(() => setUrlFocused(false), 200)} className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] font-inherit min-w-0" placeholder={activeTab ? "Enter URL or search…" : "Search or type a URL"} />
            </div>
            <UrlAutocomplete query={urlInput} visible={urlFocused} onSelect={(url) => { setUrlInput(url); setUrlFocused(false); if (activeTabId) { updateTab(activeTabId, { url, title: url } as Partial<WebTab>); pushHistory(activeTabId, url); setTabLoading(activeTabId, true); setIframeLoaded(false); setIframeError(false); } else addTab(url); }} />
          </form>
          <NavBtn title={isBookmarked ? "Bookmarked" : "Bookmark this page"} onClick={handleBookmark} active={isBookmarked}><Star className="size-4" style={{ fill: isBookmarked ? 'var(--accent-primary)' : 'none' }} /></NavBtn>
          <NavBtn title="Find in page" onClick={() => setFindBarOpen((v) => !v)} active={findBarOpen}><MagnifyingGlass className="size-4" /></NavBtn>

          {enabledExtensions.map((ext) => ext.id === 'allternit-agent' ? (
            <div key={ext.id} className="relative" onContextMenu={(e) => { e.preventDefault(); setAgentPopupOpen(!agentPopupOpen); }}>
              <NavBtn title={agentActive ? "Allternit Computer Agent (Active) — right-click for controls" : "Allternit Computer Agent — right-click for controls"} onClick={toggleChatPane} active={agentActive || chatPaneOpen}>
                <div className="relative flex items-center justify-center">
                  <ScaledMatrixLogo state={agentActive ? (agentStatus === 'Running' ? 'thinking' : 'listening') : 'idle'} displaySize={16} />
                  {chatPaneOpen && <div className="absolute -bottom-0.5 -right-0.5 size-1.5 rounded-full bg-[#4ade80] border border-solid border-[var(--bg-secondary)]" />}
                </div>
              </NavBtn>
              <AgentPopup open={agentPopupOpen} onClose={() => setAgentPopupOpen(false)} />
            </div>
          ) : (
            <NavBtn key={ext.id} title={ext.name}><ExtensionStoreIcon storeUrl={ext.storeUrl} fallbackIcon={ext.icon} size={16} /></NavBtn>
          ))}

          <div className="relative">
            <NavBtn title="Extensions" onClick={() => setExtensionPopupOpen(!extensionPopupOpen)}><Puzzle className="size-4" /></NavBtn>
            <ExtensionManagerPopup open={extensionPopupOpen} onClose={() => setExtensionPopupOpen(false)} onNavigate={addTab} />
          </div>

          <div className="relative">
            <NavBtn title="More" onClick={() => setMenuOpen(!menuOpen)}><DotsThreeVertical className="size-4" /></NavBtn>
            <ThreeDotMenu open={menuOpen} onClose={() => setMenuOpen(false)} contentMode={contentMode} setContentMode={setContentMode} agentModeControl={agentModeControl} setAgentMode={setAgentMode} agentStatus={agentStatus} onNewTab={() => addTab('about:blank')} onToggleChatPane={toggleChatPane} chatPaneOpen={chatPaneOpen} onCloseAllTabs={handleCloseAllTabs} onScreenshot={handleScreenshot} zoomLevel={zoomLevel} onZoomIn={() => setZoomLevel((z) => Math.min(z + 0.1, 3))} onZoomOut={() => setZoomLevel((z) => Math.max(z - 0.1, 0.3))} onZoomReset={() => setZoomLevel(1)} />
          </div>
        </div>

        {/* ━━━ VIEWPORT + CHAT PANE ━━━ */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          <div ref={viewportRef} className="flex-1 relative overflow-hidden min-h-0 min-w-0">
            {findBarOpen && contentMode === 'web' && activeTab?.contentType === 'web' && <BrowserFindBar iframeRef={iframeRef} onClose={() => setFindBarOpen(false)} />}
            {showAciViewport && <ACIComputerUseView agentBarHeight={0} />}
            <BrowserAgentOverlay status={agentStatus} currentAction={agentCurrentAction as any} />
            <ACIGlassPill placement="bottom-center" />

            {officeHostRequiresDesktopEmbed && (
              <div className="absolute top-4 left-4 right-4 z-[14] flex justify-center pointer-events-none">
                <div className="max-w-[860px] w-full pointer-events-auto flex items-start gap-3.5 p-4 rounded-[18px] border border-solid border-[var(--border-strong)] bg-white/95 shadow-sm">
                  <div className="size-[34px] shrink-0 rounded-xl flex items-center justify-center bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"><Warning className="size-[18px]" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-[var(--text-primary)] mb-1">Office is only real in the desktop shell</div>
                    <div className="text-[12px] leading-relaxed text-[var(--text-secondary)]">This localhost browser build is not treated as a valid in-platform Office host. Use the Electron desktop shell for Office on the web inside Browser mode, or use the real desktop Office product with the add-in companion.</div>
                  </div>
                  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(ALLTERNIT_DESKTOP_DEV_COMMAND); setCopiedDesktopCommand(true); window.setTimeout(() => setCopiedDesktopCommand(false), 2200); } catch (err) { console.error(err); } }} className="inline-flex items-center gap-2 shrink-0 p-[10px_12px] rounded-xl border border-solid border-[var(--border-strong)] bg-[var(--bg-secondary)] text-[var(--text-primary)] cursor-pointer text-[12px] font-semibold hover:bg-[var(--bg-hover)] transition-colors"><Copy className="size-3.5" /> {copiedDesktopCommand ? 'Copied!' : 'Copy launch command'}</button>
                </div>
              </div>
            )}

            {contentMode === 'web' ? (
              activeTab && activeTab.contentType === 'web' && (activeTab as WebTab).url !== 'about:blank' ? (
                <div className="size-full relative overflow-auto">
                  <div className="origin-top-left" style={{ width: `${100 / zoomLevel}%`, height: `${100 / zoomLevel}%`, transform: `scale(${zoomLevel})` }}>
                    {isElectronShell() ? <webview data-testid="allternit-webview-content" src={(activeTab as WebTab).url} partition={trustedOfficeHost ? "persist:allternit-office-web" : undefined} className="size-full border-none bg-white" allowpopups={true} onloadstart={() => { setIframeLoaded(false); setIframeError(false); if (activeTabId) setTabLoading(activeTabId, true); }} onloadstop={() => { setIframeLoaded(true); if (activeTabId) setTabLoading(activeTabId, false); }} onerror={() => { setIframeError(true); if (activeTabId) setTabLoading(activeTabId, false); }} {...({ 'ondid-fail-load': () => { setIframeError(true); if (activeTabId) setTabLoading(activeTabId, false); } } as any)} /> : trustedOfficeHost ? (
                      <div className="flex size-full items-center justify-center bg-[linear-gradient(180deg,#f7f8fc_0%,#eef3fb_100%)] px-6">
                        <div className="max-w-xl rounded-3xl border border-[rgba(15,23,42,0.08)] bg-white/95 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                            <Globe size={22} weight="fill" />
                          </div>
                          <div className="text-[18px] font-semibold text-[var(--text-primary)]">Open this Office session in the desktop shell</div>
                          <div className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">Office on the web is only treated as a real Allternit surface when it is mounted in the Electron desktop shell webview. This browser build will not render the Office product inline.</div>
                        </div>
                      </div>
                    ) : <iframe ref={iframeRef} data-testid="allternit-iframe-content" src={getWebProxyUrl((activeTab as WebTab).url)} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-modals allow-pointer-lock allow-downloads allow-storage-access-by-user-activation" allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="no-referrer" className="size-full border-none bg-white" onLoad={handleIframeLoad} onError={() => { setIframeError(true); if (activeTabId) setTabLoading(activeTabId, false); }} />}
                  </div>
                  {iframeError && <div className="absolute inset-0 bg-[var(--bg-primary)] flex flex-col items-center justify-center z-10"><Warning className="size-12 text-red-500/60 mb-4" /><div className="text-[12px] font-black text-red-400/80 uppercase tracking-[0.3em] mb-2">CONNECTION_FAILED</div><div className="text-[12px] font-mono text-zinc-500/40 max-w-[320px] text-center">Could not load {(activeTab as WebTab).url}</div></div>}
                  {!iframeLoaded && !iframeError && <div className="absolute inset-0 z-10"><BrowserIframeSkeleton /></div>}
                  <BrowserDownloadBar />
                </div>
              ) : showHomePage || tabs.length === 0 || (activeTab && activeTab.contentType === 'web' && (activeTab as WebTab).url === 'about:blank') ? (
                <BrowserNewTabPage onNavigate={(url) => { if (activeTab && activeTab.contentType === 'web' && (activeTab as WebTab).url === 'about:blank' && activeTabId) { updateTab(activeTabId, { url, title: url } as Partial<BrowserTab>); pushHistory(activeTabId, url); setTabLoading(activeTabId, true); setIframeLoaded(false); setIframeError(false); } else { addTab(url); setShowHomePage(false); } }} />
              ) : (
                <div className="size-full flex flex-col items-center justify-center"><div className="mb-20 opacity-40 scale-90"><AllternitLogo size="lg" variant="stacked" /></div><p className="text-[12px] font-mono text-zinc-500/20 uppercase tracking-[0.5em]">INITIALIZING_KERNEL…</p></div>
              )
            ) : contentMode === 'canvas' ? <CanvasMode tab={activeTab?.contentType === 'a2ui' ? (activeTab as A2UITab) : undefined} /> : <StudioMode />}
            <PageAgentTakeoverOverlay active={showPageAgentTakeover} task={pageAgentGoal} />
          </div>

          {chatPaneOpen && (
            <>
              <div role="separator" aria-label="Resize browser chat pane" onPointerDown={handleChatPaneResizePointerStart} onMouseDown={handleChatPaneResizeMouseStart} className={cn("w-2 shrink-0 cursor-col-resize relative transition-colors", isResizingChatPane ? "bg-[var(--surface-hover)]" : "bg-transparent")}>
                <div className={cn("absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px transition-colors", isResizingChatPane ? "bg-[var(--accent-primary)]" : "bg-[var(--border-subtle)]")} />
              </div>
              <div className="shrink-0 border-l border-solid border-[var(--border-subtle)] overflow-hidden relative" style={{ width: chatPaneWidth, minWidth: BROWSER_CHAT_PANE_MIN_WIDTH }}>
                <div className="absolute inset-0 flex flex-col"><BrowserChatPane /></div>
              </div>
            </>
          )}
        </div>
        {isResizingChatPane && <div aria-hidden="true" onPointerMove={(e) => updateChatPaneResize(e.clientX)} onPointerUp={stopChatPaneResize} onPointerCancel={stopChatPaneResize} onMouseMove={(e) => updateChatPaneResize(e.clientX)} onMouseUp={stopChatPaneResize} className="absolute inset-0 z-50 cursor-col-resize bg-transparent pointer-events-auto" />}
      </div>
    </LazyMotion>
  );
}

function RadioItem({ label, value }: { label: BrowserAgentMode; value: BrowserAgentMode }) {
  const { mode, setMode } = useBrowserAgentStore();
  const active = mode === value;
  return (
    <label className="flex items-center gap-2 cursor-pointer py-1 group">
      <div className={cn("size-3 rounded-full border border-solid transition-all flex items-center justify-center", active ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10" : "border-[var(--ui-border-default)] group-hover:border-[var(--text-tertiary)]")}>
        {active && <div className="size-1.5 rounded-full bg-[var(--accent-primary)]" />}
      </div>
      <input aria-label="Radio" type="radio" name="agent-mode-popup" checked={active} onChange={() => setMode(value)} className="hidden" />
      <span className={cn("transition-colors", active ? "text-[var(--text-primary)] font-semibold" : "text-[var(--text-tertiary)]")}>{label}</span>
    </label>
  );
}

const isTrustedOfficeHost_fn = isTrustedOfficeHost;

export function openSampleA2UITab() {
  const { addA2UITab } = useBrowserStore.getState();
  addA2UITab(sampleA2UIPayload as any, 'A2UI Demo', 'demo');
}

export default BrowserCapsuleEnhanced;
