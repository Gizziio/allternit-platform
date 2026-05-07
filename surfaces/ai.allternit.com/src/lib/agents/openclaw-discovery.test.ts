import { describe, expect, it } from "vitest";

import {
  getRegisteredOpenClawAgentId,
  resolveOpenClawRegistration,
  type OpenClawDiscoveredAgent,
} from "./openclaw-discovery";

const candidate: OpenClawDiscoveredAgent = {
  agent_id: "main",
  display_name: "Main",
  agent_dir: "/Users/macbook/.openclaw/agents/main",
  workspace_path: "/Users/macbook/.openclaw/workspace",
  session_count: 48,
  auth_providers: ["google-gemini-cli"],
  models: ["google-gemini-cli/gemini-3-pro-preview"],
  primary_model: "google-gemini-cli/gemini-3-pro-preview",
  primary_provider: "google-gemini-cli",
  files: {
    models: true,
    auth_profiles: true,
    sessions_store: true,
  },
  registered_agent_id: null,
};

describe("openclaw discovery matching", () => {
  it("matches an imported platform agent by OpenClaw agent id", () => {
    const registeredAgentId = getRegisteredOpenClawAgentId(candidate, [
      {
        id: "agent-1",
        config: {
          source: "openclaw",
          openclaw: {
            agentId: "main",
            agentDir: "/Users/macbook/.openclaw/agents/main",
            workspacePath: "/Users/macbook/.openclaw/workspace",
          },
        },
      },
    ]);

    expect(registeredAgentId).toBe("agent-1");
  });

  it("matches an imported platform agent by normalized workspace path", () => {
    const registeredAgentId = getRegisteredOpenClawAgentId(candidate, [
      {
        id: "agent-2",
        config: {
          source: "openclaw",
          openclaw: {
            workspacePath: "/Users/macbook/.openclaw/workspace/",
          },
        },
      },
    ]);

    expect(registeredAgentId).toBe("agent-2");
  });

  it("marks resolved candidates with their registered platform agent id", () => {
    const resolved = resolveOpenClawRegistration([candidate], [
      {
        id: "agent-3",
        config: {
          source: "openclaw",
          openclaw: {
            agentDir: "/Users/macbook/.openclaw/agents/main",
          },
        },
      },
    ]);

    expect(resolved).toEqual([
      {
        ...candidate,
        registered_agent_id: "agent-3",
      },
    ]);
  });
});
