import type {
  InstalledLocalModel,
  LocalGenerationEvent,
  LocalGenerationRequest,
  LocalInstallProgress,
  LocalInstallRequest,
  LocalModelProvider,
  LocalProviderStatus,
} from "../types";

export const BONSAI_WEBGPU_MODEL_ID = "bonsai-image-ternary-4b";
export const BONSAI_WEBGPU_PROVIDER_PREFERENCE = "allternit:image-provider";
export const BONSAI_WEBGPU_CONSENT = "allternit:bonsai-webgpu-consent";

const BUNDLE_CACHE = "allternit-bonsai-webgpu-runtime-v1";
const MODEL_CACHE = "bonsai-image-v1";
const BUNDLE_CACHE_KEY = "/__allternit/bonsai-webgpu/index-Bf-HmMxp.js";
const BUNDLE_URL =
  "https://huggingface.co/spaces/webml-community/bonsai-image-webgpu/raw/main/assets/index-Bf-HmMxp.js";
const BUNDLE_SHA256 = "8e1726c485bfdae81ad7fa479a73a60cc27313a40e5b76b588245d1c9416f0eb";
const WORKER_URL = "/bonsai-webgpu-worker.js";

type SandboxReply = {
  source: "allternit-bonsai-webgpu";
  id: string;
  ok: boolean;
  result?: { blob?: Blob; seed?: number; spec?: unknown };
  error?: string;
  progress?: { completedBytes?: number; totalBytes?: number; message?: string };
};

function hasWebGpu(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

function assertConsent(): void {
  if (typeof sessionStorage === "undefined" || sessionStorage.getItem(BONSAI_WEBGPU_CONSENT) !== "accepted") {
    throw new Error("Fast Bonsai WebGPU requires explicit consent in Local Models before it can run.");
  }
}

class BonsaiWorkerClient {
  private worker?: Worker;

  private ensureWorker(): Worker {
    if (!this.worker) this.worker = new Worker(WORKER_URL, { name: "allternit-bonsai-webgpu" });
    return this.worker;
  }

  async request(
    action: "probe-runtime" | "install" | "generate" | "export-spec",
    payload: Record<string, unknown> = {},
    onProgress?: (progress: NonNullable<SandboxReply["progress"]>) => void,
    signal?: AbortSignal,
  ): Promise<SandboxReply["result"]> {
    const worker = this.ensureWorker();
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        worker.removeEventListener("message", onMessage);
        signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        worker.postMessage({ source: "allternit-parent", id, action: "cancel" });
        cleanup();
        reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
      };
      const onMessage = (event: MessageEvent<SandboxReply>) => {
        const message = event.data;
        if (message?.source !== "allternit-bonsai-webgpu" || message.id !== id) return;
        if (message.progress) {
          onProgress?.(message.progress);
          return;
        }
        cleanup();
        if (message.ok) resolve(message.result);
        else reject(new Error(message.error ?? "Bonsai WebGPU Worker failed"));
      };
      worker.addEventListener("message", onMessage);
      signal?.addEventListener("abort", onAbort, { once: true });
      worker.postMessage({ source: "allternit-parent", id, action, ...payload });
    });
  }

  destroy(): void {
    this.worker?.terminate();
    this.worker = undefined;
  }
}

export class BonsaiWebGpuProvider implements LocalModelProvider {
  readonly id = "bonsai-webgpu";
  readonly engine = "webgpu" as const;
  private readonly worker = new BonsaiWorkerClient();

  async connect(): Promise<LocalProviderStatus> {
    if (!hasWebGpu()) return { providerId: this.id, connected: false, local: true, error: "WebGPU is not available in this browser" };
    const installed = typeof caches !== "undefined" && Boolean(await (await caches.open(BUNDLE_CACHE)).match(BUNDLE_CACHE_KEY));
    return {
      providerId: this.id,
      connected: true,
      local: true,
      version: installed ? BUNDLE_SHA256.slice(0, 12) : undefined,
    };
  }

  private installedModel(): InstalledLocalModel {
    return {
      id: BONSAI_WEBGPU_MODEL_ID,
      providerId: this.id,
      runtimeModelId: BONSAI_WEBGPU_MODEL_ID,
      name: "Bonsai Image Ternary 4B (WebGPU)",
      digest: BUNDLE_SHA256,
      capabilities: { tasks: ["text-to-image"], supportsStreaming: false, supportsSeed: true, verified: false },
      metadata: { bundleUrl: BUNDLE_URL, modelCache: MODEL_CACHE },
    };
  }

  async listModels(): Promise<InstalledLocalModel[]> {
    const status = await this.connect();
    return status.version ? [this.installedModel()] : [];
  }

  async inspectModel(runtimeModelId: string): Promise<InstalledLocalModel> {
    if (runtimeModelId !== BONSAI_WEBGPU_MODEL_ID || !(await this.connect()).version) {
      throw new Error(`The WebGPU model ${runtimeModelId} is not installed`);
    }
    return this.installedModel();
  }

  async *installModel(request: LocalInstallRequest): AsyncIterable<LocalInstallProgress> {
    assertConsent();
    if (!hasWebGpu()) throw new Error("WebGPU is not available in this browser");
    yield { status: "starting", message: "Preparing the isolated WebGPU runtime…" };
    const progress: LocalInstallProgress[] = [];
    let wake: (() => void) | undefined;
    let finished = false;
    let failure: unknown;
    void this.worker.request("install", {}, (event) => {
      progress.push({ status: "downloading", ...event });
      wake?.();
      wake = undefined;
    }, request.signal).catch(error => {
      failure = error;
    }).finally(() => {
      finished = true;
      wake?.();
    });
    while (!finished || progress.length > 0) {
      const event = progress.shift();
      if (event) yield event;
      else await new Promise<void>(resolve => { wake = resolve; });
    }
    if (failure) throw failure;
    yield { status: "verifying", message: `Verified runtime SHA-256 ${BUNDLE_SHA256.slice(0, 12)}…` };
    yield { status: "ready", message: "Bonsai WebGPU is cached and ready." };
  }

  async ensureInstalled(signal?: AbortSignal): Promise<void> {
    if ((await this.connect()).version) return;
    assertConsent();
    await this.worker.request("install", {}, undefined, signal);
  }

  async removeModel(_runtimeModelId: string = BONSAI_WEBGPU_MODEL_ID): Promise<void> {
    this.worker.destroy();
    if (typeof caches !== "undefined") await Promise.all([caches.delete(BUNDLE_CACHE), caches.delete(MODEL_CACHE)]);
  }

  async exportRuntimeSpec(): Promise<unknown> {
    const result = await this.worker.request("export-spec");
    return result?.spec;
  }

  async probeRuntime(signal?: AbortSignal): Promise<void> {
    assertConsent();
    await this.worker.request("probe-runtime", {}, undefined, signal);
  }

  async generateImage(
    prompt: string,
    options: { width?: number; height?: number; seed?: number; signal?: AbortSignal } = {},
  ): Promise<{ blob: Blob; seed: number }> {
    assertConsent();
    await this.ensureInstalled(options.signal);
    const seed = options.seed ?? 42;
    const result = await this.worker.request("generate", {
      prompt,
      width: options.width ?? 1024,
      height: options.height ?? 1024,
      numInferenceSteps: 4,
      seed,
    }, undefined, options.signal);
    if (!(result?.blob instanceof Blob)) throw new Error("Bonsai WebGPU returned no image");
    return { blob: result.blob, seed: result.seed ?? seed };
  }

  async *generate(request: LocalGenerationRequest): AsyncIterable<LocalGenerationEvent> {
    const image = await this.generateImage(request.prompt ?? "", { seed: request.seed, signal: request.signal });
    yield { type: "image", blob: image.blob, seed: image.seed };
    yield { type: "done", finishReason: "stop" };
  }
}

export const bonsaiWebGpuProvider = new BonsaiWebGpuProvider();
