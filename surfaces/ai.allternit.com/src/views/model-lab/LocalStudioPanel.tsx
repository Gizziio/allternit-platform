'use client';

import React, { useEffect, useState } from 'react';
import {
  Cpu,
  BookOpen,
  ArrowsClockwise,
  Warning,
  CircleNotch,
  HardDrives,
  FileText,
  Play,
  Globe,
  Plus,
  Trash,
  FloppyDisk,
} from '@phosphor-icons/react';
import { BarChart3, Activity, Server } from 'lucide-react';
import { useModelLabStore } from '@/lib/model-lab/store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useBrowserStore } from '@/capsules/browser';
import { cn } from '@/lib/utils';
import { ModelCard } from './components/ModelCard';

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '—';
  const gb = bytes / 1024 ** 3;
  return `${gb.toFixed(2)} GB`;
}

function formatMb(mb?: number): string {
  if (mb === undefined || mb === null) return '—';
  return `${mb.toFixed(0)} MB`;
}

interface LocalStudioRecipeDraft {
  id: string;
  backend: string;
  model_path?: string;
  hf_repo?: string;
  quantization?: string;
  max_model_len?: number;
  metadata: Record<string, unknown>;
}

const BACKEND_OPTIONS = ['llama.cpp', 'vllm', 'sglang', 'mlx', 'tgi'];
const QUANT_OPTIONS = ['none', 'q4_k_m', 'q5_k_m', 'q8_0', 'bf16', 'fp16'];

export function LocalStudioPanel(): React.ReactNode {
  const {
    localStudioHealth,
    localStudioStatus,
    localStudioGpus,
    localStudioModels,
    localStudioUsage,
    localStudioLogs,
    localStudioLoading,
    localStudioError,
    refreshLocalStudioState,
  } = useModelLabStore();

  const { addTab } = useBrowserStore();
  const [controllerUrl, setControllerUrl] = useState('http://127.0.0.1:8080');

  // Recipe builder state
  const [recipes, setRecipes] = useState<LocalStudioRecipeDraft[]>([]);
  const [recipeForm, setRecipeForm] = useState<LocalStudioRecipeDraft>({
    id: '',
    backend: 'llama.cpp',
    model_path: '',
    hf_repo: '',
    quantization: 'none',
    max_model_len: 4096,
    metadata: {},
  });

  useEffect(() => {
    void refreshLocalStudioState();
  }, [refreshLocalStudioState]);

  useEffect(() => {
    if (localStudioModels?.data.length) {
      setRecipes((prev) => {
        const existing = new Set(prev.map((r) => r.id));
        const incoming = localStudioModels.data
          .filter((m) => !existing.has(m.id))
          .map((m) => ({
            id: m.id,
            backend: m.metadata?.backend?.toString() || 'llama.cpp',
            model_path: m.metadata?.model_path?.toString() || '',
            hf_repo: m.metadata?.hf_repo?.toString() || '',
            quantization: m.metadata?.quantization?.toString() || 'none',
            max_model_len: m.max_model_len ?? undefined,
            metadata: m.metadata || {},
          }));
        return [...prev, ...incoming];
      });
    }
  }, [localStudioModels]);

  const isConnected = localStudioHealth?.status === 'ok';

  const saveRecipe = () => {
    if (!recipeForm.id.trim()) return;
    setRecipes((prev) => {
      const idx = prev.findIndex((r) => r.id === recipeForm.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = recipeForm;
        return next;
      }
      return [recipeForm, ...prev];
    });
    setRecipeForm({
      id: '',
      backend: 'llama.cpp',
      model_path: '',
      hf_repo: '',
      quantization: 'none',
      max_model_len: 4096,
      metadata: {},
    });
  };

  const deleteRecipe = (id: string) => {
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Local Studio</h2>
          <p className="text-sm text-[var(--text-tertiary)]">
            Native Local Studio integration: models, recipes, usage, and inference runtimes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refreshLocalStudioState()}
          disabled={localStudioLoading}
        >
          <ArrowsClockwise size={14} className={cn('mr-1.5', localStudioLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Controller connection */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Server size={16} className="text-[var(--accent-primary)]" />
          Controller
        </h3>
        <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <Server size={18} className="text-[var(--accent-primary)]" />
          <Input
            value={controllerUrl}
            onChange={(e) => setControllerUrl(e.target.value)}
            placeholder="Local Studio controller URL"
            className="flex-1 h-9 border-0 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:ring-0 focus-visible:ring-offset-0"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void refreshLocalStudioState()}
            disabled={localStudioLoading}
          >
            {localStudioLoading ? <CircleNotch size={14} className="animate-spin" /> : 'Connect'}
          </Button>
        </div>

        {localStudioError && (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
            <Warning size={18} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Controller not reachable</p>
              <p className="text-xs text-[var(--text-tertiary)] break-words">{localStudioError}</p>
            </div>
          </div>
        )}
      </section>

      {/* Status */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Activity size={16} className="text-[var(--accent-primary)]" />
          Status
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ModelCard className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                <Activity size={18} />
              </div>
              <span className="text-xs font-bold uppercase text-[var(--text-tertiary)]">Health</span>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? <div className="size-2 rounded-full bg-green-500" /> : <div className="size-2 rounded-full bg-amber-500" />}
              <span className="font-semibold text-[var(--text-primary)]">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </ModelCard>

          <ModelCard className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                <Play size={18} />
              </div>
              <span className="text-xs font-bold uppercase text-[var(--text-tertiary)]">Runtime</span>
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{localStudioStatus?.running ? 'Running' : 'Stopped'}</div>
            {localStudioStatus?.inference_port && (
              <div className="text-xs text-[var(--text-tertiary)]">Port {localStudioStatus.inference_port}</div>
            )}
          </ModelCard>

          <ModelCard className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                <BookOpen size={18} />
              </div>
              <span className="text-xs font-bold uppercase text-[var(--text-tertiary)]">Models</span>
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{localStudioModels?.data.length ?? 0} recipes</div>
            <div className="text-xs text-[var(--text-tertiary)]">{localStudioModels?.data.filter((m) => m.active).length ?? 0} active</div>
          </ModelCard>

          <ModelCard className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                <Cpu size={18} />
              </div>
              <span className="text-xs font-bold uppercase text-[var(--text-tertiary)]">GPUs</span>
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)]">{localStudioGpus?.count ?? 0} detected</div>
            <div className="text-xs text-[var(--text-tertiary)] truncate">{localStudioGpus?.gpus[0]?.name ?? 'None'}</div>
          </ModelCard>
        </div>

        {localStudioStatus?.process && (
          <ModelCard className="p-5">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Active process</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[var(--text-tertiary)]">Recipe</span>
                <p className="font-medium text-[var(--text-primary)]">{localStudioStatus.process.recipe_id ?? '—'}</p>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)]">Served as</span>
                <p className="font-medium text-[var(--text-primary)]">{localStudioStatus.process.served_model_name ?? '—'}</p>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)]">Model path</span>
                <p className="font-medium text-[var(--text-primary)] truncate">{localStudioStatus.process.model_path ?? '—'}</p>
              </div>
              <div>
                <span className="text-[var(--text-tertiary)]">PID</span>
                <p className="font-medium text-[var(--text-primary)]">{localStudioStatus.process.pid ?? '—'}</p>
              </div>
            </div>
          </ModelCard>
        )}

        {localStudioGpus && localStudioGpus.gpus.length > 0 && (
          <ModelCard className="p-5">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-3">GPU details</h4>
            <div className="space-y-3">
              {localStudioGpus.gpus.map((gpu, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-secondary)]">
                  <div className="flex items-center gap-3">
                    <Cpu size={16} className="text-[var(--accent-primary)]" />
                    <span className="text-sm font-medium text-[var(--text-primary)]">{gpu.name}</span>
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {formatMb(gpu.free_memory_mb)} free / {formatMb(gpu.total_memory_mb)} total
                  </div>
                </div>
              ))}
            </div>
          </ModelCard>
        )}
      </section>

      {/* Recipes */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Plus size={16} className="text-[var(--accent-primary)]" />
          Recipes
        </h3>
        <ModelCard className="p-5">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Plus size={16} className="text-[var(--accent-primary)]" />
            New recipe
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-[var(--text-secondary)]">Recipe ID</Label>
              <Input
                value={recipeForm.id}
                onChange={(e) => setRecipeForm((prev) => ({ ...prev, id: e.target.value }))}
                placeholder="e.g. llama-3.1-8b-gguf"
                className="mt-1 bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--text-secondary)]">Backend</Label>
              <select
                value={recipeForm.backend}
                onChange={(e) => setRecipeForm((prev) => ({ ...prev, backend: e.target.value }))}
                className="mt-1 w-full h-9 px-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none"
              >
                {BACKEND_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-[var(--text-secondary)]">Local model path</Label>
              <Input
                value={recipeForm.model_path}
                onChange={(e) => setRecipeForm((prev) => ({ ...prev, model_path: e.target.value }))}
                placeholder="/path/to/model.gguf"
                className="mt-1 bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--text-secondary)]">Hugging Face repo</Label>
              <Input
                value={recipeForm.hf_repo}
                onChange={(e) => setRecipeForm((prev) => ({ ...prev, hf_repo: e.target.value }))}
                placeholder="owner/model-id"
                className="mt-1 bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
              />
            </div>
            <div>
              <Label className="text-xs text-[var(--text-secondary)]">Quantization</Label>
              <select
                value={recipeForm.quantization}
                onChange={(e) => setRecipeForm((prev) => ({ ...prev, quantization: e.target.value }))}
                className="mt-1 w-full h-9 px-2 rounded-md bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none"
              >
                {QUANT_OPTIONS.map((q) => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs text-[var(--text-secondary)]">Max model length</Label>
              <Input
                type="number"
                value={recipeForm.max_model_len}
                onChange={(e) => setRecipeForm((prev) => ({ ...prev, max_model_len: Number(e.target.value) }))}
                className="mt-1 bg-[var(--bg-secondary)] border-[var(--border-subtle)]"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button size="sm" onClick={saveRecipe} disabled={!recipeForm.id.trim()}>
              <FloppyDisk size={14} className="mr-1.5" />
              Save recipe
            </Button>
          </div>
        </ModelCard>

        {recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <BookOpen size={48} className="text-[var(--text-tertiary)] opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">No recipes yet.</p>
            <p className="text-xs text-[var(--text-tertiary)] text-center max-w-sm">
              Recipes define how a model is loaded: backend, quantization, context length, and source.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recipes.map((recipe) => (
              <ModelCard key={recipe.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{recipe.id}</h4>
                      <Badge variant="outline" className="text-[10px]">{recipe.backend}</Badge>
                      {recipe.quantization && recipe.quantization !== 'none' && (
                        <Badge variant="secondary" className="text-[10px]">{recipe.quantization}</Badge>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">
                      {recipe.model_path || recipe.hf_repo || 'No source configured'}
                    </p>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">Max length: {recipe.max_model_len ?? '—'}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRecipe(recipe.id)}
                    className="text-[var(--status-error)] hover:text-[var(--status-error)] hover:bg-[var(--status-error)]/10"
                  >
                    <Trash size={16} />
                  </Button>
                </div>
                <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setRecipeForm(recipe)}>
                    <ArrowsClockwise size={14} className="mr-1.5" />
                    Edit
                  </Button>
                  <Button size="sm" onClick={() => addTab(`${controllerUrl}/v1/models/${recipe.id}`, recipe.id)}>
                    <Globe size={14} className="mr-1.5" />
                    Open
                  </Button>
                </div>
              </ModelCard>
            ))}
          </div>
        )}
      </section>

      {/* Models */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <BookOpen size={16} className="text-[var(--accent-primary)]" />
          Active models
        </h3>
        {localStudioModels?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <BookOpen size={48} className="text-[var(--text-tertiary)] opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">No Local Studio recipes found.</p>
            <p className="text-xs text-[var(--text-tertiary)] text-center max-w-sm">
              Add a model recipe above, or connect a Local Studio controller.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localStudioModels?.data.map((model) => (
              <ModelCard key={model.id} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate">{model.id}</h4>
                    {model.active && (
                      <Badge className="text-[10px] uppercase bg-green-500/10 text-green-500 border-0">Active</Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)]">Max length: {model.max_model_len ?? '—'}</p>
                  {model.metadata && Object.keys(model.metadata).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {Object.entries(model.metadata).slice(0, 4).map(([key, value]) => (
                        <span
                          key={key}
                          className="px-2 py-0.5 rounded-full text-[10px] text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
                        >
                          {key}: {String(value).slice(0, 20)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => addTab(`${controllerUrl}/v1/models/${model.id}`, model.id)}>
                  <Globe size={16} />
                </Button>
              </ModelCard>
            ))}
          </div>
        )}
      </section>

      {/* Usage */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <BarChart3 size={16} className="text-[var(--accent-primary)]" />
          Usage
        </h3>
        {localStudioUsage?.entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <BarChart3 size={48} className="text-[var(--text-tertiary)] opacity-40" />
            <p className="text-sm text-[var(--text-secondary)]">No usage data yet.</p>
          </div>
        ) : (
          <ModelCard className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-secondary)]">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--text-tertiary)]">Time</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-tertiary)]">Requests</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-tertiary)]">Tokens in</th>
                  <th className="text-right px-4 py-2 text-xs font-semibold text-[var(--text-tertiary)]">Tokens out</th>
                </tr>
              </thead>
              <tbody>
                {localStudioUsage?.entries.map((entry, idx) => (
                  <tr key={idx} className="border-t border-[var(--border-subtle)]">
                    <td className="px-4 py-2 text-[var(--text-primary)]">{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-primary)]">{entry.requests}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-primary)]">{entry.tokens_in}</td>
                    <td className="px-4 py-2 text-right text-[var(--text-primary)]">{entry.tokens_out}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ModelCard>
        )}
      </section>

      {/* Logs */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <FileText size={16} className="text-[var(--accent-primary)]" />
          Logs
        </h3>
        <ModelCard className="p-0 overflow-hidden">
          <div className="max-h-[480px] overflow-auto p-4 font-mono text-xs space-y-2">
            {localStudioLogs?.lines.length === 0 ? (
              <p className="text-[var(--text-tertiary)]">No logs available.</p>
            ) : (
              localStudioLogs?.lines.map((line, idx) => (
                <div key={idx} className="flex gap-3">
                  <span className="text-[var(--text-tertiary)] shrink-0">{new Date(line.timestamp).toLocaleTimeString()}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] shrink-0 h-4 px-1',
                      line.level === 'ERROR' && 'border-red-500/30 text-red-500',
                      line.level === 'WARN' && 'border-amber-500/30 text-amber-500',
                      line.level === 'INFO' && 'border-[var(--accent-primary)]/30 text-[var(--accent-primary)]'
                    )}
                  >
                    {line.level}
                  </Badge>
                  <span className="text-[var(--text-secondary)] break-words">{line.message}</span>
                </div>
              ))
            )}
          </div>
        </ModelCard>
      </section>
    </div>
  );
}

export default LocalStudioPanel;
