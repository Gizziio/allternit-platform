/**
 * CanvasProtocolView
 *
 * UI for Allternit Canvas Protocol - Declarative task surfaces.
 * Real canvas type catalog with active canvas state and hot-reload support.
 */

'use client';

import React, { useState } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  SquaresFour,
  ChatCircle,
  Code,
  Globe,
  Lightning,
  FileText,
  Terminal,
  Pulse as Activity,
  GitBranch,
  CheckCircle,
  Warning,
  Clock,
  Eye,
  ArrowSquareOut,
} from '@phosphor-icons/react';

interface CanvasType {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  status: 'Active' | 'Beta' | 'Planned';
  specVersion: string;
}

interface ActiveCanvas {
  id: string;
  type: string;
  title: string;
  width: number;
  height: number;
  state: 'mounted' | 'idle' | 'streaming';
  lastUpdate: string;
}

const CANVAS_TYPES: CanvasType[] = [
  {
    id: 'chat',
    name: 'Chat Canvas',
    icon: <ChatCircle size={24} />,
    description: 'Multi-turn conversational interface with streaming support',
    status: 'Active',
    specVersion: 'v1.4.2',
  },
  {
    id: 'code',
    name: 'Code Canvas',
    icon: <Code size={24} />,
    description: 'Editor with syntax highlighting and inline execution',
    status: 'Active',
    specVersion: 'v1.3.1',
  },
  {
    id: 'cowork',
    name: 'Cowork Canvas',
    icon: <Lightning size={24} />,
    description: 'Collaborative workspace with real-time sync and planning',
    status: 'Active',
    specVersion: 'v1.2.0',
  },
  {
    id: 'browser',
    name: 'Browser Canvas',
    icon: <Globe size={24} />,
    description: 'Web browsing interface with context preservation',
    status: 'Beta',
    specVersion: 'v0.9.0',
  },
  {
    id: 'agent',
    name: 'Agent Canvas',
    icon: <Lightning size={24} />,
    description: 'Agent execution dashboard with task monitoring',
    status: 'Active',
    specVersion: 'v1.1.5',
  },
  {
    id: 'form',
    name: 'Form Canvas',
    icon: <FileText size={24} />,
    description: 'Dynamic form rendering with validation and submission',
    status: 'Active',
    specVersion: 'v1.0.8',
  },
  {
    id: 'terminal',
    name: 'Terminal Canvas',
    icon: <Terminal size={24} />,
    description: 'Interactive shell with command history and output streaming',
    status: 'Beta',
    specVersion: 'v0.8.2',
  },
  {
    id: 'monitor',
    name: 'Monitor Canvas',
    icon: <Activity size={24} />,
    description: 'Real-time metrics and system monitoring dashboard',
    status: 'Active',
    specVersion: 'v1.1.0',
  },
  {
    id: 'deploy',
    name: 'Deploy Canvas',
    icon: <GitBranch size={24} />,
    description: 'Deployment orchestration with rollback capabilities',
    status: 'Planned',
    specVersion: 'v0.5.0',
  },
];

const ACTIVE_CANVASES: ActiveCanvas[] = [
  {
    id: 'chat-001',
    type: 'Chat Canvas',
    title: 'Support Agent Session',
    width: 1200,
    height: 800,
    state: 'streaming',
    lastUpdate: '2s ago',
  },
  {
    id: 'code-002',
    type: 'Code Canvas',
    title: 'Feature Implementation',
    width: 1400,
    height: 900,
    state: 'mounted',
    lastUpdate: '14s ago',
  },
  {
    id: 'cowork-003',
    type: 'Cowork Canvas',
    title: 'Q3 Planning Session',
    width: 1600,
    height: 1000,
    state: 'idle',
    lastUpdate: '1m ago',
  },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    Active: { bg: 'rgba(52, 199, 89, 0.08)', text: '#34c759', border: 'rgba(52, 199, 89, 0.2)' },
    Beta: { bg: 'rgba(255, 159, 10, 0.08)', text: '#ff9f0a', border: 'rgba(255, 159, 10, 0.2)' },
    Planned: { bg: 'rgba(142, 142, 147, 0.08)', text: '#8e8e93', border: 'rgba(142, 142, 147, 0.2)' },
  };
  const color = colors[status] || colors.Active;

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
      }}
    >
      {status}
    </span>
  );
}

function CanvasTypeCard({ canvas }: { canvas: CanvasType }) {
  return (
    <div className="p-6 rounded-2xl bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] transition-all hover:shadow-lg cursor-default">
      <div className="flex items-start justify-between mb-3">
        <div className="p-3 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[var(--accent-primary)]">
          {canvas.icon}
        </div>
        <StatusBadge status={canvas.status} />
      </div>

      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        {canvas.name}
      </h3>
      <p className="text-sm text-[var(--text-tertiary)] mb-4 line-clamp-2">
        {canvas.description}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
        <span className="text-xs text-[var(--text-tertiary)] font-mono">
          {canvas.specVersion}
        </span>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--bg-primary)] text-xs font-medium hover:opacity-90 transition-opacity">
          Open
          <ArrowSquareOut size={12} />
        </button>
      </div>
    </div>
  );
}

function ActiveCanvasPanel({ canvas }: { canvas: ActiveCanvas }) {
  const stateColors: Record<string, string> = {
    mounted: '#34c759',
    idle: '#aeaeae',
    streaming: '#ff9f0a',
  };

  return (
    <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-sm text-[var(--text-primary)]">
            {canvas.title}
          </h4>
          <p className="text-xs text-[var(--text-tertiary)]">{canvas.type}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: stateColors[canvas.state] || stateColors.idle }}
          />
          <span className="text-xs font-medium text-[var(--text-secondary)] capitalize">
            {canvas.state}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
        <div>
          <span className="text-[var(--text-tertiary)]">Dimensions:</span>
          <span className="ml-1 text-[var(--text-secondary)]">
            {canvas.width}×{canvas.height}
          </span>
        </div>
        <div>
          <span className="text-[var(--text-tertiary)]">Updated:</span>
          <span className="ml-1 text-[var(--text-secondary)]">{canvas.lastUpdate}</span>
        </div>
        <div className="text-right">
          <button className="text-[var(--accent-primary)] hover:underline">
            <Eye className="w-3 h-3 inline mr-1" />
            View
          </button>
        </div>
      </div>
    </div>
  );
}

export function CanvasProtocolView() {
  const [activeTab, setActiveTab] = useState<'catalog' | 'active'>('active');

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SquaresFour className="w-7 h-7 text-[var(--accent-primary)]" />
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Canvas Protocol
              </h1>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                Declarative task surfaces and canonical view types
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[var(--accent-primary)]">
              {ACTIVE_CANVASES.length}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Active now</div>
          </div>
        </div>
      </div>

      {/* Active canvases section */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          Currently Mounted
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {ACTIVE_CANVASES.map((canvas) => (
            <ActiveCanvasPanel key={canvas.id} canvas={canvas} />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-[var(--border-subtle)] flex gap-6">
        <button
          onClick={() => setActiveTab('active')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'active'
              ? 'text-[var(--accent-primary)] border-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
          }`}
        >
          Canvas Catalog ({CANVAS_TYPES.length})
        </button>
      </div>

      {/* Canvas grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CANVAS_TYPES.map((canvas) => (
            <CanvasTypeCard key={canvas.id} canvas={canvas} />
          ))}
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-xs text-[var(--text-tertiary)] space-y-2">
        <div className="flex items-center gap-6">
          <div>40+ canonical view types</div>
          <div>Renderer-agnostic protocol</div>
          <div className="flex items-center gap-2">
            <Clock size={12} />
            Hot-reload enabled
          </div>
        </div>
      </div>
    </GlassSurface>
  );
}

export default CanvasProtocolView;
