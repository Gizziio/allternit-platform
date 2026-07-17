export const LOCAL_MODEL_SCHEMA = "allternit.model.v1" as const;

export type LocalModelKind = "brain" | "embedding" | "image" | "video";

export type LocalModelTask =
  | "chat"
  | "reasoning"
  | "tools"
  | "structured-output"
  | "vision"
  | "embeddings"
  | "text-to-image"
  | "image-to-image"
  | "text-to-video"
  | "image-to-video";

export type LocalRuntimeEngine =
  | "ollama"
  | "llama.cpp"
  | "webgpu"
  | "transformers.js"
  | "desktop";

export type LocalModelSource =
  | { type: "huggingface"; repository: string; revision?: string }
  | { type: "url"; url: string }
  | { type: "local-file"; acceptedExtensions: string[] };

export interface LocalRuntimeManifest {
  engine: LocalRuntimeEngine;
  model?: string;
  adapter?: string;
  source?: LocalModelSource;
}

export interface LocalModelManifest {
  schema: typeof LOCAL_MODEL_SCHEMA;
  id: string;
  name: string;
  description: string;
  kind: LocalModelKind;
  tasks: LocalModelTask[];
  runtimes: LocalRuntimeManifest[];
  requirements?: {
    webgpu?: boolean;
    estimatedDownloadBytes?: number;
    minimumMemoryBytes?: number;
  };
  defaults?: {
    temperature?: number;
    contextLength?: number;
  };
  license?: {
    id: string;
    url?: string;
    noticeRequired?: boolean;
  };
  delivery: {
    status: "integrated" | "adapter-required" | "blocked";
    note?: string;
  };
}

export interface LocalModelCapabilities {
  tasks: LocalModelTask[];
  contextLength?: number;
  embeddingDimensions?: number;
  supportsStreaming: boolean;
  supportsSeed: boolean;
  verified: boolean;
  verifiedAt?: string;
}

export interface InstalledLocalModel {
  id: string;
  providerId: string;
  runtimeModelId: string;
  name: string;
  sizeBytes?: number;
  digest?: string;
  modifiedAt?: string;
  capabilities: LocalModelCapabilities;
  metadata?: Record<string, unknown>;
}

export interface LocalProviderStatus {
  providerId: string;
  connected: boolean;
  local: true;
  version?: string;
  error?: string;
}

export interface LocalBrainMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  images?: string[];
  toolCallId?: string;
}

export interface LocalBrainTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface LocalGenerationRequest {
  requestId: string;
  model: string;
  task?: LocalModelTask;
  messages?: LocalBrainMessage[];
  prompt?: string;
  tools?: LocalBrainTool[];
  temperature?: number;
  seed?: number;
  width?: number;
  height?: number;
  format?: "json" | Record<string, unknown>;
  signal?: AbortSignal;
}

export type LocalGenerationEvent =
  | { type: "text-delta"; text: string }
  | { type: "tool-call"; id: string; name: string; arguments: Record<string, unknown> }
  | { type: "image"; blob: Blob; seed?: number }
  | { type: "video"; blob: Blob; seed?: number }
  | { type: "usage"; promptTokens?: number; completionTokens?: number }
  | { type: "done"; finishReason?: string };

export interface LocalInstallRequest {
  manifest: LocalModelManifest;
  runtime: LocalRuntimeManifest;
  signal?: AbortSignal;
}

export interface LocalInstallProgress {
  status: "starting" | "downloading" | "verifying" | "ready";
  completedBytes?: number;
  totalBytes?: number;
  message?: string;
}

export interface LocalModelProvider {
  readonly id: string;
  readonly engine: LocalRuntimeEngine;
  connect(): Promise<LocalProviderStatus>;
  listModels(): Promise<InstalledLocalModel[]>;
  inspectModel(runtimeModelId: string): Promise<InstalledLocalModel>;
  installModel(request: LocalInstallRequest): AsyncIterable<LocalInstallProgress>;
  removeModel(runtimeModelId: string): Promise<void>;
  generate(request: LocalGenerationRequest): AsyncIterable<LocalGenerationEvent>;
  loadModel?(runtimeModelId: string): Promise<void>;
  unloadModel?(runtimeModelId: string): Promise<void>;
  cancel?(requestId: string): Promise<void>;
}

export interface LocalModelSelection {
  provider: LocalModelProvider;
  model: InstalledLocalModel;
  manifest?: LocalModelManifest;
}
