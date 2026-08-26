import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Brain,
  Upload,
  Plus,
  Play,
  Stop,
  DownloadSimple,
  ArrowsClockwise,
  Warning,
  CheckCircle,
  Gear,
  FileArrowUp,
} from '@phosphor-icons/react';
import { api } from '@/integration/api-client';
import type {
  ModelTrainingBaseModel,
  ModelTrainingJob,
  ModelTrainingCheckpoint,
  ModelTrainingHyperparameters,
} from '@/integration/api-client';

type Tab = 'base-model' | 'dataset' | 'train' | 'jobs' | 'export';
type TrainingMethod = 'lora' | 'qlora' | 'full' | 'dpo';

interface DatasetUploadResponse {
  dataset_id: string;
  path: string;
  rows: number;
  format: 'jsonl' | 'csv';
}

export function ModelTrainingView(): React.ReactNode {
  const [activeTab, setActiveTab] = useState<Tab>('base-model');

  // Base model state
  const [baseModels, setBaseModels] = useState<ModelTrainingBaseModel[]>([]);
  const [selectedBaseModel, setSelectedBaseModel] = useState<string>('');
  const [loadingBaseModels, setLoadingBaseModels] = useState(false);

  // Dataset state
  const [datasetFile, setDatasetFile] = useState<File | null>(null);
  const [uploadingDataset, setUploadingDataset] = useState(false);
  const [datasetUploadError, setDatasetUploadError] = useState<string | null>(null);
  const [uploadedDataset, setUploadedDataset] = useState<DatasetUploadResponse | null>(null);

  // Training state
  const [jobName, setJobName] = useState('');
  const [method, setMethod] = useState<TrainingMethod>('lora');
  const [r, setR] = useState(16);
  const [alpha, setAlpha] = useState(16);
  const [learningRate, setLearningRate] = useState(2e-4);
  const [epochs, setEpochs] = useState(1);
  const [batchSize, setBatchSize] = useState(2);
  const [gradAccum, setGradAccum] = useState(4);
  const [maxSeqLength, setMaxSeqLength] = useState(2048);
  const [creatingJob, setCreatingJob] = useState(false);
  const [createJobError, setCreateJobError] = useState<string | null>(null);

  // Jobs state
  const [jobs, setJobs] = useState<ModelTrainingJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Export state
  const [exportTarget, setExportTarget] = useState<'gguf' | 'mlx'>('gguf');
  const [ggufQuant, setGgufQuant] = useState('q4_k_m');
  const [exportingJobId, setExportingJobId] = useState<string | null>(null);

  const loadBaseModels = useCallback(async () => {
    setLoadingBaseModels(true);
    try {
      const models = await api.listModelTrainingBaseModels();
      setBaseModels(models);
      if (models.length > 0 && !selectedBaseModel) {
        setSelectedBaseModel(models[0].id);
      }
    } catch {
      setBaseModels([]);
    } finally {
      setLoadingBaseModels(false);
    }
  }, [selectedBaseModel]);

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const data = await api.listModelTrainingJobs();
      setJobs(data);
    } catch {
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    void loadBaseModels();
  }, [loadBaseModels]);

  useEffect(() => {
    void loadJobs();
    const interval = setInterval(() => void loadJobs(), 5000);
    return () => clearInterval(interval);
  }, [loadJobs]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.job_id === selectedJobId) ?? jobs[0] ?? null,
    [jobs, selectedJobId],
  );

  const handleDatasetFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setDatasetFile(file);
    setDatasetUploadError(null);
  };

  const handleUploadDataset = async () => {
    if (!datasetFile) return;
    setUploadingDataset(true);
    setDatasetUploadError(null);
    try {
      const result = await api.uploadModelTrainingDataset(datasetFile);
      setUploadedDataset(result);
      setDatasetFile(null);
    } catch (err) {
      setDatasetUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadingDataset(false);
    }
  };

  const handleCreateJob = async () => {
    if (!selectedBaseModel || !uploadedDataset) {
      setCreateJobError('Select a base model and upload a dataset first.');
      return;
    }
    setCreatingJob(true);
    setCreateJobError(null);
    try {
      const hyperparameters: ModelTrainingHyperparameters = {
        method,
        r,
        alpha,
        target_modules: ['q_proj', 'k_proj', 'v_proj', 'o_proj', 'gate_proj', 'up_proj', 'down_proj'],
        learning_rate: learningRate,
        epochs,
        max_steps: -1,
        per_device_batch_size: batchSize,
        gradient_accumulation_steps: gradAccum,
        warmup_steps: 5,
        weight_decay: 0.01,
        max_seq_length: maxSeqLength,
        seed: 42,
      };
      await api.createModelTrainingJob({
        base_model_id: selectedBaseModel,
        dataset_id: uploadedDataset.dataset_id,
        name: jobName || undefined,
        hyperparameters,
      });
      setActiveTab('jobs');
      await loadJobs();
    } catch (err) {
      setCreateJobError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreatingJob(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await api.cancelModelTrainingJob(jobId);
      await loadJobs();
    } catch {}
  };

  const handleExport = async (jobId: string) => {
    setExportingJobId(jobId);
    try {
      await api.exportModelTrainingJob(jobId, {
        target: exportTarget,
        quantization: exportTarget === 'gguf' ? ggufQuant : undefined,
      });
      await loadJobs();
    } catch {}
    setExportingJobId(null);
  };

  const statusColor = (status: string) => {
    if (status === 'completed') return 'text-green-500 bg-green-500/10';
    if (status === 'running') return 'text-[var(--accent-primary)] bg-[var(--accent-primary)]/10';
    if (status === 'failed' || status === 'cancelled') return 'text-red-500 bg-red-500/10';
    return 'text-amber-500 bg-amber-500/10';
  };

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-auto">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-extrabold mb-2">Model Lab</h1>
          <p className="text-sm text-[var(--text-tertiary)]">
            Local Unsloth training for LoRA, QLoRA, full fine-tune, and DPO.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadJobs()}
          disabled={loadingJobs}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-secondary)] hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <ArrowsClockwise size={14} className={loadingJobs ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      <div className="flex gap-2 border-b border-[var(--border-subtle)] mb-6">
        {(
          [
            { id: 'base-model', label: 'Base Model', icon: Brain },
            { id: 'dataset', label: 'Dataset', icon: FileArrowUp },
            { id: 'train', label: 'Train', icon: Gear },
            { id: 'jobs', label: 'Jobs', icon: Play },
            { id: 'export', label: 'Export', icon: DownloadSimple },
          ] as { id: Tab; label: string; icon: typeof Brain }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'base-model' && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Select a base model</h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            These models are known to work with Unsloth. You can also use any Hugging Face model id
            supported by Unsloth.
          </p>
          {loadingBaseModels ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full size-8 border-b-2 border-[var(--accent-primary)]" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {baseModels.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => setSelectedBaseModel(model.id)}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    selectedBaseModel === model.id
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                      : 'border-[var(--border-subtle)] bg-secondary/10 hover:border-[var(--accent-primary)]/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{model.name}</span>
                    <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-secondary text-[var(--text-secondary)]">
                      {model.size}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-mono text-[var(--text-tertiary)] truncate">{model.id}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'dataset' && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Upload dataset</h3>
          <p className="text-xs text-[var(--text-tertiary)]">
            Upload a JSONL or CSV file. For SFT use a <code>text</code> field (or instruction/input/output
            columns). For DPO include <code>prompt</code>, <code>chosen</code>, and <code>rejected</code>{' '}
            columns.
          </p>
          <label className="block">
            <input
              type="file"
              accept=".jsonl,.csv"
              onChange={handleDatasetFileChange}
              className="block w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[var(--accent-primary)] file:text-[var(--text-inverse)] hover:file:opacity-90"
            />
          </label>
          {datasetFile && (
            <button
              type="button"
              onClick={handleUploadDataset}
              disabled={uploadingDataset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--text-inverse)] text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Upload size={14} />
              {uploadingDataset ? 'Uploading…' : 'Upload dataset'}
            </button>
          )}
          {datasetUploadError && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-2">
              <Warning size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--text-tertiary)] break-words">{datasetUploadError}</p>
            </div>
          )}
          {uploadedDataset && (
            <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 flex items-start gap-3">
              <CheckCircle size={20} weight="fill" className="text-green-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Dataset uploaded</p>
                <p className="text-xs text-[var(--text-tertiary)]">
                  {uploadedDataset.rows.toLocaleString()} rows · {uploadedDataset.format.toUpperCase()} ·{' '}
                  {uploadedDataset.dataset_id}
                </p>
              </div>
            </div>
          )}
        </section>
      )}

      {activeTab === 'train' && (
        <section className="space-y-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Configure training</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Job name</label>
              <input
                type="text"
                value={jobName}
                onChange={(e) => setJobName(e.target.value)}
                placeholder="my-lora-job"
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as TrainingMethod)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              >
                <option value="lora">LoRA</option>
                <option value="qlora">QLoRA</option>
                <option value="full">Full fine-tune</option>
                <option value="dpo">DPO</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">LoRA rank (r)</label>
              <input
                type="number"
                min={1}
                max={512}
                value={r}
                onChange={(e) => setR(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">LoRA alpha</label>
              <input
                type="number"
                min={1}
                max={1024}
                value={alpha}
                onChange={(e) => setAlpha(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Learning rate</label>
              <input
                type="number"
                step={1e-5}
                value={learningRate}
                onChange={(e) => setLearningRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Epochs</label>
              <input
                type="number"
                min={1}
                value={epochs}
                onChange={(e) => setEpochs(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Batch size</label>
              <input
                type="number"
                min={1}
                value={batchSize}
                onChange={(e) => setBatchSize(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Gradient accumulation
              </label>
              <input
                type="number"
                min={1}
                value={gradAccum}
                onChange={(e) => setGradAccum(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                Max sequence length
              </label>
              <input
                type="number"
                min={64}
                step={64}
                value={maxSeqLength}
                onChange={(e) => setMaxSeqLength(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
              />
            </div>
          </div>
          {createJobError && (
            <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 flex items-start gap-2">
              <Warning size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--text-tertiary)] break-words">{createJobError}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleCreateJob}
            disabled={creatingJob || !selectedBaseModel || !uploadedDataset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--text-inverse)] text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Plus size={14} />
            {creatingJob ? 'Starting…' : 'Start training job'}
          </button>
        </section>
      )}

      {activeTab === 'jobs' && (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Training jobs</h3>
          {jobs.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">No jobs yet. Create one in the Train tab.</p>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.job_id}
                  onClick={() => setSelectedJobId(job.job_id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    selectedJob?.job_id === job.job_id
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--accent-primary)]/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{job.name}</p>
                      <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{job.job_id}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${statusColor(
                        job.status
                      )}`}
                    >
                      {job.status}
                    </span>
                  </div>
                  {job.total_steps > 0 && (
                    <div className="mb-2">
                      <div className="h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[var(--accent-primary)] transition-all duration-300"
                          style={{ width: `${job.progress_pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                        Step {job.current_step} / {job.total_steps}
                        {job.current_loss !== undefined && job.current_loss !== null
                          ? ` · loss ${job.current_loss.toFixed(4)}`
                          : ''}
                      </p>
                    </div>
                  )}
                  {(job.status === 'running' || job.status === 'preparing' || job.status === 'pending') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleCancelJob(job.job_id);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-[var(--border-subtle)] text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <Stop size={12} /> Cancel
                    </button>
                  )}
                  {job.error_message && (
                    <p className="mt-2 text-[11px] text-red-500 break-words">{job.error_message}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'export' && (
        <section className="space-y-5">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Export trained model</h3>
          {!selectedJob ? (
            <p className="text-sm text-[var(--text-tertiary)]">Select a completed job in the Jobs tab first.</p>
          ) : selectedJob.status !== 'completed' ? (
            <p className="text-sm text-[var(--text-tertiary)]">
              Selected job is not completed yet. Wait for training to finish.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{selectedJob.name}</p>
                <p className="text-[11px] text-[var(--text-tertiary)] font-mono">{selectedJob.job_id}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">Export format</label>
                <select
                  value={exportTarget}
                  onChange={(e) => setExportTarget(e.target.value as 'gguf' | 'mlx')}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="gguf">GGUF (llama.cpp / Ollama)</option>
                  <option value="mlx">MLX (Apple Silicon)</option>
                </select>
              </div>
              {exportTarget === 'gguf' && (
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Quantization
                  </label>
                  <select
                    value={ggufQuant}
                    onChange={(e) => setGgufQuant(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
                  >
                    <option value="q4_k_m">Q4_K_M</option>
                    <option value="q5_k_m">Q5_K_M</option>
                    <option value="q8_0">Q8_0</option>
                    <option value="f16">F16</option>
                  </select>
                </div>
              )}
              <button
                type="button"
                onClick={() => void handleExport(selectedJob.job_id)}
                disabled={exportingJobId === selectedJob.job_id}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--text-inverse)] text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <DownloadSimple size={14} />
                {exportingJobId === selectedJob.job_id ? 'Exporting…' : `Export to ${exportTarget.toUpperCase()}`}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
