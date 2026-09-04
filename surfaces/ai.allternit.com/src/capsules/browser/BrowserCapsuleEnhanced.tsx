// @ts-nocheck
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowsClockwise,
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
  Plugs,
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

/**
 * BrowserCapsuleEnhanced - P5.2.2
 * Chrome-style browser with Claude-style chat sidebar
 *
 * Migrated to Tailwind CSS for architectural compliance.
 */

import { AllternitLogo } from '@/components/AllternitLogo';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';
import { isElectronShell, getWebProxyUrl } from '@/lib/platform';
import { isOfficeApiEnabled } from '@/lib/env';
import { cloudApiFetch } from '@/lib/cloud-api';
import { cn } from '@/lib/utils';

import {
  BROWSER_CHAT_PANE_MIN_WIDTH,
  useBrowserStore,
} from './browser.store';
import { BrowserTab, BrowserWorkspace, WebTab, A2UITab, A2UIPayload } from './browser.types';
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
import { BrowserApiCaptureButton } from './BrowserApiCaptureButton';

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

function getOfficeHostFromUrl(url: string): 'word' | 'excel' | 'powerpoint' | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const path = new URL(url).pathname.toLowerCase();
    if (hostname.includes('word.') || path.includes('/word')) return 'word';
    if (hostname.includes('excel.') || path.includes('/excel')) return 'excel';
    if (hostname.includes('powerpoint.') || path.includes('/powerpoint')) return 'powerpoint';
  } catch {}
  return null;
}

// ============================================================================
// Extension Store (Zustand with persist)
// ============================================================================

import { useBrowserExtensionsStore, type BrowserExtension } from './browserExtensions.store';

import { createModuleLogger } from '@/lib/logger';
const logger = createModuleLogger('BrowserCapsuleEnhanced');

type PermissionValue = 'allow' | 'block' | 'ask';

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
  const { closeTab, closeOtherTabs, closeTabsToRight, duplicateTab, pinTab, unpinTab, setTabGroup, removeTabFromGroup, toggleEssential, moveTabToWorkspace, workspaces } = useBrowserStore();
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
    { label: tab?.essential ? 'Remove from Essentials' : 'Add to Essentials', icon: <Star className="size-3" />, action: () => toggleEssential(tabId) },
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
    <div ref={ref} className="fixed w-[180px] max-h-[min(420px,calc(100vh-16px))] overflow-y-auto bg-[var(--shell-floating-bg)] border border-solid border-[var(--shell-divider)] rounded-lg shadow-md z-[100] py-1 text-[12px]"
      style={{ left: Math.max(8, Math.min(x, window.innerWidth - 188)), top: Math.max(8, Math.min(y, window.innerHeight - 428)) }}
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
      {workspaces.filter((workspace) => workspace.id !== tab?.workspaceId).map((workspace) => (
        <button type="button" key={workspace.id} onClick={() => { moveTabToWorkspace(tabId, workspace.id); onClose(); }} className="flex items-center gap-2 w-full px-3 py-1.5 border-none bg-transparent cursor-pointer text-[var(--text-secondary)] text-[12px] text-left hover:bg-[var(--bg-hover)] transition-colors"><span style={{ color: workspace.color }}>{workspace.icon}</span>Move to {workspace.name}</button>
      ))}
      {workspaces.length > 1 && <div className="h-px bg-[var(--text-tertiary)]/20 my-1 mx-2" />}
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

function ThreeDotMenu({ open, onClose, onNewTab, onToggleChatPane, chatPaneOpen, onCloseAllTabs, onEnterFocusMode, zoomLevel, onZoomIn, onZoomOut, onZoomReset }: {
  open: boolean; onClose: () => void;
  onNewTab: () => void; onToggleChatPane: () => void; chatPaneOpen: boolean; onCloseAllTabs: () => void;
  onEnterFocusMode: () => void;
  zoomLevel: number; onZoomIn: () => void; onZoomOut: () => void; onZoomReset: () => void;
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
      <MenuItem label="New Tab" icon={<Plus className="size-3.5" />} onClick={onNewTab} onClose={onClose} />
      <MenuItem label={chatPaneOpen ? 'Hide Allternit Chat' : 'Open Allternit Chat'} icon={<Sparkle className="size-3.5" />} onClick={onToggleChatPane} onClose={onClose} />
      <MenuItem label="Enter Focus Mode" icon={<SquaresFour className="size-3.5" />} onClick={onEnterFocusMode} onClose={onClose} />
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

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
  return (
    <div className="flex items-center justify-center shrink-0" style={{ width: displaySize, height: displaySize }}>
      <MatrixLogo state={state} size={displaySize} />
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
  const { extensions, addExtension, removeExtension, toggleExtension, updateExtension, setExtensionPermission } = useBrowserExtensionsStore();
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

const OFFICE_HOST_META = {
  word: { label: 'Word', color: '#2B579A', description: 'Draft, edit, format, and review documents.' },
  excel: { label: 'Excel', color: '#217346', description: 'Analyze ranges, build formulas, charts, and models.' },
  powerpoint: { label: 'PowerPoint', color: '#D24726', description: 'Create, rewrite, and design presentations.' },
} as const;

function OfficeExtensionPopup({ extension, currentUrl, attached, onClose, onOpen, onAttach, onDetach }: {
  extension: BrowserExtension;
  currentUrl?: string;
  attached: boolean;
  onClose: () => void;
  onOpen: (url: string) => void;
  onAttach: () => void;
  onDetach: () => void;
}) {
  const host = extension.officeHost;
  if (!host) return null;
  const meta = OFFICE_HOST_META[host];
  const currentIsOffice = Boolean(currentUrl && isTrustedOfficeHost(currentUrl));
  return <div className="absolute right-0 top-full mt-1 z-[70] w-[280px] overflow-hidden rounded-2xl border border-solid border-[var(--shell-divider)] bg-[var(--shell-floating-bg)] shadow-2xl">
    <div className="flex items-start gap-3 border-b border-solid border-[var(--shell-divider)] p-3.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl text-[15px] font-black" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 14%, transparent)` }}>{extension.icon}</div>
      <div className="min-w-0 flex-1"><div className="text-[12px] font-bold text-[var(--shell-item-fg)]">Allternit for {meta.label}</div><div className="mt-0.5 text-[10px] leading-relaxed text-[var(--shell-item-muted)]">{meta.description}</div></div>
      <button type="button" aria-label={`Close ${meta.label} extension menu`} onClick={onClose} className="size-6 rounded-full border-none bg-transparent text-[var(--shell-item-muted)] cursor-pointer hover:bg-[var(--shell-item-hover)]"><X size={12} /></button>
    </div>
    <div className="p-2 flex flex-col gap-1">
      <button type="button" onClick={() => { onOpen(extension.launchUrl!); onClose(); }} className="flex w-full items-center gap-2 rounded-xl border-none bg-transparent p-2.5 text-left cursor-pointer hover:bg-[var(--shell-item-hover)]"><Globe size={15} style={{ color: meta.color }} /><span className="flex-1"><span className="block text-[12px] font-semibold text-[var(--shell-item-fg)]">Open {meta.label} in Browser</span><span className="block text-[10px] text-[var(--shell-item-muted)]">Stay in Allternit with Computer Agent beside it</span></span></button>
      <button type="button" disabled={!currentIsOffice} onClick={() => { attached ? onDetach() : onAttach(); onClose(); }} className="flex w-full items-center gap-2 rounded-xl border-none bg-transparent p-2.5 text-left cursor-pointer hover:bg-[var(--shell-item-hover)] disabled:cursor-not-allowed disabled:opacity-40"><Sparkle size={15} className="text-[var(--accent-browser)]" /><span className="flex-1"><span className="block text-[12px] font-semibold text-[var(--shell-item-fg)]">{attached ? 'Detach Current Office Tab' : 'Attach Current Office Tab'}</span><span className="block text-[10px] text-[var(--shell-item-muted)]">{currentIsOffice ? attached ? 'Stop using this document as agent context' : 'Use this document as agent context' : 'Open an Office document first'}</span></span></button>
    </div>
    <div className="border-t border-solid border-[var(--shell-divider)] px-3 py-2 text-[9px] leading-relaxed text-[var(--shell-item-muted)]">The Office add-in supplies document tools. All model selection, chat, approvals, and history stay in Allternit.</div>
  </div>;
}

// ============================================================================
// Main Browser Component
// ============================================================================

export const NavBtn = ({ children, title, onClick, active, disabled }: { children: React.ReactNode; title: string; onClick?: () => void; active?: boolean; disabled?: boolean }) => (
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

function WorkspaceSettingsPanel({ workspace, workspaces, deleteArmed, onClose, onUpdate, onDuplicate, onReorder, onDelete, onArmDelete }: {
  workspace: BrowserWorkspace;
  workspaces: BrowserWorkspace[];
  deleteArmed: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<BrowserWorkspace>) => void;
  onDuplicate: () => void;
  onReorder: (direction: -1 | 1) => void;
  onDelete: () => void;
  onArmDelete: () => void;
}) {
  const inputClass = "h-8 rounded-lg border border-solid border-[var(--shell-divider)] bg-[var(--shell-view-bg)] px-2 text-[12px] normal-case tracking-normal text-[var(--shell-item-fg)] outline-none focus:border-[var(--accent-browser)]";
  const labelClass = "flex flex-col gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--shell-item-muted)]";
  const index = workspaces.findIndex((item) => item.id === workspace.id);
  return <div data-testid="workspace-settings-panel" className="absolute top-10 right-3 z-[90] w-[min(320px,calc(100%-24px))] max-h-[calc(100%-190px)] overflow-y-auto rounded-xl border border-solid border-[var(--shell-divider)] bg-[var(--shell-floating-bg)] shadow-xl p-3 flex flex-col gap-3" onMouseDown={(event) => event.stopPropagation()}>
    <div className="flex items-center justify-between"><div><div className="text-[12px] font-bold text-[var(--shell-item-fg)]">Workspace settings</div><div className="text-[10px] text-[var(--shell-item-muted)]">Appearance, defaults, and agent context</div></div><button type="button" aria-label="Close workspace settings" onClick={onClose} className="size-7 border-none rounded-full bg-transparent text-[var(--shell-item-muted)] cursor-pointer hover:bg-[var(--shell-item-hover)]"><X size={13} /></button></div>
    <label className={labelClass}>Name<input value={workspace.name} onChange={(event) => onUpdate({ name: event.target.value.slice(0, 40) })} className={inputClass} /></label>
    <div className="grid grid-cols-[1fr_52px] gap-2"><label className={labelClass}>Icon<input value={workspace.icon} onChange={(event) => onUpdate({ icon: Array.from(event.target.value).slice(0, 2).join('') })} className={inputClass} /></label><label className={labelClass}>Color<input type="color" value={workspace.color} onChange={(event) => onUpdate({ color: event.target.value })} className="h-8 w-full rounded-lg border border-solid border-[var(--shell-divider)] bg-[var(--shell-view-bg)] p-1 cursor-pointer" /></label></div>
    <label className={labelClass}>Default URL<input value={workspace.defaultUrl || ''} placeholder="about:blank" onChange={(event) => onUpdate({ defaultUrl: event.target.value || undefined })} className={inputClass} /></label>
    <div className="h-px bg-[var(--shell-divider)]" />
    <label className={labelClass}>Agent ID<input value={workspace.agentId || ''} placeholder="Use platform brain" onChange={(event) => onUpdate({ agentId: event.target.value || undefined })} className={inputClass} /></label>
    <label className={labelClass}>Skills<input value={(workspace.skillIds || []).join(', ')} placeholder="research, capture" onChange={(event) => onUpdate({ skillIds: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className={inputClass} /></label>
    <label className={labelClass}>Mini-apps<input value={(workspace.miniappIds || []).join(', ')} placeholder="hermes, openclaw" onChange={(event) => onUpdate({ miniappIds: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className={inputClass} /></label>
    <label className={labelClass}>Extensions<input value={(workspace.extensionIds || []).join(', ')} placeholder="allternit-office-word" onChange={(event) => onUpdate({ extensionIds: event.target.value.split(',').map((value) => value.trim()).filter(Boolean) })} className={inputClass} /></label>
    <div className="text-[10px] leading-relaxed text-[var(--shell-item-muted)]">These defaults are passed to the same Allternit browser and computer-use harness when work starts in this workspace.</div>
    <div className="grid grid-cols-4 gap-1.5"><button type="button" title="Move workspace left" disabled={index <= 0} onClick={() => onReorder(-1)} className="h-8 rounded-lg border border-solid border-[var(--shell-divider)] bg-transparent cursor-pointer disabled:opacity-30">←</button><button type="button" title="Move workspace right" disabled={index >= workspaces.length - 1} onClick={() => onReorder(1)} className="h-8 rounded-lg border border-solid border-[var(--shell-divider)] bg-transparent cursor-pointer disabled:opacity-30">→</button><button type="button" onClick={onDuplicate} className="h-8 col-span-2 rounded-lg border border-solid border-[var(--shell-divider)] bg-transparent text-[11px] font-semibold cursor-pointer hover:bg-[var(--shell-item-hover)]">Duplicate</button></div>
    {workspaces.length > 1 && <button type="button" onClick={deleteArmed ? onDelete : onArmDelete} className="h-8 rounded-lg border border-solid border-red-500/20 bg-red-500/5 text-red-500 cursor-pointer text-[11px] font-semibold hover:bg-red-500/10">{deleteArmed ? 'Confirm delete — tabs move safely' : 'Delete workspace…'}</button>}
  </div>;
}

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
    workspaces, activeWorkspaceId, addWorkspace, setActiveWorkspace,
    updateWorkspace, removeWorkspace, duplicateWorkspace, reorderWorkspace,
    compactMode, toggleCompactMode,
    verticalTabs, toggleVerticalTabs,
    tabSidebarCollapsed, toggleTabSidebar,
    splitViews, addTabToSplit, removeTabFromSplit, setSplitLayout, closeSplitView,
    glanceViews, openGlance, closeGlance, expandGlance, splitGlance,
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
    setPageAgentTargetTabId,
  } = useBrowserAgentStore();
  const showAciViewport = agentStatus === 'Running' || agentStatus === 'WaitingApproval' || agentStatus === 'Blocked';
  const showPageAgentTakeover = pageAgentStatus === 'running';

  useEffect(() => {
    setIsBrowserCapsuleMounted(true);
    return () => { setIsBrowserCapsuleMounted(false); };
  }, [setIsBrowserCapsuleMounted]);
  const { shortcuts, addShortcut, removeShortcut } = useBrowserShortcutsStore();
  const allExtensions = useBrowserExtensionsStore((s) => s.extensions);
  const enabledExtensions = useMemo(() => allExtensions.filter((e) => e.enabled && e.installStatus !== 'pending'), [allExtensions]);
  useExtensionBridge();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.essential || (tab.workspaceId || activeWorkspaceId) === activeWorkspaceId),
    [tabs, activeWorkspaceId],
  );
  const activeSplit = splitViews[activeWorkspaceId];
  const activeGlance = glanceViews[activeWorkspaceId];
  const splitTabs = useMemo(() => (activeSplit?.tabIds || []).map((id) => tabs.find((tab) => tab.id === id)).filter(Boolean) as BrowserTab[], [activeSplit, tabs]);
  const previousSplitPaneCountRef = useRef(0);
  const previousChatPaneOpenRef = useRef(chatPaneOpen);
  const addNextTabToSplit = useCallback(() => {
    const candidate = visibleTabs.find((tab) => tab.id !== activeTabId && !activeSplit?.tabIds.includes(tab.id));
    if (candidate) addTabToSplit(candidate.id);
  }, [visibleTabs, activeTabId, activeSplit, addTabToSplit]);

  useEffect(() => {
    const handleSplitShortcuts = (event: KeyboardEvent) => {
      if (!event.altKey || !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      if (!['h', 'v', 'g', 'u'].includes(key)) return;
      event.preventDefault();
      if (key === 'u') return closeSplitView();
      if (!activeSplit) addNextTabToSplit();
      setSplitLayout(key === 'h' ? 'horizontal' : key === 'v' ? 'vertical' : 'grid');
    };
    window.addEventListener('keydown', handleSplitShortcuts);
    return () => window.removeEventListener('keydown', handleSplitShortcuts);
  }, [activeSplit, addNextTabToSplit, closeSplitView, setSplitLayout]);

  useEffect(() => {
    const handleBrowserShortcuts = (event: KeyboardEvent) => {
      if (compactMode && event.key === 'Escape') {
        event.preventDefault();
        toggleCompactMode();
        return;
      }
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        const current = visibleTabs.findIndex((tab) => tab.id === activeTabId);
        const direction = event.shiftKey ? -1 : 1;
        const next = (current + direction + visibleTabs.length) % visibleTabs.length;
        if (visibleTabs[next]) setActiveTab(visibleTabs[next].id);
        return;
      }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        toggleCompactMode();
        return;
      }
      if (event.ctrlKey && event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        event.preventDefault();
        const current = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId);
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const next = (current + direction + workspaces.length) % workspaces.length;
        if (workspaces[next]) setActiveWorkspace(workspaces[next].id);
      }
    };
    window.addEventListener('keydown', handleBrowserShortcuts);
    return () => window.removeEventListener('keydown', handleBrowserShortcuts);
  }, [visibleTabs, activeTabId, workspaces, activeWorkspaceId, compactMode, setActiveTab, setActiveWorkspace, toggleCompactMode]);

  useEffect(() => {
    const previousCount = previousSplitPaneCountRef.current;
    if (splitTabs.length > 1 && previousCount < 2) {
      if (chatPaneOpen) toggleChatPane();
      if (verticalTabs && !tabSidebarCollapsed) toggleTabSidebar();
    }
    previousSplitPaneCountRef.current = splitTabs.length;
  }, [splitTabs.length, chatPaneOpen, toggleChatPane, verticalTabs, tabSidebarCollapsed, toggleTabSidebar]);

  useEffect(() => {
    const justOpened = chatPaneOpen && !previousChatPaneOpenRef.current;
    if (justOpened && verticalTabs && !tabSidebarCollapsed) toggleTabSidebar();
    if (chatPaneOpen && (viewportRef.current?.parentElement?.clientWidth || 0) < 1000 && chatPaneWidth > 340) setChatPaneWidth(340);
    previousChatPaneOpenRef.current = chatPaneOpen;
  }, [chatPaneOpen, verticalTabs, tabSidebarCollapsed, toggleTabSidebar, chatPaneWidth, setChatPaneWidth]);
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
  const [officePopupId, setOfficePopupId] = useState<string | null>(null);
  const agentActive = agentModeControl !== 'Human';
  const [urlFocused, setUrlFocused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const trustedOfficeHost = activeTab?.contentType === 'web' ? isTrustedOfficeHost((activeTab as WebTab).url) : false;
  const activeOfficeHost = activeTab?.contentType === 'web' ? getOfficeHostFromUrl((activeTab as WebTab).url) : null;
  const activeOfficeExtension = activeOfficeHost ? allExtensions.find((extension) => extension.officeHost === activeOfficeHost && extension.enabled) : undefined;
  const officeTabAttached = Boolean(trustedOfficeHost && activeTab?.extensionIds?.some((id) => id.startsWith('allternit-office-')));
  const officeHostRequiresDesktopEmbed = trustedOfficeHost && !isElectronShell();
  const [copiedDesktopCommand, setCopiedDesktopCommand] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showHomePage, setShowHomePage] = useState(false);
  const [isResizingChatPane, setIsResizingChatPane] = useState(false);
  const [findBarOpen, setFindBarOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceDeleteArmed, setWorkspaceDeleteArmed] = useState(false);
  const [narrowBrowser, setNarrowBrowser] = useState(false);

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

  const activeDomain = useMemo(() => {
    if (!activeTab || activeTab.contentType !== 'web') return undefined;
    try {
      return new URL((activeTab as WebTab).url).hostname;
    } catch {
      return undefined;
    }
  }, [activeTab]);

  useEffect(() => { setFindBarOpen(false); }, [activeTabId]);

  useEffect(() => {
    // Binding refresh polls GET /api/v1/office/bindings. When the flag is on
    // the handler is served by the cloud-api control plane (Clerk bearer, see
    // cloudApiFetch); the flag guard below keeps the fail-closed behavior
    // (tab left unbound) in deployments where it is off.
    if (!isOfficeApiEnabled()) return;
    if (!activeOfficeHost || !activeTabId || !officeTabAttached) return;
    let cancelled = false;
    const refreshBinding = async () => {
      try {
        const response = await cloudApiFetch('/api/v1/office/bindings');
        if (!response.ok) return;
        const payload = await response.json() as { bindings?: Array<{ id: string; host?: string; title?: string; label?: string; connected?: boolean }> };
        const binding = payload.bindings?.find((item) => item.host === activeOfficeHost);
        if (!cancelled && binding) updateTab(activeTabId, { officeBindingId: binding.id, officeDocumentTitle: binding.title || binding.label, officeBindingConnected: binding.connected !== false });
      } catch {
        if (!cancelled) updateTab(activeTabId, { officeBindingConnected: false });
      }
    };
    void refreshBinding();
    const interval = window.setInterval(refreshBinding, 10_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [activeOfficeHost, activeTabId, officeTabAttached, updateTab]);

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

  const handleBookmark = useCallback(() => {
    if (!activeTab || activeTab.contentType !== 'web') return;
    const url = (activeTab as WebTab).url;
    const title = activeTab.title || url;
    if (isBookmarked) {
      const bookmark = shortcuts.find((shortcut) => shortcut.url === url);
      if (bookmark) removeShortcut(bookmark.id);
      return;
    }
    addShortcut({ label: title, url, icon: '⭐' });
  }, [activeTab, isBookmarked, shortcuts, addShortcut, removeShortcut]);

  const attachOfficeExtension = useCallback((extension: BrowserExtension, tabId: string) => {
    const tab = useBrowserStore.getState().tabs.find((item) => item.id === tabId);
    const tabExtensionIds = Array.from(new Set([...(tab?.extensionIds || []), extension.id]));
    updateTab(tabId, { extensionIds: tabExtensionIds });
    const workspace = useBrowserStore.getState().workspaces.find((item) => item.id === activeWorkspaceId);
    updateWorkspace(activeWorkspaceId, { extensionIds: Array.from(new Set([...(workspace?.extensionIds || []), extension.id])) });
    setPageAgentTargetTabId(tabId);
    if (!chatPaneOpen) toggleChatPane();
  }, [activeWorkspaceId, chatPaneOpen, setPageAgentTargetTabId, toggleChatPane, updateTab, updateWorkspace]);

  const detachOfficeExtension = useCallback((extension: BrowserExtension, tabId: string) => {
    const tab = useBrowserStore.getState().tabs.find((item) => item.id === tabId);
    updateTab(tabId, { extensionIds: (tab?.extensionIds || []).filter((id) => id !== extension.id) });
    if (pageAgentTargetTabId === tabId) setPageAgentTargetTabId(null);
  }, [pageAgentTargetTabId, setPageAgentTargetTabId, updateTab]);

  const handleRefresh = useCallback(() => {
    if (!activeTabId) return;
    setIframeLoaded(false);
    setIframeError(false);
    setTabLoading(activeTabId, true);
    const webview = viewportRef.current?.querySelector('webview') as (HTMLElement & { reload?: () => void }) | null;
    if (isElectronShell() && webview?.reload) webview.reload();
    else setReloadNonce((value) => value + 1);
  }, [activeTabId, setTabLoading]);

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

  useEffect(() => {
    const container = viewportRef.current?.parentElement;
    if (!container) return;
    const update = () => setNarrowBrowser(container.clientWidth < 800);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <div data-testid="browser-capsule-enhanced-root" className="flex flex-col size-full flex-1 min-h-0 min-w-0 relative overflow-hidden bg-[var(--shell-view-bg,var(--view-browser-bg))] text-[var(--shell-item-fg,var(--text-primary))] font-sans select-none">

        {/* When the shell rail is collapsed, its floating rail controls (and the
            frameless window's traffic lights) overlay the left end of this
            chrome — push the Workspaces strip right so they never collide. */}
        <style>{`[data-shell-frame][data-rail-collapsed="true"] [data-browser-workspaces-strip] { padding-left: var(--workspaces-strip-clearance, 148px); }`}</style>

        {/* Workspaces are browser sessions with their own tabs and Allternit context. */}
        {!compactMode && <div data-browser-workspaces-strip="" className="h-9 shrink-0 flex items-center gap-1 px-2 bg-[var(--shell-rail-bg)] border-b border-solid border-[var(--shell-divider)]" style={{ '--workspaces-strip-clearance': isElectronShell() ? '148px' : '56px' } as React.CSSProperties}>
          <div className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none] flex-1">
            <span className="px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--shell-item-muted)]">Workspaces</span>
            {workspaces.map((workspace) => <button key={workspace.id} type="button" onClick={() => { setActiveWorkspace(workspace.id); setWorkspaceDeleteArmed(false); }} title={`Switch to ${workspace.name}`} className={cn("h-7 px-2.5 rounded-lg border border-solid flex items-center gap-1.5 cursor-pointer text-[12px] font-semibold whitespace-nowrap transition-colors relative", workspace.id === activeWorkspaceId ? "bg-[var(--shell-item-active-bg)] border-[var(--accent-browser)]/30 text-[var(--shell-item-active-fg)] after:absolute after:left-2 after:right-2 after:-bottom-[5px] after:h-0.5 after:rounded-full after:bg-[var(--accent-browser)]" : "bg-transparent border-transparent text-[var(--shell-item-muted)] hover:bg-[var(--shell-item-hover)]")}><span style={{ color: workspace.color }}>{workspace.icon}</span>{workspace.name}<span className="text-[9px] opacity-50">{tabs.filter((tab) => tab.workspaceId === workspace.id && !tab.essential).length}</span></button>)}
            <button type="button" onClick={() => addWorkspace(`Workspace ${workspaces.length + 1}`)} title="New workspace" className="size-7 rounded-lg border-none bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center justify-center"><Plus size={14} /></button>
          </div>
          <button type="button" onClick={() => setWorkspaceSettingsOpen((open) => !open)} title="Workspace settings" className="size-7 rounded-lg border-none bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center justify-center"><GearSix size={14} /></button>
          <button type="button" onClick={toggleVerticalTabs} title={verticalTabs ? "Use horizontal tabs" : "Use vertical tabs"} className="h-7 px-2 rounded-lg border-none bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center gap-1.5 text-[11px]">{verticalTabs ? '↔' : '↕'} Tabs</button>
          <button type="button" onClick={toggleCompactMode} title="Enter focus mode" className="h-7 px-2 rounded-lg border-none bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)] cursor-pointer flex items-center gap-1.5 text-[11px]"><SquaresFour size={14} /> Focus</button>
        </div>}
        {workspaceSettingsOpen && !compactMode && (() => { const workspace = workspaces.find((item) => item.id === activeWorkspaceId); return workspace ? <WorkspaceSettingsPanel workspace={workspace} workspaces={workspaces} deleteArmed={workspaceDeleteArmed} onClose={() => { setWorkspaceSettingsOpen(false); setWorkspaceDeleteArmed(false); }} onUpdate={(updates) => updateWorkspace(workspace.id, updates)} onDuplicate={() => { duplicateWorkspace(workspace.id); setWorkspaceDeleteArmed(false); }} onReorder={(direction) => reorderWorkspace(workspace.id, direction)} onArmDelete={() => setWorkspaceDeleteArmed(true)} onDelete={() => { removeWorkspace(workspace.id); setWorkspaceSettingsOpen(false); setWorkspaceDeleteArmed(false); }} /> : null; })()}

        {/* ━━━ ROW 1: TAB BAR ━━━ */}
        {!compactMode && !verticalTabs && <div
          className="h-9 min-h-9 max-h-9 flex flex-row items-end px-1 bg-[var(--shell-rail-bg)] shrink-0 relative"
          onDoubleClick={(e) => { if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-tab-bar-space]')) addTab('about:blank'); }}
        >
          <div data-tab-bar-space ref={tabBarRef} onWheel={(e) => { e.preventDefault(); tabBarRef.current?.scrollBy({ left: e.deltaY, behavior: 'smooth' }); }} className="flex-1 flex flex-row items-end overflow-x-auto overflow-y-hidden [scrollbar-width:none] min-w-0 gap-0.5 pb-1 pl-0.5">
            {visibleTabs.map((tab, index) => {
              const isActive = tab.id === activeTabId;
              const isLoading = tabLoading[tab.id];
              const isMounted = pageAgentTargetTabId === tab.id;
              const isAgentRunning = isMounted && pageAgentStatus === 'running';
              const isPinned = tab.pinned ?? false;
              const showTitle = isActive || isHoveringTab === tab.id || visibleTabs.length <= 3;
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
                  {(isActive || isHoveringTab === tab.id) && !isPinned && <button type="button" aria-label={`Close ${tab.title || 'tab'}`} onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }} className="ml-0.5 p-0.5 rounded-full border-none bg-transparent cursor-pointer text-inherit opacity-50 flex shrink-0 hover:bg-[var(--ui-border-default)] hover:opacity-100"><X size={10} /></button>}
                </div>
              );
            })}
            <m.button onClick={() => addTab('about:blank')} title="New Tab" whileHover={{ y: -1, scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ duration: 0.15 }} className="h-7 w-7 flex items-center justify-center rounded border-none bg-transparent cursor-pointer text-[var(--text-tertiary)] shrink-0 ml-0.5 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"><Plus size={14} /></m.button>
          </div>
          <div className="relative flex items-center h-full pr-1 gap-0.5">
            <NavBtn title="Show all tabs" onClick={() => setTabDropdownOpen(!tabDropdownOpen)}><CaretDown className="size-4" /></NavBtn>
            <TabOverflowDropdown open={tabDropdownOpen} onClose={() => setTabDropdownOpen(false)} tabs={tabs} activeTabId={activeTabId} onSelect={setActiveTab} onCloseTab={closeTab} />
            {visibleTabs.length > 0 && <NavBtn title="Close all tabs" onClick={handleCloseAllTabs}><X className="size-4" /></NavBtn>}
          </div>
        </div>}

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
        {!compactMode && <div className="h-0.5 shrink-0 bg-[linear-gradient(90deg,transparent,var(--accent-primary),transparent)] opacity-40 origin-left animate-[browserAccentSlide_1.2s_ease-out]" />}

        {/* ━━━ ROW 2: NAV BAR ━━━ */}
        {!compactMode && <div className="h-10 min-h-10 max-h-10 flex flex-row items-center gap-2 px-2 bg-[var(--shell-rail-bg)] border-b border-solid border-[var(--shell-divider)] shrink-0 z-20">
          <div className="flex flex-row items-center gap-0.5">
            <NavBtn title="Back" onClick={() => activeTabId && goBack(activeTabId)} disabled={!canBack}><CaretLeft className="size-4" /></NavBtn>
            <NavBtn title="Forward" onClick={() => activeTabId && goForward(activeTabId)} disabled={!canForward}><CaretRight className="size-4" /></NavBtn>
            <NavBtn title="Reload page" onClick={handleRefresh} disabled={!activeTabId}><ArrowsClockwise className="size-4" /></NavBtn>
          </div>
          <form onSubmit={handleNavigate} className="flex-1 min-w-0 relative flex items-center gap-2">
            <div className="flex items-center h-8 bg-[var(--bg-primary)] rounded-full px-4 flex-1">
              {activeTab && activeTab.contentType === 'web' && (activeTab as WebTab).url.startsWith('https://') && <Lock className="size-3.5 text-[var(--text-tertiary)] mr-2 shrink-0" />}
              <input aria-label="Address and search bar" type="text" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (e.altKey) { openGlance(urlInput, urlInput, activeTabId || undefined); setUrlFocused(false); } else handleNavigate(); } }} onFocus={() => setUrlFocused(true)} onBlur={() => setTimeout(() => setUrlFocused(false), 200)} className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] font-inherit min-w-0" placeholder={activeTab ? "Enter URL or search…" : "Search or type a URL"} />
            </div>
            <UrlAutocomplete query={urlInput} visible={urlFocused} onSelect={(url) => { setUrlInput(url); setUrlFocused(false); if (activeTabId) { updateTab(activeTabId, { url, title: url } as Partial<WebTab>); pushHistory(activeTabId, url); setTabLoading(activeTabId, true); setIframeLoaded(false); setIframeError(false); } else addTab(url); }} />
          </form>
          <NavBtn title={isBookmarked ? "Bookmarked" : "Bookmark this page"} onClick={handleBookmark} active={isBookmarked}><Star className="size-4" style={{ fill: isBookmarked ? 'var(--accent-primary)' : 'none' }} /></NavBtn>
          <NavBtn title="Find in page" onClick={() => setFindBarOpen((v) => !v)} active={findBarOpen}><MagnifyingGlass className="size-4" /></NavBtn>
          <BrowserApiCaptureButton domain={activeDomain} disabled={!activeTab || activeTab.contentType !== 'web' || (activeTab as WebTab).url === 'about:blank'} onOpenSiteApis={toggleChatPane} />
          <NavBtn title={activeSplit ? "Add another tab to Split View" : "Split with another tab"} onClick={addNextTabToSplit} disabled={visibleTabs.length < 2 || splitTabs.length >= 4} active={splitTabs.length > 1}><SquaresFour className="size-4" /></NavBtn>
          {activeSplit && <div className="flex items-center rounded-lg bg-[var(--bg-primary)] p-0.5">
            <button type="button" title="Side-by-side Split View" onClick={() => setSplitLayout('horizontal')} className={cn("px-1.5 py-1 border-none rounded cursor-pointer text-[10px]", activeSplit.layout === 'horizontal' ? "bg-[var(--bg-active)] text-[var(--accent-primary)]" : "bg-transparent text-[var(--text-tertiary)]")}>Ⅱ</button>
            <button type="button" title="Stacked Split View" onClick={() => setSplitLayout('vertical')} className={cn("px-1.5 py-1 border-none rounded cursor-pointer text-[10px]", activeSplit.layout === 'vertical' ? "bg-[var(--bg-active)] text-[var(--accent-primary)]" : "bg-transparent text-[var(--text-tertiary)]")}>＝</button>
            <button type="button" title="Grid Split View" onClick={() => setSplitLayout('grid')} className={cn("px-1.5 py-1 border-none rounded cursor-pointer text-[10px]", activeSplit.layout === 'grid' ? "bg-[var(--bg-active)] text-[var(--accent-primary)]" : "bg-transparent text-[var(--text-tertiary)]")}>▦</button>
            <button type="button" title="Close Split View" onClick={closeSplitView} className="px-1.5 py-1 border-none rounded cursor-pointer bg-transparent text-[var(--text-tertiary)] hover:bg-[var(--bg-hover)]"><X size={11} /></button>
          </div>}

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
            ext.officeHost ? <div key={ext.id} className="relative">
              <NavBtn title={`${ext.name} — browser extension controls`} onClick={() => setOfficePopupId((current) => current === ext.id ? null : ext.id)} active={officePopupId === ext.id || (trustedOfficeHost && Boolean(activeTabId && pageAgentTargetTabId === activeTabId))}><ExtensionStoreIcon storeUrl={ext.storeUrl} fallbackIcon={ext.icon} size={16} /></NavBtn>
              {officePopupId === ext.id && <OfficeExtensionPopup extension={ext} currentUrl={activeTab?.contentType === 'web' ? (activeTab as WebTab).url : undefined} attached={Boolean(activeTab?.extensionIds?.includes(ext.id))} onClose={() => setOfficePopupId(null)} onOpen={(url) => { const tabId = addTab(url); attachOfficeExtension(ext, tabId); }} onAttach={() => { if (activeTabId) attachOfficeExtension(ext, activeTabId); }} onDetach={() => { if (activeTabId) detachOfficeExtension(ext, activeTabId); }} />}
            </div> : <NavBtn
              key={ext.id}
              title={`Open ${ext.name}`}
              onClick={ext.storeUrl ? () => addTab(ext.storeUrl!) : undefined}
              disabled={!ext.storeUrl}
            ><ExtensionStoreIcon storeUrl={ext.storeUrl} fallbackIcon={ext.icon} size={16} /></NavBtn>
          ))}

          <div className="relative">
            <NavBtn title="Extensions" onClick={() => setExtensionPopupOpen(!extensionPopupOpen)}><Puzzle className="size-4" /></NavBtn>
            <ExtensionManagerPopup open={extensionPopupOpen} onClose={() => setExtensionPopupOpen(false)} onNavigate={addTab} />
          </div>

          <div className="relative">
            <NavBtn title="More" onClick={() => setMenuOpen(!menuOpen)}><DotsThreeVertical className="size-4" /></NavBtn>
            <ThreeDotMenu open={menuOpen} onClose={() => setMenuOpen(false)} onNewTab={() => addTab('about:blank')} onToggleChatPane={toggleChatPane} chatPaneOpen={chatPaneOpen} onCloseAllTabs={handleCloseAllTabs} onEnterFocusMode={toggleCompactMode} zoomLevel={zoomLevel} onZoomIn={() => setZoomLevel((z) => Math.min(z + 0.1, 3))} onZoomOut={() => setZoomLevel((z) => Math.max(z - 0.1, 0.3))} onZoomReset={() => setZoomLevel(1)} />
          </div>
        </div>}

        {/* ━━━ VIEWPORT + CHAT PANE ━━━ */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden relative">
          {!compactMode && verticalTabs && <aside aria-label="Browser tabs" className={cn("shrink-0 flex flex-col min-h-0 border-r border-solid border-[var(--shell-divider)] bg-[var(--shell-rail-bg)] gap-1 transition-[width] duration-200", tabSidebarCollapsed ? "w-12 p-1.5" : "w-[216px] p-2")}>
            <button type="button" onClick={toggleTabSidebar} title={tabSidebarCollapsed ? "Expand tab sidebar" : "Collapse tab sidebar"} className={cn("h-7 rounded-lg border-none bg-transparent text-[var(--shell-item-muted)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center", tabSidebarCollapsed ? "justify-center" : "justify-end px-1.5")}><CaretLeft size={13} className={cn("transition-transform", tabSidebarCollapsed && "rotate-180")} /></button>
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
              {[...visibleTabs].sort((a, b) => Number(Boolean(b.essential)) - Number(Boolean(a.essential))).map((tab) => <button type="button" title={tabSidebarCollapsed ? tab.title || 'New Tab' : undefined} key={tab.id} onClick={() => setActiveTab(tab.id)} onContextMenu={(event) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY, tabId: tab.id }); }} className={cn("group h-9 w-full rounded-lg border border-solid flex items-center cursor-pointer text-left transition-colors", tabSidebarCollapsed ? "justify-center px-0" : "px-2 gap-2", tab.id === activeTabId ? "bg-[var(--shell-item-active-bg)] border-[var(--accent-browser)]/25 text-[var(--shell-item-active-fg)]" : "bg-transparent border-transparent text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)]")}><span className="relative shrink-0"><TabFavicon url={tab.contentType === 'web' ? (tab as WebTab).url : undefined} size={14} />{tab.essential && <Star size={8} weight="fill" className="absolute -right-1 -bottom-1 text-[var(--accent-browser)]" />}</span>{!tabSidebarCollapsed && <><span className="flex-1 min-w-0 truncate text-[12px] font-medium">{tab.title || 'New Tab'}</span><span onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} className="opacity-0 group-hover:opacity-70 hover:opacity-100"><X size={11} /></span></>}</button>)}
            </div>
            <button type="button" title="New tab" onClick={() => addTab('about:blank')} className={cn("h-9 w-full rounded-lg border-none bg-transparent text-[var(--shell-item-fg)] hover:bg-[var(--shell-item-hover)] cursor-pointer flex items-center text-[12px]", tabSidebarCollapsed ? "justify-center" : "px-2 gap-2")}><Plus size={14} />{!tabSidebarCollapsed && ' New tab'}</button>
          </aside>}
          <div ref={viewportRef} className="flex-1 relative overflow-hidden min-h-0 min-w-0">
            {compactMode && <button type="button" onClick={toggleCompactMode} title="Exit focus mode (Esc)" aria-label="Exit focus mode" className="absolute top-3 left-1/2 -translate-x-1/2 z-[60] h-8 px-3 rounded-full border border-solid border-[var(--border-subtle)] bg-[var(--shell-rail-bg)] text-[var(--shell-item-fg)] shadow-md cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold hover:bg-[var(--shell-item-hover)]"><X size={13} /> Exit Focus <span className="opacity-60">Esc</span></button>}
            {trustedOfficeHost && activeOfficeHost && <div data-testid="office-browser-context-bar" className="absolute left-1/2 top-2 z-[35] flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-2 rounded-full border border-solid border-[var(--shell-divider)] bg-[var(--shell-floating-bg)]/95 px-2 py-1 shadow-lg backdrop-blur-md">
              <span className="flex size-6 items-center justify-center rounded-full text-[10px] font-black" style={{ color: OFFICE_HOST_META[activeOfficeHost].color, background: `color-mix(in srgb, ${OFFICE_HOST_META[activeOfficeHost].color} 14%, transparent)` }}>{activeOfficeHost === 'powerpoint' ? 'P' : activeOfficeHost === 'excel' ? 'X' : 'W'}</span>
              <span className="min-w-0 truncate text-[10px] font-semibold text-[var(--shell-item-fg)]">{activeTab?.officeDocumentTitle || `${OFFICE_HOST_META[activeOfficeHost].label} in Allternit Browser`}</span>
              <span className={cn("flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold", officeTabAttached ? "bg-green-500/10 text-green-600" : "bg-[var(--shell-item-hover)] text-[var(--shell-item-muted)]")}><span className={cn("size-1.5 rounded-full", officeTabAttached ? "bg-green-500" : "bg-amber-500")} />{officeTabAttached ? 'Agent attached' : 'Not attached'}</span>
              {activeTab?.officeBindingId && <span title={`Office binding ${activeTab.officeBindingId}`} className={cn("hidden sm:flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold", activeTab?.officeBindingConnected ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600")}><span className={cn("size-1.5 rounded-full", activeTab?.officeBindingConnected ? "bg-green-500" : "bg-amber-500")} />{activeTab?.officeBindingConnected ? 'Bridge live' : 'Bridge reconnecting'}</span>}
              <button type="button" onClick={() => { if (activeTabId && activeOfficeExtension) attachOfficeExtension(activeOfficeExtension, activeTabId); else if (!chatPaneOpen) toggleChatPane(); }} className="h-6 rounded-full border-none bg-[var(--accent-browser)] px-2.5 text-[9px] font-bold text-white cursor-pointer hover:brightness-110">{officeTabAttached ? 'Open Agent' : activeOfficeExtension ? 'Attach Agent' : 'Enable Extension'}</button>
            </div>}
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

            {splitTabs.length > 1 ? (
              <div data-testid="browser-split-view" className={cn("size-full grid gap-px bg-[var(--border-subtle)]", activeSplit?.layout === 'vertical' ? "grid-cols-1" : activeSplit?.layout === 'grid' ? "grid-cols-2" : `grid-cols-${Math.min(splitTabs.length, 4)}`)} style={activeSplit?.layout === 'horizontal' ? { gridTemplateColumns: `repeat(${splitTabs.length}, minmax(0, 1fr))` } : activeSplit?.layout === 'vertical' ? { gridTemplateRows: `repeat(${splitTabs.length}, minmax(0, 1fr))` } : undefined}>
                {splitTabs.map((splitTab, splitIndex) => <div key={splitTab.id} onMouseDown={() => setActiveTab(splitTab.id)} className={cn("relative min-w-0 min-h-0 bg-white overflow-hidden", activeSplit?.layout === 'grid' && splitTabs.length === 3 && splitIndex === 2 && "col-span-2", splitTab.id === activeTabId && "ring-2 ring-inset ring-[var(--accent-primary)]")}>
                  <div className="absolute top-2 left-2 right-2 z-20 flex justify-between pointer-events-none"><div className="max-w-[70%] truncate rounded-md bg-[var(--bg-secondary)]/90 border border-solid border-[var(--border-subtle)] px-2 py-1 text-[10px] text-[var(--text-secondary)] shadow-sm">{splitTab.title}</div><button type="button" onClick={(event) => { event.stopPropagation(); removeTabFromSplit(splitTab.id); }} className="pointer-events-auto size-6 rounded-full border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]/90 text-[var(--text-secondary)] cursor-pointer flex items-center justify-center"><Minus size={11} /></button></div>
                  {splitTab.contentType === 'web' && (splitTab as WebTab).url !== 'about:blank' ? (isElectronShell() ? <webview data-testid={`split-webview-${splitTab.id}`} src={(splitTab as WebTab).url} className="size-full border-none bg-white" allowpopups="true" /> : <iframe title={splitTab.title} data-testid={`split-iframe-${splitTab.id}`} src={getWebProxyUrl((splitTab as WebTab).url)} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-modals allow-pointer-lock allow-downloads allow-storage-access-by-user-activation" className="size-full border-none bg-white" />) : <div className="size-full flex items-center justify-center bg-[var(--bg-primary)] text-[12px] text-[var(--text-tertiary)]">This surface opens outside Split View</div>}
                </div>)}
              </div>
            ) : contentMode === 'web' ? (
              activeTab && activeTab.contentType === 'web' && (activeTab as WebTab).url !== 'about:blank' ? (
                <div className="size-full relative overflow-auto">
                  <div className="origin-top-left" style={{ width: `${100 / zoomLevel}%`, height: `${100 / zoomLevel}%`, transform: `scale(${zoomLevel})` }}>
                    {isElectronShell() ? <webview key={`${activeTab.id}-${reloadNonce}`} data-testid="allternit-webview-content" src={(activeTab as WebTab).url} partition={trustedOfficeHost ? "persist:allternit-office-web" : undefined} className="size-full border-none bg-white" allowpopups="true" onloadstart={() => { setIframeLoaded(false); setIframeError(false); if (activeTabId) setTabLoading(activeTabId, true); }} onloadstop={() => { setIframeLoaded(true); if (activeTabId) setTabLoading(activeTabId, false); }} onerror={() => { setIframeError(true); if (activeTabId) setTabLoading(activeTabId, false); }} {...({ 'ondid-fail-load': () => { setIframeError(true); if (activeTabId) setTabLoading(activeTabId, false); } } as any)} /> : trustedOfficeHost ? (
                      <div className="flex size-full items-center justify-center bg-[linear-gradient(180deg,#f7f8fc_0%,#eef3fb_100%)] px-6">
                        <div className="max-w-xl rounded-3xl border border-[rgba(15,23,42,0.08)] bg-white/95 p-7 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
                          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]">
                            <Globe size={22} weight="fill" />
                          </div>
                          <div className="text-[18px] font-semibold text-[var(--text-primary)]">Open this Office session in the desktop shell</div>
                          <div className="mt-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">Office on the web is only treated as a real Allternit surface when it is mounted in the Electron desktop shell webview. This browser build will not render the Office product inline.</div>
                        </div>
                      </div>
                    ) : <iframe key={`${activeTab.id}-${reloadNonce}`} ref={iframeRef} data-testid="allternit-iframe-content" src={getWebProxyUrl((activeTab as WebTab).url)} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-modals allow-pointer-lock allow-downloads allow-storage-access-by-user-activation" allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="no-referrer" className="size-full border-none bg-white" onLoad={handleIframeLoad} onError={() => { setIframeError(true); if (activeTabId) setTabLoading(activeTabId, false); }} />}
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
            {activeGlance && <div data-testid="browser-glance" className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 p-[clamp(20px,5vw,72px)]" onMouseDown={(event) => { if (event.target === event.currentTarget) closeGlance(); }}>
              <div className="size-full max-w-[1180px] max-h-[820px] overflow-hidden rounded-2xl border border-solid border-[var(--border-strong)] bg-[var(--bg-secondary)] shadow-2xl flex flex-col">
                <div className="h-10 shrink-0 flex items-center gap-2 px-3 border-b border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)]"><Globe size={14} className="text-[var(--accent-primary)]" /><div className="flex-1 min-w-0 truncate text-[12px] font-semibold text-[var(--text-primary)]">{activeGlance.title}</div><button type="button" onClick={splitGlance} className="h-7 px-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] cursor-pointer text-[11px] hover:bg-[var(--bg-hover)]">Add to Split</button><button type="button" onClick={expandGlance} className="h-7 px-2.5 rounded-lg border border-solid border-[var(--border-subtle)] bg-transparent text-[var(--text-secondary)] cursor-pointer text-[11px] hover:bg-[var(--bg-hover)]">Open Tab</button><button type="button" aria-label="Close Glance" onClick={closeGlance} className="size-7 rounded-full border-none bg-transparent text-[var(--text-secondary)] cursor-pointer flex items-center justify-center hover:bg-[var(--bg-hover)]"><X size={14} /></button></div>
                <div className="flex-1 min-h-0 bg-white">{isElectronShell() ? <webview src={activeGlance.url} className="size-full border-none" allowpopups="true" /> : <iframe title={`Glance: ${activeGlance.title}`} src={getWebProxyUrl(activeGlance.url)} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-modals allow-downloads" className="size-full border-none" />}</div>
              </div>
            </div>}
          </div>

          {chatPaneOpen && (
            <>
              {!narrowBrowser && <div role="separator" aria-label="Resize browser chat pane" onPointerDown={handleChatPaneResizePointerStart} onMouseDown={handleChatPaneResizeMouseStart} className={cn("w-2 shrink-0 cursor-col-resize relative transition-colors", isResizingChatPane ? "bg-[var(--surface-hover)]" : "bg-transparent")}>
                <div className={cn("absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px transition-colors", isResizingChatPane ? "bg-[var(--accent-primary)]" : "bg-[var(--border-subtle)]")} />
              </div>}
              <div className={cn("border-l border-solid border-[var(--shell-divider)] overflow-hidden", narrowBrowser ? "absolute z-30 right-0 top-0 bottom-0 shadow-2xl bg-[var(--shell-floating-bg)]" : "shrink-0 relative")} style={{ width: narrowBrowser ? `min(${chatPaneWidth}px, calc(100% - 56px))` : chatPaneWidth, minWidth: narrowBrowser ? 0 : BROWSER_CHAT_PANE_MIN_WIDTH }}>
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
