'use client';

import React, { useState, useEffect } from 'react';
import { 
  CloudArrowDown, 
  Trash, 
  CheckCircle, 
  Play, 
  Cpu, 
  HardDrives,
  ArrowsClockwise
} from '@phosphor-icons/react';

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  details: {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export function LocalModelManager() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchModels = async () => {
    setRefreshing(true);
    try {
      // This endpoint was added to the kernel to proxy to Ollama
      const res = await fetch('/api/provider/ollama/models');
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      }
    } catch (err) {
      console.error('Failed to fetch Ollama models', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const formatSize = (bytes: number) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1 text-[var(--text-primary)]">Local AI Models</h3>
          <p className="text-sm text-[var(--text-tertiary)]">
            Manage models available for offline inference via Ollama.
          </p>
        </div>
        <button 
          onClick={fetchModels}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-secondary transition-colors text-[var(--text-secondary)]"
        >
          <ArrowsClockwise size={20} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {models.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-secondary/10">
          <CloudArrowDown size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-[var(--text-secondary)] font-medium">No local models found</p>
          <p className="text-xs text-[var(--text-tertiary)] mt-1 mb-6">
            Make sure Ollama is running and you have pulled at least one model.
          </p>
          <code className="bg-black/20 px-3 py-1.5 rounded-lg text-xs font-mono">
            ollama pull llama3
          </code>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {models.map((model) => (
            <div 
              key={model.digest} 
              className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-between group hover:border-[var(--accent-primary)] transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <Cpu size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text-primary)]">{model.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 uppercase font-bold">
                      {model.details.quantization_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-tertiary)] font-medium">
                    <span className="flex items-center gap-1">
                      <HardDrives size={12} /> {formatSize(model.size)}
                    </span>
                    <span>•</span>
                    <span>{model.details.parameter_size} parameters</span>
                    <span>•</span>
                    <span>{model.details.family}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button className="p-2 rounded-lg text-green-500 bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Play size={18} weight="fill" />
                </button>
                <button className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash size={18} />
                </button>
                <div className="p-2 text-green-500">
                  <CheckCircle size={20} weight="fill" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
        <div className="flex gap-3">
          <div className="text-blue-500"><CloudArrowDown size={20} /></div>
          <div>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">Coming Soon</p>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Automatic model discovery and one-click installation from the Allternit Catalog.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
