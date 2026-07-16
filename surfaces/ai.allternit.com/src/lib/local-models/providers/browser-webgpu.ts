import type {
  InstalledLocalModel,
  LocalGenerationEvent,
  LocalGenerationRequest,
  LocalInstallProgress,
  LocalInstallRequest,
  LocalModelProvider,
  LocalProviderStatus,
} from "../types";

export interface BrowserModelRuntime {
  readonly adapter: string;
  isInstalled(modelId: string): Promise<boolean>;
  inspect(modelId: string): Promise<InstalledLocalModel>;
  install(request: LocalInstallRequest): AsyncIterable<LocalInstallProgress>;
  remove(modelId: string): Promise<void>;
  generate(request: LocalGenerationRequest): AsyncIterable<LocalGenerationEvent>;
}

function hasWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export class BrowserWebGpuProvider implements LocalModelProvider {
  readonly id = "browser-webgpu";
  readonly engine = "webgpu" as const;
  private readonly runtimes = new Map<string, BrowserModelRuntime>();
  private readonly installed = new Map<string, { adapter: string }>();

  registerRuntime(runtime: BrowserModelRuntime): () => void {
    this.runtimes.set(runtime.adapter, runtime);
    return () => this.runtimes.delete(runtime.adapter);
  }

  async connect(): Promise<LocalProviderStatus> {
    return {
      providerId: this.id,
      connected: hasWebGpu(),
      local: true,
      error: hasWebGpu() ? undefined : "WebGPU is not available in this browser",
    };
  }

  async listModels(): Promise<InstalledLocalModel[]> {
    const models: InstalledLocalModel[] = [];
    for (const [modelId, registration] of this.installed) {
      const runtime = this.runtimes.get(registration.adapter);
      if (runtime && (await runtime.isInstalled(modelId))) models.push(await runtime.inspect(modelId));
    }
    return models;
  }

  async inspectModel(runtimeModelId: string): Promise<InstalledLocalModel> {
    const registration = this.installed.get(runtimeModelId);
    const runtime = registration && this.runtimes.get(registration.adapter);
    if (!runtime) throw new Error(`No trusted WebGPU adapter is registered for ${runtimeModelId}`);
    return runtime.inspect(runtimeModelId);
  }

  async *installModel(request: LocalInstallRequest): AsyncIterable<LocalInstallProgress> {
    if (!hasWebGpu()) throw new Error("WebGPU is not available in this browser");
    const adapter = request.runtime.adapter;
    const runtime = adapter && this.runtimes.get(adapter);
    if (!adapter || !runtime) {
      throw new Error(`No trusted WebGPU adapter is registered for ${adapter ?? request.manifest.id}`);
    }
    for await (const progress of runtime.install(request)) yield progress;
    this.installed.set(request.manifest.id, { adapter });
  }

  async removeModel(runtimeModelId: string): Promise<void> {
    const registration = this.installed.get(runtimeModelId);
    const runtime = registration && this.runtimes.get(registration.adapter);
    if (!runtime) return;
    await runtime.remove(runtimeModelId);
    this.installed.delete(runtimeModelId);
  }

  async *generate(request: LocalGenerationRequest): AsyncIterable<LocalGenerationEvent> {
    const registration = this.installed.get(request.model);
    const runtime = registration && this.runtimes.get(registration.adapter);
    if (!runtime) throw new Error(`The WebGPU model ${request.model} is not installed`);
    for await (const event of runtime.generate(request)) yield event;
  }
}
