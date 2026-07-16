import { LOCAL_MODEL_SCHEMA, type LocalModelManifest } from "./types";

const GB = 1_000_000_000;

export const LOCAL_MODEL_CATALOG: readonly LocalModelManifest[] = [
  {
    schema: LOCAL_MODEL_SCHEMA,
    id: "local-brain-llama-3.2-3b",
    name: "Local Brain",
    description: "Private general-purpose local brain for everyday Allternit tasks.",
    kind: "brain",
    tasks: ["chat", "structured-output"],
    runtimes: [{ engine: "ollama", model: "llama3.2:3b" }],
    requirements: { minimumMemoryBytes: 4 * GB },
    defaults: { temperature: 0.2, contextLength: 8192 },
    delivery: { status: "integrated", note: "Runs through the local Ollama service." },
  },
  {
    schema: LOCAL_MODEL_SCHEMA,
    id: "gemma-4-e2b-local",
    name: "Gemma 4 E2B",
    description: "Small multimodal brain with browser and native-local runtime options.",
    kind: "brain",
    tasks: ["chat", "reasoning", "tools", "structured-output", "vision"],
    runtimes: [
      {
        engine: "webgpu",
        adapter: "gemma-4-webgpu",
        source: { type: "huggingface", repository: "google/gemma-4-e2b" },
      },
      { engine: "ollama", model: "gemma4:e2b" },
    ],
    requirements: {
      webgpu: true,
      estimatedDownloadBytes: 1.5 * GB,
      minimumMemoryBytes: 4 * GB,
    },
    defaults: { temperature: 0.2, contextLength: 8192 },
    license: { id: "gemma", url: "https://ai.google.dev/gemma/terms", noticeRequired: true },
    delivery: {
      status: "adapter-required",
      note: "Catalog metadata only until a reviewed Gemma WebGPU adapter is registered.",
    },
  },
  {
    schema: LOCAL_MODEL_SCHEMA,
    id: "bonsai-image-ternary-4b-native",
    name: "Bonsai Image Ternary 4B (Native)",
    description: "Local image generation through the packaged Allternit Bonsai companion on Apple Silicon.",
    kind: "image",
    tasks: ["text-to-image"],
    runtimes: [
      {
        engine: "desktop",
        model: "bonsai-ternary-mlx",
        source: {
          type: "huggingface",
          repository: "prism-ml/bonsai-image-ternary-4B-mlx-2bit",
          revision: "2c24c81b934a658ba5590cf39088ba929985b4a8",
        },
      },
    ],
    requirements: {
      estimatedDownloadBytes: 3.89 * GB,
      minimumMemoryBytes: 8 * GB,
    },
    license: { id: "Apache-2.0", noticeRequired: true },
    delivery: {
      status: "integrated",
      note: "Installed and supervised by the Allternit desktop app; serves only http://127.0.0.1:8000. Verified end-to-end with deterministic seed-42 generation on 2026-07-15.",
    },
  },
  {
    schema: LOCAL_MODEL_SCHEMA,
    id: "bonsai-image-ternary-4b",
    name: "Bonsai Image Ternary 4B",
    description: "Quality-oriented local image generation using low-bit WebGPU kernels.",
    kind: "image",
    tasks: ["text-to-image"],
    runtimes: [
      {
        engine: "webgpu",
        adapter: "bonsai-image-webgpu",
        source: {
          type: "huggingface",
          repository: "prism-ml/bonsai-image-ternary-4B-mlx-2bit",
        },
      },
    ],
    requirements: {
      webgpu: true,
      estimatedDownloadBytes: 3.88 * GB,
      minimumMemoryBytes: 2.4 * GB,
    },
    license: { id: "Apache-2.0", noticeRequired: true },
    delivery: {
      status: "adapter-required",
      note: "Downloads the checksum-pinned, unaudited webml-community WebGPU runtime from Hugging Face at install time; runs locally on your GPU and is never packaged by Allternit.",
    },
  },
  {
    schema: LOCAL_MODEL_SCHEMA,
    id: "bonsai-image-binary-4b",
    name: "Bonsai Image Binary 4B",
    description: "Memory-oriented local image generation using one-bit WebGPU kernels.",
    kind: "image",
    tasks: ["text-to-image"],
    runtimes: [
      {
        engine: "webgpu",
        adapter: "bonsai-image-webgpu",
        source: {
          type: "huggingface",
          repository: "prism-ml/bonsai-image-binary-4B-mlx-1bit",
        },
      },
    ],
    requirements: {
      webgpu: true,
      estimatedDownloadBytes: 3.42 * GB,
      minimumMemoryBytes: 2 * GB,
    },
    license: { id: "Apache-2.0", noticeRequired: true },
    delivery: {
      status: "blocked",
      note: "The public WebGPU demo has no declared source license; its minified bundle is not packaged by Allternit.",
    },
  },
];

export function getLocalModelManifest(id: string): LocalModelManifest | undefined {
  return LOCAL_MODEL_CATALOG.find((manifest) => manifest.id === id);
}

export function getCatalogForEngine(engine: string): LocalModelManifest[] {
  return LOCAL_MODEL_CATALOG.filter((manifest) =>
    manifest.runtimes.some((runtime) => runtime.engine === engine),
  );
}
