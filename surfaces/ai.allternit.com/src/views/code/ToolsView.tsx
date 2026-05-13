import React, { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { getAllToolDefinitions } from '@/lib/agents/tools';

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  status: 'enabled' | 'disabled' | 'restricted';
  riskLevel: 'low' | 'medium' | 'high';
  lastUsed?: string;
  usageCount?: number;
}

export function ToolsView() {
  const isClient = useSyncExternalStore(() => () => {}, () => true, () => false);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const loadTools = useCallback(() => {
    try {
      const defs = getAllToolDefinitions();
      const mapped: Tool[] = defs.map((def) => ({
        id: def.name,
        name: def.name,
        description: String(def.description).split('\n')[0],
        category: def.name.split('_')[0],
        status: 'enabled' as const,
        riskLevel: 'low' as const,
      }));
      setTools(mapped);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tools from registry');
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const filteredTools = filter === 'all' 
    ? tools 
    : tools.filter(tool => tool.status === filter);

  if (loading) {
    return (
      <div className="p-5 text-center h-full flex items-center justify-center">
        <div className="text-sm opacity-60 italic">Loading tools from registry…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-5 text-center h-full flex items-center justify-center">
        <div className="text-[var(--status-error)] font-medium">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 h-full overflow-auto flex flex-col gap-5">
      <div className="flex justify-between items-center">
        <h2 className="m-0 text-xl font-bold tracking-tight">Available Tools</h2>
        
        <div className="flex gap-3">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="p-1.5 px-3 border border-[var(--border-default)] rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[13px] outline-none focus:border-[var(--accent-primary)] transition-colors"
          >
            <option value="all">All Tools</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="restricted">Restricted</option>
          </select>
          
          <button 
            className="p-1.5 px-3 border border-[var(--border-default)] rounded-md bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-[13px] font-semibold cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
            onClick={() => {
              setLoading(true);
              loadTools();
            }}
          >
            Refresh
          </button>
        </div>
      </div>
      
      <div className="grid gap-3">
        {filteredTools.map(tool => (
          <div 
            key={tool.id} 
            className="p-4 border border-[var(--border-default)] rounded-xl bg-[var(--bg-secondary)] relative group transition-all duration-150 hover:border-[var(--ui-border-default)]"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="m-0 font-bold text-base">{tool.name}</h3>
                <div className="flex gap-2 mt-1.5">
                  <span className={`px-2 py-0.5 rounded text-[12px] font-bold uppercase tracking-wider ${
                    tool.status === 'enabled' ? 'bg-emerald-500/10 text-emerald-500' :
                    tool.status === 'disabled' ? 'bg-zinc-500/10 text-zinc-500' : 
                    'bg-amber-500/10 text-amber-500'
                  }`}>
                    {tool.status}
                  </span>
                  
                  <span className={`px-2 py-0.5 rounded text-[12px] font-bold uppercase tracking-wider ${
                    tool.riskLevel === 'low' ? 'bg-emerald-500/10 text-emerald-500' :
                    tool.riskLevel === 'medium' ? 'bg-amber-500/10 text-amber-500' : 
                    'bg-rose-500/10 text-rose-500'
                  }`}>
                    {tool.riskLevel} risk
                  </span>
                  
                  <span className="px-2 py-0.5 rounded bg-zinc-500/10 text-zinc-500 text-[12px] font-bold uppercase tracking-wider">
                    {tool.category}
                  </span>
                </div>
              </div>
              
              <div className="text-[12px] text-[var(--text-tertiary)] text-right">
                <div className="font-medium">Used: <span className="text-[var(--text-secondary)]">{tool.usageCount || 0}</span></div>
                {tool.lastUsed && <div>Last: <span className="text-[var(--text-secondary)]">{isClient ? new Date(tool.lastUsed).toLocaleDateString() : '—'}</span></div>}
              </div>
            </div>
            
            <p className="m-0 mb-4 text-[var(--text-secondary)] text-[13px] leading-relaxed">
              {tool.description}
            </p>
            
            <div className="flex gap-2">
              <button 
                className={`p-1.5 px-4 border border-[var(--border-default)] rounded-lg bg-[var(--bg-tertiary)] text-[12px] font-bold transition-all ${
                  tool.status === 'disabled' 
                    ? 'cursor-not-allowed opacity-50' 
                    : 'cursor-pointer hover:bg-[var(--surface-hover)]'
                }`}
                disabled={tool.status === 'disabled'}
              >
                Execute
              </button>
              <button className="p-1.5 px-4 border border-[var(--border-default)] rounded-lg bg-[var(--bg-tertiary)] text-[12px] font-bold cursor-pointer hover:bg-[var(--surface-hover)] transition-all">
                View Details
              </button>
              <button className="p-1.5 px-4 border border-[var(--border-default)] rounded-lg bg-[var(--bg-tertiary)] text-[12px] font-bold cursor-pointer hover:bg-[var(--surface-hover)] transition-all">
                Permissions
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}