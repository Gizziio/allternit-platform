'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  HardDrives,
  Pulse,
  CheckCircle,
  Warning,
  ArrowsClockwise,
  DownloadSimple,
  FolderOpen,
  Play,
  Stop,
  Scales,
  ArrowsMerge,
  ChartBar,
  CircleNotch,
  FileText,
  Brain,
  MagnifyingGlass,
  Plus,
  Gauge,
  Memory,
  Plugs,
  Rocket,
  Trash,
} from '@phosphor-icons/react';
import { useModelLabStore } from '@/lib/model-lab/store';
import type { CachedModel, RuntimeRecipe, RuntimeRecipeType } from '@/lib/model-lab/api';
import { setupApi } from '@/services/setup-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const BACKEND_OPTIONS: { value: RuntimeRecipeType; label: string }[] = [
  { value: 'vllm', label: 'vLLM' },
  { value: 'sglang', label: 'SGLang' },
  { value: 'llama_cpp', label: 'llama.cpp' },
  { value: 'mlx', label: 'MLX' },
];

const QUANT_OPTIONS = ['q4_k_m', 'q5_k_m', 'q8_0', 'bf16', 'fp16'];
const EVAL_TASKS = ['mmlu', 'arc_challenge', 'hellaswag', 'truthfulqa_mc1', 'winogrande'];

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || bytes === 0) return '—';
  const gb = bytes / 1024 ** 3;
  if (gb < 1) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  return `${gb.toFixed(2)} GB`;
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

interface SidecarModel {
  tag: string;
  sizeBytes?: number;
}

export function LocalRuntimePanel(): React.ReactNode {
  const {
    engineHealth,
    engineStatus,
    engineModels,
    engineRuntimes,
    engineLoading,
    engineError,
    refreshEngineState,
    launchRuntime,
    stopRuntime,
    importModel,
    downloadModel,
    createJob,
    jobs,
    registerEngineAsBrain,
    registerSidecarAsBrain,
    brainRegisterLoading,
    brainRegisterError,
    brainRegisterLastProvider,
  } = useModelLabStore();

  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [opSuccess, setOpSuccess] = useState<string | null>(null);

  // Models section
  const [search, setSearch] = useState('');
  const [importPath, setImportPath] = useState('');
  const [downloadRepo, setDownloadRepo] = useState('');
  const [selectedBackend, setSelectedBackend] = useState<Record<string, RuntimeRecipeType>>({});

  // Operations
  const [opModelId, setOpModelId] = useState('');
  const [quantFormat, setQuantFormat] = useState('q4_k_m');
  const [mergeAdapterPath, setMergeAdapterPath] = useState('');
  const [evalTask, setEvalTask] = useState('mmlu');
  const [opError, setOpError] = useState<string | null>(null);

  // Sidecar models + deploy from job + brain registration
  const [sidecarModels, setSidecarModels] = useState<SidecarModel[]>([]);
  const [sidecarLoading, setSidecarLoading] = useState(false);
  const [sidecarError, setSidecarError] = useState<string | null>(null);
  const [deployJobId, setDeployJobId] = useState('');

  const completedJobs = jobs.filter(
    (job) => job.status === 'completed' && Boolean(job.output_model_path)
  );

  const loadSidecarModels = async () => {
    setSidecarLoading(true);
    setSidecarError(null);
    try {
      const result = await setupApi.listLocalModels();
      setSidecarModels(result.models ?? []);
    } catch (error) {
      setSidecarError(error instanceof Error ? error.message : 'Failed to load sidecar models');
    } finally {
      setSidecarLoading(false);
    }
  };

  useEffect(() => {
    void loadSidecarModels();
  }, []);

  useEffect(() => {
    void refreshEngineState();
  }, [refreshEngineState]);

  const filteredModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    return engineModels.filter(
      (m) =>
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.path.toLowerCase().includes(q) ||
        (m.recipe?.backend ?? '').toLowerCase().includes(q)
    );
  }, [engineModels, search]);

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

  const handleDownload = async () => {
    if (!downloadRepo.trim()) return;
    setLoading('download', true);
    try {
      await downloadModel(downloadRepo.trim());
      setDownloadRepo('');
    } finally {
      setLoading('download', false);
    }
  };

  const handleLaunch = async (model: CachedModel) => {
    const backend = selectedBackend[model.id] ?? model.recipe?.backend ?? 'llama_cpp';
    setLoading(`launch:${model.id}`, true);
    try {
      await launchRuntime(model.id, makeRecipe(backend, model.path));
    } finally {
      setActionLoading((prev) => ({ ...prev, [`launch:${model.id}`]: false }));
    }
  };

  const handleStop = async (runtimeId: string) => {
    setLoading(`stop:${runtimeId}`, true);
    try {
      await stopRuntime(runtimeId);
    } finally {
      setActionLoading((prev) => ({ ...prev, [`stop:${runtimeId}`]: false }));
    }
  };

  const submitOp = async (type: 'export' | 'merge' | 'evaluation') => {
    setOpError(null);
    setOpSuccess(null);
    if (!opModelId.trim()) {
      setOpError('Select or enter a model ID.');
      return;
    }
    setLoading(`op:${type}`, true);
    try {
      await createJob({
        model_id: opModelId.trim(),
        type,
        metadata: {
          source: 'local_runtime_panel',
          quant_format: type === 'export' ? quantFormat : undefined,
          adapter_path: type === 'merge' ? mergeAdapterPath || undefined : undefined,
          eval_task: type === 'evaluation' ? evalTask : undefined,
        },
      });
      setOpSuccess(`${type === 'export' ? 'Quantization' : type === 'merge' ? 'Merge' : 'Evaluation'} job queued. Track it in Train › Jobs.`);
      window.setTimeout(() => setOpSuccess(null), 5000);
    } catch (error) {
      setOpError(error instanceof Error ? error.message : 'Failed to create job');
    } finally {
      setLoading(`op:${type}`, false);
    }
  };

  const handleDeployJob = async () => {
    const job = completedJobs.find((j) => j.id === deployJobId);
    if (!job?.output_model_path) return;
    setLoading('deploy', true);
    try {
      await importModel(job.output_model_path, job.model_id);
      setDeployJobId('');
    } finally {
      setActionLoading((prev) => ({ ...prev, deploy: false }));
    }
  };

  const handleRegisterEngine = async () => {
    setLoading('register-engine', true);
    try {
      await registerEngineAsBrain();
    } finally {
      setActionLoading((prev) => ({ ...prev, ['register-engine']: false }));
    }
  };

  const handleRegisterSidecar = async () => {
    setLoading('register-sidecar', true);
    try {
      await registerSidecarAsBrain(sidecarModels);
    } finally {
      setActionLoading((prev) => ({ ...prev, ['register-sidecar']: false }));
    }
  };

  const gpu = engineStatus?.gpu?.[0];
  const isAppleUnified = gpu?.name?.toLowerCase().includes('apple');
  const gpuMemoryUsed = (gpu?.memory_used_mb ?? 0) * 1024 * 1024;
  const gpuMemoryTotal = (gpu?.memory_total_mb ?? 1) * 1024 * 1024;
  const ramUsed = engineStatus?.ram?.used_bytes ?? 0;
  const ramTotal = engineStatus?.ram?.total_bytes ?? 1;
  const diskUsed = engineStatus?.disk?.used_bytes ?? 0;
  const diskTotal = engineStatus?.disk?.total_bytes ?? 1;
  const engineHealthy = engineHealth?.status === 'ok';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Engine</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Telemetry, local cache, runtimes, and operations for open-weights inference.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRegisterEngine()}
            disabled={brainRegisterLoading || engineModels.length === 0}
          >
            {actionLoading['register-engine'] ? (
              <CircleNotch size={14} className="animate-spin mr-1.5" />
            ) : (
              <Plugs size={14} className="mr-1.5" />
            )}
            Add Engine to Brain
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleRegisterSidecar()}
            disabled={brainRegisterLoading || sidecarModels.length === 0}
          >
            {actionLoading['register-sidecar'] ? (
              <CircleNotch size={14} className="animate-spin mr-1.5" />
            ) : (
              <Plugs size={14} className="mr-1.5" />
            )}
            Add Sidecar to Brain
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refreshEngineState()}
            disabled={engineLoading}
          >
            <ArrowsClockwise size={14} className={cn('mr-1.5', engineLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

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

      {engineError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <Warning size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-tertiary)] break-words">{engineError}</p>
        </div>
      )}

      {opError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <Warning size={18} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-tertiary)] break-words">{opError}</p>
        </div>
      )}

      {opSuccess && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 flex items-start gap-3">
          <CheckCircle size={18} weight="fill" className="text-green-500 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--text-tertiary)] break-words">{opSuccess}</p>
        </div>
      )}

      {/* Telemetry */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Gauge size={16} className="text-[var(--accent-primary)]" />
          Telemetry
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <StatusCard
            icon={<Pulse size={18} />}
            label="Health"
            value={engineHealthy ? 'Healthy' : 'Unavailable'}
            status={engineHealthy ? 'ok' : 'warn'}
          />
          <StatusCard
            icon={<Cpu size={18} />}
            label="CPU"
            value={engineStatus?.cpu?.model ?? 'Unknown'}
            sub={`${engineStatus?.cpu?.cores ?? 0} cores • ${engineStatus?.cpu?.threads ?? 0} threads`}
            status="ok"
          />
          <MetricCard
            icon={<Memory size={18} />}
            label="RAM"
            value={`${formatBytes(ramUsed)} / ${formatBytes(ramTotal)}`}
            progress={ramTotal ? (ramUsed / ramTotal) * 100 : 0}
          />
          <MetricCard
            icon={<Cpu size={18} />}
            label={isAppleUnified ? 'Unified GPU' : 'GPU'}
            value={gpu?.name ?? 'Not detected'}
            sub={`${formatBytes(gpuMemoryUsed)} / ${formatBytes(gpuMemoryTotal)}`}
            progress={gpuMemoryTotal ? (gpuMemoryUsed / gpuMemoryTotal) * 100 : 0}
          />
          <MetricCard
            icon={<HardDrives size={18} />}
            label="Disk"
            value={`${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}`}
            progress={diskTotal ? (diskUsed / diskTotal) * 100 : 0}
          />
          <StatusCard
            icon={<Brain size={18} />}
            label="Models"
            value={`${engineStatus?.cached_models ?? engineModels.length}`}
            sub="cached"
            status="ok"
          />
          <StatusCard
            icon={<Play size={18} />}
            label="Runtimes"
            value={`${engineRuntimes.length} active`}
            status={engineRuntimes.length > 0 ? 'ok' : 'warn'}
          />
        </div>
      </section>

      {/* Active runtimes */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Play size={16} className="text-[var(--accent-primary)]" />
          Active runtimes
        </h3>
        <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          {engineRuntimes.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-[var(--border-subtle)] rounded-xl bg-[var(--bg-secondary)]/30">
              <Play size={32} className="mx-auto text-[var(--text-tertiary)] opacity-40 mb-2" />
              <p className="text-sm text-[var(--text-secondary)]">No runtimes running.</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Launch a model from the Model cache below.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {engineRuntimes.map((runtime) => (
                <div
                  key={runtime.id}
                  className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{runtime.model_id}</span>
                      <Badge variant="outline" className="text-[10px]">{backendLabel(runtime.recipe.backend)}</Badge>
                      <Badge className="text-[10px] uppercase">{runtime.status}</Badge>
                    </div>
                    <p className="text-[11px] text-[var(--text-tertiary)]">
                      Port {runtime.port}
                      {runtime.pid ? ` • PID ${runtime.pid}` : ''}
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={actionLoading[`stop:${runtime.id}`]}
                    onClick={() => void handleStop(runtime.id)}
                  >
                    {actionLoading[`stop:${runtime.id}`] ? (
                      <CircleNotch size={14} className="animate-spin mr-1.5" />
                    ) : (
                      <Stop size={14} className="mr-1.5" />
                    )}
                    Stop
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Model cache */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Brain size={16} className="text-[var(--accent-primary)]" />
          Model cache
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-4">
            <div className="flex items-center gap-2">
              <Plus size={16} className="text-[var(--accent-primary)]" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Import or download</h4>
            </div>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="/path/to/local/model"
                  value={importPath}
                  onChange={(e) => setImportPath(e.target.value)}
                  className="flex-1 bg-[var(--bg-elevated)] border-[var(--border-default)]"
                />
                <Button onClick={() => void handleImport()} disabled={!importPath.trim() || actionLoading['import']}>
                  {actionLoading['import'] ? <CircleNotch size={14} className="animate-spin mr-1.5" /> : <FolderOpen size={14} className="mr-1.5" />}
                  Import
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="owner/model-id"
                  value={downloadRepo}
                  onChange={(e) => setDownloadRepo(e.target.value)}
                  className="flex-1 bg-[var(--bg-elevated)] border-[var(--border-default)]"
                />
                <Button
                  variant="outline"
                  onClick={() => void handleDownload()}
                  disabled={!downloadRepo.trim() || actionLoading['download']}
                >
                  {actionLoading['download'] ? <CircleNotch size={14} className="animate-spin mr-1.5" /> : <DownloadSimple size={14} className="mr-1.5" />}
                  Download
                </Button>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-4">
            <div className="flex items-center gap-2">
              <MagnifyingGlass size={16} className="text-[var(--accent-primary)]" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">Search cache</h4>
            </div>
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              />
              <input
                type="text"
                placeholder="Search cached models…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-default)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]"
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[var(--text-tertiary)]">
              <span>{filteredModels.length} model{filteredModels.length === 1 ? '' : 's'}</span>
              <span>{engineModels.filter((m) => m.status === 'downloading').length} downloading</span>
            </div>
          </div>
        </div>

        {filteredModels.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-[var(--border-subtle)] rounded-2xl bg-[var(--bg-elevated)]">
            <Brain size={40} className="mx-auto text-[var(--text-tertiary)] opacity-40 mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">No cached models yet.</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-1">Import a local path or download a model from Hugging Face.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredModels.map((model) => {
              const backend = selectedBackend[model.id] ?? model.recipe?.backend ?? 'llama_cpp';
              const isLaunching = actionLoading[`launch:${model.id}`];
              return (
                <div
                  key={model.id}
                  className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{model.name}</span>
                      <Badge className="text-[10px] uppercase">{model.status}</Badge>
                      {model.recipe && (
                        <Badge variant="outline" className="text-[10px]">{backendLabel(model.recipe.backend)}</Badge>
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
                                model.total_bytes ? (model.downloaded_bytes ?? 0) / model.total_bytes * 100 : 0
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                          {formatBytes(model.downloaded_bytes)} / {formatBytes(model.total_bytes)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={backend}
                      onValueChange={(value) =>
                        setSelectedBackend((prev) => ({ ...prev, [model.id]: value as RuntimeRecipeType }))
                      }
                    >
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
                      size="sm"
                      disabled={model.status !== 'ready' || isLaunching}
                      onClick={() => void handleLaunch(model)}
                    >
                      {isLaunching ? (
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
      </section>

      {/* Operations */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Scales size={16} className="text-[var(--accent-primary)]" />
          Operations
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <OperationCard
            title="Quantize"
            description="Export a model to a smaller GGUF or MLX quantized format."
            icon={<Scales size={22} />}
            modelId={opModelId}
            onModelIdChange={setOpModelId}
            disabled={actionLoading['op:export']}
            loading={actionLoading['op:export']}
            onSubmit={() => void submitOp('export')}
            submitLabel="Queue quantization job"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[var(--text-primary)]">Target format</Label>
              <Select value={quantFormat} onValueChange={setQuantFormat}>
                <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)]">{quantFormat}</SelectTrigger>
                <SelectContent>
                  {QUANT_OPTIONS.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </OperationCard>

          <OperationCard
            title="Merge LoRA"
            description="Merge a trained LoRA adapter back into a base model."
            icon={<ArrowsMerge size={22} />}
            modelId={opModelId}
            onModelIdChange={setOpModelId}
            disabled={actionLoading['op:merge']}
            loading={actionLoading['op:merge']}
            onSubmit={() => void submitOp('merge')}
            submitLabel="Queue merge job"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[var(--text-primary)]">LoRA adapter path</Label>
              <Input
                placeholder="/path/to/lora-adapter"
                value={mergeAdapterPath}
                onChange={(e) => setMergeAdapterPath(e.target.value)}
                className="bg-[var(--bg-elevated)] border-[var(--border-default)]"
              />
            </div>
          </OperationCard>

          <OperationCard
            title="Evaluate"
            description="Run an OpenLLM benchmark task against a local model."
            icon={<ChartBar size={22} />}
            modelId={opModelId}
            onModelIdChange={setOpModelId}
            disabled={actionLoading['op:evaluation']}
            loading={actionLoading['op:evaluation']}
            onSubmit={() => void submitOp('evaluation')}
            submitLabel="Queue evaluation job"
          >
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[var(--text-primary)]">Benchmark task</Label>
              <Select value={evalTask} onValueChange={setEvalTask}>
                <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)]">{evalTask}</SelectTrigger>
                <SelectContent>
                  {EVAL_TASKS.map((task) => (
                    <SelectItem key={task} value={task}>{task}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </OperationCard>
        </div>
      </section>

      {/* Deploy from training job */}
      {completedJobs.length > 0 && (
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Rocket size={16} className="text-[var(--accent-primary)]" />
            Deploy from training job
          </h3>
          <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <p className="text-xs text-[var(--text-tertiary)] mb-3">
              Import a completed Unsloth output directly into the Local Engine.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={deployJobId} onValueChange={setDeployJobId}>
                <SelectTrigger className="flex-1 bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectValue placeholder="Select a completed job" />
                </SelectTrigger>
                <SelectContent>
                  {completedJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.model_id} — {job.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => void handleDeployJob()} disabled={!deployJobId || actionLoading['deploy']}>
                {actionLoading['deploy'] ? <CircleNotch size={14} className="animate-spin" /> : <Rocket size={14} />}
                Import
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Sidecar models */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Brain size={16} className="text-[var(--accent-primary)]" />
          Sidecar models
        </h3>
        <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[var(--text-tertiary)]">Models available in the local sidecar runtime.</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleRegisterSidecar()}
                disabled={brainRegisterLoading || sidecarModels.length === 0}
              >
                {actionLoading['register-sidecar'] ? (
                  <CircleNotch size={14} className="animate-spin mr-1.5" />
                ) : (
                  <Plugs size={14} className="mr-1.5" />
                )}
                Add to Brain
              </Button>
              <Button variant="ghost" size="icon" onClick={() => void loadSidecarModels()} disabled={sidecarLoading}>
                <ArrowsClockwise size={16} className={sidecarLoading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>

          {sidecarError && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-xs text-[var(--text-tertiary)] mb-3">
              {sidecarError}
            </div>
          )}

          {sidecarLoading && sidecarModels.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <CircleNotch size={24} className="animate-spin text-[var(--accent-primary)]" />
            </div>
          ) : sidecarModels.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 text-center">
              <p className="text-xs text-[var(--text-tertiary)]">No sidecar models installed.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {sidecarModels.map((model) => (
                <div
                  key={model.tag}
                  className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]/30 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{model.tag}</p>
                    {model.sizeBytes !== undefined && (
                      <p className="text-xs text-[var(--text-tertiary)]">{formatBytes(model.sizeBytes)}</p>
                    )}
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => void setupApi.removeLocalModel(model.tag).then(() => void loadSidecarModels())}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Logs */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <FileText size={16} className="text-[var(--accent-primary)]" />
          Logs
        </h3>
        <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Local Engine logs</h4>
            <Badge variant="outline" className="text-[10px]">{engineHealth?.status ?? 'unknown'}</Badge>
          </div>
          <div className="font-mono text-xs text-[var(--text-secondary)] space-y-1 p-4 rounded-lg bg-[var(--bg-secondary)]/50 min-h-[160px]">
            <p><span className="text-[var(--text-tertiary)]">[{new Date().toLocaleTimeString()}]</span> Local Engine status: {engineHealth?.status ?? 'unknown'}</p>
            <p><span className="text-[var(--text-tertiary)]">[{new Date().toLocaleTimeString()}]</span> Platform: {engineStatus?.platform?.os} ({engineStatus?.platform?.arch}) • {engineStatus?.platform?.hostname}</p>
            <p><span className="text-[var(--text-tertiary)]">[{new Date().toLocaleTimeString()}]</span> CPU: {engineStatus?.cpu?.model} • {engineStatus?.cpu?.cores} cores</p>
            <p><span className="text-[var(--text-tertiary)]">[{new Date().toLocaleTimeString()}]</span> Cached models: {engineModels.length}</p>
            <p><span className="text-[var(--text-tertiary)]">[{new Date().toLocaleTimeString()}]</span> Active runtimes: {engineRuntimes.length}</p>
            <p><span className="text-[var(--text-tertiary)]">[{new Date().toLocaleTimeString()}]</span> {isAppleUnified ? 'Unified memory' : 'GPU memory'}: {formatBytes(gpuMemoryUsed)} / {formatBytes(gpuMemoryTotal)}</p>
            <p><span className="text-[var(--text-tertiary)]">[{new Date().toLocaleTimeString()}]</span> RAM: {formatBytes(ramUsed)} / {formatBytes(ramTotal)}</p>
            <p><span className="text-[var(--text-tertiary)]">[{new Date().toLocaleTimeString()}]</span> Disk: {formatBytes(diskUsed)} / {formatBytes(diskTotal)}</p>
          </div>
          <p className="text-xs text-[var(--text-tertiary)]">
            Streaming log integration is handled by the Local Engine service. Enable verbose logging in settings for per-runtime output.
          </p>
        </div>
      </section>
    </div>
  );
}

function StatusCard({
  icon,
  label,
  value,
  sub,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  status: 'ok' | 'warn';
}) {
  return (
    <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-9 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">{icon}</div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {status === 'ok' ? (
          <CheckCircle size={16} weight="fill" className="text-green-500" />
        ) : (
          <Warning size={16} weight="fill" className="text-amber-500" />
        )}
        <span className="font-semibold text-[var(--text-primary)]">{value}</span>
      </div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-1.5">{sub}</div>}
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  progress: number;
}) {
  return (
    <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <div className="flex items-center gap-3 mb-3">
        <div className="size-9 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">{icon}</div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-tertiary)]">{label}</span>
      </div>
      <div className="text-sm font-semibold text-[var(--text-primary)]">{value}</div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
      <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden mt-3">
        <div className="h-full rounded-full bg-[var(--accent-primary)]" style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
    </div>
  );
}

function OperationCard({
  title,
  description,
  icon,
  modelId,
  onModelIdChange,
  children,
  disabled,
  loading,
  onSubmit,
  submitLabel,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  modelId: string;
  onModelIdChange: (value: string) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <div className="p-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-5">
      <div className="flex items-start gap-4">
        <div className="size-11 rounded-xl bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)] shrink-0">{icon}</div>
        <div>
          <h4 className="text-base font-semibold text-[var(--text-primary)]">{title}</h4>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-[var(--text-primary)]">Model ID or path</Label>
          <Input
            placeholder="unsloth/Meta-Llama-3.1-8B-Instruct"
            value={modelId}
            onChange={(e) => onModelIdChange(e.target.value)}
            className="bg-[var(--bg-elevated)] border-[var(--border-default)]"
          />
        </div>
        {children}
      </div>
      <div className="flex justify-end">
        <Button onClick={onSubmit} disabled={disabled || !modelId.trim()}>
          {loading ? <CircleNotch size={14} className="animate-spin mr-1.5" /> : null}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}

export default LocalRuntimePanel;
