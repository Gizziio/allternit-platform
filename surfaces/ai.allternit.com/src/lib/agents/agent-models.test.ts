import { describe, expect, it } from "vitest";

import { config } from "@/lib/config";
import { getDefaultAgentModel } from "./agent-models";

describe("getDefaultAgentModel", () => {
  it("returns the platform primary (Kimi) even though it is a virtual id absent from the gateway registry", () => {
    const primary = config.models.defaults.primary;
    expect(primary).toBe("kimi/kimi-for-coding");
    const model = getDefaultAgentModel();
    expect(model.id).toBe("kimi/kimi-for-coding");
    expect(model.provider).toBe("custom");
  });
});
