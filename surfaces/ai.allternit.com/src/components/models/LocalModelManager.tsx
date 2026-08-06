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
  Image as ImageIcon,
  Play,
  Stop,
  X,
  MagnifyingGlass,
  DownloadSimple,
} from '@phosphor-icons/react';
import { LOCAL_MODEL_CATALOG } from '@/lib/local-models/catalog';
import {
  BONSAI_WEBGPU_CONSENT,
  BONSAI_WEBGPU_MODEL_ID,
  BONSAI_WEBGPU_PROVIDER_PREFERENCE,
  bonsaiWebGpuProvider,
} from '@/lib/local-models/providers/bonsai-webgpu';

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modified_at: string;
  // Ollama omits this for some manually-imported/GGUF models, so it's not
  // safe to assume every listed model has full details.
  details?: {
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

interface HuggingFaceModel {
  repoId: string;
  downloads: number;
  likes: number;
}

type HfInstallState = 'idle' | 'pulling' | 'done' | 'error';

interface HfInstallStatus {
  state: HfInstallState;
  progress?: PullProgress;
  error?: string;
}

type BonsaiBridge = NonNullable<NonNullable<typeof window.allternit>['bonsai']>;
type BonsaiStatus = Awaited<ReturnType<BonsaiBridge['getStatus']>>;

export function LocalModelManager() {
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [brainStatus, setBrainStatus] = useState<BrainStatus | null>(null);
  const [pullState, setPullState] = useState<PullState>('idle');
  const [pullProgress, setPullProgress] = useState<PullProgress | null>(null);
  const [pullError, setPullError] = useState<string | null>(null);

  const bonsai = typeof window !== 'undefined' ? window.allternit?.bonsai : undefined;
  const [bonsaiStatus, setBonsaiStatus] = useState<BonsaiStatus | null>(null);
  const [bonsaiBusy, setBonsaiBusy] = useState<'install' | 'start' | 'stop' | 'remove' | null>(null);
  const [bonsaiProgress, setBonsaiProgress] = useState<string | null>(null);
  const [bonsaiError, setBonsaiError] = useState<string | null>(null);
  const [bonsaiLicenseAccepted, setBonsaiLicenseAccepted] = useState(false);
  const [bonsaiConfirmRemove, setBonsaiConfirmRemove] = useState(false);
  const [imageProvider, setImageProvider] = useState<'bonsai-local' | 'bonsai-webgpu'>('bonsai-local');
  const [webGpuConsent, setWebGpuConsent] = useState(false);
  const [webGpuBusy, setWebGpuBusy] = useState(false);
  const [webGpuMessage, setWebGpuMessage] = useState<string | null>(null);

  const [hfQuery, setHfQuery] = useState('');
  const [hfResults, setHfResults] = useState<HuggingFaceModel[]>([]);
  const [hfSearching, setHfSearching] = useState(false);
  const [hfSearchError, setHfSearchError] = useState<string | null>(null);
  const [hfSearched, setHfSearched] = useState(false);
  const [hfInstalls, setHfInstalls] = useState<Record<string, HfInstallStatus>>({});

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

  const refreshBonsai = useCallback(async () => {
    if (!bonsai) return;
    try {
      setBonsaiStatus(await bonsai.getStatus());
    } catch {}
  }, [bonsai]);

  useEffect(() => {
    Promise.all([fetchStatus(), fetchModels()]);
    if (sessionStorage.getItem(BONSAI_WEBGPU_PROVIDER_PREFERENCE) === 'bonsai-webgpu' &&
        sessionStorage.getItem(BONSAI_WEBGPU_CONSENT) === 'accepted') {
      setImageProvider('bonsai-webgpu');
      setWebGpuConsent(true);
    }
  }, [fetchStatus, fetchModels]);

  const selectLocalImage = () => {
    sessionStorage.removeItem(BONSAI_WEBGPU_PROVIDER_PREFERENCE);
    sessionStorage.removeItem(BONSAI_WEBGPU_CONSENT);
    setImageProvider('bonsai-local');
    setWebGpuConsent(false);
    setWebGpuMessage(null);
  };

  const enableWebGpu = async () => {
    if (!webGpuConsent) return;
    sessionStorage.setItem(BONSAI_WEBGPU_CONSENT, 'accepted');
    setWebGpuBusy(true);
    setWebGpuMessage('Downloading and verifying the WebGPU runtime and model…');
    try {
      const manifest = LOCAL_MODEL_CATALOG.find(item => item.id === BONSAI_WEBGPU_MODEL_ID);
      const runtime = manifest?.runtimes.find(item => item.engine === 'webgpu');
      if (!manifest || !runtime) throw new Error('Bonsai WebGPU catalog entry is unavailable');
      for await (const progress of bonsaiWebGpuProvider.installModel({ manifest, runtime })) {
        if (progress.message) setWebGpuMessage(progress.message);
      }
      sessionStorage.setItem(BONSAI_WEBGPU_PROVIDER_PREFERENCE, 'bonsai-webgpu');
      setImageProvider('bonsai-webgpu');
    } catch (error) {
      sessionStorage.removeItem(BONSAI_WEBGPU_PROVIDER_PREFERENCE);
      setWebGpuMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setWebGpuBusy(false);
    }
  };

  const removeWebGpu = async () => {
    setWebGpuBusy(true);
    setWebGpuMessage('Removing the cached WebGPU runtime and model weights…');
    try {
      await bonsaiWebGpuProvider.removeModel(BONSAI_WEBGPU_MODEL_ID);
      selectLocalImage();
      setWebGpuMessage('WebGPU runtime and model caches removed.');
    } catch (error) {
      setWebGpuMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setWebGpuBusy(false);
    }
  };

  useEffect(() => {
    refreshBonsai();
    if (!bonsai) return;
    return bonsai.onProgress((progress) => {
      setBonsaiProgress(progress.message);
      if (progress.stage === 'ready' || progress.stage === 'error' || progress.stage === 'cancelled') {
        refreshBonsai();
      }
    });
  }, [bonsai, refreshBonsai]);

  const runBonsaiAction = async (action: 'install' | 'start' | 'stop' | 'remove') => {
    if (!bonsai) return;
    setBonsaiBusy(action);
    setBonsaiError(null);
    setBonsaiProgress(null);
    try {
      if (action === 'install') await bonsai.install();
      else if (action === 'start') await bonsai.start();
      else if (action === 'stop') await bonsai.stop();
      else await bonsai.remove();
      setBonsaiConfirmRemove(false);
    } catch (err) {
      setBonsaiError(err instanceof Error ? err.message : String(err));
    } finally {
      setBonsaiBusy(null);
      await refreshBonsai();
    }
  };

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

  const searchHuggingFace = async (query: string) => {
    setHfSearching(true);
    setHfSearchError(null);
    setHfSearched(true);
    try {
      const res = await fetch(`/api/provider/huggingface/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(err.message ?? err.error ?? `Search failed (${res.status})`);
      }
      const data = await res.json() as { models?: HuggingFaceModel[] };
      setHfResults(data.models ?? []);
    } catch (err) {
      setHfSearchError(err instanceof Error ? err.message : String(err));
      setHfResults([]);
    } finally {
      setHfSearching(false);
    }
  };

  const installFromHuggingFace = async (repoId: string) => {
    setHfInstalls((prev) => ({ ...prev, [repoId]: { state: 'pulling' } }));
    try {
      const res = await fetch('/api/local-brain/pull-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo: repoId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(err.message ?? err.error ?? `Install failed (${res.status})`);
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
            if (event.status === 'success' || event.status === 'done') {
              setHfInstalls((prev) => ({ ...prev, [repoId]: { state: 'done' } }));
              await fetchModels();
            } else if (event.status === 'error') {
              setHfInstalls((prev) => ({ ...prev, [repoId]: { state: 'error', error: event.error ?? 'Install failed' } }));
            } else {
              setHfInstalls((prev) => ({ ...prev, [repoId]: { state: 'pulling', progress: event } }));
            }
          } catch {}
        }
      }
    } catch (err) {
      setHfInstalls((prev) => ({ ...prev, [repoId]: { state: 'error', error: err instanceof Error ? err.message : String(err) } }));
    }
  };

  const formatSize = (bytes: number) =>
    (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';

  const pullPct =
    pullProgress?.total && pullProgress.completed
      ? Math.round((pullProgress.completed / pullProgress.total) * 100)
      : null;

  const otherModels = models.filter((m) => !m.name.startsWith('llama3.2:3b'));
  const localCatalog = LOCAL_MODEL_CATALOG.filter((model) => model.kind === 'brain' || model.kind === 'image');

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full size-8  border-b-2 border-[var(--accent-primary)]" />
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
            Private inference on your device. Model downloads come from their declared publisher; prompts stay local unless you enable a network tool.
          </p>
        </div>
        <button type="button"
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
            <div className="size-10  rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Brain size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-[var(--text-primary)]">Local Brain</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 uppercase font-bold">
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
          <div className="size-10  rounded-xl bg-green-500/10 flex items-center justify-center text-green-500 shrink-0">
            <Brain size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-semibold text-[var(--text-primary)]">Local Brain</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-500 uppercase font-bold">
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
            <div className="size-8  rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
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
              <button type="button"
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
            <div className="size-10  rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
              <Brain size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-[var(--text-primary)]">Local Brain</span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] uppercase font-bold">
                  ~2 GB
                </span>
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">
                llama3.2:3b · offline · no API key · works on any machine
              </p>
            </div>
            <button type="button"
              onClick={startDownload}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:opacity-90 transition-opacity"
            >
              <CloudArrowDown size={14} /> Download
            </button>
          </div>
        </div>
      )}

      {/* ── Hugging Face model search (PocketPal-style discovery) ── */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Add a model from Hugging Face</h4>
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
          Search public GGUF models on Hugging Face and install any of them into your Local Brain — not just the default.
        </p>
        <form
          className="flex items-center gap-2 mb-3"
          onSubmit={(event) => { event.preventDefault(); if (hfQuery.trim()) void searchHuggingFace(hfQuery.trim()); }}
        >
          <div className="relative flex-1">
            <MagnifyingGlass size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <input
              type="text"
              value={hfQuery}
              onChange={(event) => setHfQuery(event.target.value)}
              placeholder={'Search Hugging Face, e.g. "qwen 7b gguf"'}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
          <button
            type="submit"
            disabled={hfSearching || !hfQuery.trim()}
            className="shrink-0 px-3 py-2 rounded-lg text-xs font-bold bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {hfSearching ? 'Searching…' : 'Search'}
          </button>
        </form>

        {hfSearchError && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-2 mb-3">
            <Warning size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--text-tertiary)] break-words">{hfSearchError}</p>
          </div>
        )}

        {hfSearched && !hfSearching && !hfSearchError && hfResults.length === 0 && (
          <p className="text-xs text-[var(--text-tertiary)]">No GGUF models matched that search.</p>
        )}

        {hfResults.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {hfResults.map((model) => {
              const install = hfInstalls[model.repoId];
              return (
                <div
                  key={model.repoId}
                  className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate font-mono">{model.repoId}</div>
                    <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                      {model.downloads.toLocaleString()} downloads · {model.likes.toLocaleString()} likes
                    </div>
                    {install?.state === 'pulling' && (
                      <div className="text-[11px] text-[var(--accent-primary)] mt-1">
                        {install.progress?.status ?? 'Starting…'}
                      </div>
                    )}
                    {install?.state === 'error' && (
                      <div className="text-[11px] text-red-500 mt-1">{install.error}</div>
                    )}
                  </div>
                  {install?.state === 'done' ? (
                    <CheckCircle size={20} weight="fill" className="text-green-500 shrink-0" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => void installFromHuggingFace(model.repoId)}
                      disabled={install?.state === 'pulling'}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
                    >
                      <DownloadSimple size={14} className={install?.state === 'pulling' ? 'animate-pulse' : ''} />
                      {install?.state === 'pulling' ? 'Installing…' : 'Install'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Bonsai Image companion card ── */}
      <div>
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Local Image</h4>
        <p className="text-xs text-[var(--text-tertiary)] mb-3">
          Bonsai Image 4B runs on this device through a loopback companion. No cloud provider is used.
        </p>
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <button type="button" onClick={selectLocalImage}
            className={`rounded-xl border p-3 text-left ${imageProvider === 'bonsai-local' ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5' : 'border-[var(--border-subtle)] bg-secondary/10'}`}>
            <span className="block text-sm font-semibold text-[var(--text-primary)]">Local (slow)</span>
            <span className="mt-1 block text-xs text-[var(--text-tertiary)]">Private, auditable companion runtime · default</span>
          </button>
          <div className={`rounded-xl border p-3 ${imageProvider === 'bonsai-webgpu' ? 'border-amber-500/50 bg-amber-500/5' : 'border-[var(--border-subtle)] bg-secondary/10'}`}>
            <div className="text-sm font-semibold text-[var(--text-primary)]">WebGPU (fast)</div>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-tertiary)]">
              Fast WebGPU mode downloads an unaudited third-party runtime (webml-community/bonsai-image-webgpu) from Hugging Face. It runs entirely on your GPU and prompts stay on your device, but we cannot verify its telemetry, licensing, or security. Use Local mode for a fully auditable runtime.
            </p>
            <label className="mt-2 flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={webGpuConsent} disabled={webGpuBusy}
                onChange={event => setWebGpuConsent(event.target.checked)} className="mt-0.5 accent-amber-500" />
              <span className="text-[11px] text-[var(--text-tertiary)]">I understand and consent for this session.</span>
            </label>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={enableWebGpu} disabled={!webGpuConsent || webGpuBusy}
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50">
                {webGpuBusy ? 'Working…' : imageProvider === 'bonsai-webgpu' ? 'Reinstall WebGPU' : 'Enable WebGPU'}
              </button>
              <button type="button" onClick={removeWebGpu} disabled={webGpuBusy}
                className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-bold text-red-500 disabled:opacity-50">
                Remove cache
              </button>
            </div>
            {webGpuMessage ? <p className="mt-2 text-[11px] break-words text-[var(--text-tertiary)]">{webGpuMessage}</p> : null}
          </div>
        </div>
        {!bonsai ? (
          <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] bg-secondary/10">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                <ImageIcon size={18} />
              </div>
              <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                Install, repair, and removal controls are available in the Allternit desktop app.
                Image generation works whenever the companion runs at <code>http://127.0.0.1:8000</code>.
              </p>
            </div>
          </div>
        ) : bonsaiStatus?.installing || bonsaiBusy === 'install' ? (
          <div className="p-4 rounded-xl border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5">
            <div className="flex items-center gap-3 mb-3">
              <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                <ImageIcon size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-[var(--text-primary)]">Installing Bonsai Image 4B</span>
                <p className="text-xs text-[var(--text-tertiary)] truncate">
                  {bonsaiProgress ?? 'Starting installer…'}
                </p>
              </div>
              <button type="button"
                onClick={() => { bonsai.cancelInstall(); }}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-secondary transition-colors"
              >
                <X size={12} /> Cancel
              </button>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
              <div className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300 animate-pulse" style={{ width: '40%' }} />
            </div>
          </div>
        ) : bonsaiStatus?.running || bonsaiStatus?.installed ? (
          <div className={`p-4 rounded-xl border ${bonsaiStatus.running ? 'border-green-500/30 bg-green-500/5' : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)]'}`}>
            <div className="flex items-center gap-4">
              <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${bonsaiStatus.running ? 'bg-green-500/10 text-green-500' : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'}`}>
                <ImageIcon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-[var(--text-primary)]">Bonsai Image 4B</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded uppercase font-bold ${bonsaiStatus.running ? 'bg-green-500/10 text-green-500' : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'}`}>
                    {bonsaiStatus.running ? 'Running' : 'Installed'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] truncate">
                  {bonsaiStatus.running
                    ? 'Serving on 127.0.0.1:8000 · offline'
                    : [
                        bonsaiStatus.revisions?.model ? `model ${bonsaiStatus.revisions.model.slice(0, 12)}` : null,
                        bonsaiStatus.revisions?.mlxWheel ? `mlx ${bonsaiStatus.revisions.mlxWheel}` : null,
                      ].filter(Boolean).join(' · ') || 'Companion installed'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {bonsaiStatus.running ? (
                  <button type="button"
                    onClick={() => runBonsaiAction('stop')}
                    disabled={bonsaiBusy !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    <Stop size={14} /> Stop
                  </button>
                ) : (
                  <button type="button"
                    onClick={() => runBonsaiAction('start')}
                    disabled={bonsaiBusy !== null}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Play size={14} /> Start
                  </button>
                )}
                <button type="button"
                  onClick={() => runBonsaiAction('install')}
                  disabled={bonsaiBusy !== null}
                  title="Re-run the installer (repair or update)"
                  className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  <ArrowsClockwise size={16} />
                </button>
                {bonsaiConfirmRemove ? (
                  <>
                    <button type="button"
                      onClick={() => runBonsaiAction('remove')}
                      disabled={bonsaiBusy !== null}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      Confirm delete
                    </button>
                    <button type="button"
                      onClick={() => setBonsaiConfirmRemove(false)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-secondary transition-colors"
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button type="button"
                    onClick={() => setBonsaiConfirmRemove(true)}
                    disabled={bonsaiBusy !== null}
                    title="Remove the companion and its managed model files"
                    className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">
                <ImageIcon size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-[var(--text-primary)]">Bonsai Image 4B</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] uppercase font-bold">
                    ~3.9 GB
                  </span>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Local image generation · offline · deterministic seeds
                </p>
                <label className="mt-2 flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bonsaiLicenseAccepted}
                    onChange={(event) => setBonsaiLicenseAccepted(event.target.checked)}
                    className="mt-0.5 accent-[var(--accent-primary)]"
                  />
                  <span className="text-[11px] leading-relaxed text-[var(--text-tertiary)]">
                    I accept the Apache-2.0 license terms of the Bonsai model weights and the PrismML Image Studio runtime.
                  </span>
                </label>
              </div>
              <button type="button"
                onClick={() => runBonsaiAction('install')}
                disabled={!bonsaiLicenseAccepted || bonsaiBusy !== null}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[var(--accent-primary)] text-[var(--text-inverse)] hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <CloudArrowDown size={14} /> Install
              </button>
            </div>
          </div>
        )}
        {bonsaiError ? (
          <div className="mt-2 p-3 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-2">
            <Warning size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-[var(--text-tertiary)] break-words">{bonsaiError}</p>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-[var(--text-primary)]">Local model catalog</h4>
          <p className="text-xs text-[var(--text-tertiary)]">
            Replaceable model packages use trusted Allternit runtime adapters. Weights are downloaded from the publisher or imported by the user.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {localCatalog.map((manifest) => (
            <div key={manifest.id} className="rounded-xl border border-[var(--border-subtle)] p-4 bg-secondary/10">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{manifest.name}</div>
                  <div className="mt-1 text-xs text-[var(--text-tertiary)]">{manifest.description}</div>
                </div>
                <span className="shrink-0 rounded bg-[var(--accent-primary)]/10 px-2 py-1 text-[10px] font-bold uppercase text-[var(--accent-primary)]">
                  {manifest.delivery.status === 'integrated' ? 'ready' : 'not installed'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {manifest.runtimes.map((runtime) => (
                  <span key={`${manifest.id}-${runtime.engine}`} className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                    {runtime.engine}
                  </span>
                ))}
                {manifest.requirements?.estimatedDownloadBytes ? (
                  <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">
                    {(manifest.requirements.estimatedDownloadBytes / 1_000_000_000).toFixed(1)} GB
                  </span>
                ) : null}
              </div>
              {manifest.delivery.note ? (
                <p className="mt-3 text-[10px] leading-relaxed text-[var(--text-tertiary)]">{manifest.delivery.note}</p>
              ) : null}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)]">
          Security details are documented in <code>docs/LOCAL_FIRST_MODELS_AND_PRIVATE_BRAIN.md</code>.
        </p>
      </div>

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
                  <div className="size-10  rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                    <Cpu size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-primary)]">{model.name}</span>
                      {model.details?.quantization_level && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 uppercase font-bold">
                          {model.details.quantization_level}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-tertiary)] font-medium">
                      <span className="flex items-center gap-1">
                        <HardDrives size={12} /> {formatSize(model.size)}
                      </span>
                      {model.details?.parameter_size && (
                        <>
                          <span>•</span>
                          <span>{model.details.parameter_size} parameters</span>
                        </>
                      )}
                      {model.details?.family && (
                        <>
                          <span>•</span>
                          <span>{model.details.family}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity">
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
