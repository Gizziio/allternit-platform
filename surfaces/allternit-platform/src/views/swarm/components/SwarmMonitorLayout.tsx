/**
 * SwarmMonitorLayout - Main layout container
 *
 * Based on demo-v3/v4/v5.html design specification
 * - Left: Reserved for app mode switchers
 * - Center: Search and stats
 * - Right: View dropdown + actions
 */

import React from 'react';
import { MagnifyingGlass, Plus } from '@phosphor-icons/react';
import { SwarmViewMode, SwarmAgent } from '../types';
import { ViewToggle } from './ViewToggle';
import { useSwarmMonitorStore } from '../SwarmMonitor.store';
import { BACKGROUND, SAND, STATUS, TEXT } from '@/design/allternit.tokens';

// Amber/orange accent from demo-v3/v4/v5
const ACCENT = '#c17817';
const ACCENT_DIM = 'rgba(193, 120, 23, 0.2)';
const BG_SURFACE = '#121110';
const BORDER_COLOR = '#272522';
const TEXT_MUTED = '#8b8680';
const TEXT_SUBTLE = '#5c5854';
const GREEN = STATUS.success;

interface SwarmMonitorLayoutProps {
  children: React.ReactNode;
  viewMode: SwarmViewMode;
  onViewModeChange: (mode: SwarmViewMode) => void;
  agents: SwarmAgent[];
  className?: string;
  modeColors?: { accent: string };
}

export function SwarmMonitorLayout({
  children,
  viewMode,
  onViewModeChange,
  agents,
  className,
}: SwarmMonitorLayoutProps) {
  const activeCount = agents.filter(a => a.status === 'working').length;
  const totalTokens = agents.reduce((sum, a) => sum + a.tokensUsed, 0);
  const totalCost = agents.reduce((sum, a) => sum + a.costAccumulated, 0);

  return (
    <div
      className={`h-full flex flex-col ${className || ''}`}
      style={{ background: '#0a0908' }}
    >
      {/* Header - matching demo-v3/v4/v5 */}
      <header
        className="h-12 border-b flex items-center justify-between px-4 shrink-0"
        style={{ borderColor: BORDER_COLOR, background: BG_SURFACE }}
      >
        {/* LEFT: Empty space reserved for app's mode switchers */}
        <div className="w-48" />

        {/* CENTER: Search and Stats */}
        <div className="flex items-center gap-6">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlass
              size={12}
              color={TEXT_SUBTLE}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search agents..."
              className="pl-7 pr-3 py-1.5 rounded text-xs outline-none transition-colors"
              style={{
                background: BG_SURFACE,
                border: `1px solid ${BORDER_COLOR}`,
                color: '#e8e6e3',
                width: 200,
              }}
            />
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4 text-xs" style={{ color: TEXT_MUTED }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
              {activeCount} active
            </span>
            <span className="font-mono">${totalCost.toFixed(2)}</span>
            <span className="font-mono">{(totalTokens / 1000).toFixed(1)}k tok</span>
          </div>
        </div>

        {/* RIGHT: View Dropdown + Actions */}
        <div className="flex items-center gap-2 w-48 justify-end">
          {/* Live Status */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded text-xs" style={{ color: GREEN }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: GREEN, boxShadow: `0 0 6px ${GREEN}` }} />
            Live
          </div>

          {/* Add Agent Button */}
          <button
            className="flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{
              background: ACCENT_DIM,
              border: `1px solid ${ACCENT}`,
              color: ACCENT,
            }}
            title="New Task"
          >
            <Plus size={12} weight="bold" />
          </button>

          {/* View Selector Dropdown */}
          <ViewToggle current={viewMode} onChange={onViewModeChange} />

          {/* More Actions */}
          <button
            className="flex items-center justify-center w-7 h-7 rounded transition-colors"
            style={{
              background: BG_SURFACE,
              border: `1px solid ${BORDER_COLOR}`,
              color: TEXT_MUTED,
            }}
            title="More options"
          >
            <span className="text-xs">⋮</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
