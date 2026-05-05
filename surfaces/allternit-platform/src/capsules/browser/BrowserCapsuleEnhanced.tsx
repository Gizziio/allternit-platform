/**
 * BrowserCapsuleEnhanced - P5.2.2
 * Chrome-style browser with Claude-style chat sidebar
 *
 * Uses explicit inline styles for layout to avoid CSS conflicts
 * with the shell's deeply nested flex/grid hierarchy.
 */

"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Globe,
  ArrowsClockwise,
  Warning,
  Plus,
  X,
  Lock,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  CaretDown,
  DotsThreeVertical,
  Camera,
  SquaresFour,
  Sparkle,
  Star,
  PuzzlePiece as Puzzle,
  DownloadSimple,
  Trash,
  Copy,
  PushPin as Pin,
  CircleNotch,
  GearSix,
  Shield,
  ArrowLeft,
  Minus,
} from '@phosphor-icons/react';

import { AllternitLogo } from '@/components/AllternitLogo';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';
import { isElectronShell, getWebProxyUrl } from '@/lib/platform';

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
import { motion } from 'framer-motion';
import { BrowserIframeSkeleton } from './BrowserIframeSkeleton';
import { BrowserNewTabPage } from './BrowserNewTabPage';
import { BrowserFindBar } from './BrowserFindBar';
import { BrowserDownloadBar } from './BrowserDownloadBar';

// Design tokens for browser chrome
import {
  MODE_COLORS,
  BACKGROUND,
  TEXT,
  BORDER,
  SHADOW,
  STATUS,
} from '@/design/allternit.tokens';

const browserTokens = MODE_COLORS.browser;

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

// ============================================================================
// Extension Store (Zustand with persist)
// ============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
  { id: 'allternit-agent', name: 'Allternit Agent', description: 'AI-powered browsing automation', icon: '🤖', enabled: true, version: '1.0.0', installStatus: 'installed' },
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
  if (tab) return <div style={{ width: '100%', height: '100%', overflow: 'auto' }}><A2UIRenderer payload={tab.payload} /></div>;
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <div style={{ width: 40, height: 40, borderRadius: 4, background: 'rgba(168,85,247,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(168,85,247,0.2)' }}>
          <SquaresFour style={{ width: 20, height: 20, color: 'rgba(168,85,247,0.6)' }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(168,85,247,0.8)' }}>Canvas_Surface</div>
        </div>
      </div>
      <div style={{ flex: 1, background: 'var(--surface-hover)', borderRadius: 4, border: '1px solid var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', opacity: 0.1 }}>
          <SquaresFour style={{ width: 64, height: 64, margin: '0 auto 16px' }} />
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5em' }}>Waiting_for_signal...</p>
        </div>
      </div>
    </div>
  );
}

function StudioMode() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <div style={{ width: 40, height: 40, borderRadius: 4, background: 'var(--status-warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Sparkle style={{ width: 20, height: 20, color: 'rgba(245,158,11,0.6)' }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(245,158,11,0.8)' }}>A2UI_Studio</div>
        </div>
      </div>
      <div style={{ flex: 1, background: 'var(--surface-hover)', borderRadius: 4, border: '1px solid var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', opacity: 0.1 }}>
          <Sparkle style={{ width: 64, height: 64, margin: '0 auto 16px' }} />
          <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.5em' }}>Initialize_Workspace...</p>
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
    <div ref={ref} style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 224, maxHeight: 288, overflowY: 'auto', background: BACKGROUND.secondary, border: `1px solid ${BORDER.subtle}`, borderRadius: 8, boxShadow: SHADOW.md, zIndex: 50, padding: '4px 0' }}>
      <div style={{ padding: '6px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT.tertiary, fontWeight: 600 }}>Open Tabs ({tabs.length})</div>
      {tabs.map((tab) => (
        <div key={tab.id} onClick={() => { onSelect(tab.id); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', background: tab.id === activeTabId ? BACKGROUND.active : 'transparent', color: tab.id === activeTabId ? TEXT.primary : TEXT.tertiary }}
          onMouseEnter={(e) => e.currentTarget.style.background = BACKGROUND.hover}
          onMouseLeave={(e) => e.currentTarget.style.background = tab.id === activeTabId ? 'var(--surface-hover)' : 'transparent'}>
          <TabFavicon url={tab.contentType === 'web' ? (tab as WebTab).url : undefined} size={12} />
          <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.title || 'New Tab'}</span>
          <button onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }} style={{ padding: 2, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', opacity: 0.4 }}>
            <X style={{ width: 12, height: 12 }} />
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
    return <Globe style={{ width: size, height: size, flexShrink: 0, opacity: 0.5 }} />;
  }

  return (
    <img
      src={faviconSrc}
      alt=""
      onError={() => setError(true)}
      style={{ width: size, height: size, flexShrink: 0, borderRadius: 2 }}
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
    { label: isPinned ? 'Unpin Tab' : 'Pin Tab', icon: <Pin style={{ width: 12, height: 12 }} />, action: () => isPinned ? unpinTab(tabId) : pinTab(tabId) },
    { label: 'Duplicate Tab', icon: <Copy style={{ width: 12, height: 12 }} />, action: () => duplicateTab(tabId) },
  ];

  const groupItems = Array.from(allGroups.entries()).map(([name, color]) => ({
    label: `Group: ${name}`,
    icon: <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />,
    action: () => setTabGroup(tabId, name, color),
    active: tab?.group === name,
  }));

  const newGroupItems = GROUP_COLORS.map((color, i) => ({
    label: `New Group ${i + 1}`,
    icon: <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />,
    action: () => setTabGroup(tabId, `Group ${i + 1}`, color),
  }));

  return (
    <div ref={ref} style={{
      position: 'fixed', left: x, top: y, width: 180, background: BACKGROUND.secondary,
      border: `1px solid ${BORDER.subtle}`, borderRadius: 8, boxShadow: SHADOW.md,
      zIndex: 100, padding: '4px 0', fontSize: 12,
    }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px',
            border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT.secondary, fontSize: 12, textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = BACKGROUND.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          {item.icon}
          {item.label}
        </button>
      ))}
      <div style={{ height: 1, background: TEXT.tertiary, margin: '4px 0' }} />
      {groupItems.map((item, i) => (
        <button key={`g-${i}`} onClick={() => { item.action(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px',
            border: 'none', background: 'transparent', cursor: 'pointer', color: item.active ? browserTokens.accent : TEXT.secondary, fontSize: 12, textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = BACKGROUND.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          {item.icon}
          {item.label}
        </button>
      ))}
      {groupItems.length > 0 && <div style={{ height: 1, background: TEXT.tertiary, margin: '4px 0' }} />}
      {newGroupItems.map((item, i) => (
        <button key={`ng-${i}`} onClick={() => { item.action(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px',
            border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT.secondary, fontSize: 12, textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = BACKGROUND.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          {item.icon}
          {item.label}
        </button>
      ))}
      {inGroup && (
        <>
          <div style={{ height: 1, background: TEXT.tertiary, margin: '4px 0' }} />
          <button onClick={() => { removeTabFromGroup(tabId); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px',
              border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT.tertiary, fontSize: 12, textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = BACKGROUND.hover; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <X style={{ width: 12, height: 12 }} />
            Remove from Group
          </button>
        </>
      )}
      <div style={{ height: 1, background: TEXT.tertiary, margin: '4px 0' }} />
      <button onClick={() => { closeTab(tabId); onClose(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px',
          border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT.secondary, fontSize: 12, textAlign: 'left',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = BACKGROUND.hover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <X style={{ width: 12, height: 12 }} />
        Close Tab
      </button>
      <button onClick={() => { closeOtherTabs(tabId); onClose(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px',
          border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT.secondary, fontSize: 12, textAlign: 'left',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = BACKGROUND.hover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <X style={{ width: 12, height: 12 }} />
        Close Other Tabs
      </button>
      <button onClick={() => { closeTabsToRight(tabId); onClose(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px',
          border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT.secondary, fontSize: 12, textAlign: 'left',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = BACKGROUND.hover; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        <CaretRight style={{ width: 12, height: 12 }} />
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
    <div ref={ref} style={{
      position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4,
      background: BACKGROUND.secondary, border: `1px solid ${BORDER.subtle}`, borderRadius: 8,
      boxShadow: SHADOW.md, zIndex: 100, padding: '4px 0',
      maxHeight: 200, overflowY: 'auto',
    }}>
      {filtered.map((visit, i) => (
        <div key={i}
          onClick={() => onSelect(visit.url)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            cursor: 'pointer', color: TEXT.secondary, fontSize: 12,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = BACKGROUND.hover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <TabFavicon url={visit.url} size={14} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{visit.title}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: TEXT.tertiary }}>{visit.url}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Three-Dot Menu
// ============================================================================

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

  const Item = ({ label, icon, active, color, disabled, onClick }: { label: string; icon?: React.ReactNode; active?: boolean; color?: string; disabled?: boolean; onClick: () => void }) => (
    <button onClick={() => { onClick(); onClose(); }} disabled={disabled}
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', color: color || (active ? browserTokens.accent : TEXT.tertiary), fontSize: 12, textAlign: 'left', opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = BACKGROUND.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {icon || <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? browserTokens.accent : 'transparent' }} />}
      {label}
    </button>
  );

  return (
    <div ref={menuRef} style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 208, background: BACKGROUND.secondary, border: `1px solid ${BORDER.subtle}`, borderRadius: 8, boxShadow: SHADOW.md, zIndex: 50, padding: '4px 0', fontSize: 14 }}>
      <div style={{ padding: '6px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT.tertiary, fontWeight: 600 }}>View Mode</div>
      {(['web', 'canvas', 'studio'] as ContentMode[]).map((m) => <Item key={m} label={m.charAt(0).toUpperCase() + m.slice(1)} active={contentMode === m} onClick={() => setContentMode(m)} />)}
      <div style={{ height: 1, background: TEXT.tertiary, margin: '4px 0' }} />
      <div style={{ padding: '6px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT.tertiary, fontWeight: 600 }}>Agent Mode</div>
      {(['Human', 'Assist', 'Agent'] as BrowserAgentMode[]).map((m) => <Item key={m} label={m} active={agentModeControl === m} disabled={agentStatus === 'Running'} onClick={() => setAgentMode(m)} />)}
      <div style={{ height: 1, background: TEXT.tertiary, margin: '4px 0' }} />
      <Item label={chatPaneOpen ? 'Hide Chat Pane' : 'Open Chat Pane'} icon={<Sparkle style={{ width: 14, height: 14 }} />} onClick={onToggleChatPane} />
      <Item label="Screenshot" icon={<Camera style={{ width: 14, height: 14 }} />} onClick={onScreenshot} />
      <Item label="New Tab" icon={<Plus style={{ width: 14, height: 14 }} />} onClick={onNewTab} />
      <div style={{ height: 1, background: TEXT.tertiary, margin: '4px 0' }} />
      <div style={{ height: 1, background: TEXT.tertiary, margin: '4px 0' }} />
      <div style={{ padding: '6px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: TEXT.tertiary, fontWeight: 600 }}>Zoom</div>
      <Item label={`Zoom In (${Math.round((zoomLevel + 0.1) * 100)}%)`} icon={<Plus style={{ width: 14, height: 14 }} />} onClick={onZoomIn} />
      <Item label={`Zoom Out (${Math.round((zoomLevel - 0.1) * 100)}%)`} icon={<Minus style={{ width: 14, height: 14 }} />} onClick={onZoomOut} />
      <Item label="Reset Zoom" icon={<ArrowsClockwise style={{ width: 14, height: 14 }} />} onClick={onZoomReset} />
      <div style={{ height: 1, background: TEXT.tertiary, margin: '4px 0' }} />
      <Item label="Close All Tabs" icon={<X style={{ width: 14, height: 14 }} />} color="rgba(248,113,113,0.7)" onClick={onCloseAllTabs} />
    </div>
  );
}

// ============================================================================
// Agent Popup (MatrixLogo dropdown — agent mode/status)
// ============================================================================

const accentLineStyle = `@keyframes browserAccentSlide { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes tabLoadingSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.8); } }`;

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

  const RadioItem = ({ label, value }: { label: string; value: BrowserAgentMode }) => (
    <div
      onClick={() => status !== 'Running' && setMode(value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
        cursor: status === 'Running' ? 'not-allowed' : 'pointer',
        opacity: status === 'Running' ? 0.5 : 1,
        color: mode === value ? browserTokens.accent : TEXT.tertiary, fontSize: 12,
      }}
    >
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        border: `2px solid ${mode === value ? browserTokens.accent : TEXT.tertiary}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {mode === value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: browserTokens.accent }} />}
      </div>
      {label}
    </div>
  );

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 224,
      background: BACKGROUND.secondary, border: `1px solid ${BORDER.subtle}`, borderRadius: 8,
      boxShadow: SHADOW.md, zIndex: 50, padding: 0, fontSize: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid var(--ui-border-muted)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: TEXT.secondary, fontWeight: 600 }}>
          <ScaledMatrixLogo state={agentActive ? 'thinking' : 'idle'} displaySize={14} />
          <span>Allternit Agent</span>
        </div>
        <button
          onClick={() => setMode(agentActive ? 'Human' : 'Assist')}
          style={{
            padding: '2px 10px', borderRadius: 10, border: 'none', fontSize: 10, fontWeight: 700,
            background: agentActive ? browserTokens.accent : TEXT.tertiary,
            color: agentActive ? BACKGROUND.primary : TEXT.tertiary,
            cursor: 'pointer',
          }}
        >
          {agentActive ? 'On' : 'Off'}
        </button>
      </div>

      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ui-border-muted)' }}>
        <div style={{ color: TEXT.tertiary, marginBottom: 6 }}>Status: <span style={{ color: TEXT.secondary }}>{status}</span></div>
        <div style={{ color: TEXT.tertiary, marginBottom: 4 }}>Mode:</div>
        <div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <RadioItem label="Human" value="Human" />
          <RadioItem label="Assist" value="Assist" />
          <RadioItem label="Agent" value="Agent" />
        </div>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, color: TEXT.tertiary }}>
        <div>
          Operator: {operatorOk === null ? '...' : operatorOk ? (
            <span style={{ color: STATUS.success }}>Connected ✓</span>
          ) : (
            <span style={{ color: STATUS.error }}>Offline ✗</span>
          )}
        </div>
        <div>
          Extension: {extensionPaired ? (
            <span style={{ color: STATUS.success }}>Paired ✓</span>
          ) : (
            <span style={{ color: TEXT.tertiary }}>Not paired</span>
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
    <div style={{
      width: displaySize,
      height: displaySize,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <div style={{
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        width: baseSize,
        height: baseSize,
        flexShrink: 0,
      }}>
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
      style={{ flexShrink: 0 }}
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

// Renders a real extension icon.
// Special-cases Claude in Chrome (Anthropic asterisk) since the Chrome Web Store
// favicon endpoint only returns the generic CWS puzzle-piece for that page.
// For all other extensions it falls back to the Google favicon service, then emoji.
const CLAUDE_CHROME_STORE_ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn';

function ExtensionStoreIcon({ storeUrl, fallbackIcon, size }: { storeUrl?: string; fallbackIcon: string; size: number }) {
  const [imgError, setImgError] = useState(false);

  // Special-case: Claude in Chrome always uses the Anthropic asterisk SVG
  if (storeUrl?.includes(CLAUDE_CHROME_STORE_ID)) {
    return <AnthropicAsteriskIcon size={size} />;
  }

  const iconSrc = storeUrl ? getFaviconUrl(storeUrl, size * 2) : '';
  if (imgError || !iconSrc) {
    return <span style={{ fontSize: size, flexShrink: 0, lineHeight: 1 }}>{fallbackIcon}</span>;
  }
  return (
    <img
      src={iconSrc}
      alt=""
      onError={() => setImgError(true)}
      style={{ width: size, height: size, borderRadius: 4, flexShrink: 0, objectFit: 'contain' }}
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

  // Wire Allternit Agent extension toggle to agent store + chat pane
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
    // Navigate the built-in browser to the Chrome Web Store page so the user
    // can install the extension right there (the browser is Chromium-based)
    onNavigate(item.storeUrl);
    onClose();
    // Also add to the local extension list with 'pending' so the user can
    // confirm once they've installed it
    const alreadyAdded = extensions.some(
      (e) => e.chromeStoreId === item.chromeStoreId
    );
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

  // Confirm that a pending extension was installed in Chrome
  const handleConfirmInstalled = (extId: string) => {
    updateExtension(extId, { installStatus: 'installed', enabled: true });
  };

  // Custom extension form
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

  // Extensions not yet added from the catalog
  const catalogNotInstalled = EXTENSION_CATALOG.filter(
    (item) => !extensions.some((e) => e.chromeStoreId === item.chromeStoreId)
  );

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 290,
      background: BACKGROUND.secondary, border: `1px solid ${BORDER.subtle}`, borderRadius: 8,
      boxShadow: SHADOW.md, zIndex: 50, padding: 0, fontSize: 12,
      maxHeight: 420, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid var(--ui-border-muted)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: TEXT.secondary, fontWeight: 600 }}>
          <Puzzle style={{ width: 14, height: 14 }} />
          <span>Extensions</span>
        </div>
        <button
          onClick={onClose}
          style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT.tertiary, display: 'flex' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = TEXT.secondary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = TEXT.tertiary; }}
        >
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--ui-border-muted)', flexShrink: 0 }}>
        {(['installed', 'discover'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '7px 0', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: activeTab === tab ? browserTokens.accent : TEXT.tertiary,
              borderBottom: activeTab === tab ? `2px solid ${browserTokens.accent}` : '2px solid transparent',
              transition: 'color 0.15s',
            }}
          >
            {tab === 'installed' ? `Installed (${extensions.length})` : `Discover${catalogNotInstalled.length > 0 ? ` (${catalogNotInstalled.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Scrollable body */}
      <div style={{ overflowY: 'auto', flex: 1 }}>

        {/* ── INSTALLED TAB ── */}
        {activeTab === 'installed' && (
          <>
            {extensions.map((ext) => (
              <div key={ext.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                borderBottom: '1px solid var(--surface-hover)',
              }}>
                {ext.id === 'allternit-agent' ? (
                  <ScaledMatrixLogo state={ext.enabled ? 'listening' : 'idle'} displaySize={20} />
                ) : (
                  <ExtensionStoreIcon storeUrl={ext.storeUrl} fallbackIcon={ext.icon} size={20} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: ext.enabled ? TEXT.secondary : TEXT.tertiary, fontWeight: 500 }}>{ext.name}</span>
                    {ext.installStatus === 'pending' && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: STATUS.warning, background: 'rgba(251,191,36,0.12)', borderRadius: 3, padding: '1px 4px',
                      }}>Pending</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: TEXT.tertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ext.description}
                    {ext.version !== 'latest' && ` · v${ext.version}`}
                  </div>
                  {/* Pending: show confirm + re-open store */}
                  {ext.installStatus === 'pending' && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <button
                        onClick={() => handleConfirmInstalled(ext.id)}
                        style={{
                          padding: '2px 6px', borderRadius: 4, border: 'none', fontSize: 10, fontWeight: 600,
                          background: 'rgba(34,197,94,0.15)', color: STATUS.success, cursor: 'pointer',
                        }}
                      >
                        ✓ Mark installed
                      </button>
                      {ext.storeUrl && (
                        <button
                          onClick={() => { onNavigate(ext.storeUrl!); onClose(); }}
                          style={{
                            padding: '2px 6px', borderRadius: 4, border: 'none', fontSize: 10, fontWeight: 600,
                            background: 'var(--ui-border-muted)', color: TEXT.tertiary, cursor: 'pointer',
                          }}
                        >
                          Open store
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {/* Toggle — only for installed/non-pending */}
                {ext.installStatus !== 'pending' && (
                  <button
                    onClick={() => handleToggle(ext.id)}
                    style={{
                      width: 32, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer', padding: 0,
                      background: ext.enabled ? browserTokens.accent : TEXT.tertiary,
                      position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', background: TEXT.primary,
                      position: 'absolute', top: 2,
                      left: ext.enabled ? 16 : 2,
                      transition: 'left 0.2s',
                    }} />
                  </button>
                )}
                {/* Settings gear */}
                {ext.installStatus !== 'pending' && (
                  <button
                    onClick={() => setSettingsExtId(ext.id)}
                    title="Extension settings"
                    style={{
                      padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
                      cursor: 'pointer', color: TEXT.tertiary, display: 'flex', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = browserTokens.accent; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = TEXT.tertiary; }}
                  >
                    <GearSix style={{ width: 12, height: 12 }} />
                  </button>
                )}
                {/* Remove */}
                {ext.id !== 'allternit-agent' && (
                  <button
                    onClick={() => removeExtension(ext.id)}
                    style={{
                      padding: 4, borderRadius: 4, border: 'none', background: 'transparent',
                      cursor: 'pointer', color: TEXT.tertiary, display: 'flex', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = STATUS.error; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = TEXT.tertiary; }}
                  >
                    <Trash style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            ))}

            {/* Custom install form */}
            {!customInstalling ? (
              <div style={{ padding: '8px 12px' }}>
                <button
                  onClick={() => setCustomInstalling(true)}
                  style={{
                    width: '100%', padding: '6px', borderRadius: 6, border: `1px dashed ${TEXT.tertiary}`,
                    background: 'transparent', color: TEXT.tertiary, fontSize: 11, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = TEXT.secondary; e.currentTarget.style.color = TEXT.secondary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = TEXT.tertiary; e.currentTarget.style.color = TEXT.tertiary; }}
                >
                  <Plus style={{ width: 10, height: 10 }} /> Add custom extension
                </button>
              </div>
            ) : (
              <div style={{ padding: '8px 12px', borderTop: `1px solid ${BORDER.subtle}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: TEXT.tertiary, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Extension</div>
                <input
                  value={installName} onChange={(e) => setInstallName(e.target.value)}
                  placeholder="Extension name"
                  autoFocus
                  style={{
                    background: 'var(--surface-panel)', border: '1px solid var(--ui-border-muted)',
                    borderRadius: 6, padding: '5px 8px', color: TEXT.primary, fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
                <input
                  value={installUrl} onChange={(e) => setInstallUrl(e.target.value)}
                  placeholder="Store URL (optional)"
                  style={{
                    background: 'var(--surface-panel)', border: '1px solid var(--ui-border-muted)',
                    borderRadius: 6, padding: '5px 8px', color: TEXT.primary, fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleCustomInstall} style={{
                    flex: 1, padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: browserTokens.accent, color: BACKGROUND.primary, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                    Add Extension
                  </button>
                  <button onClick={() => { setCustomInstalling(false); setInstallName(''); setInstallUrl(''); }} style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: 'var(--ui-border-muted)', color: TEXT.tertiary, fontSize: 11, cursor: 'pointer',
                  }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── DISCOVER TAB ── */}
        {activeTab === 'discover' && (
          <>
            {/* How installs work */}
            <div style={{
              margin: '8px 12px', padding: '7px 10px', borderRadius: 6,
              background: 'rgba(212,176,140,0.06)', border: '1px solid rgba(212,176,140,0.15)',
              fontSize: 10, color: TEXT.tertiary, lineHeight: 1.5,
            }}>
              Clicking <strong style={{ color: browserTokens.accent }}>Add to Chrome</strong> navigates to the Chrome Web Store — install it there, then open Extensions and click <strong style={{ color: STATUS.success }}>Mark installed</strong>.
            </div>

            {EXTENSION_CATALOG.map((item) => {
              const alreadyAdded = extensions.some((e) => e.chromeStoreId === item.chromeStoreId);
              return (
                <div key={item.catalogId} style={{
                  padding: '10px 12px', borderBottom: '1px solid var(--surface-hover)',
                  background: item.featured ? 'rgba(212,176,140,0.03)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <ExtensionStoreIcon storeUrl={item.storeUrl} fallbackIcon={item.icon} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, color: TEXT.secondary, fontWeight: 600 }}>{item.name}</span>
                        {item.featured && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: browserTokens.accent, background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)', borderRadius: 3, padding: '1px 4px',
                          }}>Featured</span>
                        )}
                      </div>
                      {item.publisher && (
                        <div style={{ fontSize: 10, color: TEXT.tertiary, marginBottom: 3 }}>by {item.publisher}</div>
                      )}
                      <div style={{ fontSize: 10, color: TEXT.tertiary, lineHeight: 1.4, marginBottom: 8 }}>
                        {item.description}
                      </div>
                      {alreadyAdded ? (
                        <span style={{
                          fontSize: 10, color: STATUS.success, fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          ✓ Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCatalogInstall(item)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 700,
                            background: item.featured ? browserTokens.accent : 'var(--ui-border-muted)',
                            color: item.featured ? BACKGROUND.primary : TEXT.secondary,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                          onMouseEnter={(e) => {
                            if (!item.featured) { e.currentTarget.style.background = 'var(--ui-border-default)'; e.currentTarget.style.color = TEXT.secondary; }
                          }}
                          onMouseLeave={(e) => {
                            if (!item.featured) { e.currentTarget.style.background = 'var(--ui-border-muted)'; e.currentTarget.style.color = TEXT.secondary; }
                          }}
                        >
                          <DownloadSimple style={{ width: 9, height: 9 }} /> Add to Chrome
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Link to full Chrome Web Store */}
            <div style={{ padding: '8px 12px', textAlign: 'center' }}>
              <button
                onClick={() => { onNavigate('https://chromewebstore.google.com'); onClose(); }}
                style={{ background: 'transparent', border: 'none', fontSize: 10, color: TEXT.tertiary, cursor: 'pointer', padding: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = browserTokens.accent; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = TEXT.tertiary; }}
              >
                Browse Chrome Web Store →
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── SETTINGS PANEL OVERLAY ── */}
      {settingsExtId && (() => {
        const settingsExt = extensions.find((e) => e.id === settingsExtId);
        if (!settingsExt) return null;
        return (
          <div style={{
            position: 'absolute', inset: 0, background: BACKGROUND.secondary, borderRadius: 8,
            display: 'flex', flexDirection: 'column', zIndex: 10,
          }}>
            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderBottom: '1px solid var(--ui-border-muted)', flexShrink: 0,
            }}>
              <button
                onClick={() => setSettingsExtId(null)}
                style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT.tertiary, display: 'flex' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = TEXT.secondary; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = TEXT.secondary; }}
              >
                <ArrowLeft style={{ width: 13, height: 13 }} />
              </button>
              {settingsExt.id === 'allternit-agent' ? (
                <ScaledMatrixLogo state="idle" displaySize={16} />
              ) : (
                <ExtensionStoreIcon storeUrl={settingsExt.storeUrl} fallbackIcon={settingsExt.icon} size={16} />
              )}
              <span style={{ fontSize: 12, color: TEXT.secondary, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {settingsExt.name}
              </span>
              <GearSix style={{ width: 12, height: 12, color: TEXT.tertiary }} />
            </div>

            {/* Permissions section */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              <div style={{
                padding: '4px 12px 8px', fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT.tertiary,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <Shield style={{ width: 10, height: 10 }} />
                Permissions
              </div>

              {EXTENSION_PERMISSIONS.map(({ key, label, icon }) => {
                const current: PermissionValue = settingsExt.permissions?.[key] ?? 'ask';
                return (
                  <div key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', borderBottom: '1px solid var(--surface-hover)',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 11, color: TEXT.secondary, flex: 1 }}>{label}</span>
                    {/* Three-way pill: Allow / Ask / Block */}
                    <div style={{
                      display: 'flex', borderRadius: 6, overflow: 'hidden',
                      border: `1px solid ${BORDER.subtle}`, flexShrink: 0,
                    }}>
                      {(['allow', 'ask', 'block'] as PermissionValue[]).map((val) => {
                        const active = current === val;
                        const colors: Record<PermissionValue, string> = {
                          allow: STATUS.success,
                          ask:   browserTokens.accent,
                          block: STATUS.error,
                        };
                        return (
                          <button
                            key={val}
                            onClick={() => setExtensionPermission(settingsExt.id, key, val)}
                            style={{
                              padding: '2px 6px', border: 'none', cursor: 'pointer', fontSize: 9,
                              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                              background: active ? `${colors[val]}22` : 'transparent',
                              color: active ? colors[val] : TEXT.tertiary,
                              borderRight: val !== 'block' ? `1px solid ${BORDER.subtle}` : 'none',
                              transition: 'background 0.15s, color 0.15s',
                            }}
                            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = TEXT.tertiary; e.currentTarget.style.background = 'var(--surface-hover)'; }}}
                            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = TEXT.tertiary; e.currentTarget.style.background = 'transparent'; }}}
                          >
                            {val}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Reset all */}
              <div style={{ padding: '10px 12px' }}>
                <button
                  onClick={() => {
                    EXTENSION_PERMISSIONS.forEach(({ key }) =>
                      setExtensionPermission(settingsExt.id, key, 'ask')
                    );
                  }}
                  style={{
                    width: '100%', padding: '5px', borderRadius: 6, border: `1px dashed ${BORDER.subtle}`,
                    background: 'transparent', color: TEXT.tertiary, fontSize: 10, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = TEXT.tertiary; e.currentTarget.style.color = TEXT.secondary; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = BORDER.subtle; e.currentTarget.style.color = TEXT.tertiary; }}
                >
                  Reset all to Ask
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ============================================================================
// Main Browser Component
// ============================================================================

export function BrowserCapsuleEnhanced({
  initialUrl,
  agentMode = 'autonomous',
  guidanceMessages = [],
  onHumanCheckpoint,
}: BrowserCapsuleEnhancedProps = {}) {
  const {
    tabs, activeTabId, addTab, closeTab, closeAllTabs, setActiveTab, updateTab,
    goBack, goForward, canGoBack, canGoForward, pushHistory,
    tabLoading, setTabLoading,
    chatPaneOpen, chatPaneWidth, toggleChatPane, setChatPaneWidth,
  } = useBrowserStore();
  
  // Override closeAllTabs to show home page
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
  const showAciViewport =
    agentStatus === 'Running' ||
    agentStatus === 'WaitingApproval' ||
    agentStatus === 'Blocked';
  const showPageAgentTakeover = pageAgentStatus === 'running';

  // Tell the global ACIComputerUseSidecar to suppress itself while this capsule is mounted
  useEffect(() => {
    setIsBrowserCapsuleMounted(true);
    return () => { setIsBrowserCapsuleMounted(false); };
  }, [setIsBrowserCapsuleMounted]);
  const { addShortcut } = useBrowserShortcutsStore();
  const allExtensions = useExtensionsStore((s) => s.extensions);
  // Only show extensions that are fully installed (not pending) AND enabled in the toolbar
  const enabledExtensions = useMemo(
    () => allExtensions.filter((e) => e.enabled && e.installStatus !== 'pending'),
    [allExtensions],
  );
  // Initialize extension bridge for direct Chrome extension communication
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
  const viewportRef = useRef<HTMLDivElement>(null);
  // Show home page state (when no tabs)
  const [showHomePage, setShowHomePage] = useState(false);
  const [isResizingChatPane, setIsResizingChatPane] = useState(false);
  const [findBarOpen, setFindBarOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Tab context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const chatPaneResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [tooltipTab, setTooltipTab] = useState<BrowserTab | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bookmarked state for current tab
  const shortcuts = useBrowserShortcutsStore((s) => s.shortcuts);
  const isBookmarked = useMemo(() => {
    if (!activeTab || activeTab.contentType !== 'web') return false;
    const url = (activeTab as WebTab).url;
    return shortcuts.some((s) => s.url === url);
  }, [activeTab, shortcuts]);

  // Close find bar when switching tabs
  useEffect(() => {
    setFindBarOpen(false);
  }, [activeTabId]);

  useEffect(() => {
    if (activeTab) {
      if (activeTab.contentType === 'web') {
        setUrlInput((activeTab as WebTab).url);
        setContentMode('web');
        setIframeLoaded(false);
        setIframeError(false);
        // Clear any existing timeout
        if (proxyTimeoutRef.current) {
          clearTimeout(proxyTimeoutRef.current);
        }
        // Fallback timeout in case iframe onLoad doesn't fire
        proxyTimeoutRef.current = setTimeout(() => {
          setIframeLoaded(true);
          proxyTimeoutRef.current = null;
        }, 3000);
        return () => {
          if (proxyTimeoutRef.current) {
            clearTimeout(proxyTimeoutRef.current);
            proxyTimeoutRef.current = null;
          }
        };
      } else if (activeTab.contentType === 'a2ui') {
        setContentMode('canvas');
      }
    } else {
      setUrlInput('');
    }
  }, [activeTabId, activeTab]);

  const handleNavigate = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!urlInput.trim()) return;
    let targetUrl = urlInput.trim();
    if (!targetUrl.match(/^https?:\/\//)) {
      if (targetUrl.includes('.') && !targetUrl.includes(' ')) {
        targetUrl = `https://${targetUrl}`;
      } else {
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
      }
    }
    
    setIframeLoaded(false);
    setIframeError(false);
    if (activeTabId) {
      updateTab(activeTabId, { url: targetUrl, title: targetUrl } as Partial<WebTab>);
      pushHistory(activeTabId, targetUrl);
      setTabLoading(activeTabId, true);
    } else {
      addTab(targetUrl);
    }
    setUrlFocused(false);
  }, [urlInput, activeTabId, updateTab, pushHistory, setTabLoading, addTab]);

  // Handle iframe load — update title and loading state
  const handleIframeLoad = useCallback(() => {
    if (proxyTimeoutRef.current) {
      clearTimeout(proxyTimeoutRef.current);
      proxyTimeoutRef.current = null;
    }
    setIframeLoaded(true);
    if (activeTabId) {
      setTabLoading(activeTabId, false);
      // Try to get title from URL hostname as fallback
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

  // Listen for proxy navigation messages posted by the injected nav-intercept
  // script inside the iframe.  When the page navigates (link click, JS redirect,
  // history.pushState, etc.) the script posts { type: 'allternit-navigate', url } to
  // the parent window so we can update the tab URL and keep the URL bar in sync.
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type !== 'allternit-navigate') return;
      const rawUrl: string = event.data.url;
      if (!rawUrl) return;

      // Unwrap the proxied URL back to the real target URL for the store
      let targetUrl = rawUrl;
      try {
        const proxyParam = new URL(rawUrl, window.location.href).searchParams.get('url');
        if (proxyParam) targetUrl = proxyParam;
      } catch { /* leave as-is */ }

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

  // Screenshot functionality
  const handleScreenshot = useCallback(() => {
    // Use html2canvas-like approach: capture the viewport div
    const viewport = viewportRef.current;
    if (!viewport) return;
    // For iframe content, we can't directly screenshot due to CORS.
    // Instead, capture what we can — the viewport container
    try {
      const canvas = document.createElement('canvas');
      const rect = viewport.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Draw a placeholder with URL info
      ctx.fillStyle = BACKGROUND.primary;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = browserTokens.accent;
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      const url = activeTab && activeTab.contentType === 'web' ? (activeTab as WebTab).url : 'No active tab';
      ctx.fillText(`Screenshot: ${url}`, canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = TEXT.tertiary;
      ctx.font = '12px system-ui';
      ctx.fillText(new Date().toLocaleString(), canvas.width / 2, canvas.height / 2 + 20);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `browser-screenshot-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    } catch (err) {
      console.error('Screenshot failed:', err);
    }
  }, [activeTab]);

  // Bookmark current tab
  const handleBookmark = useCallback(() => {
    if (!activeTab || activeTab.contentType !== 'web') return;
    const url = (activeTab as WebTab).url;
    const title = activeTab.title || url;
    if (isBookmarked) return; // Already bookmarked
    addShortcut({ label: title, url, icon: '⭐' });
  }, [activeTab, isBookmarked, addShortcut]);

  // Button helper
  const NavBtn = ({ children, title, onClick, active, disabled }: { children: React.ReactNode; title: string; onClick?: () => void; active?: boolean; disabled?: boolean }) => (
    <motion.button
      onClick={onClick} title={title} disabled={disabled}
      whileHover={disabled ? {} : { y: -1, scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{ duration: 0.15 }}
      style={{ padding: 6, borderRadius: '50%', border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', color: active ? browserTokens.accent : disabled ? TEXT.tertiary : TEXT.tertiary, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'var(--ui-border-default)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </motion.button>
  );

  // Compute dynamic tab width: shrink as count grows, min 60px
  // Tab bar refs

  // Back/forward for active tab
  const canBack = activeTabId ? canGoBack(activeTabId) : false;
  const canForward = activeTabId ? canGoForward(activeTabId) : false;

  const startChatPaneResize = useCallback((clientX: number) => {
    chatPaneResizeRef.current = {
      startX: clientX,
      startWidth: chatPaneWidth,
    };
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

  const handleChatPaneResizePointerStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    startChatPaneResize(event.clientX);
  }, [startChatPaneResize]);

  const handleChatPaneResizeMouseStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    startChatPaneResize(event.clientX);
  }, [startChatPaneResize]);

  useEffect(() => {
    if (!isResizingChatPane) return;

    const handlePointerMove = (event: PointerEvent) => {
      updateChatPaneResize(event.clientX);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopChatPaneResize);
    window.addEventListener('pointercancel', stopChatPaneResize);
    window.addEventListener('blur', stopChatPaneResize);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopChatPaneResize);
      window.removeEventListener('pointercancel', stopChatPaneResize);
      window.removeEventListener('blur', stopChatPaneResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingChatPane, stopChatPaneResize, updateChatPaneResize]);

  return (
    // ROOT: explicit inline flex-column, absolute dimensions
    <div
      data-testid="browser-capsule-enhanced-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        flex: '1 1 0%',
        minHeight: 0,
        minWidth: 0,
        position: 'relative',
        overflow: 'hidden',
        background: BACKGROUND.primary,
        color: TEXT.primary,
        fontFamily: 'var(--font-sans)',
        userSelect: 'none',
      }}
    >
      {/* ━━━ ROW 1: TAB BAR ━━━ */}
      <div
        style={{
          height: 36,
          minHeight: 36,
          maxHeight: 36,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          paddingLeft: 4,
          paddingRight: 4,
          background: BACKGROUND.primary,
          flexShrink: 0,
          position: 'relative',
        }}
        onDoubleClick={(e) => {
          // Double-click empty space → new tab
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-tab-bar-space]')) {
            addTab('about:blank');
          }
        }}
      >
        {/* Compact favicon tab bar — horizontal scroll, favicon-first */}
        <div
          data-tab-bar-space
          ref={tabBarRef}
          onWheel={(e) => { e.preventDefault(); tabBarRef.current?.scrollBy({ left: e.deltaY, behavior: 'smooth' }); }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'flex-end',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            minWidth: 0,
            gap: 2,
            paddingBottom: 4,
            paddingLeft: 2,
          }}
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeTabId;
            const isLoading = tabLoading[tab.id];
            const isMounted = pageAgentTargetTabId === tab.id;
            const isAgentRunning = isMounted && pageAgentStatus === 'running';
            const isPinned = tab.pinned ?? false;
            const showTitle = isActive || isHoveringTab === tab.id;
            const isDragOver = dragOverIndex === index;
            return (
              <div
                key={tab.id}
                draggable={!isPinned}
                onDragStart={(e) => {
                  if (isPinned) return;
                  e.dataTransfer.setData('text/plain', String(index));
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedIndex(index);
                }}
                onDragEnd={() => { setDraggedIndex(null); setDragOverIndex(null); }}
                onDragOver={(e) => {
                  if (isPinned || draggedIndex === null) return;
                  e.preventDefault();
                  setDragOverIndex(index);
                }}
                onDrop={(e) => {
                  if (isPinned || draggedIndex === null) return;
                  e.preventDefault();
                  const fromIndex = draggedIndex;
                  const toIndex = index;
                  if (fromIndex !== toIndex) {
                    useBrowserStore.getState().reorderTabs(fromIndex, toIndex);
                  }
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onMouseEnter={() => {
                  setIsHoveringTab(tab.id);
                  if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
                  tooltipTimeoutRef.current = setTimeout(() => setTooltipTab(tab), 300);
                }}
                onMouseLeave={() => {
                  setIsHoveringTab(null);
                  if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
                  tooltipTimeoutRef.current = setTimeout(() => setTooltipTab(null), 150);
                }}
                onClick={() => setActiveTab(tab.id)}
                onMouseDown={(e) => {
                  if (e.button === 1 && !isPinned) {
                    e.preventDefault();
                    closeTab(tab.id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: isPinned ? 24 : 28,
                  width: isPinned ? 28 : (showTitle ? 'auto' : 32),
                  minWidth: isPinned ? 28 : (showTitle ? 80 : 32),
                  maxWidth: isPinned ? 28 : (showTitle ? 140 : 32),
                  paddingLeft: isPinned ? 4 : (showTitle ? 8 : 4),
                  paddingRight: isPinned ? 4 : (showTitle ? 6 : 4),
                  gap: showTitle ? 6 : 0,
                  cursor: isPinned ? 'pointer' : 'grab',
                  borderRadius: 6,
                  transition: 'all 0.15s ease',
                  background: isActive ? BACKGROUND.secondary : isMounted ? browserTokens.panelTint : isDragOver ? browserTokens.panelTint : 'transparent',
                  border: isMounted ? `1px solid ${browserTokens.border}` : isDragOver ? `1px solid ${browserTokens.accent}` : '1px solid transparent',
                  boxShadow: isMounted ? `0 0 8px ${browserTokens.soft}` : 'none',
                  color: isActive ? TEXT.primary : TEXT.tertiary,
                  overflow: 'hidden',
                  position: 'relative',
                  flexShrink: 0,
                  opacity: draggedIndex === index ? 0.5 : 1,
                }}
              >
                {/* Extension mounted indicator dot */}
                {isMounted && (
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: browserTokens.accent,
                    animation: isAgentRunning ? 'pulse 1.5s ease-in-out infinite' : 'none',
                    zIndex: 2,
                  }} />
                )}
                {/* Group color indicator */}
                {tab.group && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 4,
                    right: 4,
                    height: 2,
                    borderRadius: 1,
                    background: tab.groupColor || browserTokens.accent,
                    zIndex: 2,
                  }} />
                )}
                {/* Pin indicator for pinned tabs */}
                {isPinned && !isMounted && (
                  <div style={{
                    position: 'absolute',
                    bottom: 2,
                    right: 2,
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    background: TEXT.tertiary,
                    zIndex: 2,
                  }} />
                )}
                {/* Loading / Agent running indicator */}
                {isAgentRunning ? (
                  <CircleNotch style={{ width: 13, height: 13, flexShrink: 0, opacity: 0.8, animation: 'spin 1s linear infinite' }} />
                ) : isLoading ? (
                  <CircleNotch style={{ width: 13, height: 13, flexShrink: 0, opacity: 0.5, animation: 'spin 1s linear infinite' }} />
                ) : (
                  <TabFavicon url={tab.contentType === 'web' ? (tab as WebTab).url : undefined} size={isPinned ? 12 : 13} />
                )}
                {showTitle && !isPinned && (
                  <span style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                    {tab.title || 'New Tab'}
                  </span>
                )}
                {(isActive || isHoveringTab === tab.id) && !isPinned && (
                  <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    style={{ marginLeft: 2, padding: 2, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', opacity: 0.5, display: 'flex', flexShrink: 0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ui-border-default)'; e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.5'; }}>
                    <X style={{ width: 10, height: 10 }} />
                  </button>
                )}
              </div>
            );
          })}
          {/* + button */}
          <motion.button onClick={() => addTab('about:blank')} title="New Tab"
            whileHover={{ y: -1, scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{ height: 28, width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: TEXT.tertiary, flexShrink: 0, marginLeft: 2 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = BACKGROUND.hover; e.currentTarget.style.color = TEXT.primary; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = TEXT.tertiary; }}>
            <Plus style={{ width: 14, height: 14 }} />
          </motion.button>
        </div>
        {/* Dropdown chevron + close all */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%', paddingRight: 4, gap: 2 }}>
          <NavBtn title="Show all tabs" onClick={() => setTabDropdownOpen(!tabDropdownOpen)}><CaretDown style={{ width: 16, height: 16 }} /></NavBtn>
          <TabOverflowDropdown open={tabDropdownOpen} onClose={() => setTabDropdownOpen(false)} tabs={tabs} activeTabId={activeTabId} onSelect={setActiveTab} onCloseTab={closeTab} />
          {tabs.length > 0 && (
            <NavBtn title="Close all tabs" onClick={handleCloseAllTabs}><X style={{ width: 16, height: 16 }} /></NavBtn>
          )}
        </div>
      </div>

      {/* Tab context menu */}
      {contextMenu && (
        <TabContextMenu
          x={contextMenu.x} y={contextMenu.y} tabId={contextMenu.tabId}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Tab preview tooltip */}
      {tooltipTab && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(100% - 40px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: BACKGROUND.secondary,
            border: `1px solid ${BORDER.subtle}`,
            borderRadius: 8,
            boxShadow: SHADOW.md,
            padding: '6px 10px',
            maxWidth: 240,
          }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: TEXT.primary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tooltipTab.title || 'New Tab'}
            </div>
            {'url' in tooltipTab && (tooltipTab as WebTab).url && (
              <div style={{ fontSize: 10, color: TEXT.tertiary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                {(tooltipTab as WebTab).url}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ━━━ ACCENT LINE ━━━ */}
      <style>{accentLineStyle}</style>
      <div style={{
        height: 2, flexShrink: 0,
        background: 'linear-gradient(90deg, transparent, browserTokens.accent, transparent)',
        opacity: 0.4,
        animation: 'browserAccentSlide 1.2s ease-out',
        transformOrigin: 'left',
      }} />

      {/* ━━━ ROW 2: NAV BAR ━━━ */}
      <div style={{
        height: 40,
        minHeight: 40,
        maxHeight: 40,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 8,
        paddingRight: 8,
        background: BACKGROUND.secondary,
        borderBottom: `1px solid ${BORDER.subtle}`,
        flexShrink: 0,
        zIndex: 20,
      }}>
        {/* Nav buttons */}
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <NavBtn title="Back" onClick={() => activeTabId && goBack(activeTabId)} disabled={!canBack}>
            <CaretLeft style={{ width: 16, height: 16 }} />
          </NavBtn>
          <NavBtn title="Forward" onClick={() => activeTabId && goForward(activeTabId)} disabled={!canForward}>
            <CaretRight style={{ width: 16, height: 16 }} />
          </NavBtn>
          <NavBtn title="Refresh" onClick={() => {
            if (activeTabId) {
              setIframeLoaded(false);
              setIframeError(false);
              setTabLoading(activeTabId, true);
              // Force iframe reload by briefly clearing and resetting URL
              const currentUrl = activeTab && activeTab.contentType === 'web' ? (activeTab as WebTab).url : '';
              if (currentUrl) {
                updateTab(activeTabId, { url: '' } as Partial<WebTab>);
                setTimeout(() => updateTab(activeTabId, { url: currentUrl } as Partial<WebTab>), 50);
              }
            }
          }}>
            <ArrowsClockwise style={{ width: 16, height: 16 }} />
          </NavBtn>
        </div>
        {/* URL bar */}
        <form onSubmit={handleNavigate} style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', height: 32, background: BACKGROUND.primary, borderRadius: 16, paddingLeft: 16, paddingRight: 16, flex: 1 }}>
            {activeTab && <Lock style={{ width: 14, height: 14, color: TEXT.tertiary, marginRight: 8, flexShrink: 0 }} />}
            <input type="text" value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onFocus={() => setUrlFocused(true)}
              onBlur={() => setTimeout(() => setUrlFocused(false), 200)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: TEXT.primary, fontFamily: 'inherit', minWidth: 0 }}
              placeholder={activeTab ? "Enter URL or search..." : "Search or type a URL"} />
          </div>
          <UrlAutocomplete
            query={urlInput}
            visible={urlFocused}
            onSelect={(url) => {
              setUrlInput(url);
              setUrlFocused(false);
              if (activeTabId) {
                updateTab(activeTabId, { url, title: url } as Partial<WebTab>);
                pushHistory(activeTabId, url);
                setTabLoading(activeTabId, true);
                setIframeLoaded(false);
                setIframeError(false);
              } else {
                addTab(url);
              }
            }}
          />
        </form>
        {/* Right actions */}
        <NavBtn title={isBookmarked ? "Bookmarked" : "Bookmark this page"} onClick={handleBookmark} active={isBookmarked}>
          <Star style={{ width: 16, height: 16, fill: isBookmarked ? browserTokens.accent : 'none' }} />
        </NavBtn>
        <NavBtn title="Find in page" onClick={() => setFindBarOpen((v) => !v)} active={findBarOpen}>
          <MagnifyingGlass style={{ width: 16, height: 16 }} />
        </NavBtn>

        {/* Dynamic enabled extension icons — only shown when toggled on */}
        {enabledExtensions.map((ext) =>
          ext.id === 'allternit-agent' ? (
            <div key={ext.id} style={{ position: 'relative' }}
              onContextMenu={(e) => { e.preventDefault(); setAgentPopupOpen(!agentPopupOpen); }}
            >
              <NavBtn
                title={agentActive ? "Allternit Agent (Active) — right-click for controls" : "Allternit Agent — right-click for controls"}
                onClick={() => {
                  // Click → toggle chat pane
                  toggleChatPane();
                }}
                active={agentActive || chatPaneOpen}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ScaledMatrixLogo
                    state={agentActive ? (agentStatus === 'Running' ? 'thinking' : 'listening') : 'idle'}
                    displaySize={16}
                  />
                  {chatPaneOpen && (
                    <div style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 6, height: 6, borderRadius: '50%',
                      background: STATUS.success, border: '1px solid ' + BACKGROUND.secondary,
                    }} />
                  )}
                </div>
              </NavBtn>
              {/* Right-click → agent controls popup */}
              <AgentPopup open={agentPopupOpen} onClose={() => setAgentPopupOpen(false)} />
            </div>
          ) : (
            <NavBtn key={ext.id} title={ext.name}>
              <ExtensionStoreIcon storeUrl={ext.storeUrl} fallbackIcon={ext.icon} size={16} />
            </NavBtn>
          )
        )}

        {/* Puzzle — Extension Manager */}
        <div style={{ position: 'relative' }}>
          <NavBtn
            title="Extensions"
            onClick={() => setExtensionPopupOpen(!extensionPopupOpen)}
          >
            <Puzzle style={{ width: 16, height: 16 }} />
          </NavBtn>
          <ExtensionManagerPopup
            open={extensionPopupOpen}
            onClose={() => setExtensionPopupOpen(false)}
            onNavigate={(url) => {
              // Open the URL in a new tab inside the in-app browser
              addTab(url);
              setExtensionPopupOpen(false);
            }}
          />
        </div>

        <div style={{ position: 'relative' }}>
          <NavBtn title="More" onClick={() => setMenuOpen(!menuOpen)}><DotsThreeVertical style={{ width: 16, height: 16 }} /></NavBtn>
          <ThreeDotMenu open={menuOpen} onClose={() => setMenuOpen(false)} contentMode={contentMode} setContentMode={setContentMode}
            agentModeControl={agentModeControl} setAgentMode={setAgentMode} agentStatus={agentStatus}
            onNewTab={() => addTab('about:blank')} onToggleChatPane={toggleChatPane} chatPaneOpen={chatPaneOpen} onCloseAllTabs={closeAllTabs}
            onScreenshot={handleScreenshot}
            zoomLevel={zoomLevel} onZoomIn={() => setZoomLevel((z) => Math.min(z + 0.1, 3))} onZoomOut={() => setZoomLevel((z) => Math.max(z - 0.1, 0.3))} onZoomReset={() => setZoomLevel(1)} />
        </div>
      </div>

      {/* ━━━ VIEWPORT + CHAT PANE ━━━ */}
      <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'row', minHeight: 0, overflow: 'hidden' }}>
        <div ref={viewportRef} style={{
          flex: '1 1 0%',
          position: 'relative',
          overflow: 'hidden',
          minHeight: 0,
          minWidth: 0,
        }}>
          {/* Find bar overlay */}
          {findBarOpen && contentMode === 'web' && activeTab?.contentType === 'web' && (
            <BrowserFindBar iframeRef={iframeRef} onClose={() => setFindBarOpen(false)} />
          )}

          {/* ACI computer-use viewport — full overlay when agent is active */}
          {showAciViewport && (
            <ACIComputerUseView agentBarHeight={0} />
          )}

          {/* ACI overlays — float above web content */}
          <BrowserAgentOverlay status={agentStatus} currentAction={agentCurrentAction as any} />

          {/* Glass pill — bottom-center execution status */}
          <ACIGlassPill placement="bottom-center" />

          {contentMode === 'web' ? (
          activeTab && activeTab.contentType === 'web' && (activeTab as WebTab).url !== 'about:blank' ? (
            /* WEB CONTENT */
            <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'auto' }}>
              <div style={{ width: `${100 / zoomLevel}%`, height: `${100 / zoomLevel}%`, transform: `scale(${zoomLevel})`, transformOrigin: 'top left' }}>
              {isElectronShell() ? (
                /* @ts-ignore */
                <webview
                  data-testid="allternit-webview-content"
                  src={(activeTab as WebTab).url}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                  allowpopups={true}
                />
              ) : (
                <iframe
                  ref={iframeRef}
                  data-testid="allternit-iframe-content"
                  src={getWebProxyUrl((activeTab as WebTab).url)}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation allow-modals allow-pointer-lock allow-downloads"
                  allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                  onLoad={handleIframeLoad}
                  onError={() => { setIframeError(true); if (activeTabId) setTabLoading(activeTabId, false); }}
                />
              )}
              </div>
              {iframeError && (
                <div style={{ position: 'absolute', inset: 0, background: BACKGROUND.primary, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <Warning style={{ width: 48, height: 48, color: 'rgba(239,68,68,0.6)', marginBottom: 16 }} />
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(248,113,113,0.8)', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 8 }}>CONNECTION_FAILED</div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(155,155,155,0.4)', maxWidth: 320, textAlign: 'center' }}>Could not load {(activeTab as WebTab).url}</div>
                </div>
              )}
              {!iframeLoaded && !iframeError && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10 }}>
                  <BrowserIframeSkeleton />
                </div>
              )}
              <BrowserDownloadBar />
            </div>
          ) : showHomePage || tabs.length === 0 || (activeTab && activeTab.contentType === 'web' && (activeTab as WebTab).url === 'about:blank') ? (
            <BrowserNewTabPage onNavigate={(url) => {
              if (activeTab && activeTab.contentType === 'web' && (activeTab as WebTab).url === 'about:blank' && activeTabId) {
                // Navigate the current blank tab instead of creating a new one
                updateTab(activeTabId, { url, title: url } as Partial<BrowserTab>);
                pushHistory(activeTabId, url);
                setTabLoading(activeTabId, true);
                setIframeLoaded(false);
                setIframeError(false);
              } else {
                addTab(url);
                setShowHomePage(false);
              }
            }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ marginBottom: 80, opacity: 0.4, transform: 'scale(0.9)' }}><AllternitLogo size="lg" variant="stacked" /></div>
              <p style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'rgba(155,155,155,0.2)', textTransform: 'uppercase', letterSpacing: '0.5em' }}>INITIALIZING_KERNEL...</p>
            </div>
          )
        ) : contentMode === 'canvas' ? (
          <CanvasMode tab={activeTab?.contentType === 'a2ui' ? (activeTab as A2UITab) : undefined} />
        ) : (
          <StudioMode />
        )}
          <PageAgentTakeoverOverlay active={showPageAgentTakeover} task={pageAgentGoal} />
        </div>

        {/* ━━━ CHAT PANE (Kimi-style right sidecar) ━━━ */}
        {chatPaneOpen && (
          <>
            <div
              role="separator"
              aria-label="Resize browser chat pane"
              onPointerDown={handleChatPaneResizePointerStart}
              onMouseDown={handleChatPaneResizeMouseStart}
              style={{
                width: 8,
                flexShrink: 0,
                cursor: 'col-resize',
                position: 'relative',
                background: isResizingChatPane ? 'var(--surface-hover)' : 'transparent',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 3,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: isResizingChatPane ? browserTokens.accent : BORDER.subtle,
                }}
              />
            </div>
            <div style={{
              width: chatPaneWidth,
              minWidth: BROWSER_CHAT_PANE_MIN_WIDTH,
              flexShrink: 0,
              borderLeft: `1px solid ${BORDER.subtle}`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: BACKGROUND.primary,
            }}>
              <BrowserChatPane />
            </div>
          </>
        )}
      </div>
      {isResizingChatPane && (
        <div
          aria-hidden="true"
          onPointerMove={(event) => updateChatPaneResize(event.clientX)}
          onPointerUp={stopChatPaneResize}
          onPointerCancel={stopChatPaneResize}
          onMouseMove={(event) => updateChatPaneResize(event.clientX)}
          onMouseUp={stopChatPaneResize}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            cursor: 'col-resize',
            background: 'transparent',
            pointerEvents: 'auto',
          }}
        />
      )}
    </div>
  );
}

export function openSampleA2UITab() {
  const { addA2UITab } = useBrowserStore.getState();
  addA2UITab(sampleA2UIPayload as any, 'A2UI Demo', 'demo');
}

export default BrowserCapsuleEnhanced;
