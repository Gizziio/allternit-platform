import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Agent } from "./agent.types";
import {
  createLocalAgent,
  mergeAgentCatalog,
  shouldUseLocalAgentRegistryFallback,
} from "./local-agent-registry";

describe("local-agent-registry", () => {
  let storage: Map<string, string>;

  beforeEach(() => {
    storage = new Map<string, string>();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => {
      return storage.get(key) ?? null;
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(
      (key: string, value: string) => {
        storage.set(key, value);
      },
    );
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key: string) => {
      storage.delete(key);
    });
    vi.spyOn(Storage.prototype, "clear").mockImplementation(() => {
      storage.clear();
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a local fallback agent with the expected registry markers", () => {
    const created = createLocalAgent({
      name: "Main",
      description: "Imported from OpenClaw",
      type: "worker",
      model: "google-gemini-cli/gemini-3-pro-preview",
      provider: "custom",
      capabilities: ["chat", "workspace"],
      config: {
        source: "openclaw",
        openclaw: {
          agentId: "main",
          agentDir: "/Users/macbook/.openclaw/agents/main",
          workspacePath: "/Users/macbook/.openclaw/workspace",
        },
      },
    });

    expect(created.id).toMatch(/^local-agent-/);
    expect(created.config).toMatchObject({
      source: "openclaw",
      localRegistry: {
        fallback: true,
      },
    });
  });

  it("dedupes remote and local OpenClaw imports by binding", () => {
    const localAgent = createLocalAgent({
      name: "Main",
      description: "Imported from OpenClaw",
      type: "worker",
      model: "google-gemini-cli/gemini-3-pro-preview",
      provider: "custom",
      capabilities: ["chat", "workspace"],
      config: {
        source: "openclaw",
        openclaw: {
          agentId: "main",
          agentDir: "/Users/macbook/.openclaw/agents/main",
          workspacePath: "/Users/macbook/.openclaw/workspace",
        },
      },
    });

    const remote: Agent[] = [
      {
        id: "agent-registry-main",
        name: "Main",
        description: "Registry copy",
        type: "worker",
        model: "google-gemini-cli/gemini-3-pro-preview",
        provider: "custom",
        capabilities: ["chat", "workspace"],
        tools: [],
        maxIterations: 10,
        temperature: 0.7,
        config: {
          source: "openclaw",
          openclaw: {
            agentId: "main",
            agentDir: "/Users/macbook/.openclaw/agents/main",
            workspacePath: "/Users/macbook/.openclaw/workspace",
          },
        },
        status: "idle",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const merged = mergeAgentCatalog(remote, [localAgent]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("agent-registry-main");
  });

  it("allows fallback on local shell when the registry request fails", () => {
    expect(
      shouldUseLocalAgentRegistryFallback({
        statusCode: 500,
        message: "HTTP 500",
      }),
    ).toBe(true);
  });
});
