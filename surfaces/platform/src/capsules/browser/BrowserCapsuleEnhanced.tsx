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
} from '@phosphor-icons/react';

import { AllternitLogo } from '@/components/AllternitLogo';
import { ArchitectLogo } from '@/components/ai-elements/ArchitectLogo';
import { MatrixLogo } from '@/components/ai-elements/MatrixLogo';
import { cn } from '@/lib/utils';
import { isElectronShell, getWebProxyUrl } from '@/lib/platform';

import {
  BROWSER_CHAT_PANE_MIN_WIDTH,
  useBrowserStore,
} from './browser.store';
import { BrowserTab, WebTab, A2UITab, A2UIPayload, ChromeStreamTab } from './browser.types';
import { useBrowserAgentStore } from './browserAgent.store';
import { BrowserAgentMode } from './browserAgent.types';
import { A2UIRenderer } from '../a2ui/A2UIRenderer';
import { useBrowserAutomation } from '../../integration/browser-client';
import { useSidecarStore } from '../../stores/sidecar-store';
import { useBrowserShortcutsStore, getFaviconUrl } from './browserShortcuts.store';
import { ChromeStreamView } from './ChromeStreamView';
import { useChromeSession } from './useChromeSession';
import { ACIGlassPill } from './ACIGlassPill';
import { BrowserAgentOverlay } from './BrowserAgentOverlay';
import { BrowserChatPane } from './BrowserChatPane';
import { ACIComputerUseView } from './ACIComputerUseView';
import { PageAgentTakeoverOverlay } from './PageAgentTakeoverOverlay';
import { useExtensionBridge } from './useExtensionBridge';

// ============================================================================
// Types & Constants
// ============================================================================

export interface BrowserCapsuleEnhancedProps {
  initialUrl?: string;
  agentMode?: 'guided' | 'autonomous';
  guidanceMessages?: string[];
  onHumanCheckpoint?: () => void;
}

const DEFAULT_URL = 'https://www.google.com';

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
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', opacity: 0.1 }}>
          <SquaresFour style={{ width: 64, height: 64, margin: '0 auto 16px' }} />
          <p style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5em' }}>Waiting_for_signal...</p>
        </div>
      </div>
    </div>
  );
}

function StudioMode() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <div style={{ width: 40, height: 40, borderRadius: 4, background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Sparkle style={{ width: 20, height: 20, color: 'rgba(245,158,11,0.6)' }} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.3em', color: 'rgba(245,158,11,0.8)' }}>A2UI_Studio</div>
        </div>
      </div>
      <div style={{ flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', opacity: 0.1 }}>
          <Sparkle style={{ width: 64, height: 64, margin: '0 auto 16px' }} />
          <p style={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.5em' }}>Initialize_Workspace...</p>
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
    <div ref={ref} style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 224, maxHeight: 288, overflowY: 'auto', background: '#252220', border: '1px solid #444', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50, padding: '4px 0' }}>
      <div style={{ padding: '6px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', fontWeight: 600 }}>Open Tabs ({tabs.length})</div>
      {tabs.map((tab) => (
        <div key={tab.id} onClick={() => { onSelect(tab.id); onClose(); }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', cursor: 'pointer', background: tab.id === activeTabId ? 'rgba(255,255,255,0.05)' : 'transparent', color: tab.id === activeTabId ? '#fff' : '#999' }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          onMouseLeave={(e) => e.currentTarget.style.background = tab.id === activeTabId ? 'rgba(255,255,255,0.05)' : 'transparent'}>
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

function TabContextMenu({ x, y, tabId, onClose }: {
  x: number; y: number; tabId: string; onClose: () => void;
}) {
  const { closeTab, closeOtherTabs, closeTabsToRight, duplicateTab } = useBrowserStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const items = [
    { label: 'Duplicate Tab', icon: <Copy style={{ width: 12, height: 12 }} />, action: () => duplicateTab(tabId) },
    { label: 'Close Tab', icon: <X style={{ width: 12, height: 12 }} />, action: () => closeTab(tabId) },
    { label: 'Close Other Tabs', icon: <X style={{ width: 12, height: 12 }} />, action: () => closeOtherTabs(tabId) },
    { label: 'Close Tabs to Right', icon: <CaretRight style={{ width: 12, height: 12 }} />, action: () => closeTabsToRight(tabId) },
  ];

  return (
    <div ref={ref} style={{
      position: 'fixed', left: x, top: y, width: 180, background: '#252220',
      border: '1px solid #444', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      zIndex: 1000, padding: '4px 0', fontSize: 12,
    }}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.action(); onClose(); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px',
            border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc', fontSize: 12, textAlign: 'left',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
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
      background: '#252220', border: '1px solid #444', borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 100, padding: '4px 0',
      maxHeight: 200, overflowY: 'auto',
    }}>
      {filtered.map((visit, i) => (
        <div key={i}
          onClick={() => onSelect(visit.url)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            cursor: 'pointer', color: '#ccc', fontSize: 12,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <TabFavicon url={visit.url} size={14} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{visit.title}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 10, color: '#666' }}>{visit.url}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Three-Dot Menu
// ============================================================================

function ThreeDotMenu({ open, onClose, contentMode, setContentMode, agentModeControl, setAgentMode, agentStatus, onNewTab, onToggleChatPane, chatPaneOpen, onCloseAllTabs, onScreenshot }: {
  open: boolean; onClose: () => void; contentMode: ContentMode; setContentMode: (m: ContentMode) => void;
  agentModeControl: BrowserAgentMode; setAgentMode: (m: BrowserAgentMode) => void; agentStatus: string;
  onNewTab: () => void; onToggleChatPane: () => void; chatPaneOpen: boolean; onCloseAllTabs: () => void;
  onScreenshot: () => void;
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
      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', color: color || (active ? '#D4B08C' : '#999'), fontSize: 12, textAlign: 'left', opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {icon || <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#D4B08C' : 'transparent' }} />}
      {label}
    </button>
  );

  return (
    <div ref={menuRef} style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 208, background: '#252220', border: '1px solid #444', borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50, padding: '4px 0', fontSize: 14 }}>
      <div style={{ padding: '6px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', fontWeight: 600 }}>View Mode</div>
      {(['web', 'canvas', 'studio'] as ContentMode[]).map((m) => <Item key={m} label={m.charAt(0).toUpperCase() + m.slice(1)} active={contentMode === m} onClick={() => setContentMode(m)} />)}
      <div style={{ height: 1, background: '#444', margin: '4px 0' }} />
      <div style={{ padding: '6px 12px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#888', fontWeight: 600 }}>Agent Mode</div>
      {(['Human', 'Assist', 'Agent'] as BrowserAgentMode[]).map((m) => <Item key={m} label={m} active={agentModeControl === m} disabled={agentStatus === 'Running'} onClick={() => setAgentMode(m)} />)}
      <div style={{ height: 1, background: '#444', margin: '4px 0' }} />
      <Item label={chatPaneOpen ? 'Hide Chat Pane' : 'Open Chat Pane'} icon={<Sparkle style={{ width: 14, height: 14 }} />} onClick={onToggleChatPane} />
      <Item label="Screenshot" icon={<Camera style={{ width: 14, height: 14 }} />} onClick={onScreenshot} />
      <Item label="New Tab" icon={<Plus style={{ width: 14, height: 14 }} />} onClick={onNewTab} />
      <div style={{ height: 1, background: '#444', margin: '4px 0' }} />
      <Item label="Close All Tabs" icon={<X style={{ width: 14, height: 14 }} />} color="rgba(248,113,113,0.7)" onClick={onCloseAllTabs} />
    </div>
  );
}

// ============================================================================
// Agent Popup (MatrixLogo dropdown — agent mode/status)
// ============================================================================

const accentLineStyle = `@keyframes browserAccentSlide { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes tabLoadingSlide { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`;

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
        color: mode === value ? '#D4B08C' : '#999', fontSize: 12,
      }}
    >
      <div style={{
        width: 12, height: 12, borderRadius: '50%',
        border: `2px solid ${mode === value ? '#D4B08C' : '#555'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {mode === value && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4B08C' }} />}
      </div>
      {label}
    </div>
  );

  return (
    <div ref={ref} style={{
      position: 'absolute', right: 0, top: '100%', marginTop: 4, width: 224,
      background: '#252220', border: '1px solid #444', borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50, padding: 0, fontSize: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid #333',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontWeight: 600 }}>
          <ScaledMatrixLogo state={agentActive ? 'thinking' : 'idle'} displaySize={14} />
          <span>Allternit Agent</span>
        </div>
        <button
          onClick={() => setMode(agentActive ? 'Human' : 'Assist')}
          style={{
            padding: '2px 10px', borderRadius: 10, border: 'none', fontSize: 10, fontWeight: 700,
            background: agentActive ? '#D4B08C' : '#444',
            color: agentActive ? '#1A1612' : '#888',
            cursor: 'pointer',
          }}
        >
          {agentActive ? 'On' : 'Off'}
        </button>
      </div>

      <div style={{ padding: '8px 12px', borderBottom: '1px solid #333' }}>
        <div style={{ color: '#777', marginBottom: 6 }}>Status: <span style={{ color: '#ccc' }}>{status}</span></div>
        <div style={{ color: '#777', marginBottom: 4 }}>Mode:</div>
        <div style={{ paddingLeft: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <RadioItem label="Human" value="Human" />
          <RadioItem label="Assist" value="Assist" />
          <RadioItem label="Agent" value="Agent" />
        </div>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4, color: '#777' }}>
        <div>
          Operator: {operatorOk === null ? '...' : operatorOk ? (
            <span style={{ color: '#6ee7b7' }}>Connected ✓</span>
          ) : (
            <span style={{ color: '#f87171' }}>Offline ✗</span>
          )}
        </div>
        <div>
          Extension: {extensionPaired ? (
            <span style={{ color: '#6ee7b7' }}>Paired ✓</span>
          ) : (
            <span style={{ color: '#888' }}>Not paired</span>
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
      background: '#252220', border: '1px solid #444', borderRadius: 8,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)', zIndex: 50, padding: 0, fontSize: 12,
      maxHeight: 420, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px', borderBottom: '1px solid #333', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontWeight: 600 }}>
          <Puzzle style={{ width: 14, height: 14 }} />
          <span>Extensions</span>
        </div>
        <button
          onClick={onClose}
          style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#666', display: 'flex' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#ccc'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
        >
          <X style={{ width: 12, height: 12 }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #333', flexShrink: 0 }}>
        {(['installed', 'discover'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '7px 0', border: 'none', background: 'transparent', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: activeTab === tab ? '#D4B08C' : '#666',
              borderBottom: activeTab === tab ? '2px solid #D4B08C' : '2px solid transparent',
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
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                {ext.id === 'allternit-agent' ? (
                  <ScaledMatrixLogo state={ext.enabled ? 'listening' : 'idle'} displaySize={20} />
                ) : (
                  <ExtensionStoreIcon storeUrl={ext.storeUrl} fallbackIcon={ext.icon} size={20} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 12, color: ext.enabled ? '#ccc' : '#666', fontWeight: 500 }}>{ext.name}</span>
                    {ext.installStatus === 'pending' && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                        color: '#f59e0b', background: 'rgba(245,158,11,0.12)', borderRadius: 3, padding: '1px 4px',
                      }}>Pending</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                          background: 'rgba(34,197,94,0.15)', color: '#4ade80', cursor: 'pointer',
                        }}
                      >
                        ✓ Mark installed
                      </button>
                      {ext.storeUrl && (
                        <button
                          onClick={() => { onNavigate(ext.storeUrl!); onClose(); }}
                          style={{
                            padding: '2px 6px', borderRadius: 4, border: 'none', fontSize: 10, fontWeight: 600,
                            background: 'rgba(255,255,255,0.06)', color: '#888', cursor: 'pointer',
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
                      background: ext.enabled ? '#D4B08C' : '#444',
                      position: 'relative', flexShrink: 0, transition: 'background 0.2s',
                    }}
                  >
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', background: '#fff',
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
                      cursor: 'pointer', color: '#555', display: 'flex', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#D4B08C'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; }}
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
                      cursor: 'pointer', color: '#666', display: 'flex', flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#f87171'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
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
                    width: '100%', padding: '6px', borderRadius: 6, border: '1px dashed #444',
                    background: 'transparent', color: '#666', fontSize: 11, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#888'; e.currentTarget.style.color = '#aaa'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#666'; }}
                >
                  <Plus style={{ width: 10, height: 10 }} /> Add custom extension
                </button>
              </div>
            ) : (
              <div style={{ padding: '8px 12px', borderTop: '1px solid #333', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Extension</div>
                <input
                  value={installName} onChange={(e) => setInstallName(e.target.value)}
                  placeholder="Extension name"
                  autoFocus
                  style={{
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, padding: '5px 8px', color: '#fff', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
                <input
                  value={installUrl} onChange={(e) => setInstallUrl(e.target.value)}
                  placeholder="Store URL (optional)"
                  style={{
                    background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 6, padding: '5px 8px', color: '#fff', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={handleCustomInstall} style={{
                    flex: 1, padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: '#D4B08C', color: '#1A1612', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                    Add Extension
                  </button>
                  <button onClick={() => { setCustomInstalling(false); setInstallName(''); setInstallUrl(''); }} style={{
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: 'rgba(255,255,255,0.06)', color: '#888', fontSize: 11, cursor: 'pointer',
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
              fontSize: 10, color: '#9a8a7a', lineHeight: 1.5,
            }}>
              Clicking <strong style={{ color: '#D4B08C' }}>Add to Chrome</strong> navigates to the Chrome Web Store — install it there, then open Extensions and click <strong style={{ color: '#4ade80' }}>Mark installed</strong>.
            </div>

            {EXTENSION_CATALOG.map((item) => {
              const alreadyAdded = extensions.some((e) => e.chromeStoreId === item.chromeStoreId);
              return (
                <div key={item.catalogId} style={{
                  padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  background: item.featured ? 'rgba(212,176,140,0.03)' : 'transparent',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <ExtensionStoreIcon storeUrl={item.storeUrl} fallbackIcon={item.icon} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <span style={{ fontSize: 12, color: '#ccc', fontWeight: 600 }}>{item.name}</span>
                        {item.featured && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                            color: '#D4B08C', background: 'rgba(212,176,140,0.12)', borderRadius: 3, padding: '1px 4px',
                          }}>Featured</span>
                        )}
                      </div>
                      {item.publisher && (
                        <div style={{ fontSize: 10, color: '#666', marginBottom: 3 }}>by {item.publisher}</div>
                      )}
                      <div style={{ fontSize: 10, color: '#777', lineHeight: 1.4, marginBottom: 8 }}>
                        {item.description}
                      </div>
                      {alreadyAdded ? (
                        <span style={{
                          fontSize: 10, color: '#4ade80', fontWeight: 600,
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          ✓ Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCatalogInstall(item)}
                          style={{
                            padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: 10, fontWeight: 700,
                            background: item.featured ? '#D4B08C' : 'rgba(255,255,255,0.08)',
                            color: item.featured ? '#1A1612' : '#aaa',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                          }}
                          onMouseEnter={(e) => {
                            if (!item.featured) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#ccc'; }
                          }}
                          onMouseLeave={(e) => {
                            if (!item.featured) { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#aaa'; }
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
                style={{ background: 'transparent', border: 'none', fontSize: 10, color: '#666', cursor: 'pointer', padding: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#D4B08C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; }}
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
            position: 'absolute', inset: 0, background: '#252220', borderRadius: 8,
            display: 'flex', flexDirection: 'column', zIndex: 10,
          }}>
            {/* Panel header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
              borderBottom: '1px solid #333', flexShrink: 0,
            }}>
              <button
                onClick={() => setSettingsExtId(null)}
                style={{ padding: 4, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: '#888', display: 'flex' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ccc'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; }}
              >
                <ArrowLeft style={{ width: 13, height: 13 }} />
              </button>
              {settingsExt.id === 'allternit-agent' ? (
                <ScaledMatrixLogo state="idle" displaySize={16} />
              ) : (
                <ExtensionStoreIcon storeUrl={settingsExt.storeUrl} fallbackIcon={settingsExt.icon} size={16} />
              )}
              <span style={{ fontSize: 12, color: '#ccc', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {settingsExt.name}
              </span>
              <GearSix style={{ width: 12, height: 12, color: '#555' }} />
            </div>

            {/* Permissions section */}
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
              <div style={{
                padding: '4px 12px 8px', fontSize: 10, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666',
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
                    padding: '7px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: 11, color: '#bbb', flex: 1 }}>{label}</span>
                    {/* Three-way pill: Allow / Ask / Block */}
                    <div style={{
                      display: 'flex', borderRadius: 6, overflow: 'hidden',
                      border: '1px solid #383838', flexShrink: 0,
                    }}>
                      {(['allow', 'ask', 'block'] as PermissionValue[]).map((val) => {
                        const active = current === val;
                        const colors: Record<PermissionValue, string> = {
                          allow: '#4ade80',
                          ask:   '#D4B08C',
                          block: '#f87171',
                        };
                        return (
                          <button
                            key={val}
                            onClick={() => setExtensionPermission(settingsExt.id, key, val)}
                            style={{
                              padding: '2px 6px', border: 'none', cursor: 'pointer', fontSize: 9,
                              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                              background: active ? `${colors[val]}22` : 'transparent',
                              color: active ? colors[val] : '#555',
                              borderRight: val !== 'block' ? '1px solid #383838' : 'none',
                              transition: 'background 0.15s, color 0.15s',
                            }}
                            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.color = '#999'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}}
                            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'transparent'; }}}
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
                    width: '100%', padding: '5px', borderRadius: 6, border: '1px dashed #383838',
                    background: 'transparent', color: '#555', fontSize: 10, cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#666'; e.currentTarget.style.color = '#888'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#383838'; e.currentTarget.style.color = '#555'; }}
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
    tabLoading, setTabLoading, duplicateTab, closeOtherTabs, closeTabsToRight,
    addChromeStreamTab, chatPaneOpen, chatPaneWidth, toggleChatPane, setChatPaneWidth,
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
    endpoint,
    currentAction: agentCurrentAction,
    setIsBrowserCapsuleMounted,
    goal: pageAgentGoal,
    pageAgentStatus,
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
  const extSetEnabled = useExtensionsStore((s) => s.setEnabled);
  // Only show extensions that are fully installed (not pending) AND enabled in the toolbar
  const enabledExtensions = useMemo(
    () => allExtensions.filter((e) => e.enabled && e.installStatus !== 'pending'),
    [allExtensions],
  );
  const automation = useBrowserAutomation();
  
  // Initialize extension bridge for direct Chrome extension communication
  const { isConnected: isExtensionConnected } = useExtensionBridge();

  const activeTab = tabs.find(t => t.id === activeTabId);
  const [contentMode, setContentMode] = useState<ContentMode>('web');
  const [urlInput, setUrlInput] = useState('');
  const [isHoveringTab, setIsHoveringTab] = useState<string | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [proxyFailed, setProxyFailed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const proxyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tabDropdownOpen, setTabDropdownOpen] = useState(false);
  const [agentPopupOpen, setAgentPopupOpen] = useState(false);
  const [extensionPopupOpen, setExtensionPopupOpen] = useState(false);
  const agentActive = agentModeControl !== 'Human';
  const [urlFocused, setUrlFocused] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const chromeEmbedContainerRef = useRef<HTMLDivElement>(null);
  
  // Chrome embed state
  const [useChromeEmbed, setUseChromeEmbed] = useState(false);
  const [chromeEmbedUrl, setChromeEmbedUrl] = useState<string | null>(null);
  
  // Show home page state (when no tabs)
  const [showHomePage, setShowHomePage] = useState(false);
  const [isResizingChatPane, setIsResizingChatPane] = useState(false);

  // Tab context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const chatPaneResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Bookmarked state for current tab
  const shortcuts = useBrowserShortcutsStore((s) => s.shortcuts);
  const isBookmarked = useMemo(() => {
    if (!activeTab || activeTab.contentType !== 'web') return false;
    const url = (activeTab as WebTab).url;
    return shortcuts.some((s) => s.url === url);
  }, [activeTab, shortcuts]);

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
    
    // Check if this is Chrome Web Store - use embedded Chrome browser
    if (targetUrl.includes('chromewebstore.google.com')) {
      console.log('[Browser] Chrome Web Store detected, launching embedded Chrome:', targetUrl);
      if (window.chromeEmbed?.launch) {
        try {
          await window.chromeEmbed.launch(targetUrl);
          console.log('[Browser] Embedded Chrome launched');
          return;
        } catch (err) {
          console.error('[Browser] Failed to launch embedded Chrome:', err);
          // Fall through to normal navigation
        }
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
      ctx.fillStyle = '#202020';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#D4B08C';
      ctx.font = '16px system-ui';
      ctx.textAlign = 'center';
      const url = activeTab && activeTab.contentType === 'web' ? (activeTab as WebTab).url : 'No active tab';
      ctx.fillText(`Screenshot: ${url}`, canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = '#888';
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

  // Launch Chrome browser session (creates chrome-stream tab)
  const launchEmbeddedChrome = useCallback(async (url?: string) => {
    console.log('[Browser] Launching Chrome session...');
    
    try {
      // Create Chrome session via API
      const response = await fetch('/api/v1/chrome-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolution: '1920x1080',
          extension_mode: 'power',
          initial_url: url || 'https://chromewebstore.google.com',
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create Chrome session: ${response.status}`);
      }

      const data = await response.json();
      console.log('[Browser] Chrome session created:', data);

      // Poll until session is ready
      const pollUntilReady = async (sessionId: string, maxWait = 30000) => {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
          const statusResponse = await fetch(`/api/v1/chrome-sessions/${sessionId}`);
          if (!statusResponse.ok) break;
          
          const statusData = await statusResponse.json();
          if (statusData.status === 'ready') {
            return statusData;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        throw new Error('Session provisioning timeout');
      };

      const sessionData = await pollUntilReady(data.session_id);
      console.log('[Browser] Chrome session ready:', sessionData);

      // Add chrome-stream tab
      const tabId = addChromeStreamTab(
        sessionData.session_id,
        sessionData.signaling_url,
        sessionData.ice_servers,
        sessionData.resolution
      );

      console.log('[Browser] Chrome stream tab added:', tabId);

    } catch (err) {
      console.error('[Browser] Failed to launch Chrome session:', err);
      // Fallback: open in external Chrome
      if (window.chromeEmbed?.open) {
        await window.chromeEmbed.open(url || 'https://chromewebstore.google.com');
      } else {
        window.open(url || 'https://chromewebstore.google.com', '_blank');
      }
    }
  }, [addChromeStreamTab]);

  // Close embedded Chrome
  const closeEmbeddedChrome = useCallback(async () => {
    if (window.chromeEmbed?.close) {
      await window.chromeEmbed.close();
    }
    setUseChromeEmbed(false);
    setChromeEmbedUrl(null);
  }, []);

  // Button helper
  const NavBtn = ({ children, title, onClick, active, disabled }: { children: React.ReactNode; title: string; onClick?: () => void; active?: boolean; disabled?: boolean }) => (
    <button onClick={onClick} title={title} disabled={disabled}
      style={{ padding: 6, borderRadius: '50%', border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer', color: active ? '#D4B08C' : disabled ? '#555' : '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );

  // Compute dynamic tab width: shrink as count grows, min 60px
  const tabMinWidth = 60;
  const tabMaxWidth = 180;

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
        background: '#202020',
        color: '#ECECEC',
        fontFamily: 'system-ui, -apple-system, sans-serif',
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
          background: '#202020',
          flexShrink: 0,
          position: 'relative',
        }}
        onDoubleClick={(e) => {
          // Double-click empty space → new tab
          if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-tab-bar-space]')) {
            addTab(DEFAULT_URL);
          }
        }}
      >
        {/* Tab list — tabs shrink to fit, like Chrome */}
        <div data-tab-bar-space style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'flex-end', overflow: 'hidden', minWidth: 0 }}>
          {tabs.map((tab) => {
            const isLoading = tabLoading[tab.id];
            return (
              <div
                key={tab.id}
                onMouseEnter={() => setIsHoveringTab(tab.id)}
                onMouseLeave={() => setIsHoveringTab(null)}
                onClick={() => setActiveTab(tab.id)}
                onMouseDown={(e) => {
                  // Middle-click to close tab
                  if (e.button === 1) {
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
                  height: 30,
                  minWidth: tabMinWidth,
                  maxWidth: tabMaxWidth,
                  flex: `0 1 ${tabMaxWidth}px`,
                  paddingLeft: 10,
                  paddingRight: 6,
                  cursor: 'pointer',
                  borderRadius: '8px 8px 0 0',
                  transition: 'background 0.15s',
                  background: tab.id === activeTabId ? '#313131' : 'transparent',
                  color: tab.id === activeTabId ? '#fff' : '#999',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {/* Loading indicator */}
                {isLoading && (
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                    overflow: 'hidden', borderRadius: '0 0 0 0',
                  }}>
                    <div style={{
                      width: '25%', height: '100%', background: '#D4B08C',
                      animation: 'tabLoadingSlide 1s ease-in-out infinite',
                    }} />
                  </div>
                )}
                {/* Favicon or loading spinner */}
                {isLoading ? (
                  <CircleNotch style={{ width: 12, height: 12, marginRight: 6, flexShrink: 0, opacity: 0.6, animation: 'spin 1s linear infinite' }} />
                ) : (
                  <TabFavicon url={tab.contentType === 'web' ? (tab as WebTab).url : undefined} size={12} />
                )}
                <span style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, marginLeft: isLoading ? 0 : 6 }}>
                  {tab.title || 'New Tab'}
                </span>
                {(tab.id === activeTabId || isHoveringTab === tab.id) && (
                  <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                    style={{ marginLeft: 4, padding: 2, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: 'inherit', opacity: 0.5, display: 'flex', flexShrink: 0 }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.opacity = '1'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.opacity = '0.5'; }}>
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>
            );
          })}
          {/* + button */}
          <button onClick={() => addTab(DEFAULT_URL)} title="New Tab"
            style={{ height: 30, width: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#999', flexShrink: 0, marginLeft: 2 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#999'; }}>
            <Plus style={{ width: 14, height: 14 }} />
          </button>
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

      {/* ━━━ ACCENT LINE ━━━ */}
      <style>{accentLineStyle}</style>
      <div style={{
        height: 2, flexShrink: 0,
        background: 'linear-gradient(90deg, transparent, #D4B08C, transparent)',
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
        background: '#313131',
        borderBottom: '1px solid #1a1a1a',
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
          {/* Chrome Web Store button - opens embedded Chrome */}
          <NavBtn title="Open Chrome Web Store (for extensions)" onClick={async () => {
            if (window.chromeEmbed?.launch) {
              await window.chromeEmbed.launch('https://chromewebstore.google.com');
            } else {
              // Fallback: navigate in current browser
              updateTab(activeTabId!, { url: 'https://chromewebstore.google.com' } as Partial<WebTab>);
            }
          }}>
            <Globe style={{ width: 16, height: 16 }} />
          </NavBtn>
        </div>
        {/* URL bar */}
        <form onSubmit={handleNavigate} style={{ flex: 1, minWidth: 0, position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Chrome Browser Button - Always visible in Electron */}
          {isElectronShell() && (
            <button
              type="button"
              onClick={() => launchEmbeddedChrome('https://chromewebstore.google.com')}
              title="Open Chrome Browser (for extensions)"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8,
                border: '1px solid rgba(212,176,140,0.3)',
                background: 'rgba(212,176,140,0.1)',
                color: '#D4B08C', cursor: 'pointer',
                fontSize: 12, fontWeight: 600,
                flexShrink: 0,
                height: 32
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(212,176,140,0.2)';
                e.currentTarget.style.borderColor = 'rgba(212,176,140,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(212,176,140,0.1)';
                e.currentTarget.style.borderColor = 'rgba(212,176,140,0.3)';
              }}
            >
              <Globe style={{ width: 14, height: 14 }} />
              Chrome
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', height: 32, background: '#202020', borderRadius: 16, paddingLeft: 16, paddingRight: 16, flex: 1 }}>
            {activeTab && <Lock style={{ width: 14, height: 14, color: '#666', marginRight: 8, flexShrink: 0 }} />}
            <input type="text" value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onFocus={() => setUrlFocused(true)}
              onBlur={() => setTimeout(() => setUrlFocused(false), 200)}
              style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#fff', fontFamily: 'inherit', minWidth: 0 }}
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
          <Star style={{ width: 16, height: 16, fill: isBookmarked ? '#D4B08C' : 'none' }} />
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
                      background: '#4ade80', border: '1px solid #313131',
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
            onNewTab={() => addTab(DEFAULT_URL)} onToggleChatPane={toggleChatPane} chatPaneOpen={chatPaneOpen} onCloseAllTabs={closeAllTabs}
            onScreenshot={handleScreenshot} />
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
          {/* ACI computer-use viewport — full overlay when agent is active */}
          {showAciViewport && (
            <ACIComputerUseView agentBarHeight={0} />
          )}

          {/* ACI overlays — float above web content */}
          <BrowserAgentOverlay status={agentStatus} currentAction={agentCurrentAction} />

          {/* Glass pill — bottom-center execution status */}
          <ACIGlassPill placement="bottom-center" />

          {contentMode === 'web' ? (
          activeTab && activeTab.contentType === 'web' ? (
            /* WEB CONTENT */
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              {isElectronShell() ? (
                /* @ts-ignore */
                <webview
                  data-testid="allternit-webview-content"
                  src={(activeTab as WebTab).url}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'white' }}
                  allowpopups="true"
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
              {iframeError && (
                <div style={{ position: 'absolute', inset: 0, background: '#0A0908', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <Warning style={{ width: 48, height: 48, color: 'rgba(239,68,68,0.6)', marginBottom: 16 }} />
                  <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(248,113,113,0.8)', textTransform: 'uppercase', letterSpacing: '0.3em', marginBottom: 8 }}>CONNECTION_FAILED</div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(155,155,155,0.4)', maxWidth: 320, textAlign: 'center' }}>Could not load {(activeTab as WebTab).url}</div>
                </div>
              )}
              {!iframeLoaded && !iframeError && (
                <div style={{ position: 'absolute', inset: 0, background: '#0A0908', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <div style={{ position: 'relative', marginBottom: 32 }}>
                    <ArchitectLogo state="thinking" size={64} className="text-[#D4B08C]/60" />
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(212,176,140,0.4)', textTransform: 'uppercase', letterSpacing: '0.8em' }}>SYNCING_SUBSTRATE</div>
                </div>
              )}
            </div>
          ) : useChromeEmbed ? (
            /* EMBEDDED CHROME BROWSER */
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <div
                ref={chromeEmbedContainerRef}
                id="chrome-embed-container"
                style={{ width: '100%', height: '100%', background: '#0A0908' }}
              />
              <button
                onClick={closeEmbeddedChrome}
                style={{
                  position: 'absolute', top: 16, right: 16, zIndex: 100,
                  padding: 8, borderRadius: '50%', border: 'none',
                  background: 'rgba(212,176,140,0.2)', color: '#D4B08C',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
                title="Close Chrome"
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
              {!chromeEmbedContainerRef.current && (
                <div style={{ position: 'absolute', inset: 0, background: '#0A0908', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                  <div style={{ position: 'relative', marginBottom: 32 }}>
                    <ArchitectLogo state="thinking" size={64} className="text-[#D4B08C]/60" />
                  </div>
                  <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(212,176,140,0.4)', textTransform: 'uppercase', letterSpacing: '0.5em' }}>LAUNCHING_CHROME...</div>
                </div>
              )}
            </div>
          ) : showHomePage || tabs.length === 0 ? (
            /* HOME PAGE - Show Chrome embed option */
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0A0908' }}>
              <div style={{ marginBottom: 48, opacity: 0.4, transform: 'scale(0.9)' }}><AllternitLogo size="lg" variant="stacked" /></div>
              {isElectronShell() && window.chromeEmbed?.launch ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <button
                    onClick={() => launchEmbeddedChrome('https://chromewebstore.google.com')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '16px 32px', borderRadius: 12,
                      border: '1px solid rgba(212,176,140,0.3)',
                      background: 'rgba(212,176,140,0.1)',
                      color: '#D4B08C', cursor: 'pointer',
                      fontSize: 14, fontWeight: 600
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(212,176,140,0.2)';
                      e.currentTarget.style.borderColor = 'rgba(212,176,140,0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(212,176,140,0.1)';
                      e.currentTarget.style.borderColor = 'rgba(212,176,140,0.3)';
                    }}
                  >
                    <Globe style={{ width: 20, height: 20 }} />
                    Open Chrome Browser (for extensions)
                  </button>
                  <p style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(155,155,155,0.5)', textAlign: 'center', maxWidth: 400 }}>
                    Opens real Chrome browser for Chrome Web Store and extension downloads
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(212,176,140,0.2)', textTransform: 'uppercase', letterSpacing: '0.5em' }}>INITIALIZING_KERNEL...</p>
              )}
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ marginBottom: 80, opacity: 0.4, transform: 'scale(0.9)' }}><AllternitLogo size="lg" variant="stacked" /></div>
              <p style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(212,176,140,0.2)', textTransform: 'uppercase', letterSpacing: '0.5em' }}>INITIALIZING_KERNEL...</p>
            </div>
          )
        ) : activeTab?.contentType === 'chrome-stream' ? (
          <ChromeStreamView
            sessionId={(activeTab as ChromeStreamTab).sessionId}
            signalingUrl={(activeTab as ChromeStreamTab).signalingUrl}
            iceServers={(activeTab as ChromeStreamTab).iceServers}
            resolution={(activeTab as ChromeStreamTab).resolution}
            onStatusChange={(status) => {
              updateTab(activeTabId!, { streamStatus: status } as Partial<ChromeStreamTab>);
            }}
          />
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
                background: isResizingChatPane ? 'rgba(255,255,255,0.04)' : 'transparent',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 3,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: isResizingChatPane ? '#5f5f5f' : '#1a1a1a',
                }}
              />
            </div>
            <div style={{
              width: chatPaneWidth,
              minWidth: BROWSER_CHAT_PANE_MIN_WIDTH,
              flexShrink: 0,
              borderLeft: '1px solid #1a1a1a',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: '#12100f',
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
