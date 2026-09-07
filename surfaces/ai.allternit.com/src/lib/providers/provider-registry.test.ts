import { describe, expect, it } from "vitest";
import {
  canonicalProviderId,
  dedupeByCanonicalProvider,
  getProviderMeta,
  listCanonicalProviders,
} from "./provider-registry";

describe("canonicalProviderId", () => {
  it("folds CLI aliases onto one id", () => {
    expect(canonicalProviderId("claude")).toBe("claude-cli");
    expect(canonicalProviderId("claude-cli")).toBe("claude-cli");
    expect(canonicalProviderId("codex")).toBe("codex-cli");
    expect(canonicalProviderId("agy")).toBe("antigravity");
    expect(canonicalProviderId("copilot-cli")).toBe("copilot");
    expect(canonicalProviderId("ollama-cli")).toBe("ollama");
  });
});

describe("listCanonicalProviders", () => {
  it("does not list lookup-only aliases as extra Connect cards", () => {
    const ids = listCanonicalProviders().map((meta) => meta.id);
    expect(ids).toContain("claude-cli");
    expect(ids).not.toContain("claude");
    expect(ids).toContain("antigravity");
    expect(ids).not.toContain("agy");
    expect(ids).toContain("codex-cli");
    expect(ids).not.toContain("codex");
  });
});

describe("dedupeByCanonicalProvider", () => {
  it("keeps one row when backend reports both alias and canonical", () => {
    const rows = dedupeByCanonicalProvider([
      { provider_id: "claude", authenticated: true },
      { provider_id: "claude-cli", authenticated: true },
      { provider_id: "agy", authenticated: false },
      { provider_id: "antigravity", authenticated: true },
    ]);
    expect(rows.map((row) => row.provider_id)).toEqual(["claude-cli", "antigravity"]);
  });
});

describe("getProviderMeta", () => {
  it("resolves alias ids to the canonical card", () => {
    expect(getProviderMeta("claude").id).toBe("claude-cli");
    expect(getProviderMeta("agy").icon).toBe("antigravity.svg");
    expect(getProviderMeta("openrouter").icon).toBe("openrouter.svg");
  });
});
