/**
 * Agent Session Layout - Base Layout Component
 * 
 * Provides consistent dark Allternit obsidian theming across all agent session modes.
 * Features:
 * - Mode-specific accent colors
 * - Glass morphism panels
 * - Responsive split-pane layout
 * - Workbench rail integration
 * - Consistent header/controls
 * 
 * @module AgentSessionLayout
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ArrowsOut,
  ArrowsIn,
  Terminal,
  Monitor,
  Layout,
  GearSix,
  SidebarSimple,
  Chat,
} from '@phosphor-icons/react';

import {
  MODE_COLORS,
  TEXT,
  type AgentMode,
} from '@/design/allternit.tokens';

import type { AgentSessionMode } from './types';

export interface AgentSessionLayoutProps {
  mode: AgentSessionMode;
  title: string;
  agentName?: string;
  children: React.ReactNode; // This will be the Chat (Left Pane)
  computerView?: React.ReactNode; // This will be the Canvas/Computer (Right Pane)
  headerActions?: React.ReactNode;
  status?: 'idle' | 'running' | 'streaming' | 'error';
  onClose?: () => void;
}

export function AgentSessionLayout({
  mode,
  title,
  agentName,
  children,
  computerView,
  headerActions,
  status = 'idle',
  onClose,
}: AgentSessionLayoutProps) {
  const modeColors = MODE_COLORS[mode as AgentMode];
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  return (
    <div 
      className="h-screen w-full flex flex-col overflow-hidden relative"
      style={{ background: '#0D0B09' }} // Base obsidian
    >
      {/* Header - Minimal and non-obstructive */}
      <header 
        className="h-12 flex items-center justify-between px-4 border-b shrink-0 z-10"
        style={{ 
          background: 'rgba(0,0,0,0.6)',
          borderColor: 'rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col">
            <h1 className="text-xs font-bold uppercase tracking-wider" style={{ color: modeColors.accent }}>
              {mode} Session
            </h1>
            <span className="text-[10px]" style={{ color: TEXT.tertiary }}>{agentName || title}</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {headerActions}
          
          <button
            onClick={() => setShowTerminal(!showTerminal)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: showTerminal ? modeColors.accent : TEXT.tertiary }}
            title="Toggle Terminal"
          >
            <TerminalIcon size={16} />
          </button>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: TEXT.tertiary }}
          >
            {isFullscreen ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}
          </button>
          
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors hover:bg-red-500/10"
            style={{ color: TEXT.tertiary }}
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* 2-Pane Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Chat (Always Main Workspace) */}
        <main 
          className="flex-1 border-r relative"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
        >
          {children}
        </main>

        {/* Right Pane: Computer / Canvas */}
        <aside 
          className="w-1/2 lg:w-[45%] xl:w-[40%] shrink-0 flex flex-col overflow-hidden bg-black/20"
        >
          {computerView || (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
              <Monitor size={48} className="mb-4" />
              <p className="text-sm font-medium">Computer Workspace</p>
              <p className="text-xs mt-1">Agent activities and artifacts will appear here</p>
            </div>
          )}
        </aside>
      </div>

      {/* Terminal Overlay (Floating Pop-up) */}
      <AnimatePresence>
        {showTerminal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="absolute inset-x-10 bottom-10 top-20 z-50 flex flex-col rounded-xl overflow-hidden shadow-2xl border"
            style={{ 
              background: '#0a0a0a', 
              borderColor: 'rgba(255,255,255,0.1)',
              boxShadow: '0 24px 48px rgba(0,0,0,0.8)'
            }}
          >
            <div className="h-10 flex items-center justify-between px-4 bg-white/5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <TerminalIcon size={14} className="text-green-500" />
                <span className="text-xs font-mono text-white/70">root@allternit-orchestrator:~#</span>
              </div>
              <button onClick={() => setShowTerminal(false)} className="text-white/40 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 p-4 font-mono text-sm overflow-auto text-green-400/90">
              <p className="mb-2">Welcome to Allternit Orchestration Shell v1.0.0</p>
              <p className="mb-2 text-white/50">Session initialized for {agentName}...</p>
              <div className="flex gap-2">
                <span>$</span>
                <span className="animate-pulse w-2 h-5 bg-green-500/50"></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

export function WorkbenchSection({ 
  title, 
  children, 
  mode,
  defaultExpanded = true,
}: { 
  title: string; 
  children: React.ReactNode; 
  mode: AgentSessionMode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const modeColors = MODE_COLORS[mode as AgentMode];

  return (
    <div className="border-b" style={{ borderColor: modeColors.border }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
        style={{ color: TEXT.secondary }}
      >
        {title}
        <motion.span
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <SidebarSimple size={14} />
        </motion.span>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function WorkbenchItem({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
  mode,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
  badge?: number;
  mode: AgentSessionMode;
}) {
  const modeColors = MODE_COLORS[mode as AgentMode];

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
      style={{
        background: active ? modeColors.soft : 'transparent',
        color: active ? modeColors.accent : TEXT.secondary,
      }}
    >
      <Icon size={16} />
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span 
          className="px-2 py-0.5 rounded-full text-xs"
          style={{ background: modeColors.accent, color: '#0D0B09' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export function CanvasPanel({
  title,
  children,
  mode,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  mode: AgentSessionMode;
  actions?: React.ReactNode;
}) {
  const modeColors = MODE_COLORS[mode as AgentMode];

  return (
    <div className="flex flex-col h-full">
      {/* Canvas Header */}
      <div 
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: modeColors.border }}
      >
        <div className="flex items-center gap-2">
          <Chat size={16} style={{ color: modeColors.accent }} />
          <span className="font-medium text-sm" style={{ color: TEXT.primary }}>
            {title}
          </span>
        </div>
        {actions && (
          <div className="flex items-center gap-1">
            {actions}
          </div>
        )}
      </div>

      {/* Canvas Content */}
      <div className="flex-1 overflow-auto p-4">
        {children}
      </div>
    </div>
  );
}

export default AgentSessionLayout;
