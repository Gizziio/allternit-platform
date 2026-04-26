/**
 * Blueprint Canvas - Artifacts on Steroids
 * 
 * A high-fidelity generative workspace where Allternit agents 
 * manifest and iterate on complex interfaces.
 */

'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { GlassSurface } from '@/design/GlassSurface';
import { AllternitOpenUIRenderer } from '@/lib/openui/AllternitOpenUIRenderer';
import { getFullArchitectInstructions } from '@/lib/openui/prompts';
import { ViewContext } from '@/nav/nav.types';
import {
  Lightning,
  Code,
  CheckCircle,
  Warning,
  Play,
  List,
  X,
  CaretDown,
  Plus,
  Copy,
  ArrowCounterClockwise,
  Layout,
  Terminal,
  Robot,
  ClockCounterClockwise,
  ArrowSquareOut,
  Files,
  Cpu
} from '@phosphor-icons/react';

const DEFAULT_OPENUI = `[v:stack spacing=6
  [v:card title="Architectural Overview" elevation="raised"
    [v:grid cols=3
      [v:metric label="Node Health" val="Optimal" trend="up" trendVal="2%"]
      [v:metric label="Latency" val="12ms" trend="down" trendVal="5ms"]
      [v:metric label="Active Agents" val="4" trend="none"]
    ]
  ]
  [v:card title="Visual MCP Monitor" variant="primary"
    [v:stack spacing=4
      [v:table headers=["Service", "Status", "Uptime"] data=[["Kernel", "Stable", "4d"], ["Vault", "Locked", "12h"], ["Runner", "Busy", "5m"]]]
      [v:button label="Sync with MCP Server" variant="secondary" action="mcp_sync"]
    ]
  ]
]`;

interface ArtifactVersion {
  id: string;
  timestamp: string;
  content: string;
  summary: string;
}

interface BlueprintContext {
  stream?: string;
}

export function BlueprintCanvas({ context }: { context?: ViewContext }) {
  const ctx = (context?.context ?? {}) as BlueprintContext;
  const [mode, setMode] = useState<'openui' | 'json'>('openui');
  const [inputText, setInputText] = useState(ctx.stream || DEFAULT_OPENUI);
  const [renderTime, setRenderTime] = useState(0);
  const [catalogOpen, setCatalogOpen] = useState(true);
  const [activeStream, setActiveStream] = useState(ctx.stream || DEFAULT_OPENUI);
  const [showPrompt, setShowPrompt] = useState(false);
  
  // Versions for "Artifacts on Steroids"
  const [versions, setVersions] = useState<ArtifactVersion[]>([
    { id: '1', timestamp: 'Just now', content: DEFAULT_OPENUI, summary: 'Initial Generation' }
  ]);
  const [selectedVersionId, setSelectedVersionId] = useState('1');

  useEffect(() => {
    if (ctx.stream) {
      const newStream = ctx.stream;
      setInputText(newStream);
      setActiveStream(newStream);
      
      // Auto-save to versions
      const newVersion: ArtifactVersion = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        content: newStream,
        summary: 'Incoming Stream Update'
      };
      setVersions(prev => [newVersion, ...prev]);
      setSelectedVersionId(newVersion.id);
    }
  }, [ctx.stream]);

  const masterPrompt = useMemo(() => getFullArchitectInstructions(), []);

  const handleRender = () => {
    const start = performance.now();
    setActiveStream(inputText);
    const end = performance.now();
    setRenderTime(Math.round((end - start) * 10) / 10);
    
    // Add to versions
    const newVersion: ArtifactVersion = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString(),
      content: inputText,
      summary: 'Manual Edit'
    };
    setVersions(prev => [newVersion, ...prev]);
    setSelectedVersionId(newVersion.id);
  };

  const handleVersionSelect = (v: ArtifactVersion) => {
    setSelectedVersionId(v.id);
    setInputText(v.content);
    setActiveStream(v.content);
  };

  return (
    <GlassSurface className="h-full w-full flex flex-col bg-[var(--surface-canvas)]">
      {/* Enhanced Header */}
      <div className="p-4 border-b border-white/[0.05] flex items-center justify-between bg-black/20">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-[var(--accent-primary)]/10 rounded-lg">
            <Cpu className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              Blueprint Canvas
              <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Pro</span>
            </h2>
            <div className="flex items-center gap-3 text-[10px] text-[var(--text-tertiary)] uppercase font-bold tracking-widest">
              <span className="flex items-center gap-1"><Terminal size={12} /> Model Context: MCP-Active</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span className="flex items-center gap-1 text-green-500"><div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live Rendering</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 mr-2">
            <button
              onClick={() => setMode('openui')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                mode === 'openui' 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <Layout size={14} /> OpenUI
            </button>
            <button
              onClick={() => setMode('json')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                mode === 'json' 
                  ? 'bg-white/10 text-white shadow-sm' 
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              <Code size={14} /> JSON
            </button>
          </div>
          
          <button 
            onClick={() => setShowPrompt(!showPrompt)}
            className={`p-2 rounded-lg transition-all ${showPrompt ? 'bg-[var(--accent-primary)] text-black' : 'text-white/40 hover:bg-white/5'}`}
            title="Master Architect Protocol"
          >
            <Robot size={20} />
          </button>
          
          <div className="w-px h-6 bg-white/10 mx-1" />
          
          <button className="px-4 py-1.5 bg-[var(--accent-primary)] text-black rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-2">
             <ArrowSquareOut size={16} weight="bold" />
             Deploy Blueprint
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left: Artifact History & Tools */}
        <div className="w-[260px] border-r border-white/5 flex flex-col bg-black/10">
          <div className="p-4 border-b border-white/5 flex items-center gap-2 text-white/40">
            <ClockCounterClockwise size={16} />
            <span className="text-[10px] font-black uppercase tracking-tighter">Artifact Versioning</span>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {versions.map(v => (
              <button
                key={v.id}
                onClick={() => handleVersionSelect(v)}
                className={`w-full p-3 rounded-xl text-left transition-all border ${
                  selectedVersionId === v.id 
                    ? 'bg-white/5 border-white/10' 
                    : 'border-transparent hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                   <span className={`text-[10px] font-bold ${selectedVersionId === v.id ? 'text-[var(--accent-primary)]' : 'text-white/60'}`}>{v.timestamp}</span>
                   {selectedVersionId === v.id && <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] shadow-[0_0_8px_var(--accent-primary)]" />}
                </div>
                <div className="text-[11px] text-white/80 font-medium truncate">{v.summary}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Center: The Canvas Render */}
        <div className="flex-1 overflow-auto p-12 relative bg-grid-pattern">
          <div className="max-w-4xl mx-auto">
            <div className="mb-10 flex flex-col items-center">
              <div className="w-12 h-1 bg-[var(--accent-primary)]/40 rounded-full mb-6" />
              <AllternitOpenUIRenderer stream={activeStream} />
            </div>
          </div>
        </div>

        {/* Right: Code & Prompt Editor */}
        <div className="w-[400px] border-l border-white/5 flex flex-col bg-black/20">
          <div className="p-3 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code size={16} className="text-blue-400" />
              <span className="text-[10px] font-black uppercase tracking-tighter text-white/40">Live Specification</span>
            </div>
            <button onClick={handleRender} className="p-1 hover:bg-white/10 rounded transition-colors text-[var(--accent-primary)]">
               <Play size={16} weight="fill" />
            </button>
          </div>
          
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 p-4 bg-transparent text-[var(--text-primary)] font-mono text-[11px] leading-relaxed resize-none outline-none border-0 selection:bg-blue-500/30"
            spellCheck="false"
          />

          {showPrompt && (
            <div className="h-1/2 border-t border-white/10 bg-black/40 flex flex-col overflow-hidden">
               <div className="p-3 border-b border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Architect's Protocol</span>
                <button 
                  onClick={() => navigator.clipboard.writeText(masterPrompt)} 
                  className="text-[10px] text-[var(--accent-primary)] hover:underline flex items-center gap-1 font-bold"
                >
                  <Copy size={12} /> COPY PROTOCOL
                </button>
              </div>
              <div className="p-4 overflow-auto font-mono text-[10px] text-white/40 whitespace-pre-wrap leading-tight">
                {masterPrompt}
              </div>
            </div>
          )}
        </div>
      </div>
    </GlassSurface>
  );
}

export default BlueprintCanvas;
