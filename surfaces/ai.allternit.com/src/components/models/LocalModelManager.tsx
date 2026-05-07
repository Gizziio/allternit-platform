'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  CloudArrowDown,
  Trash,
  CheckCircle,
  Cpu,
  HardDrives,
  ArrowsClockwise,
  Brain,
  Warning,
  ArrowSquareOut,
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

interface BrainStatus {
  ollamaRunning: boolean;
  modelReady: boolean;
  pulledModels: string[];
}

interface PullProgress {
  status: string;
  total?: number;
  completed?: number;
  error?: string;
}

type PullState = 'idle' | 'pulling' | 'done' | 'error';

export function LocalModelManager() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [pullState, setPullState] = useState<PullState>('idle');
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/local-brain');
      if (res.ok) setBrainStatus(await res.json());
    } catch {}
  }, []);

  const fetchModels = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/provider/ollama/models');
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      }
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStatus(), fetchModels()]);
  }, [fetchStatus, fetchModels]);

  const startDownload = async () => {
    setPullState('pulling');
    setPullProgress(null);
    setPullError(null);
    try {
      const res = await fetch('/api/local-brain', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setPullError(err.error ?? 'Download failed');
        setPullState('error');
        return;
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: PullProgress = JSON.parse(line.slice(6));
            setPullProgress(event);
            if (event.status === 'success' || event.status === 'done') {
              setPullState('done');
              await Promise.all([fetchStatus(), fetchModels()]);
            } else if (event.status === 'error') {
              setPullState('error');
              setPullError(event.error ?? 'Download failed');
            }
          } catch {}
        }
      }
    } catch (err) {
      setPullState('error');
      setPullError(String(err));
    }
  };

  const formatSize = (bytes: number) =>
    (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';

  const pullPct =
    pullProgress?.total && pullProgress.completed
      ? Math.round((pullProgress.completed / pullProgress.total) * 100)
      : null;

  const otherModels = models.filter((m) => !m.name.startsWith('llama3.2:3b'));

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold mb-1 text-[var(--text-primary)]">Local Brain</h3>
          <p className="text-sm text-[var(--text-tertiary)]">
            Offline AI that runs on your machine — no API key, no data sent anywhere.
          </p>
        </div>
        <button
          onClick={() => { fetchStatus(); fetchModels(); }}
          disabled={refreshing}
          className="p-2 rounded-lg hover:bg-secondary transition-colors text-[var(--text-secondary)]"
        >
          <ArrowsClockwise size={20} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Local Brain status card ── */}
      {!brainStatus?.ollamaRunning ? (
        <div className="p-5 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-secondary/10">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Brain size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[var(--text-primary)]">Local Brain</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase font-bold">
                  Ollama required
                </span>
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mb-3">
                Ollama isn't running. Install it to enable offline AI on this machine.
              </p>
              <a
                href="https://ollama.com/download"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-primary)] hover:underline"
              >
                Get Ollama <ArrowSquareOut size={12} />
              </a>
            </div>
          </div>
        </div>
      ) : brainStatus.modelReady || pullState === 'done' ? (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
            <Brain size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-[var(--text-primary)]">Local Brain</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 uppercase font-bold">
                Ready
              </span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">llama3.2:3b · ~2 GB · offline</p>
          </div>
          <CheckCircle size={22} weight="fill" className="text-green-500 shrink-0" />
        </div>
      ) : pullState === 'pulling' ? (
        <div className="p-4 rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Brain size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Downloading Local Brain</span>
              <p className="text-xs text-[var(--text-tertiary)]">
                {pullProgress?.status ?? 'Starting…'}
                {pullPct !== null ? ` — ${pullPct}%` : ''}
              </p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
              style={{ width: pullPct !== null ? `${pullPct}%` : '5%' }}
            />
          </div>
        </div>
      ) : pullState === 'error' ? (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <Warning size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Download failed</p>
              <p className="text-xs text-[var(--text-tertiary)] mb-3">{pullError}</p>
              <button
                onClick={startDownload}
                className="text-xs font-semibold text-[var(--accent-primary)] hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Brain size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-[var(--text-primary)]">Local Brain</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] uppercase font-bold">
                  ~2 GB
                </span>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                llama3.2:3b · offline · no API key · works on any machine
              </p>
            </div>
            <button
              onClick={startDownload}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:opacity-90 transition-opacity"
            >
              <CloudArrowDown size={14} /> Download
            </button>
          </div>
        </div>
      )}

      {/* ── Other installed models ── */}
      {otherModels.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
            Other installed models
          </p>
          <div className="grid grid-cols-1 gap-3">
            {otherModels.map((model) => (
              <div
                key={model.digest}
                className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-between group hover:border-[var(--accent-primary)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                    <Cpu size={22} />
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
                  <button className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash size={18} />
                  </button>
                  <CheckCircle size={20} weight="fill" className="text-green-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
