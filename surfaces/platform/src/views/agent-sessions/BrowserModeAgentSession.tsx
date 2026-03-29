/**
 * Browser Mode Agent Session - 2-Pane Web Orchestration
 * 
 * Agent-driven browser experience with a clean 2-pane split:
 * - Left: Agent Orchestration & Chat
 * - Right: Web Computer / Browser Preview
 * 
 * Uses A2R browser mode accent colors (steel blue)
 * 
 * @module BrowserModeAgentSession
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe,
  Lock,
  ArrowClockwise,
  MagnifyingGlass,
  Shield,
  Pulse as Activity,
  Robot,
  Monitor,
  Layout,
  Cursor,
  Eye,
  Plus,
} from '@phosphor-icons/react';

import {
  MODE_COLORS,
  TEXT,
} from '@/design/a2r.tokens';

import { AgentSessionLayout } from './AgentSessionLayout';
import type { BrowserModeAgentSessionProps } from './types';

export function BrowserModeAgentSession({
  initialUrl = 'https://a2rchitech.com',
  onClose,
}: BrowserModeAgentSessionProps) {
  const mode = 'browser';
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.browser;
  
  const [url, setUrl] = useState(initialUrl);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'dom' | 'network'>('preview');

  return (
    <AgentSessionLayout
      mode={mode}
      title="Web Orchestration"
      agentName="Browser Agent"
      status={isNavigating ? 'streaming' : 'idle'}
      onClose={onClose}
      computerView={
        <BrowserComputer 
          mode={mode} 
          url={url}
          isNavigating={isNavigating}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
      headerActions={
        <div className="flex items-center gap-2">
           <div 
            className="flex items-center gap-2 px-3 py-1 rounded-lg bg-black/40 border border-white/10 max-w-[300px] overflow-hidden"
          >
            <Lock size={12} className="text-green-500 shrink-0" />
            <span className="text-[11px] text-white/40 truncate font-mono">{url}</span>
          </div>
          <button
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: TEXT.tertiary }}
            onClick={() => setIsNavigating(true)}
          >
            <ArrowClockwise size={14} className={isNavigating ? 'animate-spin' : ''} />
          </button>
        </div>
      }
    >
      {/* Left Pane: Browser Agent Chat & Orchestration */}
      <div 
        className="flex flex-col h-full relative"
        style={{ background: '#0D0B09' }}
      >
        {/* Browser Mode Wash Background */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{ 
            background: `radial-gradient(120% 88% at 50% 0%, ${modeColors.fog} 0%, transparent 58%)` 
          }}
        />

        {/* Browser Orchestration Controls */}
        <div className="p-6 space-y-6 relative z-1 overflow-y-auto">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold" style={{ color: TEXT.primary }}>Web Agent Control</h2>
            <p className="text-sm" style={{ color: TEXT.secondary }}>
              Executing browser-native automation and web data extraction.
            </p>
          </div>

          {/* Web Safety Indicators */}
          <div 
            className="p-4 rounded-xl border"
            style={{ background: 'rgba(255,255,255,0.03)', borderColor: modeColors.border }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} style={{ color: modeColors.accent }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: TEXT.secondary }}>Sandboxed Environment</span>
            </div>
            <div className="space-y-2">
              <WebPolicyItem label="Isolated Browser Context" status="Active" color="#4ade80" />
              <WebPolicyItem label="No Persistent Cookies" status="Enforced" color="#4ade80" />
              <WebPolicyItem label="External API Access" status="Restricted" color="#fbbf24" />
            </div>
          </div>

          {/* Browser Feed */}
          <div className="flex flex-col gap-4">
            <div className="text-xs font-medium uppercase tracking-widest opacity-40 mb-2">Browser Action Log</div>
            <div className="p-4 rounded-xl bg-black/40 border border-white/5 font-mono text-[11px] text-white/50 space-y-1">
               <p><span style={{ color: modeColors.accent }}>[NAVIGATE]</span> Loading {url}...</p>
               <p><span style={{ color: modeColors.accent }}>[ELEMENT]</span> Searching for button: <span className="text-blue-400">#login-btn</span></p>
               <p><span style={{ color: modeColors.accent }}>[SCRAPE]</span> Extracted 42 table rows from data-grid.</p>
            </div>
          </div>
        </div>

        {/* Consistent Input Bar Area */}
        <div className="mt-auto p-6 border-t border-white/5 bg-black/40">
           <div className="h-12 rounded-xl border border-white/10 bg-white/5 flex items-center px-4 text-white/20 text-sm">
             Ask the browser agent to navigate or extract data...
           </div>
        </div>
      </div>
    </AgentSessionLayout>
  );
}

function BrowserComputer({ 
  mode, 
  url,
  isNavigating,
  activeTab, 
  onTabChange 
}: { 
  mode: 'browser'; 
  url: string;
  isNavigating: boolean;
  activeTab: string; 
  onTabChange: (tab: any) => void;
}) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.browser;
  
  return (
    <div className="flex flex-col h-full bg-black/40">
      {/* Tabs */}
      <div className="flex items-center px-4 border-b border-white/5 bg-black/20">
        <TabButton label="Preview" active={activeTab === 'preview'} onClick={() => onTabChange('preview')} mode={mode} />
        <TabButton label="DOM Inspector" active={activeTab === 'dom'} onClick={() => onTabChange('dom')} mode={mode} />
        <TabButton label="Network" active={activeTab === 'network'} onClick={() => onTabChange('network')} mode={mode} />
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'preview' && (
          <div className="h-full flex flex-col items-center justify-center text-center p-12 opacity-40">
            <Globe size={64} className={`mb-6 ${isNavigating ? 'animate-pulse' : ''}`} style={{ color: modeColors.accent }} />
            <h3 className="text-lg font-bold uppercase tracking-widest mb-2">Web Preview</h3>
            <p className="text-sm max-w-xs mx-auto">Rendering secure browser view for {url}</p>
            {isNavigating && (
               <div className="mt-6 flex items-center gap-2 text-xs font-mono">
                  <ArrowClockwise size={14} className="animate-spin" />
                  <span>Loading remote context...</span>
               </div>
            )}
          </div>
        )}
        
        {activeTab === 'dom' && (
           <div className="p-6 font-mono text-[11px] text-white/40 space-y-1">
             <p className="text-blue-400">{`<html>`}</p>
             <p className="pl-4 text-blue-400">{`<head>`}</p>
             <p className="pl-8 text-white/30">{`<title>A2R Browser Session</title>`}</p>
             <p className="pl-4 text-blue-400">{`</head>`}</p>
             <p className="pl-4 text-blue-400">{`<body>`}</p>
             <p className="pl-8 text-blue-400">{`<div id="app">`}</p>
             <p className="pl-12 text-white/30 animate-pulse">{`<!-- Agent interaction point -->`}</p>
             <p className="pl-8 text-blue-400">{`</div>`}</p>
             <p className="pl-4 text-blue-400">{`</body>`}</p>
             <p className="text-blue-400">{`</html>`}</p>
           </div>
        )}

        {activeTab === 'network' && (
           <div className="p-6">
              <div className="flex items-center justify-between text-[10px] text-white/30 uppercase tracking-widest mb-4 border-b border-white/5 pb-2">
                 <span>Request</span>
                 <span>Status</span>
                 <span>Time</span>
              </div>
              <div className="space-y-2 font-mono text-[10px]">
                 <NetworkItem url="/api/data" status="200" time="12ms" />
                 <NetworkItem url="/assets/logo.png" status="200" time="45ms" />
                 <NetworkItem url="/socket.io" status="101" time="--" />
              </div>
           </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ label, active, onClick, mode }: { label: string; active: boolean; onClick: () => void; mode: 'browser' }) {
  const modeColors = MODE_COLORS[mode] as typeof MODE_COLORS.browser;
  return (
    <button
      onClick={onClick}
      className="px-4 py-3 text-xs font-bold uppercase tracking-widest transition-all relative"
      style={{ color: active ? modeColors.accent : TEXT.tertiary }}
    >
      {label}
      {active && (
        <motion.div 
          layoutId="browser-tab-indicator"
          className="absolute bottom-0 left-0 right-0 h-0.5" 
          style={{ background: modeColors.accent }} 
        />
      )}
    </button>
  );
}

function WebPolicyItem({ label, status, color }: { label: string, status: string, color: string }) {
  return (
    <div className="flex items-center justify-between text-[10px]">
      <div className="flex items-center gap-2" style={{ color: TEXT.secondary }}>
        <span>{label}</span>
      </div>
      <span style={{ color }}>{status}</span>
    </div>
  );
}

function NetworkItem({ url, status, time }: { url: string, status: string, time: string }) {
  return (
    <div className="flex items-center justify-between text-white/40">
       <span className="truncate max-w-[150px]">{url}</span>
       <span className={status === '200' ? 'text-green-500' : 'text-blue-400'}>{status}</span>
       <span>{time}</span>
    </div>
  );
}

export default BrowserModeAgentSession;
