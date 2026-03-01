/**
 * MemoryKernelView
 *
 * UI for Memory Kernel - Three-layer memory system (AMK).
 * Browse events, entities, and relationship edges with real-time updates.
 */

'use client';

import React, { useState } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import {
  Database, Network, Layers, ChevronDown, Search, Filter, Eye,
  Clock, Tag, BarChart3
} from 'lucide-react';

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

type MemoryTab = 'Events' | 'Entities' | 'Edges';

const MOCK_EVENTS: MemoryEvent[] = [
  {
    id: 'e1',
    timestamp: '2026-02-26T14:42:07Z',
    type: 'message_sent',
    payload: 'Message "Analyze Q3 results" sent to claude-opus-4-5',
    expanded: false,
  },
  {
    id: 'e2',
    timestamp: '2026-02-26T14:41:55Z',
    type: 'tool_called',
    payload: 'Tool executed: bash_exec {cmd: "npm run build"}',
    expanded: false,
  },
  {
    id: 'e3',
    timestamp: '2026-02-26T14:41:40Z',
    type: 'file_read',
    payload: 'File read: /home/user/project/src/index.ts (2,847 bytes)',
    expanded: false,
  },
  {
    id: 'e4',
    timestamp: '2026-02-26T14:40:22Z',
    type: 'session_start',
    payload: 'New session created: sid_0x4a92b (workspace: /home/user/project)',
    expanded: false,
  },
  {
    id: 'e5',
    timestamp: '2026-02-26T14:39:44Z',
    type: 'message_sent',
    payload: 'Message "Refactor auth module" sent to claude-sonnet-4-5',
    expanded: false,
  },
  {
    id: 'e6',
    timestamp: '2026-02-26T14:38:30Z',
    type: 'tool_called',
    payload: 'Tool executed: file_write {path: /src/auth.ts, size: 1,204 bytes}',
    expanded: false,
  },
  {
    id: 'e7',
    timestamp: '2026-02-26T14:37:15Z',
    type: 'file_read',
    payload: 'File read: /home/user/project/package.json (1,542 bytes)',
    expanded: false,
  },
  {
    id: 'e8',
    timestamp: '2026-02-26T14:36:00Z',
    type: 'session_start',
    payload: 'New session created: sid_0x3f81a (workspace: /home/user/shared)',
    expanded: false,
  },
];

const MOCK_ENTITIES: Entity[] = [
  { id: 'ent1', entityId: 'user:alice', name: 'Alice', type: 'Person', lastUpdated: '2m ago', propertyCount: 12 },
  { id: 'ent2', entityId: 'company:acme', name: 'Acme Corp', type: 'Company', lastUpdated: '14s ago', propertyCount: 8 },
  { id: 'ent3', entityId: 'project:canvas', name: 'Canvas Protocol', type: 'Project', lastUpdated: '32m ago', propertyCount: 15 },
  { id: 'ent4', entityId: 'file:index.ts', name: 'index.ts', type: 'File', lastUpdated: '5s ago', propertyCount: 6 },
  { id: 'ent5', entityId: 'session:ws01', name: 'Workspace Session', type: 'Session', lastUpdated: '1h ago', propertyCount: 9 },
  { id: 'ent6', entityId: 'tool:bash_exec', name: 'bash_exec', type: 'Tool', lastUpdated: '52m ago', propertyCount: 4 },
];

const MOCK_EDGES: Edge[] = [
  { id: 'edge1', source: 'user:alice', relationship: 'AUTHORED', target: 'file:index.ts', confidence: 0.98, createdAt: '3h ago' },
  { id: 'edge2', source: 'user:alice', relationship: 'WORKS_AT', target: 'company:acme', confidence: 0.95, createdAt: '2d ago' },
  { id: 'edge3', source: 'file:index.ts', relationship: 'PART_OF', target: 'project:canvas', confidence: 0.99, createdAt: '5d ago' },
  { id: 'edge4', source: 'session:ws01', relationship: 'EDITED', target: 'file:index.ts', confidence: 0.87, createdAt: '28m ago' },
  { id: 'edge5', source: 'tool:bash_exec', relationship: 'CALLED_BY', target: 'session:ws01', confidence: 0.92, createdAt: '1h ago' },
  { id: 'edge6', source: 'user:alice', relationship: 'LEADS', target: 'project:canvas', confidence: 0.88, createdAt: '1d ago' },
];

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
        <ChevronDown className={`w-4 h-4 text-[var(--text-tertiary)] transition-transform flex-shrink-0 ${event.expanded ? 'rotate-180' : ''}`} />
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
  const [events, setEvents] = useState<MemoryEvent[]>(MOCK_EVENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

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
              <Layers className="w-4 h-4" />
              Total Events
            </div>
            <div className="text-2xl font-bold text-[var(--accent-primary)]">
              {MOCK_EVENTS.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase font-semibold mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Total Entities
            </div>
            <div className="text-2xl font-bold text-[var(--accent-primary)]">
              {MOCK_ENTITIES.length}
            </div>
          </div>
          <div>
            <div className="text-xs text-[var(--text-tertiary)] uppercase font-semibold mb-2 flex items-center gap-2">
              <Network className="w-4 h-4" />
              Total Edges
            </div>
            <div className="text-2xl font-bold text-[var(--accent-primary)]">
              {MOCK_EDGES.length}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 border-b border-[var(--border-subtle)] flex gap-8">
        {(['Events', 'Entities', 'Edges'] as MemoryTab[]).map((tab) => (
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
        {activeTab === 'Events' && (
          <div className="p-6">
            <div className="mb-4 flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
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
              {MOCK_ENTITIES.map((entity) => (
                <EntityCard key={entity.id} entity={entity} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Edges' && (
          <div className="p-6">
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
              {MOCK_EDGES.map((edge) => (
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
