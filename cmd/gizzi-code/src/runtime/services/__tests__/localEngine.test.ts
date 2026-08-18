/**
 * Local Engine service client tests.
 *
 * Covers URL construction, response parsing, and error handling for the
 * hardware/catalog/assess/recommend endpoints consumed by `gizzi models`
 * and `gizzi hardware`.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getStatus,
  getCatalog,
  refreshCatalog,
  assessRepo,
  recommendRepos,
} from "@/runtime/services/localEngine";

const baseStatus = {
  status: "healthy",
  active_runtimes: 0,
  cached_models: 0,
  hardware_id: "abc123",
  apple_chip: "M1",
  unified_memory: true,
  backends: { metal: true, cuda: false, cpu_fallback: true },
  platform: { os: "MacOS", arch: "aarch64" },
  cpu: { model: "Apple M1", cores: 8, threads: 8 },
  ram: { total_bytes: 16e9, used_bytes: 8e9, total_mb: 16384, used_mb: 8192 },
};

const baseAssessment = {
  repo_id: "owner/Model-GGUF",
  fit: "fits",
  fit_reason: "Fits comfortably",
  estimated_download_bytes: 2e9,
  estimated_loaded_bytes: 2.5e9,
  estimated_tok_per_second: {
    context_4k: 30,
    context_8k: 28,
    context_16k: 25,
    context_32k: 22,
  },
  recommended_backend: "mlx",
  confidence: "guess",
  quantization_bits: 4,
  hardware_id: "abc123",
};

const baseRecommendation = {
  repo_id: "owner/Model-GGUF",
  fit: "fits",
  fit_reason: "Fits comfortably",
  estimated_download_bytes: 2e9,
  estimated_loaded_bytes: 2.5e9,
  estimated_tok_per_second: {
    context_4k: 30,
    context_8k: 28,
    context_16k: 25,
    context_32k: 22,
  },
  recommended_backend: "mlx",
  confidence: "guess",
  score: 0.9,
  explanation: "Good fit",
  downloads: 1000,
  likes: 100,
};

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function setFetchMock(handler: FetchHandler) {
  globalThis.fetch = handler as unknown as typeof globalThis.fetch;
}

describe("localEngine service", () => {
  const originalFetch = globalThis.fetch;
  const originalEnv = process.env.LOCAL_ENGINE_URL;

  beforeEach(() => {
    process.env.LOCAL_ENGINE_URL = "http://127.0.0.1:3015";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalEnv === undefined) {
      delete process.env.LOCAL_ENGINE_URL;
    } else {
      process.env.LOCAL_ENGINE_URL = originalEnv;
    }
  });

  it("getStatus parses hardware profile", async () => {
    setFetchMock(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe("http://127.0.0.1:3015/status");
      return new Response(JSON.stringify(baseStatus), { status: 200 });
    });

    const status = await getStatus();
    expect(status.hardware_id).toBe("abc123");
    expect(status.apple_chip).toBe("M1");
    expect(status.backends.metal).toBe(true);
  });

  it("getCatalog forwards source and limit query params", async () => {
    setFetchMock(async (input: RequestInfo | URL) => {
      expect(input.toString()).toBe(
        "http://127.0.0.1:3015/catalog?source=seed&limit=5"
      );
      return new Response(
        JSON.stringify({
          models: [
            {
              repo_id: "seed/model",
              downloads: 1,
              likes: 2,
              source: "seed",
            },
          ],
          count: 1,
        }),
        { status: 200 }
      );
    });

    const result = await getCatalog("seed", 5);
    expect(result.count).toBe(1);
    expect(result.models[0].source).toBe("seed");
  });

  it("refreshCatalog posts to /catalog/refresh", async () => {
    setFetchMock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input.toString()).toBe("http://127.0.0.1:3015/catalog/refresh");
      expect(init?.method).toBe("POST");
      return new Response(JSON.stringify({ refreshed: true, count: 33 }), {
        status: 200,
      });
    });

    const result = await refreshCatalog();
    expect(result.refreshed).toBe(true);
    expect(result.count).toBe(33);
  });

  it("assessRepo posts repo_id and quantization", async () => {
    setFetchMock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input.toString()).toBe("http://127.0.0.1:3015/assess");
      const body = JSON.parse(init?.body as string);
      expect(body.repo_id).toBe("owner/Model-GGUF");
      expect(body.quantization).toBe("Q4_K_M");
      return new Response(JSON.stringify(baseAssessment), { status: 200 });
    });

    const result = await assessRepo("owner/Model-GGUF", "Q4_K_M");
    expect(result.fit).toBe("fits");
    expect(result.recommended_backend).toBe("mlx");
    expect(result.estimated_tok_per_second.context_4k).toBe(30);
  });

  it("recommendRepos posts intent and limit", async () => {
    setFetchMock(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input.toString()).toBe("http://127.0.0.1:3015/recommend");
      const body = JSON.parse(init?.body as string);
      expect(body.intent).toBe("fastest");
      expect(body.limit).toBe(3);
      return new Response(
        JSON.stringify({
          recommendations: [baseRecommendation],
          hardware_id: "abc123",
          timestamp: "2026-01-01T00:00:00Z",
        }),
        { status: 200 }
      );
    });

    const result = await recommendRepos("fastest", 3);
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].score).toBe(0.9);
  });

  it("throws LocalEngineError on non-ok response", async () => {
    setFetchMock(async () => {
      return new Response("not found", { status: 404 });
    });

    await expect(getStatus()).rejects.toThrow("Local Engine 404");
  });
});
