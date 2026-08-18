'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  MagnifyingGlass,
  DownloadSimple,
  Heart,
  ArrowDown,
  Tag,
  Cube,
  ArrowsClockwise,
  Brain,
  HardDrives,
  Play,
  Rocket,
  FolderOpen,
  Warning,
  CircleNotch,
  Memory,
  CheckCircle,
  Plugs,
  ChatTeardropText,
} from '@phosphor-icons/react';
import { useModelLabStore, useModelLabCatalogStore } from '@/lib/model-lab/store';
import type { CachedModel, RuntimeRecipe, RuntimeRecipeType, HuggingFaceModel, ModelAssessment, Recommendation } from '@/lib/model-lab/api';
import { installHuggingFaceModel, assessModel, recommendModels } from '@/lib/model-lab/api';
import { usePendingChatModelStore } from '@/stores/pending-chat-model.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ModelCard } from './components/ModelCard';
import { ModelDetailDrawer } from './components/ModelDetailDrawer';
import { cn } from '@/lib/utils';

type SortOption = 'downloads' | 'likes' | 'recent' | 'recommended';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'downloads', label: 'Most downloads' },
  { value: 'likes', label: 'Most likes' },
  { value: 'recent', label: 'Recently updated' },
  { value: 'recommended', label: 'Recommended for this machine' },
];

const FIT_OPTIONS: { value: 'all' | Fit; label: string }[] = [
  { value: 'all', label: 'All fits' },
  { value: 'fits', label: 'Fits comfortably' },
  { value: 'tight', label: 'Tight fit' },
  { value: 'no', label: 'Too big' },
];

const BACKEND_OPTIONS: { value: RuntimeRecipeType; label: string }[] = [
  { value: 'vllm', label: 'vLLM' },
  { value: 'sglang', label: 'SGLang' },
  { value: 'llama_cpp', label: 'llama.cpp' },
  { value: 'mlx', label: 'MLX' },
];

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function backendLabel(backend: RuntimeRecipeType): string {
  return BACKEND_OPTIONS.find((o) => o.value === backend)?.label ?? backend;
}

function makeRecipe(backend: RuntimeRecipeType, modelPath: string): RuntimeRecipe {
  switch (backend) {
    case 'vllm':
      return { backend: 'vllm', model_path: modelPath };
    case 'sglang':
      return { backend: 'sglang', model_path: modelPath };
    case 'llama_cpp':
      return { backend: 'llama_cpp', model_path: modelPath, n_gpu_layers: -1, n_ctx: 4096 };
    case 'mlx':
      return { backend: 'mlx', model_path: modelPath };
  }
}

function isCached(repoId: string, models: CachedModel[]): CachedModel | undefined {
  return models.find(
    (m) =>
      m.name === repoId ||
      m.path === repoId ||
      m.path.includes(repoId) ||
      m.name.toLowerCase().includes(repoId.toLowerCase())
  );
}

/**
 * Estimate model download size from the repo name.
 * Parses parameter count (e.g. 7B, 30B) and quantization (Q4_K_M, Q8_0)
 * to produce an approximate GB value.
 */
function estimateModelSize(repoId: string): number | undefined {
  const lower = repoId.toLowerCase();
  const paramMatch = lower.match(/(\d+(?:\.\d+)?)\s*b/);
  if (!paramMatch) return undefined;
  const params = parseFloat(paramMatch[1]);
  if (!Number.isFinite(params) || params <= 0) return undefined;

  let bytesPerParam = 0.6; // Q4_K_M default
  if (lower.includes('q2_k')) bytesPerParam = 0.31;
  else if (lower.includes('q3_k')) bytesPerParam = 0.39;
  else if (lower.includes('q4_k')) bytesPerParam = 0.6;
  else if (lower.includes('q5_k')) bytesPerParam = 0.72;
  else if (lower.includes('q6_k')) bytesPerParam = 0.86;
  else if (lower.includes('q8_0')) bytesPerParam = 1.0;
  else if (lower.includes('fp16') || lower.includes('bf16')) bytesPerParam = 2.0;
  else if (lower.includes('fp32')) bytesPerParam = 4.0;

  return (params * bytesPerParam);
}

function formatSizeGB(repoId: string, sizeBytes?: number): string {
  if (sizeBytes !== undefined && sizeBytes > 0) {
    return `${(sizeBytes / 1024 ** 3).toFixed(1)} GB`;
  }
  const est = estimateModelSize(repoId);
  return est !== undefined ? `~${est.toFixed(1)} GB` : '—';
}

function estimateModelSizeBytes(repoId: string, sizeBytes?: number): number | undefined {
  if (sizeBytes !== undefined && sizeBytes > 0) return sizeBytes;
  const est = estimateModelSize(repoId);
  return est !== undefined ? est * 1_000_000_000 : undefined;
}

type Fit = 'fits' | 'tight' | 'no';

function computeHardwareFit(
  repoId: string,
  sizeBytes: number | undefined,
  totalMemoryBytes?: number
): { fit: Fit; reason: string } {
  if (!totalMemoryBytes || totalMemoryBytes <= 0) {
    return { fit: 'no', reason: 'Hardware memory not detected' };
  }
  const modelBytes = estimateModelSizeBytes(repoId, sizeBytes);
  if (!modelBytes) {
    return { fit: 'tight', reason: 'Model size unknown; verify before loading' };
  }
  // Allow ~1.5x headroom for activations / context.
  const required = modelBytes * 1.5;
  if (required <= totalMemoryBytes * 0.6) return { fit: 'fits', reason: 'Fits comfortably in available memory' };
  if (required <= totalMemoryBytes * 0.9) return { fit: 'tight', reason: 'May fit with reduced context' };
  return { fit: 'no', reason: 'Likely exceeds available memory' };
}

function fitBadgeClass(fit: Fit): string {
  switch (fit) {
    case 'fits':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'tight':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'no':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
  }
}

const OFFICIAL_HF_ORGS = new Set([
  'meta-llama',
  'microsoft',
  'google',
  'google-deepmind',
  'openai',
  'anthropic',
  'stabilityai',
  'allenai',
  'tiiuae',
  'nvidia',
  'mistralai',
  'Qwen',
  'unsloth',
  'princeton-nlp',
  'EleutherAI',
  'baichuan-inc',
  '01-ai',
  'cerebras',
  'databricks',
  'NousResearch',
]);

function ModelCardItem({
  model,
  installing,
  onDownload,
  onSelect,
  fit,
  assessment,
}: {
  model: HuggingFaceModel;
  installing: boolean;
  onDownload: (repoId: string) => void;
  onSelect: (model: HuggingFaceModel) => void;
  fit: { fit: Fit; reason: string };
  assessment?: ModelAssessment;
}) {
  const tags = (model.tags ?? []).slice(0, 3);
  const size = assessment
    ? `${(assessment.estimated_download_bytes / 1024 ** 3).toFixed(1)} GB`
    : formatSizeGB(model.repoId, model.sizeBytes);
  const tokPerSec = assessment?.estimated_tok_per_second.context_4k;
  const confidence = assessment?.confidence ?? 'guess';
  const backend = assessment?.recommended_backend ?? 'llama.cpp';
  const parts = model.repoId.split('/');
  const author = parts[0] ?? '';
  const name = parts.slice(1).join('/') || model.repoId;
  const isOfficial = OFFICIAL_HF_ORGS.has(author);
  const avatarUrl = author ? `https://huggingface.co/${encodeURIComponent(author)}/avatar` : null;

  return (
    <ModelCard className="flex flex-col overflow-hidden h-full cursor-pointer" hover onClick={() => onSelect(model)}>
      {/* Header — profile-first card preview */}
      <div className="relative h-32 sm:h-36 overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="size-16 sm:size-20 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden shadow-sm">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={author}
                className="size-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <div className="size-full flex items-center justify-center text-[var(--accent-primary)]">
                <Cube size={28} weight="duotone" />
              </div>
            )}
          </div>
        </div>

        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5 max-w-[calc(100%-1rem)]">
          {model.pipeline_tag && (
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-wide bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] truncate"
            >
              {model.pipeline_tag}
            </Badge>
          )}
        </div>

        <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
          {isOfficial && (
            <Badge
              variant="secondary"
              className="text-[10px] uppercase tracking-wide bg-blue-500/10 text-blue-500 border border-blue-500/20"
            >
              Official
            </Badge>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-3 sm:p-4 gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[var(--text-tertiary)] truncate">{author}</p>
          <h3 className="text-[15px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
            {name}
          </h3>
        </div>

        {/* Hardware fit / size / perf — in body flow so they never overlap the header or title */}
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-1 rounded-full border border-[var(--border-subtle)]">
            <Memory size={11} />
            {size}
          </div>
          {tokPerSec !== undefined && (
            <div className="inline-flex items-center gap-1 text-[11px] text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-2 py-1 rounded-full border border-[var(--border-subtle)]">
              {tokPerSec.toFixed(1)} tok/s
            </div>
          )}
          <Badge
            variant="secondary"
            className={cn('text-[10px] capitalize border', fitBadgeClass(fit.fit))}
            title={fit.reason}
          >
            {fit.fit === 'fits' ? 'Fits' : fit.fit === 'tight' ? 'Tight' : 'Too big'}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] capitalize"
            title={`Confidence: ${confidence}. Recommended backend: ${backend}.`}
          >
            {confidence}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
          <span className="inline-flex items-center gap-1">
            <ArrowDown size={12} />
            {formatCount(model.downloads)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Heart size={12} />
            {formatCount(model.likes)}
          </span>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-[4px]" />

        <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onDownload(model.repoId);
            }}
            disabled={installing}
          >
            {installing ? (
              <>
                <ArrowsClockwise size={14} className="animate-spin mr-1.5" />
                Downloading
              </>
            ) : (
              <>
                <DownloadSimple size={14} className="mr-1.5" />
                Download
              </>
            )}
          </Button>
        </div>
      </div>
    </ModelCard>
  );
}

export function CatalogPanel(): React.ReactNode {
  const {
    engineModels,
    engineStatus,
    engineLoading,
    engineError,
    refreshEngineState,
    importModel,
    downloadModel,
    launchRuntime,
    registerEngineAsBrain,
    brainRegisterLoading,
    brainRegisterError,
    brainRegisterLastProvider,
  } = useModelLabStore();

  const {
    query,
    setQuery,
    sort,
    setSort,
    results,
    loading: searchLoading,
    error: searchError,
    searched,
    search,
    installQueue,
    markInstalling,
    markInstallDone,
  } = useModelLabCatalogStore();

  const [importPath, setImportPath] = useState('');
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [selectedBackend, setSelectedBackend] = useState<Record<string, RuntimeRecipeType>>({});
  const [selectedModel, setSelectedModel] = useState<HuggingFaceModel | null>(null);
  const [fitFilter, setFitFilter] = useState<'all' | Fit>('all');
  const [assessments, setAssessments] = useState<Record<string, ModelAssessment>>({});
  const [recommendedResults, setRecommendedResults] = useState<HuggingFaceModel[]>([]);
  const [recommendedAssessments, setRecommendedAssessments] = useState<Record<string, ModelAssessment>>({});
  const [recommendedLoading, setRecommendedLoading] = useState(false);

  // Prefer Apple Silicon unified memory for fit scoring; otherwise use system RAM.
  const gpu = engineStatus?.gpu?.[0];
  const isAppleUnified = gpu?.name?.toLowerCase().includes('apple');
  const totalMemoryBytes = isAppleUnified
    ? (gpu?.memory_total_mb ?? 0) * 1024 * 1024
    : (engineStatus?.ram?.total_bytes ?? 0);

  useEffect(() => {
    void refreshEngineState();
  }, [refreshEngineState]);

  // Fetch dynamic assessments for the current search result set.
  useEffect(() => {
    if (sort === 'recommended') return;
    if (results.length === 0) {
      setAssessments({});
      return;
    }

    let cancelled = false;
    async function load() {
      const next: Record<string, ModelAssessment> = {};
      for (const model of results) {
        if (cancelled) return;
        try {
          const assessment = await assessModel(model.repoId);
          next[model.repoId] = assessment;
        } catch {
          // Ignore per-model assessment failures.
        }
      }
      if (!cancelled) setAssessments(next);
    }
    void load();
    return () => { cancelled = true; };
  }, [results, sort]);

  // When the user chooses "Recommended", fetch server-side recommendations.
  useEffect(() => {
    if (sort !== 'recommended') {
      setRecommendedResults([]);
      setRecommendedAssessments({});
      return;
    }

    let cancelled = false;
    setRecommendedLoading(true);
    async function load() {
      try {
        const { recommendations } = await recommendModels('balanced', 20);
        const filtered = query.trim()
          ? recommendations.filter((r) =>
              r.repo_id.toLowerCase().includes(query.trim().toLowerCase())
            )
          : recommendations;

        const models: HuggingFaceModel[] = [];
        const assess: Record<string, ModelAssessment> = {};
        for (const r of filtered) {
          const hf: HuggingFaceModel = {
            repoId: r.repo_id,
            downloads: r.downloads,
            likes: r.likes,
            tags: [],
            pipeline_tag: 'text-generation',
            sizeBytes: r.estimated_download_bytes,
          };
          models.push(hf);
          assess[r.repo_id] = {
            repo_id: r.repo_id,
            fit: r.fit,
            fit_reason: r.fit_reason,
            estimated_download_bytes: r.estimated_download_bytes,
            estimated_loaded_bytes: r.estimated_loaded_bytes,
            estimated_tok_per_second: r.estimated_tok_per_second,
            recommended_backend: r.recommended_backend,
            confidence: r.confidence,
            quantization_bits: 0,
            hardware_id: '',
          };
        }
        if (!cancelled) {
          setRecommendedResults(models);
          setRecommendedAssessments(assess);
        }
      } catch (e) {
        if (!cancelled) {
          setRecommendedResults([]);
          setRecommendedAssessments({});
        }
      } finally {
        if (!cancelled) setRecommendedLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sort, query]);

  const activeResults = sort === 'recommended' ? recommendedResults : results;
  const activeAssessments = sort === 'recommended' ? recommendedAssessments : assessments;

  const scoredModels = useMemo(
    () =>
      activeResults.map((m) => ({
        model: m,
        assessment: activeAssessments[m.repoId],
        fit: activeAssessments[m.repoId]
          ? { fit: activeAssessments[m.repoId].fit, reason: activeAssessments[m.repoId].fit_reason }
          : computeHardwareFit(m.repoId, m.sizeBytes, totalMemoryBytes),
      })),
    [activeResults, activeAssessments, totalMemoryBytes]
  );

  const sorted = useMemo(() => {
    let list = [...scoredModels];
    if (sort === 'downloads') list.sort((a, b) => b.model.downloads - a.model.downloads);
    else if (sort === 'likes') list.sort((a, b) => b.model.likes - a.model.likes);
    else if (sort === 'recent') {
      list.sort((a, b) =>
        String(b.model.lastModified ?? '').localeCompare(String(a.model.lastModified ?? ''))
      );
    }
    if (fitFilter !== 'all') {
      list = list.filter((item) => item.fit.fit === fitFilter);
    }
    return list;
  }, [scoredModels, sort, fitFilter]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') search();
    },
    [search]
  );

  const handleDownload = useCallback(
    async (repoId: string) => {
      if (installQueue.has(repoId)) return;
      markInstalling(repoId);
      try {
        const res = await installHuggingFaceModel(repoId);
        if (!res.ok || !res.body) {
          markInstallDone(repoId);
          return;
        }
        const reader = res.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch {
        // surface-level: just clear the installing flag
      } finally {
        markInstallDone(repoId);
      }
    },
    [installQueue, markInstalling, markInstallDone]
  );

  const setLoading = (key: string, loading: boolean) => {
    setActionLoading((prev) => ({ ...prev, [key]: loading }));
  };

  const handleImport = async () => {
    if (!importPath.trim()) return;
    setLoading('import', true);
    try {
      await importModel(importPath.trim());
      setImportPath('');
    } finally {
      setLoading('import', false);
    }
  };

  const handleDownloadCached = async (repoId: string) => {
    setLoading(`download:${repoId}`, true);
    try {
      await downloadModel(repoId);
      await refreshEngineState();
    } finally {
      setActionLoading((prev) => ({ ...prev, [`download:${repoId}`]: false }));
    }
  };

  const handleLaunchCached = async (model: CachedModel) => {
    const backend = selectedBackend[model.id] ?? model.recipe?.backend ?? 'llama_cpp';
    setLoading(`launch:${model.id}`, true);
    try {
      await launchRuntime(model.id, makeRecipe(backend, model.path));
    } finally {
      setActionLoading((prev) => ({ ...prev, [`launch:${model.id}`]: false }));
    }
  };

  const handleBackendChange = (modelId: string, backend: string) => {
    setSelectedBackend((prev) => ({ ...prev, [modelId]: backend as RuntimeRecipeType }));
  };

  const handleRegisterCached = async (model: CachedModel) => {
    setLoading(`register:${model.id}`, true);
    try {
      await registerEngineAsBrain();
    } finally {
      setActionLoading((prev) => ({ ...prev, [`register:${model.id}`]: false }));
    }
  };

  const handleChatCached = async (model: CachedModel) => {
    const backend = selectedBackend[model.id] ?? model.recipe?.backend ?? 'llama_cpp';
    setLoading(`chat:${model.id}`, true);
    try {
      if (model.status === 'ready') {
        await launchRuntime(model.id, makeRecipe(backend, model.path));
      }
      usePendingChatModelStore.getState().setPending({
        providerId: 'allternit-local-engine',
        profileId: 'allternit-local-engine',
        modelId: model.name,
        modelName: model.name,
      });
    } finally {
      setActionLoading((prev) => ({ ...prev, [`chat:${model.id}`]: false }));
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Model Catalog</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Search Hugging Face, browse foundation models, and manage your local cache.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refreshEngineState()} disabled={engineLoading}>
          <ArrowsClockwise size={14} className={cn('mr-1.5', engineLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {engineError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <Warning size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-tertiary)] break-words">{engineError}</p>
        </div>
      )}

      {brainRegisterError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <Warning size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Brain registration failed</p>
            <p className="text-xs text-[var(--text-tertiary)] break-words">{brainRegisterError}</p>
          </div>
        </div>
      )}

      {brainRegisterLastProvider && !brainRegisterError && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 flex items-start gap-3">
          <CheckCircle size={18} weight="fill" className="text-green-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Added to Brain</p>
            <p className="text-xs text-[var(--text-tertiary)] break-words">
              Provider <code className="px-1 rounded bg-[var(--bg-elevated)]">{brainRegisterLastProvider}</code> is now available in the model picker.
            </p>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-4">
        <div className="flex items-center gap-2">
          <MagnifyingGlass size={16} className="text-[var(--accent-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Hugging Face search</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-secondary)]"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search Hugging Face models (e.g. llama, mistral, qwen)"
              className="pl-9 bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            />
          </div>
          <Button onClick={() => void search()} disabled={searchLoading || sort === 'recommended' || !query.trim()}>
            {searchLoading ? (
              <ArrowsClockwise size={14} className="animate-spin mr-1.5" />
            ) : (
              <MagnifyingGlass size={14} className="mr-1.5" />
            )}
            Search
          </Button>
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-40 h-10 bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]">
              {SORT_OPTIONS.find((o) => o.value === sort)?.label}
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fitFilter} onValueChange={(v) => setFitFilter(v as 'all' | Fit)}>
            <SelectTrigger className="w-44 h-10 bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]">
              {FIT_OPTIONS.find((o) => o.value === fitFilter)?.label}
            </SelectTrigger>
            <SelectContent>
              {FIT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {searchError && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-sm text-red-500">
            {searchError}
          </div>
        )}

        {!searched && !searchLoading && sort !== 'recommended' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30">
            <Cube size={40} className="text-[var(--text-secondary)] opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">Enter a search term to find models on Hugging Face.</p>
            <p className="text-xs text-[var(--text-secondary)] opacity-70">
              Try <code className="px-1 rounded bg-[var(--bg-elevated)]">llama</code>,{' '}
              <code className="px-1 rounded bg-[var(--bg-elevated)]">mistral</code>, or{' '}
              <code className="px-1 rounded bg-[var(--bg-elevated)]">qwen</code>.
            </p>
          </div>
        )}

        {(searchLoading || recommendedLoading) && (
          <div className="flex items-center justify-center py-12 gap-3">
            <ArrowsClockwise size={18} className="animate-spin text-[var(--accent-primary)]" />
            <span className="text-sm text-[var(--text-secondary)]">
              {sort === 'recommended' ? 'Finding the best models for this machine…' : 'Searching Hugging Face…'}
            </span>
          </div>
        )}

        {searched && !searchLoading && sorted.length === 0 && !searchError && sort !== 'recommended' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30">
            <MagnifyingGlass size={40} className="text-[var(--text-secondary)] opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">No models found for &ldquo;{query}&rdquo;.</p>
            <p className="text-xs text-[var(--text-secondary)] opacity-70">Try a broader term or check your spelling.</p>
          </div>
        )}

        {sort === 'recommended' && !recommendedLoading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30">
            <Cube size={40} className="text-[var(--text-secondary)] opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">No recommended models match{query ? ` &ldquo;${query}&rdquo;` : ''}.</p>
          </div>
        )}

        {sorted.length > 0 && (
          <div className="space-y-4">
            <div className="text-xs px-1 text-[var(--text-secondary)]">
              {sorted.length} result{sorted.length === 1 ? '' : 's'}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {sorted.map(({ model: m, fit }) => (
                <ModelCardItem
                  key={m.repoId}
                  model={m}
                  installing={installQueue.has(m.repoId)}
                  onDownload={handleDownload}
                  onSelect={setSelectedModel}
                  fit={fit}
                  assessment={activeAssessments[m.repoId]}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Local cache */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <HardDrives size={18} className="text-[var(--accent-primary)]" />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Local cache</h3>
        </div>

        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-3">
          <label className="text-xs font-semibold text-[var(--text-primary)] block">
            Import local model path
          </label>
          <div className="flex gap-2">
            <Input
              placeholder="/path/to/local/model"
              value={importPath}
              onChange={(event) => setImportPath(event.target.value)}
              className="flex-1 bg-[var(--bg-elevated)] border-[var(--border-default)]"
            />
            <Button onClick={() => void handleImport()} disabled={!importPath.trim() || actionLoading['import']}>
              {actionLoading['import'] ? (
                <CircleNotch size={14} className="animate-spin mr-1.5" />
              ) : (
                <FolderOpen size={14} className="mr-1.5" />
              )}
              Import
            </Button>
          </div>
        </div>

        {engineLoading && engineModels.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-elevated)]">
            <CircleNotch size={32} className="animate-spin mx-auto text-[var(--text-tertiary)] mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">Loading cached models…</p>
          </div>
        ) : engineModels.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-elevated)]">
            <Brain size={40} className="mx-auto text-[var(--text-tertiary)] opacity-40 mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">No cached models yet.</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">
              Search Hugging Face above or import a local path.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {engineModels.map((model) => {
              const backend = selectedBackend[model.id] ?? model.recipe?.backend ?? 'llama_cpp';
              return (
                <div
                  key={model.id}
                  className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {model.name}
                      </span>
                      <StatusBadge status={model.status} />
                      {model.recipe && (
                        <Badge variant="outline" className="text-[10px]">
                          {backendLabel(model.recipe.backend)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)] truncate mt-0.5">
                      {model.source} • {model.path}
                    </p>
                    {model.status === 'downloading' && (
                      <div className="mt-2">
                        <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[var(--accent-primary)]"
                            style={{
                              width: `${Math.min(
                                100,
                                model.total_bytes ? ((model.downloaded_bytes ?? 0) / model.total_bytes) * 100 : 0
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                          {(model.downloaded_bytes ?? 0).toLocaleString()} / {(model.total_bytes ?? 0).toLocaleString()} bytes
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={backend} onValueChange={(value) => handleBackendChange(model.id, value)}>
                      <SelectTrigger className="w-32 h-9 text-xs bg-[var(--bg-elevated)] border-[var(--border-default)]">
                        {backendLabel(backend)}
                      </SelectTrigger>
                      <SelectContent>
                        {BACKEND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={brainRegisterLoading}
                      onClick={() => void handleRegisterCached(model)}
                      title="Add this model to the platform brain"
                    >
                      {actionLoading[`register:${model.id}`] ? (
                        <CircleNotch size={14} className="animate-spin" />
                      ) : (
                        <Plugs size={14} />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={model.status !== 'ready' || actionLoading[`chat:${model.id}`]}
                      onClick={() => void handleChatCached(model)}
                      title="Chat with this model"
                    >
                      {actionLoading[`chat:${model.id}`] ? (
                        <CircleNotch size={14} className="animate-spin" />
                      ) : (
                        <ChatTeardropText size={14} />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      disabled={model.status !== 'ready' || actionLoading[`launch:${model.id}`]}
                      onClick={() => void handleLaunchCached(model)}
                    >
                      {actionLoading[`launch:${model.id}`] ? (
                        <CircleNotch size={14} className="animate-spin mr-1.5" />
                      ) : (
                        <Play size={14} className="mr-1.5" />
                      )}
                      Launch
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedModel && (
        <ModelDetailDrawer
          model={selectedModel}
          installing={installQueue.has(selectedModel.repoId)}
          onClose={() => setSelectedModel(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CachedModel['status'] }) {
  const isReady = status === 'ready';
  return (
    <Badge variant={isReady ? 'default' : 'secondary'} className="text-[10px] uppercase">
      {status}
    </Badge>
  );
}

export default CatalogPanel;
