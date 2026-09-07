import { describe, expect, it } from "vitest";
import { selectionToGizziBrain } from "./aci-runtime";

describe("selectionToGizziBrain", () => {
  it("maps the Gizzi picker selection onto ACI and gizzi session model shapes", () => {
    const brain = selectionToGizziBrain({
      providerId: "claude-cli",
      profileId: "claude-cli",
      modelId: "claude-sonnet-4-6",
      modelName: "Sonnet 4.6",
    });

    expect(brain).toEqual({
      providerId: "claude-cli",
      modelId: "claude-sonnet-4-6",
      profileId: "claude-cli",
      modelName: "Sonnet 4.6",
      aciModel: "claude-cli/claude-sonnet-4-6",
      gizziModel: { providerID: "claude-cli", modelID: "claude-sonnet-4-6" },
      label: "claude-cli · Sonnet 4.6",
    });
  });

  it("returns null when the picker has no brain", () => {
    expect(selectionToGizziBrain(null)).toBeNull();
    expect(selectionToGizziBrain({ providerId: "", profileId: "", modelId: "" })).toBeNull();
  });
});
