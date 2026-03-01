/**
 * BrowserView - P5.2.1
 * High-Fidelity "Browser Substrate" for A2Rchitech
 * Replaces the static engine-based view with a real interactive browser interface.
 */

"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Globe, 
  RefreshCw, 
  ArrowLeft, 
  ArrowRight, 
  Camera,
  Bot,
  Loader2,
  AlertTriangle,
  Plus,
  X,
  Lock,
  Search,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Terminal,
  Activity,
  Shield,
  Zap,
  History
} from 'lucide-react';

// Design System
import { GlassSurface } from '@/design/glass/GlassSurface';
import { GlassButton, GlassIconButton } from '@/design/glass/GlassButton';
import { GlassInput } from '@/design/glass/GlassInput';
import { A2RLogo } from '@/components/A2RLogo';
import { ArchitectLogo } from '@/components/ai-elements/ArchitectLogo';
import { cn } from '@/lib/utils';

// Store & Types
import { useBrowserStore, useActiveTab } from '@/capsules/browser/browser.store';
import { BrowserTab, WebTab } from '@/capsules/browser/browser.types';
import { useBrowserAgentStore } from '@/capsules/browser/browserAgent.store';

// ============================================================================
// Browser Substrate Component
// ============================================================================

export function BrowserView() {
  // Store state
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, updateTab } = useBrowserStore();
  const { status: agentStatus, runGoal, stopExecution } = useBrowserAgentStore();
  
  // Local UI state
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [urlInput, setUrlInput] = useState('');
  const [agentInput, setAgentInput] = useState('');
  const [isHoveringTab, setIsHoveringTab] = useState<string | null>(null);

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

  // Handle Agent Goal
  const handleAgentRun = () => {
    if (agentInput.trim()) {
      runGoal(agentInput.trim());
      setAgentInput('');
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden font-sans"
      style={{ 
        background: 'linear-gradient(135deg, #1A1612 0%, #0A0908 100%)',
        color: '#ECECEC'
      }}
    >
      {/* 1. TOP DOCK: Tab Strip */}
      <div className="h-10 flex items-end px-2 gap-1 bg-[#0A0908]/40 border-b border-[#D4B08C]/5">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onMouseEnter={() => setIsHoveringTab(tab.id)}
            onMouseLeave={() => setIsHoveringTab(null)}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "group relative flex items-center h-8 min-w-[120px] max-w-[200px] px-3 rounded-t-lg cursor-pointer transition-all duration-200",
              tab.id === activeTabId 
                ? "bg-[#1A1612] text-[#D4B08C] border-t border-l border-r border-[#D4B08C]/20" 
                : "bg-transparent text-[#9B9B9B] hover:bg-[#D4B08C]/5"
            )}
          >
            <Globe className={cn("w-3 h-3 mr-2 shrink-0", tab.id === activeTabId ? "text-[#D4B08C]" : "text-[#9B9B9B]/50")} />
            <span className="text-[11px] font-medium truncate uppercase tracking-tight flex-1">
              {tab.title || 'New Substrate'}
            </span>
            
            {(tab.id === activeTabId || isHoveringTab === tab.id) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 p-0.5 rounded-full hover:bg-[#D4B08C]/20 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            
            {/* Active Indicator Line */}
            {tab.id === activeTabId && (
              <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-[#1A1612]" />
            )}
          </div>
        ))}
        
        <button
          onClick={() => addTab('https://www.google.com')}
          className="h-8 w-8 flex items-center justify-center rounded-t-lg hover:bg-[#D4B08C]/5 text-[#9B9B9B] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* 2. NAVIGATION & CONTROL BAR */}
      <div className="h-14 flex items-center gap-4 px-4 bg-[#1A1612] border-b border-[#D4B08C]/10 z-10 shadow-lg">
        {/* Navigation Buttons */}
        <div className="flex items-center gap-1">
          <GlassIconButton size="xs" border="none" hover="scale" className="text-[#9B9B9B] hover:text-[#D4B08C]">
            <ChevronLeft className="w-4 h-4" />
          </GlassIconButton>
          <GlassIconButton size="xs" border="none" hover="scale" className="text-[#9B9B9B] hover:text-[#D4B08C]">
            <ChevronRight className="w-4 h-4" />
          </GlassIconButton>
          <GlassIconButton size="xs" border="none" hover="scale" className="text-[#D4B08C]/60 hover:text-[#D4B08C]">
            <RefreshCw className="w-3.5 h-3.5" />
          </GlassIconButton>
        </div>

        {/* Address Bar */}
        <form onSubmit={handleNavigate} className="flex-1 max-w-2xl">
          <GlassSurface 
            intensity="thin" 
            rounded="full" 
            border="subtle"
            className="flex items-center px-3 py-1.5 bg-[#0A0908]/40 border-[#D4B08C]/15 group focus-within:border-[#D4B08C]/40 transition-all"
          >
            <Lock className="w-3 h-3 text-green-500/60 mr-2" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              className="flex-1 bg-transparent text-[12px] font-mono text-[#D4B08C] outline-none placeholder:text-[#9B9B9B]/30"
              placeholder="ENTER SUBSTRATE COORDINATES..."
            />
            <Search className="w-3.5 h-3.5 text-[#9B9B9B]/40 group-hover:text-[#D4B08C]/40" />
          </GlassSurface>
        </form>

        {/* Agent Goal Input (The "Second" Bar, but styled as an Action Field) */}
        <div className="flex-1 max-w-md hidden lg:flex items-center">
          <GlassSurface 
            intensity="thin" 
            rounded="lg" 
            border="subtle"
            className="flex-1 flex items-center px-3 py-1.5 bg-[#D4B08C]/5 border-[#D4B08C]/10"
          >
            <Terminal className="w-3.5 h-3.5 text-[#D4B08C]/60 mr-2" />
            <input
              type="text"
              value={agentInput}
              onChange={(e) => setAgentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAgentRun()}
              className="flex-1 bg-transparent text-[11px] font-medium text-[#ECECEC] outline-none placeholder:text-[#9B9B9B]/50"
              placeholder="TELL GIZZI TO AUTOMATE..."
            />
            {agentStatus === 'Running' ? (
              <button onClick={stopExecution} className="text-red-400 hover:text-red-300">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              </button>
            ) : (
              <button onClick={handleAgentRun} className="text-[#D4B08C]/60 hover:text-[#D4B08C]">
                <Zap className="w-3.5 h-3.5" />
              </button>
            )}
          </GlassSurface>
        </div>

        {/* Platform Actions */}
        <div className="flex items-center gap-2">
          <GlassIconButton size="xs" variant="primary" className="bg-[#D4B08C]/10 text-[#D4B08C] border-[#D4B08C]/20">
            <Bot className="w-4 h-4" />
          </GlassIconButton>
          <div className="h-4 w-px bg-[#D4B08C]/10 mx-1" />
          <MoreHorizontal className="w-4 h-4 text-[#9B9B9B] cursor-pointer hover:text-[#D4B08C]" />
        </div>
      </div>

      {/* 3. BROWSER CONTENT AREA (FULL SCREEN) */}
      <div className="flex-1 relative bg-white overflow-hidden">
        {activeTab && activeTab.contentType === 'web' ? (
          <div className="w-full h-full relative">
            {/* Real Webview element in Electron, or iframe fallback */}
            {/* @ts-ignore */}
            <webview
              src={(activeTab as WebTab).url}
              className="w-full h-full"
              allowpopups="true"
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
            
            {/* Loading Overlay */}
            {activeTab.title === activeTab.url && (
              <div className="absolute inset-0 bg-[#0A0908] flex flex-col items-center justify-center z-10">
                <div className="relative mb-6">
                  <div className="absolute inset-0 animate-pulse blur-2xl bg-[#D4B08C]/10 rounded-full" />
                  <ArchitectLogo state="thinking" size={80} className="text-[#D4B08C]" />
                </div>
                <div className="text-[10px] font-mono text-[#D4B08C] uppercase tracking-[0.4em] animate-pulse">
                  Calibrating Substrate...
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#0A0908]">
            {/* Empty State / New Tab */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
              style={{ backgroundImage: 'linear-gradient(#D4B08C 1px, transparent 1px), linear-gradient(90deg, #D4B08C 1px, transparent 1px)', backgroundSize: '60px 60px' }} 
            />
            <A2RLogo size="lg" variant="stacked" />
            <div className="mt-12 w-full max-w-md p-2 rounded-xl bg-[#1A1612] border border-[#D4B08C]/20 shadow-2xl">
              <form onSubmit={handleNavigate} className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="flex-1 bg-transparent px-4 py-3 text-sm font-mono text-[#D4B08C] outline-none placeholder:text-[#9B9B9B]/20"
                  placeholder="SEARCH OR ENTER SUBSTRATE URL"
                />
                <button 
                  type="submit"
                  className="bg-[#D4B08C] text-[#1A1612] p-2.5 rounded-lg hover:bg-[#B08D6E] transition-colors"
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>
            <div className="mt-8 flex gap-8 text-[10px] font-mono text-[#9B9B9B]/40 uppercase tracking-[0.3em]">
              <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> SECURE</div>
              <div className="flex items-center gap-2"><Zap className="w-3.5 h-3.5" /> PERFORMANCE</div>
              <div className="flex items-center gap-2"><Bot className="w-3.5 h-3.5" /> ASSISTED</div>
            </div>
          </div>
        )}
        
        {/* Floating Agent Status Pill (Conditional) */}
        {agentStatus === 'Running' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 animate-slide-up">
            <GlassSurface intensity="thick" rounded="full" className="px-6 py-2 border-[#D4B08C]/40 shadow-[0_0_30px_rgba(212,176,140,0.2)]">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 animate-ping bg-[#D4B08C] rounded-full opacity-20" />
                  <ArchitectLogo state="thinking" size={24} className="text-[#D4B08C]" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-[#D4B08C] uppercase tracking-widest">Gizzi Executing</div>
                  <div className="text-[9px] text-[#9B9B9B] uppercase font-mono tracking-tighter">Automating substrate sequence...</div>
                </div>
                <div className="h-6 w-px bg-[#D4B08C]/10 mx-2" />
                <button onClick={stopExecution} className="text-red-400 hover:text-red-300 text-[10px] font-bold uppercase tracking-widest">
                  Abort
                </button>
              </div>
            </GlassSurface>
          </div>
        )}
      </div>

      {/* 4. STATUS BAR */}
      <div className="h-6 px-4 bg-[#0A0908] border-t border-[#D4B08C]/5 flex items-center justify-between text-[9px] font-mono text-[#9B9B9B]/60 uppercase tracking-widest">
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
          <span className="text-[#D4B08C]/40 tracking-tighter">AGENT_PROTOCOL_V4.2</span>
          <span>A2RCHITECH // BROWSER_MODE</span>
        </div>
      </div>
    </div>
  );
}

export default BrowserView;
