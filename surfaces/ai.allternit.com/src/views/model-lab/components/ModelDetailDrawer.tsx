'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  ArrowDown,
  Heart,
  Memory,
  Tag,
  DownloadSimple,
  Globe,
  CheckCircle,
  Cube,
  ArrowsClockwise,
  Warning,
  Plugs,
  ChatTeardropText,
  CircleNotch,
  Play,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { HuggingFaceModel, HuggingFaceModelDetails, RuntimeRecipe, ModelAssessment, EngineStatus } from '@/lib/model-lab/api';
import { fetchHuggingFaceModelDetails, assessModel } from '@/lib/model-lab/api';
import { useBrowserStore } from '@/capsules/browser';
import { useModelLabStore } from '@/lib/model-lab/store';
import { usePendingChatModelStore } from '@/stores/pending-chat-model.store';
import { cn } from '@/lib/utils';

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function makeRecipe(modelPath: string): RuntimeRecipe {
  return { backend: 'llama_cpp', model_path: modelPath, n_gpu_layers: -1, n_ctx: 4096 };
}

function formatSizeGB(repoId: string, sizeBytes?: number): string {
  if (sizeBytes !== undefined && sizeBytes > 0) {
    return `${(sizeBytes / 1024 ** 3).toFixed(1)} GB`;
  }

  const lower = repoId.toLowerCase();
  const paramMatch = lower.match(/(\d+(?:\.\d+)?)\s*b/);
  if (!paramMatch) return '—';
  const params = parseFloat(paramMatch[1]);
  if (!Number.isFinite(params) || params <= 0) return '—';

  let bytesPerParam = 0.6;
  if (lower.includes('q2_k')) bytesPerParam = 0.31;
  else if (lower.includes('q3_k')) bytesPerParam = 0.39;
  else if (lower.includes('q4_k')) bytesPerParam = 0.6;
  else if (lower.includes('q5_k')) bytesPerParam = 0.72;
  else if (lower.includes('q6_k')) bytesPerParam = 0.86;
  else if (lower.includes('q8_0')) bytesPerParam = 1.0;
  else if (lower.includes('fp16') || lower.includes('bf16')) bytesPerParam = 2.0;
  else if (lower.includes('fp32')) bytesPerParam = 4.0;

  return `~${(params * bytesPerParam).toFixed(1)} GB`;
}

function fitBadgeClass(fit: string): string {
  switch (fit) {
    case 'fits':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'tight':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'no':
      return 'bg-red-500/10 text-red-500 border-red-500/20';
    default:
      return 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-subtle)]';
  }
}

function hardwareSummary(status: EngineStatus | null): string {
  if (!status) return 'Hardware not detected';
  const gpu = status.gpu?.[0];
  const totalGB = ((gpu?.memory_total_mb ?? status.ram.total_mb) / 1024).toFixed(1);
  if (status.apple_chip) {
    return `${status.apple_chip} · ${totalGB} GB unified memory`;
  }
  if (gpu?.name) {
    return `${gpu.name} · ${totalGB} GB`;
  }
  return `${status.cpu.model} · ${totalGB} GB RAM`;
}

interface ModelDetailDrawerProps {
  model: HuggingFaceModel | null;
  installing: boolean;
  onClose: () => void;
  onDownload: (repoId: string) => void;
}

export function ModelDetailDrawer({
  model,
  installing,
  onClose,
  onDownload,
}: ModelDetailDrawerProps): React.ReactNode {
  const { addTab } = useBrowserStore();
  const {
    engineModels,
    engineStatus,
    launchRuntime,
    registerEngineAsBrain,
    brainRegisterLoading,
    brainRegisterError,
    brainRegisterLastProvider,
  } = useModelLabStore();
  const [details, setDetails] = useState<HuggingFaceModelDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [assessment, setAssessment] = useState<ModelAssessment | null>(null);
  const [assessmentLoading, setAssessmentLoading] = useState(false);

  useEffect(() => {
    if (!model) {
      setDetails(null);
      setAssessment(null);
      return;
    }
    setLoading(true);
    setAssessmentLoading(true);
    setError(null);
    fetchHuggingFaceModelDetails(model.repoId)
      .then((d) => {
        setDetails(d);
        if (!d) setError('Could not load model details from Hugging Face.');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load details'))
      .finally(() => setLoading(false));

    assessModel(model.repoId)
      .then((a) => setAssessment(a))
      .catch(() => setAssessment(null))
      .finally(() => setAssessmentLoading(false));
  }, [model]);

  if (!model) return null;

  const openOnHuggingFace = () => {
    addTab(`https://huggingface.co/${model.repoId}`, model.repoId);
  };

  const cachedModel = engineModels.find(
    (m) =>
      m.name === model.repoId ||
      m.path === model.repoId ||
      m.path.includes(model.repoId) ||
      m.name.toLowerCase().includes(model.repoId.toLowerCase())
  );
  const isCached = Boolean(cachedModel);
  const isReady = cachedModel?.status === 'ready';

  const setLoadingKey = (key: string, value: boolean) => {
    setActionLoading((prev) => ({ ...prev, [key]: value }));
  };

  const handleRegister = async () => {
    setLoadingKey('register', true);
    try {
      await registerEngineAsBrain();
    } finally {
      setLoadingKey('register', false);
    }
  };

  const handleChat = async () => {
    setLoadingKey('chat', true);
    try {
      if (cachedModel && isReady) {
        await launchRuntime(cachedModel.id, makeRecipe(cachedModel.path));
      }
      usePendingChatModelStore.getState().setPending({
        providerId: 'allternit-local-engine',
        profileId: 'allternit-local-engine',
        modelId: cachedModel?.name ?? model.repoId,
        modelName: cachedModel?.name ?? model.repoId,
      });
    } finally {
      setLoadingKey('chat', false);
    }
  };

  const author = details?.author ?? model.repoId.split('/')[0] ?? '';
  const isOfficial = details?.isOfficial ?? false;
  const description = details?.description;
  const tags = details?.tags ?? model.tags ?? [];
  const downloads = details?.downloads ?? model.downloads;
  const likes = details?.likes ?? model.likes;
  const pipelineTag = details?.pipeline_tag ?? model.pipeline_tag;
  const size = formatSizeGB(model.repoId, model.sizeBytes);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[var(--bg-elevated)] border-l border-[var(--border-subtle)] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 z-10 size-8 rounded-full bg-[var(--bg-secondary)]/80 border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={16} />
          </button>

          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="size-20 rounded-2xl border-2 border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-center overflow-hidden shadow-sm">
              {details?.avatarUrl ? (
                <img
                  src={details.avatarUrl}
                  alt={author}
                  className="size-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <Cube size={36} weight="duotone" className="text-[var(--accent-primary)]" />
              )}
            </div>
            <div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">{author}</span>
                {isOfficial && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] uppercase tracking-wide bg-blue-500/10 text-blue-500 border border-blue-500/20"
                  >
                    <CheckCircle size={10} weight="fill" className="mr-1" />
                    Official
                  </Badge>
                )}
              </div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] leading-tight mt-0.5">
                {model.repoId.split('/').slice(1).join('/') || model.repoId}
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {error && (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-sm text-amber-500 flex items-start gap-2">
              <Warning size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-[var(--text-secondary)]">
              <ArrowsClockwise size={16} className="animate-spin" />
              Loading model details…
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatBox icon={<ArrowDown size={16} />} label="Downloads" value={formatCount(downloads)} />
            <StatBox icon={<Heart size={16} />} label="Likes" value={formatCount(likes)} />
            <StatBox icon={<Memory size={16} />} label="Size" value={size} />
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            {pipelineTag && (
              <Badge variant="secondary" className="text-[11px]">
                {pipelineTag}
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px]">
              GGUF
            </Badge>
          </div>

          {/* On your machine */}
          <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">On your machine</h3>
              <span className="text-[11px] text-[var(--text-tertiary)]">{hardwareSummary(engineStatus)}</span>
            </div>

            {assessmentLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <ArrowsClockwise size={14} className="animate-spin" />
                Estimating fit…
              </div>
            ) : assessment ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn('text-[11px] capitalize border', fitBadgeClass(assessment.fit))}
                    title={assessment.fit_reason}
                  >
                    {assessment.fit === 'fits' ? 'Fits' : assessment.fit === 'tight' ? 'Tight' : 'Too big'}
                  </Badge>
                  <Badge variant="outline" className="text-[11px] capitalize">
                    {assessment.confidence}
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">
                    {assessment.recommended_backend}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StatBox
                    icon={<Memory size={16} />}
                    label="Download size"
                    value={`${(assessment.estimated_download_bytes / 1024 ** 3).toFixed(1)} GB`}
                  />
                  <StatBox
                    icon={<Memory size={16} />}
                    label="Loaded (4K ctx)"
                    value={`${(assessment.estimated_loaded_bytes / 1024 ** 3).toFixed(1)} GB`}
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)]">Estimated decode speed</p>
                  <div className="grid grid-cols-4 gap-2">
                    <TokBox label="4K" value={assessment.estimated_tok_per_second.context_4k} />
                    <TokBox label="8K" value={assessment.estimated_tok_per_second.context_8k} />
                    <TokBox label="16K" value={assessment.estimated_tok_per_second.context_16k} />
                    <TokBox label="32K" value={assessment.estimated_tok_per_second.context_32k} />
                  </div>
                </div>

                <p className="text-[11px] text-[var(--text-tertiary)]">{assessment.fit_reason}</p>
              </div>
            ) : (
              <p className="text-xs text-[var(--text-tertiary)]">Could not estimate fit for this model.</p>
            )}
          </div>

          {/* Description */}
          {description ? (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">About</h3>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-line">
                {description}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">About</h3>
              <p className="text-sm text-[var(--text-tertiary)] italic">
                No description available from Hugging Face.
              </p>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <Tag size={14} />
                Tags
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {tags.slice(0, 20).map((t) => (
                  <span
                    key={t}
                    className="text-[11px] px-2 py-0.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-2">
          {brainRegisterError && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-red-500 flex items-start gap-2">
              <Warning size={14} className="shrink-0 mt-0.5" />
              {brainRegisterError}
            </div>
          )}

          {brainRegisterLastProvider && !brainRegisterError && (
            <div className="p-3 rounded-lg border border-green-500/30 bg-green-500/5 text-xs text-green-500 flex items-start gap-2">
              <CheckCircle size={14} weight="fill" className="shrink-0 mt-0.5" />
              Added to Brain as <code className="ml-1">{brainRegisterLastProvider}</code>
            </div>
          )}

          <Button
            className="w-full"
            disabled={installing}
            onClick={() => onDownload(model.repoId)}
          >
            {installing ? (
              <>
                <ArrowsClockwise size={16} className="animate-spin mr-2" />
                Downloading…
              </>
            ) : (
              <>
                <DownloadSimple size={16} className="mr-2" />
                {isCached ? 'Re-download model' : 'Download model'}
              </>
            )}
          </Button>

          {isCached && (
            <>
              <Button
                variant="outline"
                className="w-full"
                disabled={brainRegisterLoading || actionLoading['register']}
                onClick={() => void handleRegister()}
              >
                {actionLoading['register'] ? (
                  <CircleNotch size={16} className="animate-spin mr-2" />
                ) : (
                  <Plugs size={16} className="mr-2" />
                )}
                Add to Brain
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={!isReady || actionLoading['chat']}
                onClick={() => void handleChat()}
              >
                {actionLoading['chat'] ? (
                  <CircleNotch size={16} className="animate-spin mr-2" />
                ) : (
                  <ChatTeardropText size={16} className="mr-2" />
                )}
                Chat with this model
              </Button>
            </>
          )}

          <Button variant="outline" className="w-full" onClick={openOnHuggingFace}>
            <Globe size={16} className="mr-2" />
            Open model card in ACI
          </Button>
        </div>
      </div>
    </>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 text-center">
      <div className="flex justify-center text-[var(--accent-primary)] mb-1">{icon}</div>
      <div className="text-sm font-semibold text-[var(--text-primary)]">{value}</div>
      <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function TokBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-center">
      <div className="text-sm font-semibold text-[var(--text-primary)]">{value.toFixed(1)}</div>
      <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wide">{label}</div>
    </div>
  );
}

export default ModelDetailDrawer;
