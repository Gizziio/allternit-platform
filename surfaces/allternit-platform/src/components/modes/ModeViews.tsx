/**
 * Real-ish mode view implementations for AgentModeRouter
 * These replace the static placeholders with interactive UIs
 * that align with competitor analysis insights.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MagnifyingGlass,
  FileText,
  Upload,
  Lightning,
  GitBranch,
  Globe,
  Swatches,
} from '@phosphor-icons/react';

// ─── Research Mode ───────────────────────────────────────────────────────────

export function DeepResearchModeView() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ title: string; source: string; snippet: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    await new Promise((r) => setTimeout(r, 1500));
    setResults([
      { title: 'Research findings on ' + query, source: 'arxiv.org', snippet: 'Multi-source synthesis with automatic citations...' },
      { title: 'Industry analysis: ' + query, source: 'gartner.com', snippet: 'Key trends and market dynamics identified...' },
      { title: 'Technical deep dive', source: 'github.com', snippet: 'Code-level analysis and implementation patterns...' },
    ]);
    setIsSearching(false);
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <MagnifyingGlass size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Deep Research</h3>
          <p className="text-sm text-white/50">Multi-source research with automatic synthesis and citations</p>
        </div>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter research topic..."
            className="bg-white/5 border-white/10 text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button onClick={handleSearch} disabled={isSearching} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
            {isSearching ? 'Searching...' : 'Research'}
          </Button>
        </div>

        {results.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="secondary" className="bg-white/5 text-white/60 text-[10px]">{r.source}</Badge>
                </div>
                <h4 className="text-sm font-medium text-white mb-1">{r.title}</h4>
                <p className="text-xs text-white/50">{r.snippet}</p>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Data Studio Mode ────────────────────────────────────────────────────────

export function DataStudioModeView() {
  const [files, setFiles] = useState<Array<{ name: string; size: string; rows: number }>>([]);

  const handleUpload = () => {
    setFiles([
      ...files,
      { name: 'sales_data_q4.csv', size: '2.4 MB', rows: 12450 },
      { name: 'user_analytics.json', size: '890 KB', rows: 3420 },
    ]);
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <Swatches size={28} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Data Studio</h3>
          <p className="text-sm text-white/50">Upload CSV/Excel and get automatic charts, insights, and SQL</p>
        </div>

        <div
          onClick={handleUpload}
          className="border-2 border-dashed border-white/10 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-colors"
        >
          <Upload size={32} className="mx-auto text-white/30 mb-3" />
          <p className="text-sm text-white/60">Drop files here or click to upload</p>
          <p className="text-xs text-white/30 mt-1">Supports CSV, Excel, JSON, Parquet</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-emerald-400" />
                  <div>
                    <p className="text-sm text-white">{f.name}</p>
                    <p className="text-xs text-white/40">{f.size} · {f.rows.toLocaleString()} rows</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400">Analyzed</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pitch Deck Mode ─────────────────────────────────────────────────────────

export function PitchDeckModeView() {
  const [topic, setTopic] = useState('');
  const [slides, setSlides] = useState<Array<{ title: string; content: string }>>([]);

  const generate = async () => {
    if (!topic.trim()) return;
    await new Promise((r) => setTimeout(r, 1200));
    setSlides([
      { title: 'Introduction', content: `Overview of ${topic}` },
      { title: 'Problem Statement', content: 'Key challenges identified in the market' },
      { title: 'Solution', content: 'Our approach to solving these challenges' },
      { title: 'Market Opportunity', content: 'TAM/SAM/SOM analysis' },
      { title: 'Business Model', content: 'Revenue streams and pricing strategy' },
    ]);
  };

  return (
    <div className="h-full flex flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-amber-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Pitch Deck</h3>
          <p className="text-sm text-white/50">Auto-generate presentations with speaker notes</p>
        </div>

        <div className="flex gap-2">
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Enter presentation topic..."
            className="bg-white/5 border-white/10 text-white"
          />
          <Button onClick={generate} className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30">Generate</Button>
        </div>

        {slides.length > 0 && (
          <div className="space-y-2">
            {slides.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xs font-bold">
                  {i + 1}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{s.title}</p>
                  <p className="text-xs text-white/40">{s.content}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── File Vault Mode ─────────────────────────────────────────────────────────

export function FileVaultModeView() {
  const [files] = useState([
    { name: 'project-specs.pdf', type: 'PDF', size: '1.2 MB', tags: ['design', 'specs'] },
    { name: 'api-contract.yaml', type: 'YAML', size: '45 KB', tags: ['api', 'backend'] },
    { name: 'user-research.mp4', type: 'Video', size: '124 MB', tags: ['research', 'ux'] },
  ]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center mx-auto mb-4">
            <Upload size={28} className="text-pink-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">File Vault</h3>
          <p className="text-sm text-white/50">Smart file management with AI auto-tagging and semantic search</p>
        </div>

        <div className="space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-pink-500/20 flex items-center justify-center text-pink-400 text-xs font-bold">
                  {f.type}
                </div>
                <div>
                  <p className="text-sm text-white">{f.name}</p>
                  <p className="text-xs text-white/40">{f.size}</p>
                </div>
              </div>
              <div className="flex gap-1">
                {f.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="bg-white/5 text-white/50 text-[10px]">{t}</Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Swarms Mode ─────────────────────────────────────────────────────────────

export function SwarmsModeView() {
  const [swarm] = useState([
    { name: 'Research Agent', role: 'orchestrator', status: 'active', tasks: 3 },
    { name: 'Code Agent', role: 'worker', status: 'idle', tasks: 0 },
    { name: 'Review Agent', role: 'reviewer', status: 'active', tasks: 1 },
    { name: 'Deploy Agent', role: 'worker', status: 'paused', tasks: 0 },
  ]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <GitBranch size={28} className="text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Agent Swarms</h3>
          <p className="text-sm text-white/50">Coordinate multiple AI agents working in parallel</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {swarm.map((agent, i) => (
            <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-white">{agent.name}</span>
                <div className={`w-2 h-2 rounded-full ${
                  agent.status === 'active' ? 'bg-emerald-400 animate-pulse' :
                  agent.status === 'idle' ? 'bg-white/30' : 'bg-amber-400'
                }`} />
              </div>
              <p className="text-xs text-white/40 capitalize">{agent.role}</p>
              <p className="text-xs text-white/30 mt-1">{agent.tasks} active task{agent.tasks !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Auto Flow Mode ──────────────────────────────────────────────────────────

export function AutoFlowModeView() {
  const [nodes] = useState([
    { id: 1, type: 'trigger', label: 'New PR Opened', x: 100, y: 100 },
    { id: 2, type: 'action', label: 'Run Tests', x: 300, y: 100 },
    { id: 3, type: 'condition', label: 'Tests Pass?', x: 500, y: 100 },
    { id: 4, type: 'action', label: 'Deploy to Staging', x: 700, y: 60 },
    { id: 5, type: 'action', label: 'Notify Team', x: 700, y: 140 },
  ]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <Lightning size={28} className="text-cyan-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Auto Flow</h3>
          <p className="text-sm text-white/50">Build automated workflows with visual builder</p>
        </div>

        <div className="relative h-48 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
          <svg className="absolute inset-0 w-full h-full">
            {nodes.map((n, i) => {
              const next = nodes[i + 1];
              if (!next) return null;
              return (
                <line
                  key={`line-${n.id}`}
                  x1={n.x + 60} y1={n.y + 20}
                  x2={next.x} y2={next.y + 20}
                  stroke="var(--ui-border-default)"
                  strokeWidth={2}
                />
              );
            })}
          </svg>
          {nodes.map((n) => (
            <div
              key={n.id}
              className="absolute px-3 py-2 rounded-lg text-xs font-medium border"
              style={{
                left: n.x,
                top: n.y,
                background: n.type === 'trigger' ? 'rgba(6,182,212,0.15)' :
                           n.type === 'condition' ? 'rgba(245,158,11,0.15)' :
                           'var(--surface-hover)',
                borderColor: n.type === 'trigger' ? 'rgba(6,182,212,0.3)' :
                            n.type === 'condition' ? 'rgba(245,158,11,0.3)' :
                            'var(--ui-border-default)',
                color: n.type === 'trigger' ? '#22d3ee' :
                       n.type === 'condition' ? 'var(--status-warning)' :
                       'rgba(255,255,255,0.8)',
              }}
            >
              {n.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Site Builder Mode ───────────────────────────────────────────────────────

export function SiteBuilderModeView() {
  const [templates] = useState([
    { name: 'SaaS Landing', description: 'Modern SaaS landing page with pricing', preview: 'saas' },
    { name: 'Portfolio', description: 'Creative portfolio with project grid', preview: 'portfolio' },
    { name: 'Docs Site', description: 'Documentation site with sidebar nav', preview: 'docs' },
  ]);

  return (
    <div className="h-full flex flex-col p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
            <Globe size={28} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Site Builder</h3>
          <p className="text-sm text-white/50">Generate complete, deployable websites from text descriptions</p>
        </div>

        <div className="space-y-3">
          {templates.map((t, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors cursor-pointer">
              <div className="w-16 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                {t.preview.toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-white font-medium">{t.name}</p>
                <p className="text-xs text-white/40">{t.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
