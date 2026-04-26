/**
 * MemoryKernelView
 *
 * UI for Memory Kernel - Three-layer memory system (AMK).
 * Browse events, entities, and relationship edges with real-time updates.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  Database,
  Network,
  Stack,
  CaretDown,
  MagnifyingGlass,
  Funnel,
  Eye,
  Clock,
  Tag,
  ChartBar,
} from '@phosphor-icons/react';

interface MemoryEvent {
  id: string;
  timestamp: string;
  type: string;
  payload: string;
  expanded?: boolean;
}

interface Entity {
  id: string;
  entityId: string;
  name: string;
  type: string;
  lastUpdated: string;
  propertyCount: number;
}

interface Edge {
  id: string;
  source: string;
  relationship: string;
  target: string;
  confidence: number;
  createdAt: string;
}

import { MemoryVaultStats } from '@/components/memory/MemoryVaultStats';

type MemoryTab = 'Events' | 'Entities' | 'Edges' | 'Health';


function EventTypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    message_sent: '💬',
    tool_called: '🔨',
    file_read: '📖',
    session_start: '▶️',
  };
  return <span className="text-lg">{icons[type] || '📌'}</span>;
}

function EventRow({ event, onToggle }: { event: MemoryEvent; onToggle: (id: string) => void }) {
  return (
    <div className="border-b border-[var(--border-subtle)] last:border-0">
      <div
        className="px-4 py-3 hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer flex items-center justify-between"
        onClick={() => onToggle(event.id)}
      >
        <div className="flex items-start gap-3 flex-1">
          <EventTypeIcon type={event.type} />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[var(--text-tertiary)] mb-1 font-mono">
              {event.timestamp}
            </div>
            <div className="text-sm text-[var(--text-primary)]">
              {event.payload}
            </div>
          </div>
        </div>
        <CaretDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform flex-shrink-0 ${event.expanded ? 'rotate-180' : ''}`} />
      </div>
      {event.expanded && (
        <div className="px-4 py-3 bg-[var(--bg-secondary)] border-t border-[var(--border-subtle)]">
          <div className="font-mono text-xs text-[var(--text-tertiary)] break-all bg-[var(--bg-primary)] p-3 rounded-lg">
            {JSON.stringify({ type: event.type, timestamp: event.timestamp, payload: event.payload }, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}

function EntityCard({ entity }: { entity: Entity }) {
  const typeColors: Record<string, string> = {
    Person: '#34c759',
    Company: '#ff9f0a',
    Project: '#007aff',
    File: '#5ac8fa',
    Session: '#9b59b6',
    Tool: '#3498db',
  };

  return (
    <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-sm text-[var(--text-primary)]">
            {entity.name}
          </h4>
          <p className="text-xs text-[var(--text-tertiary)] font-mono mt-1">
            {entity.entityId}
          </p>
        </div>
        <span
          className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
          style={{ background: typeColors[entity.type] || typeColors.Person }}
        >
          {entity.type}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--border-subtle)] pt-3">
        <div>
          <span className="text-[var(--text-tertiary)]">Updated</span>
          <span className="ml-1 text-[var(--text-secondary)]">{entity.lastUpdated}</span>
        </div>
        <div>
          <span className="text-[var(--text-tertiary)]">Properties</span>
          <span className="ml-1 font-semibold text-[var(--accent-primary)]">{entity.propertyCount}</span>
        </div>
      </div>

      <button className="w-full mt-3 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--accent-primary)] hover:bg-[var(--bg-primary)] transition-colors border border-[var(--border-subtle)]">
        View Details
      </button>
    </div>
  );
}

function EdgeRow({ edge }: { edge: Edge }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--bg-secondary)] transition-colors text-sm">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[var(--text-secondary)] text-xs">{edge.source}</span>
          <span className="text-[var(--text-tertiary)] text-xs px-2 py-1 rounded-md bg-[var(--bg-secondary)]">
            {edge.relationship}
          </span>
          <span className="font-mono text-[var(--text-secondary)] text-xs">{edge.target}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="text-right text-xs">
          <div className="text-[var(--text-tertiary)]">Confidence</div>
          <div className="font-semibold text-[var(--accent-primary)]">
            {(edge.confidence * 100).toFixed(0)}%
          </div>
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">
          {edge.createdAt}
        </div>
      </div>
    </div>
  );
}

export function MemoryKernelView() {
  const [activeTab, setActiveTab] = useState<MemoryTab>('Events');
  const [events, setEvents] = useState<MemoryEvent[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetch('/api/v1/memory/events').then(r => r.json()).then(setEvents).catch(() => {});
    fetch('/api/v1/memory/entities').then(r => r.json()).then(setEntities).catch(() => {});
    fetch('/api/v1/memory/edges').then(r => r.json()).then(setEdges).catch(() => {});
  }, []);

  const toggleEventExpand = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, expanded: !e.expanded } : e))
    );
  };

  const filteredEvents = events.filter((e) => {
    const matchesSearch = e.payload.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === 'all' || e.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-7 h-7 text-[var(--accent-primary)]" />
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                Memory Kernel
              </h1>
              <p className="text-sm text-[var(--text-tertiary)] mt-1">
                Three-layer memory system (AMK)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase font-semibold mb-2 flex items-center gap-2">
              <Stack size={16} />
              Total Events
            </div>
            <div className="text-2xl font-bold text-[var(--accent-primary)]">
              {events.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase font-semibold mb-2 flex items-center gap-2">
              <Tag size={16} />
              Total Entities
            </div>
            <div className="text-2xl font-bold text-[var(--accent-primary)]">
              {entities.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase font-semibold mb-2 flex items-center gap-2">
              <Network size={16} />
              Total Edges
            </div>
            <div className="text-2xl font-bold text-[var(--accent-primary)]">
              {edges.length}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-[var(--border-subtle)] flex gap-8">
        {(['Events', 'Entities', 'Edges', 'Health'] as MemoryTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? 'text-[var(--accent-primary)] border-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'Health' && (
          <div className="p-6">
            <MemoryVaultStats />
          </div>
        )}

        {activeTab === 'Events' && (
          <div className="p-6">
            <div className="mb-4 flex gap-3">
              <div className="flex-1 relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="all">All Types</option>
                <option value="message_sent">Messages</option>
                <option value="tool_called">Tools</option>
                <option value="file_read">Files</option>
                <option value="session_start">Sessions</option>
              </select>
            </div>

            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
              {filteredEvents.map((event) => (
                <EventRow key={event.id} event={event} onToggle={toggleEventExpand} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Entities' && (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entities.map((entity) => (
                <EntityCard key={entity.id} entity={entity} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Edges' && (
          <div className="p-6">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
              {edges.map((edge) => (
                <EdgeRow key={edge.id} edge={edge} />
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassSurface>
  );
}

export default MemoryKernelView;
