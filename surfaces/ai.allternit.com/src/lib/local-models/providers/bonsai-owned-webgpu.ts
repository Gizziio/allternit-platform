import { BONSAI_PINNED_ARTIFACT_BYTES, OwnedBonsaiPipeline } from "../bonsai-runtime";
import type {
  InstalledLocalModel,
  LocalGenerationEvent,
  LocalGenerationRequest,
  LocalInstallProgress,
  LocalInstallRequest,
  LocalModelProvider,
  LocalProviderStatus,
} from "../types";

export const BONSAI_OWNED_WEBGPU_MODEL_ID = "bonsai-image-owned-webgpu";
export const BONSAI_OWNED_WEBGPU_ENABLE = "allternit:bonsai-owned-webgpu-enable";

function enabledForSession(): boolean {
  return typeof sessionStorage !== "undefined" &&
    sessionStorage.getItem(BONSAI_OWNED_WEBGPU_ENABLE) === "accepted";
}

function requireSessionEnable(): void {
  if (!enabledForSession()) {
    throw new Error("The experimental auditable Bonsai WebGPU runtime must be enabled explicitly for this session.");
  }
}

function installedModel(providerId: string): InstalledLocalModel {
  return {
    id: BONSAI_OWNED_WEBGPU_MODEL_ID,
    providerId,
    runtimeModelId: BONSAI_OWNED_WEBGPU_MODEL_ID,
    name: "Bonsai Image Ternary 4B (Allternit WebGPU, experimental)",
    sizeBytes: BONSAI_PINNED_ARTIFACT_BYTES,
    capabilities: {
      tasks: ["text-to-image"],
      supportsStreaming: false,
      supportsSeed: true,
      verified: false,
    },
    metadata: {
      maximumWidth: 1024,
      maximumHeight: 1024,
      delivery: "range-streamed-from-pinned-hugging-face-revision",
      releaseReady: false,
    },
  };
}

/**
 * Auditable Phase-B provider. It remains separately named and session-gated
 * until quality, speed, and 1024px tiled execution match the release target.
 */
export class BonsaiOwnedWebGpuProvider implements LocalModelProvider {
  readonly id = "bonsai-owned-webgpu";
  readonly engine = "webgpu" as const;
  private pipeline?: Promise<OwnedBonsaiPipeline>;

  async connect(): Promise<LocalProviderStatus> {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      return { providerId: this.id, connected: false, local: true, error: "WebGPU is unavailable" };
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return { providerId: this.id, connected: false, local: true, error: "No WebGPU adapter is available" };
    if (adapter.limits.maxStorageBufferBindingSize < 128 * 1024 * 1024) {
      return { providerId: this.id, connected: false, local: true, error: "The WebGPU storage-binding limit is below 128 MiB" };
    }
    return { providerId: this.id, connected: true, local: true, version: "phase-b-experimental" };
  }

  async listModels(): Promise<InstalledLocalModel[]> {
    return enabledForSession() ? [installedModel(this.id)] : [];
  }

  async inspectModel(runtimeModelId: string): Promise<InstalledLocalModel> {
    if (runtimeModelId !== BONSAI_OWNED_WEBGPU_MODEL_ID || !enabledForSession()) {
      throw new Error(`The owned WebGPU model ${runtimeModelId} is not enabled`);
    }
    return installedModel(this.id);
  }

  async *installModel(_request: LocalInstallRequest): AsyncIterable<LocalInstallProgress> {
    requireSessionEnable();
    const status = await this.connect();
    if (!status.connected) throw new Error(status.error ?? "Owned Bonsai WebGPU is unavailable");
    yield { status: "starting", message: "Checking the auditable WebGPU runtime…" };
    yield {
      status: "ready",
      completedBytes: 0,
      totalBytes: BONSAI_PINNED_ARTIFACT_BYTES,
      message: "Ready to range-stream pinned weights during generation; no model files were downloaded yet.",
    };
  }

  async removeModel(_runtimeModelId: string = BONSAI_OWNED_WEBGPU_MODEL_ID): Promise<void> {
    const pipeline = await this.pipeline?.catch(() => undefined);
    pipeline?.dispose();
    this.pipeline = undefined;
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(BONSAI_OWNED_WEBGPU_ENABLE);
  }

  async *generate(request: LocalGenerationRequest): AsyncIterable<LocalGenerationEvent> {
    requireSessionEnable();
    if (request.model !== BONSAI_OWNED_WEBGPU_MODEL_ID) throw new Error(`Unsupported owned Bonsai model: ${request.model}`);
    request.signal?.throwIfAborted();
    const width = request.width ?? 512;
    const height = request.height ?? 512;
    if (width > 1024 || height > 1024) throw new Error("Owned Bonsai WebGPU supports up to 1024px");
    const pipeline = await this.getPipeline();
    const blob = await pipeline.generate({
      prompt: request.prompt ?? "",
      width,
      height,
      numInferenceSteps: 4,
      seed: request.seed,
      signal: request.signal,
    });
    yield { type: "image", blob, seed: request.seed ?? 42 };
    yield { type: "done", finishReason: "stop" };
  }

  private getPipeline(): Promise<OwnedBonsaiPipeline> {
    if (!this.pipeline) {
      this.pipeline = OwnedBonsaiPipeline.create().catch(error => {
        this.pipeline = undefined;
        throw error;
      });
    }
    return this.pipeline;
  }
}

export const bonsaiOwnedWebGpuProvider = new BonsaiOwnedWebGpuProvider();
