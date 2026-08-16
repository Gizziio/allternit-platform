/**
 * Model Lab API client.
 *
 * Covers the Unsloth-backed Model Lab worker (`/api/model-lab/*`) and the
 * Allternit Local Engine controller (`/api/local-engine/*`).
 */

import { api, GATEWAY_BASE_URL } from '@/integration/api-client';
import { setupApi } from '@/services/setup-api';

// ============================================================================
// Model Lab job types
// ============================================================================

export type ModelJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ModelJobType = 'training' | 'export' | 'merge' | 'evaluation';

export interface ModelJob {
  id: string;
  model_id: string;
  type: ModelJobType;
  status: ModelJobStatus;
  output_model_path?: string;
  created_at: string;
  updated_at?: string;
  progress?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ModelJobListResponse {
  jobs: ModelJob[];
}

// ============================================================================
// Local Engine types (mirrors services/local-engine/src/lib.rs)
// ============================================================================

export type ModelSource = 'hugging_face' | 'local_path' | 'unsloth_output';
export type ModelStatus = 'downloading' | 'ready' | 'failed';

export interface VllmConfig {
  tensor_parallel_size?: number;
  gpu_memory_utilization?: number;
  dtype?: string;
  quantization?: string;
}

export interface SglangConfig {
  tensor_parallel_size?: number;
  context_length?: number;
}

export interface LlamaCppConfig {
  n_gpu_layers?: number;
  n_ctx?: number;
  flash_attn?: boolean;
}

export interface MlxConfig {
  quantize?: string;
  max_tokens?: number;
}

export type RuntimeRecipe =
  | { backend: 'vllm'; model_path: string } & VllmConfig
  | { backend: 'sglang'; model_path: string } & SglangConfig
  | { backend: 'llama_cpp'; model_path: string } & LlamaCppConfig
  | { backend: 'mlx'; model_path: string } & MlxConfig;

export type RuntimeRecipeType = RuntimeRecipe['backend'];

export type RuntimeStatus = 'starting' | 'running' | 'stopped' | 'error';

export interface RuntimeHealth {
  reachable: boolean;
  last_check_at?: string;
  error?: string;
}

export interface CachedModel {
  id: string;
  name: string;
  source: ModelSource;
  path: string;
  recipe?: RuntimeRecipe | null;
  status: ModelStatus;
  downloaded_bytes?: number;
  total_bytes?: number;
  created_at: string;
}

export interface RuntimeInstance {
  id: string;
  model_id: string;
  recipe: RuntimeRecipe;
  pid?: number | null;
  port: number;
  status: RuntimeStatus;
  health?: RuntimeHealth | null;
}

export interface EngineGpuInfo {
  name: string;
  memory_total_mb?: number;
  memory_used_mb?: number;
}

export interface EngineCpuInfo {
  model: string;
  cores: number;
  threads: number;
}

export interface EngineRamInfo {
  total_bytes: number;
  used_bytes: number;
  total_mb: number;
  used_mb: number;
}

export interface EnginePlatformInfo {
  os: string;
  arch: string;
  kernel?: string;
  hostname?: string;
}

export interface EngineDiskMetrics {
  path?: string;
  total_bytes?: number;
  free_bytes?: number;
  used_bytes?: number;
}

export interface EngineStatus {
  status: 'healthy' | 'degraded' | 'unavailable';
  platform: EnginePlatformInfo;
  cpu: EngineCpuInfo;
  ram: EngineRamInfo;
  disk?: EngineDiskMetrics;
  gpu?: EngineGpuInfo[];
  active_runtimes: number;
  cached_models: number;
}

export interface EngineHealth {
  status: 'ok' | 'error';
  version?: string;
}

export interface ImportModelRequest {
  path: string;
  name?: string;
  source?: ModelSource;
}

export interface ImportModelResponse {
  model: CachedModel;
}

export interface DownloadModelRequest {
  repo_id: string;
  revision?: string;
  quantization?: string;
}

export interface DownloadModelResponse {
  model: CachedModel;
}

export interface LaunchRuntimeRequest {
  model_id: string;
  recipe: RuntimeRecipe;
  port?: number;
}

export interface LaunchRuntimeResponse {
  runtime: RuntimeInstance;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionChunk {
  id?: string;
  object?: string;
  created?: number;
  model?: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
}

// ============================================================================
// Model Lab job API
// ============================================================================

export async function listModelLabJobs(): Promise<ModelJob[]> {
  const response = await api.get<ModelJobListResponse>('/api/model-lab/jobs');
  return response.jobs ?? [];
}

export async function getModelLabJob(jobId: string): Promise<ModelJob> {
  return api.get<ModelJob>(`/api/model-lab/jobs/${encodeURIComponent(jobId)}`);
}

export interface CreateModelLabJobRequest {
  model_id: string;
  type: ModelJobType;
  metadata?: Record<string, unknown>;
}

export async function createModelLabJob(request: CreateModelLabJobRequest): Promise<ModelJob> {
  return api.post<ModelJob>('/api/model-lab/jobs', request);
}

// ============================================================================
// Local Engine API
// ============================================================================

export async function getLocalEngineHealth(): Promise<EngineHealth> {
  return api.get<EngineHealth>('/api/local-engine/health');
}

export async function getLocalEngineStatus(): Promise<EngineStatus> {
  return api.get<EngineStatus>('/api/local-engine/status');
}

export async function listLocalEngineModels(): Promise<CachedModel[]> {
  const response = await api.get<{ models: CachedModel[] }>('/api/local-engine/models');
  return response.models ?? [];
}

export async function importLocalEngineModel(
  request: ImportModelRequest
): Promise<ImportModelResponse> {
  return api.post<ImportModelResponse>('/api/local-engine/models/import', request);
}

export async function downloadLocalEngineModel(
  request: DownloadModelRequest
): Promise<DownloadModelResponse> {
  return api.post<DownloadModelResponse>('/api/local-engine/models/download', request);
}

export async function listLocalEngineRuntimes(): Promise<RuntimeInstance[]> {
  const response = await api.get<{ runtimes: RuntimeInstance[] }>('/api/local-engine/runtimes');
  return response.runtimes ?? [];
}

export async function launchLocalEngineRuntime(
  request: LaunchRuntimeRequest
): Promise<LaunchRuntimeResponse> {
  return api.post<LaunchRuntimeResponse>('/api/local-engine/runtimes/launch', request);
}

export async function stopLocalEngineRuntime(runtimeId: string): Promise<void> {
  await api.post(`/api/local-engine/runtimes/${encodeURIComponent(runtimeId)}/stop`, {});
}

/**
 * Stream a chat completion from a running Local Engine runtime.
 *
 * Uses a direct fetch so the caller can consume the SSE stream.
 */
export async function chatWithLocalEngine(
  request: ChatCompletionRequest,
  onChunk: (chunk: ChatCompletionChunk) => void,
  onError?: (error: Error) => void
): Promise<void> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('allternit_token') : null;
  const response = await fetch(`${GATEWAY_BASE_URL}/api/local-engine/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...request, stream: true }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Chat request failed: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const chunk = JSON.parse(payload) as ChatCompletionChunk;
          onChunk(chunk);
        } catch (parseError) {
          // Ignore malformed SSE lines.
        }
      }
    }
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// Hugging Face catalog API (via local-brain sidecar)
// ============================================================================

export interface HuggingFaceModel {
  repoId: string;
  downloads: number;
  likes: number;
  tags?: string[];
  pipeline_tag?: string;
  lastModified?: string;
  sizeBytes?: number;
}

export type HfSortOption = 'downloads' | 'likes' | 'recent';

export async function searchHuggingFaceModels(
  query: string,
  limit = 20,
): Promise<{ models: HuggingFaceModel[] }> {
  if (!query.trim()) return { models: [] };
  const result = await setupApi.searchLocalModels(query, limit);
  return { models: (result.models ?? []) as HuggingFaceModel[] };
}

export async function installHuggingFaceModel(
  repoId: string,
  quantTag?: string,
): Promise<Response> {
  return setupApi.installLocalModel(repoId, quantTag);
}

export interface HuggingFaceModelDetails {
  repoId: string;
  author: string;
  description?: string;
  tags: string[];
  pipeline_tag?: string;
  downloads: number;
  likes: number;
  lastModified?: string;
  avatarUrl?: string;
  cardData?: Record<string, unknown>;
  isOfficial: boolean;
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

export async function fetchHuggingFaceModelDetails(
  repoId: string,
): Promise<HuggingFaceModelDetails | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(repoId)}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      id?: string;
      modelId?: string;
      author?: string;
      description?: string;
      tags?: string[];
      pipeline_tag?: string;
      downloads?: number;
      likes?: number;
      lastModified?: string;
      cardData?: Record<string, unknown>;
    };

    const author = data.author ?? repoId.split('/')[0] ?? '';
    const avatarUrl = author ? `https://huggingface.co/${encodeURIComponent(author)}/avatar` : undefined;

    return {
      repoId: data.id ?? data.modelId ?? repoId,
      author,
      description: data.description,
      tags: data.tags ?? [],
      pipeline_tag: data.pipeline_tag,
      downloads: data.downloads ?? 0,
      likes: data.likes ?? 0,
      lastModified: data.lastModified,
      avatarUrl,
      cardData: data.cardData,
      isOfficial: OFFICIAL_HF_ORGS.has(author),
    };
  } catch {
    return null;
  }
}

// ============================================================================
// Register local inference stack as a platform "brain" provider
// ============================================================================

export interface RegisterLocalProviderResult {
  success: boolean;
  provider: string;
}

/**
 * Register the Allternit Local Engine as a provider so its cached/running
 * models appear in the model picker and chat composer.
 */
export async function registerLocalEngineProvider(
  models: CachedModel[],
): Promise<RegisterLocalProviderResult> {
  const provider = 'allternit-local-engine';
  const modelMap: Record<string, unknown> = {};
  for (const m of models) {
    const modelId = m.name || m.id;
    modelMap[modelId] = {
      id: modelId,
      name: modelId,
      tool_call: true,
      limit: { context: 8192, output: 4096 },
    };
  }
  const defaultModel = models[0] ? `${provider}/${models[0].name || models[0].id}` : undefined;

  return setupApi.saveProvider({
    provider,
    name: 'Allternit Local Engine',
    npm: '@ai-sdk/openai-compatible',
    authType: 'none',
    baseURL: `${GATEWAY_BASE_URL}/api/local-engine/v1`,
    models: modelMap,
    defaultModel,
    setDefault: false,
  });
}

/**
 * Register the embedded sidecar (Ollama) as a provider so its installed
 * GGUF models appear in the model picker and chat composer.
 */
export async function registerSidecarProvider(
  models: Array<{ tag: string; sizeBytes?: number }>,
): Promise<RegisterLocalProviderResult> {
  const provider = 'allternit-sidecar';
  const modelMap: Record<string, unknown> = {};
  for (const m of models) {
    modelMap[m.tag] = {
      id: m.tag,
      name: m.tag,
      tool_call: true,
      limit: { context: 8192, output: 4096 },
    };
  }
  const defaultModel = models[0] ? `${provider}/${models[0].tag}` : undefined;

  return setupApi.saveProvider({
    provider,
    name: 'Allternit Sidecar',
    npm: '@ai-sdk/openai-compatible',
    authType: 'none',
    baseURL: 'http://127.0.0.1:11435/v1',
    models: modelMap,
    defaultModel,
    setDefault: false,
  });
}

export async function listLocalModels(): Promise<{
  models: Array<{ tag: string; sizeBytes?: number }>;
}> {
  return setupApi.listLocalModels();
}

// ============================================================================
// Local Studio adapter API (proxied through /api/local-studio/*)
// ============================================================================

export interface LocalStudioHealth {
  status: 'ok' | 'error';
  version?: string;
}

export interface LocalStudioStatus {
  running: boolean;
  inference_port?: number;
  launching?: string | null;
  launch_failures?: string[];
  process?: {
    recipe_id?: string;
    model_path?: string;
    served_model_name?: string;
    pid?: number;
    port?: number;
  } | null;
}

export interface LocalStudioGpuInfo {
  count: number;
  gpus: Array<{
    name: string;
    total_memory_mb?: number;
    free_memory_mb?: number;
  }>;
}

export interface LocalStudioModel {
  id: string;
  object: 'model';
  created: number;
  owned_by: string;
  active: boolean;
  max_model_len?: number | null;
  metadata?: Record<string, unknown>;
}

export interface LocalStudioModelsResponse {
  object: 'list';
  data: LocalStudioModel[];
}

export interface LocalStudioUsageEntry {
  timestamp: string;
  requests: number;
  tokens_in: number;
  tokens_out: number;
}

export interface LocalStudioUsage {
  entries: LocalStudioUsageEntry[];
}

export interface LocalStudioLogLine {
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}

export interface LocalStudioLogs {
  lines: LocalStudioLogLine[];
}

const localStudioApi = {
  async request<T>(path: string): Promise<T> {
    return api.get<T>(`/api/local-studio${path}`);
  },
};

export async function getLocalStudioHealth(): Promise<LocalStudioHealth> {
  return localStudioApi.request<LocalStudioHealth>('/health');
}

export async function getLocalStudioStatus(): Promise<LocalStudioStatus> {
  return localStudioApi.request<LocalStudioStatus>('/status');
}

export async function getLocalStudioGpus(): Promise<LocalStudioGpuInfo> {
  return localStudioApi.request<LocalStudioGpuInfo>('/gpus');
}

export async function listLocalStudioModels(): Promise<LocalStudioModelsResponse> {
  return localStudioApi.request<LocalStudioModelsResponse>('/v1/models');
}

export async function getLocalStudioUsage(
  window = '1h',
): Promise<LocalStudioUsage> {
  return localStudioApi.request<LocalStudioUsage>(`/usage?window=${encodeURIComponent(window)}`);
}

export async function getLocalStudioLogs(
  options: { limit?: number; level?: string } = {},
): Promise<LocalStudioLogs> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.level) params.set('level', options.level);
  const query = params.toString();
  return localStudioApi.request<LocalStudioLogs>(`/logs${query ? `?${query}` : ''}`);
}

// ============================================================================
// HAR-derived API capture
// ============================================================================

export interface HarApiEndpoint {
  id: string;
  method: string;
  url: string;
  host: string;
  path: string;
  summary?: string;
  query_params: Array<{ name: string; value: string; templated: boolean; suggested_default?: string }>;
  path_params: Array<{ name: string; value: string; templated: boolean; suggested_default?: string }>;
  headers: Array<{ name: string; value: string; templated: boolean; suggested_default?: string }>;
  body_template?: string;
  body_mime_type?: string;
  body_params: Array<{ name: string; value: string; templated: boolean; suggested_default?: string }>;
  status_code: number;
  response_sample?: string;
}

export interface HarIngestResponse {
  endpoints: HarApiEndpoint[];
  stats: {
    total_entries: number;
    api_entries: number;
    hosts: string[];
  };
}

export interface HarGenerateClientRequest {
  endpoints: string[];
  language: 'python' | 'typescript' | 'curl';
  include_auth?: boolean;
}

export interface HarGenerateClientResponse {
  language: string;
  code: string;
  notes: string[];
}

export async function ingestHar(harJson: string): Promise<HarIngestResponse> {
  return api.post<HarIngestResponse>('/api/har-derived-api/ingest', { har: harJson });
}

export async function generateHarClient(
  request: HarGenerateClientRequest,
): Promise<HarGenerateClientResponse> {
  return api.post<HarGenerateClientResponse>('/api/har-derived-api/client', request);
}
