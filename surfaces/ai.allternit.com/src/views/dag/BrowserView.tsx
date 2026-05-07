/**
 * BrowserView - P5.2.1
 * High-Fidelity "Browser Substrate" for Allternit
 * Replaces the static engine-based view with a real interactive browser interface.
 */

"use client";

import React, { useState, useEffect } from 'react';
import {
  Globe,
  ArrowsClockwise,
  ArrowRight,
  Robot,
  CircleNotch,
  Plus,
  X,
  Lock,
  MagnifyingGlass,
  CaretLeft,
  CaretRight,
  Pulse as Activity,
  Shield,
  Lightning,
} from '@phosphor-icons/react';

// Design System
import { GlassSurface } from '@/design/glass/GlassSurface';
import { GlassIconButton } from '@/design/glass/GlassButton';
import { AllternitLogo } from '@/components/AllternitLogo';
import { ArchitectLogo } from '@/components/ai-elements/ArchitectLogo';
import { cn } from '@/lib/utils';

// Store & Types
import { useBrowserStore } from '@/capsules/browser/browser.store';
import { WebTab } from '@/capsules/browser/browser.types';
import { useBrowserAgentStore } from '@/capsules/browser/browserAgent.store';

// ============================================================================
// Browser Substrate Component
// ============================================================================

export function BrowserView() {
  // Store state
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, updateTab } = useBrowserStore();
  const { status: agentStatus, stopExecution, setIsBrowserCapsuleMounted } = useBrowserAgentStore();
  
  // Local UI state
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [urlInput, setUrlInput] = useState('');
  const [isHoveringTab, setIsHoveringTab] = useState<string | null>(null);

  // Mark browser capsule as mounted to suppress global ACIComputerUseSidecar
  useEffect(() => {
    setIsBrowserCapsuleMounted(true);
    return () => { setIsBrowserCapsuleMounted(false); };
  }, [setIsBrowserCapsuleMounted]);

  // Sync URL input with active tab
  useEffect(() => {
    if (activeTab && activeTab.contentType === 'web') {
      setUrlInput((activeTab as WebTab).url);
    }
  }, [activeTabId, activeTab]);

  // Handle URL navigation
  const handleNavigate = (e?: React.FormEvent) => {
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

    if (activeTabId) {
      updateTab(activeTabId, { url: targetUrl, title: targetUrl } as Partial<WebTab>);
    } else {
      addTab(targetUrl);
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden font-sans"
      style={{ 
        background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
        color: 'var(--text-primary)'
      }}
    >
      {/* 1. TOP DOCK: Tab Strip */}
      <div className="h-10 flex items-end px-2 gap-1 bg-[color-mix(in_srgb,var(--bg-primary)_40%,transparent)] border-b border-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)]">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onMouseEnter={() => setIsHoveringTab(tab.id)}
            onMouseLeave={() => setIsHoveringTab(null)}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group relative flex items-center h-8 min-w-[120px] max-w-[200px] px-3 rounded-t-lg cursor-pointer transition-all duration-200",
              tab.id === activeTabId 
                ? "bg-[var(--bg-secondary)] text-[var(--accent-primary)] border-t border-l border-r border-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)]" 
                : "bg-transparent text-[var(--text-muted)] hover:bg-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)]"
            )}
          >
            <Globe className={cn("w-3 h-3 mr-2 shrink-0", tab.id === activeTabId ? "text-[var(--accent-primary)]" : "text-[color-mix(in_srgb,var(--text-muted)_50%,transparent)]")} />
            <span className="text-[11px] font-medium truncate uppercase tracking-tight flex-1">
              {tab.title || 'New Substrate'}
            </span>
            
            {(tab.id === activeTabId || isHoveringTab === tab.id) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 p-0.5 rounded-full hover:bg-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)] transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            
            {/* Active Indicator Line */}
            {tab.id === activeTabId && (
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[var(--bg-secondary)]" />
            )}
          </div>
        ))}
        
        <button
          onClick={() => addTab('https://www.google.com')}
          className="h-8 w-8 flex items-center justify-center rounded-t-lg hover:bg-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)] text-[var(--text-muted)] transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* 2. NAVIGATION & CONTROL BAR - CLEAN VERSION */}
      <div className="h-12 flex items-center gap-3 px-4 bg-[var(--bg-secondary)] border-b border-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] z-10">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <GlassIconButton size="xs" className="text-[var(--text-muted)] hover:text-[var(--accent-primary)]">
            <CaretLeft size={14} />
          </GlassIconButton>
          <GlassIconButton size="xs" className="text-[var(--text-muted)] hover:text-[var(--accent-primary)]">
            <CaretRight size={14} />
          </GlassIconButton>
          <GlassIconButton size="xs" className="text-[color-mix(in_srgb,var(--accent-primary)_60%,transparent)] hover:text-[var(--accent-primary)]">
            <ArrowsClockwise className="w-3 h-3" />
          </GlassIconButton>
        </div>

        {/* Address Bar */}
        <form onSubmit={handleNavigate} className="flex-1 max-w-3xl">
          <GlassSurface 
            intensity="thin" 
            rounded="full" 
            border="subtle"
            className="flex items-center px-3 py-1.5 bg-[color-mix(in_srgb,var(--bg-primary)_40%,transparent)] border-[color-mix(in_srgb,var(--accent-primary)_15%,transparent)] group focus-within:border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)] transition-all"
          >
            <Lock className="w-3 h-3 text-green-500/60 mr-2" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 bg-transparent text-[12px] font-mono text-[var(--accent-primary)] outline-none placeholder:text-[color-mix(in_srgb,var(--text-muted)_30%,transparent)]"
              placeholder="ENTER SUBSTRATE COORDINATES..."
            />
            <MagnifyingGlass className="w-3.5 h-3.5 text-[color-mix(in_srgb,var(--text-muted)_40%,transparent)] group-hover:text-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)]" />
          </GlassSurface>
        </form>

        {/* Status Indicator (Minimal) */}
        <div className="flex items-center gap-2 ml-auto">
          {agentStatus === 'Running' && (
            <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] border border-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)]">
              <CircleNotch className="w-3 h-3 animate-spin text-[var(--accent-primary)]" />
              <span className="text-[10px] text-[var(--accent-primary)] uppercase tracking-wider">Running</span>
            </div>
          )}
          <div className="h-2 w-2 rounded-full bg-green-500/50" />
        </div>
      </div>

      {/* 3. BROWSER CONTENT AREA (FULL SCREEN) */}
      <div className="flex-1 relative bg-[var(--bg-primary)] overflow-hidden">
        {activeTab && activeTab.contentType === 'web' ? (
          <div className="w-full h-full relative">
            {/* Real Webview element in Electron, or iframe fallback */}
            {/* @ts-ignore */}
            <webview
              src={(activeTab as WebTab).url}
              className="w-full h-full"
              allowpopups={true}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
            
            {/* Loading Overlay */}
            {activeTab.title === activeTab.url && (
              <div className="absolute inset-0 bg-[var(--bg-primary)] flex flex-col items-center justify-center z-10">
                <div className="relative mb-6">
                  <div className="absolute inset-0 animate-pulse blur-2xl bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] rounded-full" />
                  <ArchitectLogo state="thinking" size={80} className="text-[var(--accent-primary)]" />
                </div>
                <div className="text-[10px] font-mono text-[var(--accent-primary)] uppercase tracking-[0.4em] animate-pulse">
                  Calibrating Substrate...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--bg-primary)]">
            {/* Empty State / New Tab */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
              style={{ backgroundImage: 'linear-gradient(var(--accent-primary) 1px, transparent 1px), linear-gradient(90deg, var(--accent-primary) 1px, transparent 1px)', backgroundSize: '60px 60px' }} 
            />
            <AllternitLogo size="lg" variant="stacked" />
            <div className="mt-12 w-full max-w-md p-2 rounded-xl bg-[var(--bg-secondary)] border border-[color-mix(in_srgb,var(--accent-primary)_20%,transparent)] shadow-2xl">
              <form onSubmit={handleNavigate} className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-3 text-sm font-mono text-[var(--accent-primary)] outline-none placeholder:text-[color-mix(in_srgb,var(--text-muted)_20%,transparent)]"
                  placeholder="SEARCH OR ENTER SUBSTRATE URL"
                />
                <button 
                  type="submit"
                  className="bg-[var(--accent-primary)] text-[var(--bg-secondary)] p-2.5 rounded-lg hover:brightness-90 transition-colors"
                >
                  <ArrowRight size={20} />
                </button>
              </form>
            </div>
            <div className="mt-8 flex gap-8 text-[10px] font-mono text-[color-mix(in_srgb,var(--text-muted)_40%,transparent)] uppercase tracking-[0.3em]">
              <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> SECURE</div>
              <div className="flex items-center gap-2"><Lightning className="w-3.5 h-3.5" /> PERFORMANCE</div>
              <div className="flex items-center gap-2"><Robot className="w-3.5 h-3.5" /> ASSISTED</div>
            </div>
          </div>
        )}
        
        {/* Floating Agent Status Pill (Conditional) */}
        {agentStatus === 'Running' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 animate-slide-up">
            <GlassSurface intensity="thick" rounded="full" className="px-6 py-2 border-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)] shadow-[0_0_30px_var(--ui-border-default)]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping bg-[var(--accent-primary)] rounded-full opacity-20" />
                  <ArchitectLogo state="thinking" size={24} className="text-[var(--accent-primary)]" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[var(--accent-primary)] uppercase tracking-widest">Gizzi Executing</div>
                  <div className="text-[9px] text-[var(--text-muted)] uppercase font-mono tracking-tighter">Automating substrate sequence...</div>
                </div>
                <div className="h-6 w-px bg-[color-mix(in_srgb,var(--accent-primary)_10%,transparent)] mx-2" />
                <button onClick={stopExecution} className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-widest">
                  Abort
                </button>
              </div>
            </GlassSurface>
          </div>
        )}
      </div>

      {/* 4. STATUS BAR */}
      <div className="h-6 px-4 bg-[var(--bg-primary)] border-t border-[color-mix(in_srgb,var(--accent-primary)_5%,transparent)] flex items-center justify-between text-[9px] font-mono text-[color-mix(in_srgb,var(--text-muted)_60%,transparent)] uppercase tracking-widest">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
            SUBSTRATE_ONLINE
          </div>
          <div className="flex items-center gap-1.5">
            <Activity className="w-2.5 h-2.5" />
            RT_SIGNAL_100ms
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[color-mix(in_srgb,var(--accent-primary)_40%,transparent)] tracking-tighter">AGENT_PROTOCOL_V4.2</span>
          <span>Allternit // BROWSER_MODE</span>
        </div>
      </div>
    </div>
  );
}

export default BrowserView;
