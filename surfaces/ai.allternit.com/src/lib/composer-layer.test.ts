import { describe, expect, it } from "vitest";
import { getComposerLayer, setComposerLayer } from "./composer-layer";

describe("composer-layer", () => {
  it("defaults to chat and persists agent", () => {
    sessionStorage.clear();
    expect(getComposerLayer()).toBe("chat");
    setComposerLayer("agent");
    expect(getComposerLayer()).toBe("agent");
    setComposerLayer("bot");
    expect(getComposerLayer()).toBe("bot");
  });
});
