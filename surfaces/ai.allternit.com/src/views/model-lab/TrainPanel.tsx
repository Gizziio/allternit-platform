'use client';

import React, { useState } from 'react';
import {
  RocketLaunch,
  Warning,
  CheckCircle,
  CaretRight,
  Brain,
  FileArrowDown,
  Stack,
  ChartBar,
} from '@phosphor-icons/react';
import { useModelLabStore } from '@/lib/model-lab/store';
import type { ModelJobType } from '@/lib/model-lab/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

interface TrainingTemplate {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  modelId: string;
  jobType: ModelJobType;
  defaults: {
    loraRank: number;
    epochs: number;
    learningRate: number;
    quantization: string;
    maxSeqLength: number;
    description: string;
  };
}

const TRAINING_TEMPLATES: TrainingTemplate[] = [
  {
    id: 'llama-3-1-8b-sft',
    title: 'Llama 3.1 8B SFT',
    description: 'Supervised fine-tuning recipe for Meta-Llama-3.1-8B-Instruct.',
    icon: <Brain size={20} />,
    modelId: 'unsloth/Meta-Llama-3.1-8B-Instruct',
    jobType: 'training',
    defaults: {
      loraRank: 16,
      epochs: 3,
      learningRate: 0.0002,
      quantization: 'q4_k_m',
      maxSeqLength: 2048,
      description: 'SFT fine-tune of Llama 3.1 8B Instruct via Unsloth.',
    },
  },
  {
    id: 'qwen2-5-7b-instruct',
    title: 'Qwen2.5 7B Instruct fine-tune',
    description: 'LoRA fine-tuning recipe for Qwen2.5-7B-Instruct.',
    icon: <Brain size={20} />,
    modelId: 'unsloth/Qwen2.5-7B-Instruct',
    jobType: 'training',
    defaults: {
      loraRank: 16,
      epochs: 2,
      learningRate: 0.0002,
      quantization: 'q4_k_m',
      maxSeqLength: 2048,
      description: 'LoRA fine-tune of Qwen2.5 7B Instruct via Unsloth.',
    },
  },
  {
    id: 'muse-glimmer-30b-grpo',
    title: 'Muse Glimmer 30B GRPO',
    description: 'Group Relative Policy Optimization recipe for Muse-Glimmer-30B.',
    icon: <Stack size={20} />,
    modelId: 'unsloth/Muse-Glimmer-30B',
    jobType: 'training',
    defaults: {
      loraRank: 32,
      epochs: 1,
      learningRate: 0.00005,
      quantization: 'q4_k_m',
      maxSeqLength: 4096,
      description: 'GRPO training run for Muse Glimmer 30B via Unsloth.',
    },
  },
  {
    id: 'export-merged-lora',
    title: 'Export merged LoRA',
    description: 'Export and merge a trained LoRA adapter into a single model.',
    icon: <FileArrowDown size={20} />,
    modelId: '',
    jobType: 'export',
    defaults: {
      loraRank: 0,
      epochs: 0,
      learningRate: 0,
      quantization: 'q8_0',
      maxSeqLength: 0,
      description: 'Merge LoRA weights and export to GGUF / merged format.',
    },
  },
  {
    id: 'evaluate-openllm',
    title: 'Evaluate on OpenLLM',
    description: 'Run an evaluation benchmark against a trained or base model.',
    icon: <ChartBar size={20} />,
    modelId: '',
    jobType: 'evaluation',
    defaults: {
      loraRank: 0,
      epochs: 0,
      learningRate: 0,
      quantization: 'none',
      maxSeqLength: 2048,
      description: 'OpenLLM leaderboard-style evaluation job.',
    },
  },
];

const JOB_TYPE_OPTIONS: { value: ModelJobType; label: string }[] = [
  { value: 'training', label: 'Training' },
  { value: 'export', label: 'Export' },
  { value: 'merge', label: 'Merge' },
  { value: 'evaluation', label: 'Evaluation' },
];

const QUANTIZATION_OPTIONS = ['q4_k_m', 'q5_k_m', 'q8_0', 'bf16', 'fp16', 'none'];

export function TrainPanel({ onJobCreated }: { onJobCreated?: () => void } = {}): React.ReactNode {
  const { createJob, engineModels } = useModelLabStore();

  const [modelId, setModelId] = useState('');
  const [jobType, setJobType] = useState<ModelJobType>('training');
  const [dataset, setDataset] = useState('');
  const [outputName, setOutputName] = useState('');
  const [loraRank, setLoraRank] = useState<number | ''>('');
  const [epochs, setEpochs] = useState<number | ''>('');
  const [learningRate, setLearningRate] = useState<number | ''>('');
  const [quantization, setQuantization] = useState('q4_k_m');
  const [maxSeqLength, setMaxSeqLength] = useState<number | ''>('');
  const [description, setDescription] = useState('');

  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const applyTemplate = (template: TrainingTemplate) => {
    setModelId(template.modelId);
    setJobType(template.jobType);
    setLoraRank(template.defaults.loraRank || '');
    setEpochs(template.defaults.epochs || '');
    setLearningRate(template.defaults.learningRate || '');
    setQuantization(template.defaults.quantization);
    setMaxSeqLength(template.defaults.maxSeqLength || '');
    setDescription(template.defaults.description);
    setValidationError(null);
    setSubmitError(null);
  };

  const handleNumberChange = (value: string, setter: (val: number | '') => void) => {
    if (value === '') {
      setter('');
      return;
    }
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      setter(parsed);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);
    setSubmitError(null);

    if (!modelId.trim()) {
      setValidationError('Model ID is required.');
      return;
    }
    if (!jobType) {
      setValidationError('Job type is required.');
      return;
    }

    setSubmitting(true);
    try {
      await createJob({
        model_id: modelId.trim(),
        type: jobType,
        metadata: {
          source: 'model_lab_train_tab',
          dataset: dataset.trim() || undefined,
          output_name: outputName.trim() || undefined,
          lora_rank: loraRank ? Number(loraRank) : undefined,
          epochs: epochs ? Number(epochs) : undefined,
          learning_rate: learningRate ? Number(learningRate) : undefined,
          quantization: quantization || undefined,
          max_seq_length: maxSeqLength ? Number(maxSeqLength) : undefined,
          description: description.trim() || undefined,
        },
      });
      onJobCreated?.();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to launch training job');
    } finally {
      setSubmitting(false);
    }
  };

  const modelOptions = engineModels.map((model) => model.name).filter(Boolean);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">Train</h2>
        <p className="text-sm text-[var(--text-tertiary)]">
          Launch Unsloth fine-tuning, export, merge, and evaluation jobs.
        </p>
      </div>

      {(validationError || submitError) && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-3">
          <Warning size={18} className="text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {submitError ? 'Failed to launch job' : 'Validation error'}
            </p>
            <p className="text-xs text-[var(--text-tertiary)] break-words">
              {validationError || submitError}
            </p>
          </div>
        </div>
      )}

      {/* Quick-start templates */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Quick-start templates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TRAINING_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => applyTemplate(template)}
              className="text-left p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="size-8 rounded-lg bg-[var(--accent-primary)]/10 flex items-center justify-center text-[var(--accent-primary)]">
                  {template.icon}
                </div>
                <CaretRight
                  size={16}
                  className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1"
                />
              </div>
              <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-3">
                {template.title}
              </h4>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">{template.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Training job form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] space-y-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Job configuration</h3>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[var(--text-primary)]">Model ID</Label>
              {modelOptions.length > 0 ? (
                <Select value={modelId} onValueChange={setModelId}>
                  <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                    <SelectValue placeholder="Select a model or enter a Hugging Face ID" />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="unsloth/Meta-Llama-3.1-8B-Instruct"
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[var(--text-primary)]">Job type</Label>
              <Select value={jobType} onValueChange={(value) => setJobType(value as ModelJobType)}>
                <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectValue placeholder="Select job type" />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[var(--text-primary)]">
                Dataset path or HF dataset
              </Label>
              <Input
                placeholder="yahma/alpaca-cleaned or /path/to/dataset"
                value={dataset}
                onChange={(event) => setDataset(event.target.value)}
                className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[var(--text-primary)]">Output name</Label>
              <Input
                placeholder="my-model-v1"
                value={outputName}
                onChange={(event) => setOutputName(event.target.value)}
                className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">LoRA rank</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="16"
                  value={loraRank}
                  onChange={(event) => handleNumberChange(event.target.value, setLoraRank)}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">Epochs</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="3"
                  value={epochs}
                  onChange={(event) => handleNumberChange(event.target.value, setEpochs)}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">
                  Learning rate
                </Label>
                <Input
                  type="number"
                  step="any"
                  min={0}
                  placeholder="0.0002"
                  value={learningRate}
                  onChange={(event) => handleNumberChange(event.target.value, setLearningRate)}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[var(--text-primary)]">
                  Max seq length
                </Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="2048"
                  value={maxSeqLength}
                  onChange={(event) => handleNumberChange(event.target.value, setMaxSeqLength)}
                  className="bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[var(--text-primary)]">Quantization</Label>
              <Select value={quantization} onValueChange={setQuantization}>
                <SelectTrigger className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                  <SelectValue placeholder="Select quantization" />
                </SelectTrigger>
                <SelectContent>
                  {QUANTIZATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-[var(--text-primary)]">Description</Label>
              <Textarea
                placeholder="Optional notes about this training run…"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-[100px] bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <span className="animate-pulse">Launching…</span>
            ) : (
              <>
                <RocketLaunch size={16} />
                Launch training job
              </>
            )}
          </Button>

          {submitting && (
            <span className="text-sm text-[var(--text-tertiary)]">Creating job…</span>
          )}
        </div>
      </form>
    </div>
  );
}

export default TrainPanel;
