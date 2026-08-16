'use client';

import React, { useMemo, useState } from 'react';
import {
  Sparkle,
  BookOpen,
  Notebook,
  RocketLaunch,
  MagnifyingGlass,
  Warning,
  CircleNotch,
  Tag,
  Globe,
} from '@phosphor-icons/react';
import { useModelLabStore } from '@/lib/model-lab/store';
import type { ModelJobType } from '@/lib/model-lab/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useBrowserStore } from '@/capsules/browser';
import { cn } from '@/lib/utils';

export interface UnslothGuide {
  id: string;
  title: string;
  description: string;
  tags: string[];
  category: GuideCategory;
  guideUrl: string;
  notebookUrl?: string;
  modelId: string;
  jobType: ModelJobType;
  featured?: boolean;
}

type GuideCategory = 'All' | 'Notebooks' | 'Fine-tuning' | 'GRPO' | 'Export' | 'Evaluation';

const CATEGORIES: { id: GuideCategory; label: string }[] = [
  { id: 'All', label: 'All' },
  { id: 'Notebooks', label: 'Notebooks' },
  { id: 'Fine-tuning', label: 'Fine-tuning' },
  { id: 'GRPO', label: 'GRPO' },
  { id: 'Export', label: 'Export' },
  { id: 'Evaluation', label: 'Evaluation' },
];

const UNSLOTH_GUIDES: UnslothGuide[] = [
  {
    id: 'muse-glimmer-30b',
    title: 'Fine-tune Meta Muse Glimmer 30B + GRPO',
    description:
      'Free notebook for fine-tuning Muse Glimmer 30B with GRPO RL training. Unsloth trains 1.5× faster with 50% less VRAM vs FA2 setups.',
    tags: ['unsloth', 'muse-glimmer', '30B', 'GRPO', 'notebook'],
    category: 'GRPO',
    guideUrl: 'https://unsloth.ai/docs/models/muse-glimmer/train',
    notebookUrl: 'https://unsloth.ai/docs/models/muse-glimmer/train#free-fine-tuning-notebooks',
    modelId: 'unsloth/Muse-Glimmer-30B',
    jobType: 'training',
    featured: true,
  },
  {
    id: 'llama-3-1-8b',
    title: 'Fine-tune Llama 3.1 8B',
    description:
      'Unsloth notebook for supervised fine-tuning of Llama 3.1 8B with one-click Colab/Kaggle options.',
    tags: ['unsloth', 'llama-3.1', '8B', 'SFT', 'notebook'],
    category: 'Fine-tuning',
    guideUrl: 'https://docs.unsloth.ai/basics/tutorial-how-to-finetune-llama-3.1-8b',
    notebookUrl: 'https://colab.research.google.com/drive/1T5-zKWN_bhGxAE1r5PNA6CNrK7T0mxfO?usp=sharing',
    modelId: 'unsloth/Meta-Llama-3.1-8B-Instruct',
    jobType: 'training',
  },
  {
    id: 'qwen2-5-7b',
    title: 'Fine-tune Qwen2.5 7B Instruct',
    description:
      'Notebook for fine-tuning Qwen2.5 7B Instruct using Unsloth with 4-bit/16-bit options.',
    tags: ['unsloth', 'qwen2.5', '7B', 'instruct', 'notebook'],
    category: 'Fine-tuning',
    guideUrl: 'https://docs.unsloth.ai/basics/tutorial-how-to-finetune-qwen2.5',
    notebookUrl: 'https://colab.research.google.com/drive/1q024T7A3X5o7NtorWFAqXDwq33Pqa7bb?usp=sharing',
    modelId: 'unsloth/Qwen2.5-7B-Instruct',
    jobType: 'training',
  },
  {
    id: 'mistral-nemo-12b',
    title: 'Fine-tune Mistral Nemo 12B',
    description:
      'Unsloth notebook for fine-tuning Mistral Nemo 12B with merged LoRA export.',
    tags: ['unsloth', 'mistral', 'nemo', '12B', 'notebook'],
    category: 'Fine-tuning',
    guideUrl: 'https://docs.unsloth.ai/basics/tutorial-how-to-finetune-mistral-nemo',
    notebookUrl: 'https://colab.research.google.com/drive/1wg_BqjD5NdswW9Be7Q8wRxT3jOY9BnqQ?usp=sharing',
    modelId: 'unsloth/Mistral-Nemo-Instruct-2407',
    jobType: 'training',
  },
  {
    id: 'phi-4',
    title: 'Fine-tune Phi-4',
    description:
      'Unsloth notebook for fine-tuning Microsoft Phi-4 with QLoRA and full fine-tuning recipes.',
    tags: ['unsloth', 'phi-4', '14B', 'QLoRA', 'notebook'],
    category: 'Fine-tuning',
    guideUrl: 'https://docs.unsloth.ai/basics/tutorial-how-to-finetune-phi-4',
    notebookUrl: 'https://colab.research.google.com/drive/1vl3s_9iw4Ety7jR3pS0PkfnoaA7es1m3?usp=sharing',
    modelId: 'unsloth/Phi-4',
    jobType: 'training',
  },
  {
    id: 'deepseek-r1-grpo',
    title: 'DeepSeek-R1 Distill Qwen GRPO',
    description:
      'Reasoning-focused GRPO notebook using DeepSeek-R1 Distill Qwen with Unsloth.',
    tags: ['unsloth', 'deepseek-r1', 'qwen', 'GRPO', 'reasoning'],
    category: 'GRPO',
    guideUrl: 'https://docs.unsloth.ai/basics/tutorial-how-to-run-deepseek-r1',
    notebookUrl: 'https://colab.research.google.com/drive/1Lpo0Qf-gI24lR6q5YVd8_1q8GhA0Q6yT?usp=sharing',
    modelId: 'unsloth/DeepSeek-R1-Distill-Qwen-14B',
    jobType: 'training',
  },
  {
    id: 'gemma-3',
    title: 'Fine-tune Gemma 3',
    description:
      'Unsloth notebook for fine-tuning Google Gemma 3 with vision and text LoRA adapters.',
    tags: ['unsloth', 'gemma-3', 'vision', 'LoRA', 'notebook'],
    category: 'Fine-tuning',
    guideUrl: 'https://docs.unsloth.ai/basics/tutorial-how-to-finetune-gemma-3',
    notebookUrl: 'https://colab.research.google.com/drive/1YbpKix2oStvP3zRjB3YlDZz9bD4d1hK7?usp=sharing',
    modelId: 'unsloth/gemma-3-4b-it',
    jobType: 'training',
  },
  {
    id: 'export-merge-lora',
    title: 'Export / merge a LoRA adapter',
    description:
      'Convert a trained LoRA adapter into a merged GGUF, vLLM, or Ollama-compatible model.',
    tags: ['unsloth', 'lora', 'export', 'merge', 'gguf'],
    category: 'Export',
    guideUrl: 'https://docs.unsloth.ai/basics/lora-merge',
    modelId: 'unsloth/Meta-Llama-3.1-8B-Instruct',
    jobType: 'merge',
  },
  {
    id: 'openllm-evaluation',
    title: 'Evaluation on OpenLLM benchmarks',
    description:
      'Run lm-evaluation-harness against a fine-tuned or base model to benchmark MMLU, ARC, and more.',
    tags: ['unsloth', 'evaluation', 'benchmarks', 'openllm'],
    category: 'Evaluation',
    guideUrl: 'https://docs.unsloth.ai/basics/evaluation',
    modelId: 'unsloth/Meta-Llama-3.1-8B-Instruct',
    jobType: 'evaluation',
  },
];

export function GuidesPanel({ onJobCreated }: { onJobCreated?: () => void } = {}): React.ReactNode {
  const { createJob } = useModelLabStore();
  const { addTab } = useBrowserStore();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<GuideCategory>('All');
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const featuredGuide = useMemo(() => UNSLOTH_GUIDES.find((g) => g.featured) ?? UNSLOTH_GUIDES[0], []);

  const filteredGuides = useMemo(() => {
    const query = search.trim().toLowerCase();
    return UNSLOTH_GUIDES.filter((guide) => {
      const matchesCategory = category === 'All' || guide.category === category;
      const matchesSearch =
        !query ||
        guide.title.toLowerCase().includes(query) ||
        guide.description.toLowerCase().includes(query) ||
        guide.tags.some((tag) => tag.toLowerCase().includes(query)) ||
        guide.modelId.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [search, category]);

  const regularGuides = useMemo(
    () => filteredGuides.filter((g) => g.id !== featuredGuide.id),
    [filteredGuides, featuredGuide]
  );

  const handleLaunch = async (guide: UnslothGuide) => {
    setLaunchingId(guide.id);
    setLaunchError(null);
    try {
      await createJob({
        model_id: guide.modelId,
        type: guide.jobType,
        metadata: {
          source: 'unsloth_guide',
          guide_id: guide.id,
          guide_url: guide.guideUrl,
          notebook_url: guide.notebookUrl,
        },
      });
      onJobCreated?.();
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : 'Failed to launch training job');
    } finally {
      setLaunchingId(null);
    }
  };

  const openInBrowserPane = (url: string, title?: string) => {
    addTab(url, title);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <div className="flex flex-col gap-5">
        <div>
          <h2
            className="text-3xl font-medium tracking-tight m-0"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Discover open-weights recipes
          </h2>
          <p className="m-0 mt-1.5 text-sm text-[var(--text-secondary)] max-w-2xl">
            Unsloth notebooks, guides, and fine-tuning recipes. Launch a training job or open the
            notebook in the ACI browser to follow along.
          </p>
        </div>

        <div className="relative max-w-2xl">
          <MagnifyingGlass
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
          />
          <Input
            placeholder="Search guides, models, tags, or descriptions…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-11 h-12 rounded-xl border-[var(--border-default)] text-[15px] bg-[var(--bg-elevated)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={cn(
                  'h-8 px-3.5 text-sm font-medium rounded-full border transition-all duration-200',
                  active
                    ? 'bg-[var(--text-primary)] text-[var(--bg-elevated)] border-[var(--text-primary)]'
                    : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]'
                )}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Error banner */}
      {launchError && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <Warning size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Failed to launch training job</p>
            <p className="text-xs text-[var(--text-tertiary)] break-words">{launchError}</p>
          </div>
        </div>
      )}

      {/* Featured card */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]',
          'transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md'
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent-primary)]/10 via-transparent to-[var(--accent-primary)]/5 pointer-events-none" />
        <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <Badge
                variant="secondary"
                className="text-[10px] uppercase tracking-wide bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] border-0"
              >
                Featured
              </Badge>
              <span className="text-xs text-[var(--text-tertiary)]">{featuredGuide.category}</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-medium text-[var(--text-primary)] leading-tight">
              {featuredGuide.title}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-2xl">
              {featuredGuide.description}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {featuredGuide.tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-[11px] bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-5">
              <Button size="sm" disabled={launchingId === featuredGuide.id} onClick={() => void handleLaunch(featuredGuide)}>
                {launchingId === featuredGuide.id ? (
                  <CircleNotch size={14} className="animate-spin mr-1.5" />
                ) : (
                  <RocketLaunch size={14} className="mr-1.5" />
                )}
                Launch job
              </Button>
              {featuredGuide.notebookUrl && (
                <Button variant="outline" size="sm" onClick={() => openInBrowserPane(featuredGuide.notebookUrl!, featuredGuide.title)}>
                  <Notebook size={14} className="mr-1.5" />
                  Notebook
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => openInBrowserPane(featuredGuide.guideUrl, featuredGuide.title)}>
                <BookOpen size={14} className="mr-1.5" />
                Guide
              </Button>
            </div>
          </div>
          <div className="hidden lg:flex shrink-0">
            <div className="size-28 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--accent-primary)]">
              <Sparkle size={56} weight="duotone" />
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      {regularGuides.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            More recipes
            <span className="ml-2 text-xs font-normal text-[var(--text-tertiary)]">
              {regularGuides.length}
            </span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {regularGuides.map((guide) => (
              <GuideCard
                key={guide.id}
                guide={guide}
                isLaunching={launchingId === guide.id}
                onLaunch={() => void handleLaunch(guide)}
                onOpenNotebook={guide.notebookUrl ? () => openInBrowserPane(guide.notebookUrl!, guide.title) : undefined}
                onOpenGuide={() => openInBrowserPane(guide.guideUrl, guide.title)}
              />
            ))}
          </div>
        </div>
      )}

      {regularGuides.length === 0 && filteredGuides.length <= 1 && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <BookOpen size={48} className="text-[var(--text-tertiary)] opacity-40" />
          <p className="text-sm text-[var(--text-secondary)]">No guides match your search.</p>
          <p className="text-xs text-[var(--text-tertiary)]">Try a different keyword or category filter.</p>
        </div>
      )}
    </div>
  );
}

function GuideCard({
  guide,
  isLaunching,
  onLaunch,
  onOpenNotebook,
  onOpenGuide,
}: {
  guide: UnslothGuide;
  isLaunching: boolean;
  onLaunch: () => void;
  onOpenNotebook?: () => void;
  onOpenGuide: () => void;
}) {
  return (
    <div
      className={cn(
        'group flex flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden',
        'transition-all duration-200 hover:border-[var(--border-hover)] hover:shadow-md'
      )}
    >
      {/* Preview */}
      <div className="relative h-36 overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/50">
        <div className="absolute top-3 left-3">
          <Badge
            variant="secondary"
            className="text-[10px] uppercase tracking-wide bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
          >
            {guide.category}
          </Badge>
        </div>
        <div className="absolute bottom-3 left-3">
          <div className="size-10 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--accent-primary)]">
            <Notebook size={20} weight="duotone" />
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4">
        <h3 className="text-[15px] font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
          {guide.title}
        </h3>
        <p className="text-[13px] text-[var(--text-tertiary)] mt-2 flex-1 line-clamp-3">
          {guide.description}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 mt-4 text-[11px] text-[var(--text-tertiary)]">
          <Tag size={12} />
          {guide.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded-full bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-[var(--border-subtle)]">
          <Button size="sm" disabled={isLaunching} onClick={onLaunch}>
            {isLaunching ? (
              <>
                <CircleNotch size={14} className="animate-spin mr-1.5" />
                Launching…
              </>
            ) : (
              <>
                <RocketLaunch size={14} className="mr-1.5" />
                Launch
              </>
            )}
          </Button>

          {onOpenNotebook && (
            <Button variant="outline" size="sm" onClick={onOpenNotebook}>
              <Notebook size={14} className="mr-1.5" />
              Notebook
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onOpenGuide}>
            <Globe size={14} className="mr-1.5" />
            ACI
          </Button>
        </div>
      </div>
    </div>
  );
}

export default GuidesPanel;
