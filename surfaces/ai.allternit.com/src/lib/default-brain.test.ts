import { describe, expect, it } from "vitest";
import {
  isMistakenAutoDefault,
  isPaidAllternitPlan,
  migrateRetiredCodexSelection,
  pickDefaultBrain,
  shouldKeepPersistedSelection,
} from "./default-brain";
import type { ModelOption } from "@/components/prompt-kit/prompt-model-selector";
import type { ModelSelection } from "@/components/model-picker";

describe("isPaidAllternitPlan", () => {
  it("treats Plus/Super/Ultra active or trialing as paid", () => {
    expect(isPaidAllternitPlan({ id: "plus", status: "active" })).toBe(true);
    expect(isPaidAllternitPlan({ id: "ultra", status: "trialing" })).toBe(true);
    expect(isPaidAllternitPlan({ id: "free", status: "none" })).toBe(false);
    expect(isPaidAllternitPlan({ id: "plus", status: "canceled" })).toBe(false);
  });
});

describe("pickDefaultBrain", () => {
  it("returns null when nothing is discovered", () => {
    expect(pickDefaultBrain([])).toBeNull();
  });

  it("picks Allternit Cloud first when the plan is Plus/Super/Ultra", () => {
    const models: ModelOption[] = [
      { id: "claude-cli/claude-sonnet-5", name: "Claude Sonnet 5", providerId: "claude-cli" },
      { id: "allternit/llama-3.1-8b", name: "Llama 3.1 8B", providerId: "allternit" },
      { id: "ollama/llama3.2:3b", name: "llama3.2:3b", providerId: "ollama" },
    ];
    expect(pickDefaultBrain(models, ["claude-cli"], { id: "ultra", status: "active" })).toEqual(
      expect.objectContaining({
        providerId: "allternit",
        modelId: "llama-3.1-8b",
        modelAuto: true,
      }),
    );
  });

  it("does not treat sidecar local-engine as Allternit Cloud", () => {
    const models: ModelOption[] = [
      { id: "allternit-sidecar/qwen", name: "Qwen", providerId: "allternit-sidecar" },
      { id: "claude-cli/claude-sonnet-5", name: "Claude Sonnet 5", providerId: "claude-cli" },
    ];
    expect(
      pickDefaultBrain(models, ["claude-cli"], { id: "plus", status: "active" })?.providerId,
    ).toBe("claude-cli");
  });

  it("prefers Claude CLI over OpenCode default and local models", () => {
    const models: ModelOption[] = [
      { id: "opencode/default", name: "OpenCode default", providerId: "opencode" },
      { id: "omlx/Nail-35b-a3b", name: "Nail 35B-A3B (local)", providerId: "omlx" },
      { id: "ollama/llama3.2:3b", name: "llama3.2:3b", providerId: "ollama" },
      { id: "claude-cli/claude-sonnet-4-6", name: "Claude Sonnet", providerId: "claude-cli" },
    ];
    expect(pickDefaultBrain(models)?.providerId).toBe("claude-cli");
  });

  it("skips a logged-out Claude CLI when another CLI is authenticated", () => {
    const models: ModelOption[] = [
      { id: "claude-cli/claude-sonnet-5", name: "Claude Sonnet 5", providerId: "claude-cli" },
      { id: "grok/default", name: "Grok", providerId: "grok" },
      { id: "ollama/llama3.2:3b", name: "llama3.2:3b", providerId: "ollama" },
    ];
    expect(pickDefaultBrain(models, ["grok"])?.providerId).toBe("grok");
  });

  it("falls through to Local Brain when auth status is known and no CLI is signed in", () => {
    const models: ModelOption[] = [
      { id: "claude-cli/claude-sonnet-5", name: "Claude Sonnet 5", providerId: "claude-cli" },
      { id: "ollama/llama3.2:3b", name: "llama3.2:3b", providerId: "ollama" },
    ];
    expect(pickDefaultBrain(models, [])?.modelId).toBe("llama3.2:3b");
  });

  it("falls back to official Local Brain when no CLI runtime is present", () => {
    const models: ModelOption[] = [
      { id: "omlx/Qwen3-4B-Instruct-2507-4bit", name: "Qwen3 4B Instruct (local)", providerId: "omlx" },
      { id: "ollama/llama3.2:3b", name: "llama3.2:3b", providerId: "ollama" },
    ];
    expect(pickDefaultBrain(models)?.modelId).toBe("llama3.2:3b");
  });

  it("still offers an Ollama chat model when CLI and llama3.2 are missing", () => {
    const models: ModelOption[] = [
      { id: "ollama/qwen3:4b", name: "qwen3:4b", providerId: "ollama" },
      { id: "omlx/Qwen3-4B-Instruct-2507-4bit", name: "Qwen3 4B Instruct (local)", providerId: "omlx" },
    ];
    expect(pickDefaultBrain(models)?.providerId).toBe("ollama");
  });

  it("does not auto-pick Nail 35B when any other local model exists", () => {
    const models: ModelOption[] = [
      { id: "omlx/Nail-35b-a3b", name: "Nail 35B-A3B (local)", providerId: "omlx" },
      { id: "omlx/Qwen3-4B-Instruct-2507-4bit", name: "Qwen3 4B Instruct (local)", providerId: "omlx" },
    ];
    expect(pickDefaultBrain(models)?.modelId).toContain("Qwen3");
  });
});

describe("retired Codex model ids", () => {
  it("rewrites persisted codex-mini-latest to Astra", () => {
    expect(
      migrateRetiredCodexSelection({
        providerId: "codex-cli",
        profileId: "codex-cli",
        modelId: "codex-mini-latest",
        modelName: "Codex Mini Latest",
      }),
    ).toMatchObject({
      providerId: "codex-cli",
      modelId: "gpt-6-astra",
      modelName: "Astra",
    });
  });
});

describe("isMistakenAutoDefault", () => {
  it("flags the Nail 35B auto-pick so it is not restored as the product default", () => {
    const selection: ModelSelection = {
      providerId: "omlx",
      profileId: "omlx",
      modelId: "Nail-35b-a3b",
      modelName: "Nail 35B-A3B (local)",
    };
    expect(isMistakenAutoDefault(selection)).toBe(true);
  });
});

describe("shouldKeepPersistedSelection", () => {
  const claude: ModelSelection = {
    providerId: "claude-cli",
    profileId: "claude-cli",
    modelId: "claude-sonnet-5",
    modelName: "Claude Sonnet 5",
  };
  const grok: ModelSelection = {
    providerId: "grok",
    profileId: "grok",
    modelId: "default",
    modelName: "Grok",
  };
  const local: ModelSelection = {
    providerId: "ollama",
    profileId: "ollama",
    modelId: "llama3.2:3b",
    modelName: "llama3.2:3b",
  };

  it("keeps a persisted CLI until auth status is known", () => {
    expect(shouldKeepPersistedSelection(claude, [], false)).toBe(true);
  });

  it("drops logged-out Claude once auth status is known", () => {
    expect(shouldKeepPersistedSelection(claude, ["grok", "codex-cli"], true)).toBe(false);
    expect(shouldKeepPersistedSelection(claude, [], true)).toBe(false);
  });

  it("keeps a signed-in CLI and any local pick", () => {
    expect(shouldKeepPersistedSelection(grok, ["grok", "codex-cli"], true)).toBe(true);
    expect(shouldKeepPersistedSelection(local, ["grok"], true)).toBe(true);
  });

  it("lets a paid sub replace an auto CLI default, but keeps an explicit pin", () => {
    const plus = { id: "plus", status: "active" as const };
    expect(shouldKeepPersistedSelection(grok, ["grok"], true, plus)).toBe(false);
    expect(
      shouldKeepPersistedSelection({ ...grok, modelAuto: false }, ["grok"], true, plus),
    ).toBe(true);
    expect(
      shouldKeepPersistedSelection(
        { providerId: "allternit", profileId: "allternit", modelId: "llama-3.1-8b", modelAuto: true },
        [],
        true,
        plus,
      ),
    ).toBe(true);
  });
});
