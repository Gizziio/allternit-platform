import { assertLoopbackUrl } from "../loopback";
import type {
  InstalledLocalModel,
  LocalGenerationEvent,
  LocalGenerationRequest,
  LocalInstallProgress,
  LocalInstallRequest,
  LocalModelCapabilities,
  LocalModelProvider,
  LocalModelTask,
  LocalProviderStatus,
} from "../types";

type FetchLike = typeof fetch;

interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    model?: string;
    size?: number;
    digest?: string;
    modified_at?: string;
    details?: Record<string, unknown>;
  }>;
}

interface OllamaShowResponse {
  capabilities?: string[];
  details?: Record<string, unknown>;
  model_info?: Record<string, unknown>;
  license?: string | string[];
}

interface OllamaChatChunk {
  message?: {
    content?: string;
    tool_calls?: Array<{
      function?: { name?: string; arguments?: Record<string, unknown> };
    }>;
  };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
}

const CAPABILITY_TASKS: Record<string, LocalModelTask> = {
  completion: "chat",
  tools: "tools",
  vision: "vision",
  embedding: "embeddings",
  thinking: "reasoning",
  image: "text-to-image",
};

function capabilitiesFromOllama(values: string[] = []): LocalModelCapabilities {
  const tasks = new Set<LocalModelTask>(["chat"]);
  for (const value of values) {
    const task = CAPABILITY_TASKS[value];
    if (task) tasks.add(task);
  }
  return {
    tasks: [...tasks],
    supportsStreaming: true,
    supportsSeed: true,
    verified: false,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Ollama request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return response.json() as Promise<T>;
}

async function* readNdjson<T>(response: Response): AsyncGenerator<T> {
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Ollama request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  if (!response.body) throw new Error("Ollama returned an empty stream");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) yield JSON.parse(line) as T;
      }
      if (done) break;
    }
    if (pending.trim()) yield JSON.parse(pending) as T;
  } finally {
    reader.releaseLock();
  }
}

export interface OllamaProviderOptions {
  baseUrl?: string;
  fetch?: FetchLike;
  /**
   * Allow a non-loopback Ollama endpoint. Default false: local-first mode
   * refuses to send prompts to a network host unless explicitly opted in.
   */
  allowRemote?: boolean;
}

export class OllamaLocalProvider implements LocalModelProvider {
  readonly id = "ollama";
  readonly engine = "ollama" as const;
  private readonly baseUrl: string;
  private readonly fetcher: FetchLike;
  private readonly requests = new Map<string, AbortController>();

  constructor(options: OllamaProviderOptions = {}) {
    const baseUrl = (options.baseUrl ?? "http://127.0.0.1:11434").replace(/\/$/, "");
    this.baseUrl = options.allowRemote ? baseUrl : assertLoopbackUrl(baseUrl, "Ollama");
    this.fetcher = options.fetch ?? fetch;
  }

  async connect(): Promise<LocalProviderStatus> {
    try {
      const response = await this.fetcher(`${this.baseUrl}/api/version`);
      const data = await readJson<{ version?: string }>(response);
      return { providerId: this.id, connected: true, local: true, version: data.version };
    } catch (error) {
      return {
        providerId: this.id,
        connected: false,
        local: true,
        error: error instanceof Error ? error.message : "Unable to connect to Ollama",
      };
    }
  }

  async listModels(): Promise<InstalledLocalModel[]> {
    const response = await this.fetcher(`${this.baseUrl}/api/tags`);
    const data = await readJson<OllamaTagsResponse>(response);
    return Promise.all((data.models ?? []).map(async (model) => {
      const runtimeModelId = model.model ?? model.name;
      try {
        const inspected = await this.inspectModel(runtimeModelId);
        return {
          ...inspected,
          name: model.name,
          sizeBytes: model.size,
          digest: model.digest,
          modifiedAt: model.modified_at,
          metadata: { ...model.details, ...inspected.metadata },
        };
      } catch {
        return {
          id: `ollama:${runtimeModelId}`,
          providerId: this.id,
          runtimeModelId,
          name: model.name,
          sizeBytes: model.size,
          digest: model.digest,
          modifiedAt: model.modified_at,
          capabilities: capabilitiesFromOllama(),
          metadata: model.details,
        };
      }
    }));
  }

  async inspectModel(runtimeModelId: string): Promise<InstalledLocalModel> {
    const response = await this.fetcher(`${this.baseUrl}/api/show`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: runtimeModelId }),
    });
    const data = await readJson<OllamaShowResponse>(response);
    return {
      id: `ollama:${runtimeModelId}`,
      providerId: this.id,
      runtimeModelId,
      name: runtimeModelId,
      capabilities: {
        ...capabilitiesFromOllama(data.capabilities),
        verified: true,
        verifiedAt: new Date().toISOString(),
      },
      metadata: {
        details: data.details,
        modelInfo: data.model_info,
        license: data.license,
      },
    };
  }

  async *installModel(request: LocalInstallRequest): AsyncIterable<LocalInstallProgress> {
    const runtimeModelId = request.runtime.model;
    if (!runtimeModelId) throw new Error("The Ollama runtime manifest is missing a model name");
    yield { status: "starting", message: `Preparing ${request.manifest.name}` };

    const response = await this.fetcher(`${this.baseUrl}/api/pull`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: runtimeModelId, stream: true }),
      signal: request.signal,
    });
    for await (const event of readNdjson<{
      status?: string;
      completed?: number;
      total?: number;
      error?: string;
    }>(response)) {
      if (event.error) throw new Error(event.error);
      const ready = event.status === "success";
      yield {
        status: ready ? "ready" : "downloading",
        completedBytes: event.completed,
        totalBytes: event.total,
        message: event.status,
      };
    }
  }

  async removeModel(runtimeModelId: string): Promise<void> {
    await readJson(
      await this.fetcher(`${this.baseUrl}/api/delete`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: runtimeModelId }),
      }),
    );
  }

  async *generate(request: LocalGenerationRequest): AsyncIterable<LocalGenerationEvent> {
    const controller = new AbortController();
    this.requests.set(request.requestId, controller);
    const abort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", abort, { once: true });

    try {
      const response = await this.fetcher(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages ?? [{ role: "user", content: request.prompt ?? "" }],
          tools: request.tools,
          format: request.format,
          stream: true,
          options: {
            temperature: request.temperature,
            seed: request.seed,
          },
        }),
        signal: controller.signal,
      });

      for await (const chunk of readNdjson<OllamaChatChunk>(response)) {
        if (chunk.message?.content) {
          yield { type: "text-delta", text: chunk.message.content };
        }
        for (const [index, toolCall] of (chunk.message?.tool_calls ?? []).entries()) {
          const fn = toolCall.function;
          if (fn?.name) {
            yield {
              type: "tool-call",
              id: `${request.requestId}:${index}`,
              name: fn.name,
              arguments: fn.arguments ?? {},
            };
          }
        }
        if (chunk.prompt_eval_count != null || chunk.eval_count != null) {
          yield {
            type: "usage",
            promptTokens: chunk.prompt_eval_count,
            completionTokens: chunk.eval_count,
          };
        }
        if (chunk.done) yield { type: "done", finishReason: chunk.done_reason };
      }
    } finally {
      request.signal?.removeEventListener("abort", abort);
      this.requests.delete(request.requestId);
    }
  }

  async loadModel(runtimeModelId: string): Promise<void> {
    await readJson(
      await this.fetcher(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: runtimeModelId, prompt: "", keep_alive: "5m", stream: false }),
      }),
    );
  }

  async unloadModel(runtimeModelId: string): Promise<void> {
    await readJson(
      await this.fetcher(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: runtimeModelId, prompt: "", keep_alive: 0, stream: false }),
      }),
    );
  }

  async cancel(requestId: string): Promise<void> {
    this.requests.get(requestId)?.abort("Cancelled by user");
  }
}
