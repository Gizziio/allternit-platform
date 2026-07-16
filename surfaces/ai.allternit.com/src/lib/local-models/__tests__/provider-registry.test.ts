import { describe, expect, it } from "vitest";
import { LOCAL_MODEL_CATALOG } from "../catalog";
import { LocalProviderRegistry } from "../provider-registry";
import { routeLocalModel } from "../router";
import type { LocalModelProvider } from "../types";

function provider(overrides: Partial<LocalModelProvider> = {}): LocalModelProvider {
  return {
    id: "test",
    engine: "ollama",
    connect: async () => ({ providerId: "test", connected: true, local: true }),
    listModels: async () => [
      {
        id: "ollama:llama3.2:3b",
        providerId: "test",
        runtimeModelId: "llama3.2:3b",
        name: "Local Brain",
        capabilities: {
          tasks: ["chat", "structured-output"],
          supportsStreaming: true,
          supportsSeed: true,
          verified: true,
        },
      },
    ],
    inspectModel: async () => {
      throw new Error("unused");
    },
    installModel: async function* () {
      yield { status: "ready" };
    },
    removeModel: async () => undefined,
    generate: async function* () {
      yield { type: "done" };
    },
    ...overrides,
  };
}

describe("local model foundation", () => {
  it("rejects duplicate provider registrations", () => {
    const registry = new LocalProviderRegistry();
    registry.register(provider());
    expect(() => registry.register(provider())).toThrow(/already registered/);
  });

  it("routes by capability instead of a hard-coded model name", async () => {
    const selection = await routeLocalModel([provider()], {
      requires: ["chat", "structured-output"],
    });
    expect(selection?.model.runtimeModelId).toBe("llama3.2:3b");
  });

  it("keeps model manifests declarative and versioned", () => {
    expect(LOCAL_MODEL_CATALOG.length).toBeGreaterThan(2);
    expect(LOCAL_MODEL_CATALOG.every((model) => model.schema === "allternit.model.v1")).toBe(true);
    expect(LOCAL_MODEL_CATALOG.some((model) => model.id === "bonsai-image-ternary-4b")).toBe(true);
  });
});
