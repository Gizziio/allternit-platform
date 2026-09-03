import { describe, expect, it } from "vitest";
import { getLogosAppsUrl } from "./logos-apps";

describe("getLogosAppsUrl", () => {
  it("returns null for empty input", () => {
    expect(getLogosAppsUrl("")).toBeNull();
    expect(getLogosAppsUrl(undefined)).toBeNull();
    expect(getLogosAppsUrl(null)).toBeNull();
  });

  it("normalizes brand names to local logos-apps path", () => {
    expect(getLogosAppsUrl("OpenAI")).toBe("/assets/logos-apps/openai.svg");
    expect(getLogosAppsUrl("Anthropic")).toBe("/assets/logos-apps/anthropic.svg");
  });

  it("resolves aliases", () => {
    expect(getLogosAppsUrl("xAI")).toBe("/assets/logos-apps/x.svg");
    expect(getLogosAppsUrl("Grok")).toBe("/assets/logos-apps/grok.svg");
    expect(getLogosAppsUrl("Amazon Bedrock")).toBe(
      "/assets/logos-apps/amazon-web-services.svg"
    );
    expect(getLogosAppsUrl("Claude")).toBe("/assets/logos-apps/anthropic.svg");
    expect(getLogosAppsUrl("Codex CLI")).toBe("/assets/logos-apps/openai.svg");
    expect(getLogosAppsUrl("Google Gemini")).toBe("/assets/logos-apps/gemini.svg");
    expect(getLogosAppsUrl("Gemini")).toBe("/assets/logos-apps/gemini.svg");
    expect(getLogosAppsUrl("Mistral")).toBe("/assets/logos-apps/mistral-ai.svg");
    expect(getLogosAppsUrl("Together AI")).toBe(
      "/assets/logos-apps/together-ai.svg"
    );
    expect(getLogosAppsUrl("Antigravity")).toBe(
      "/assets/logos-apps/google-antigravity.svg"
    );
    expect(getLogosAppsUrl("GitHub Copilot")).toBe(
      "/assets/logos-apps/github-copilot.svg"
    );
    expect(getLogosAppsUrl("Pi")).toBe("/assets/logos-apps/pi-coding-agent.svg");
    expect(getLogosAppsUrl("Trae CLI")).toBe("/assets/logos-apps/traeai.svg");
    expect(getLogosAppsUrl("MiniMax Code")).toBe(
      "/assets/logos-apps/minimax.svg"
    );
  });

  it("returns null for brands with no logos-apps entry", () => {
    expect(getLogosAppsUrl("ZAI")).toBeNull();
    expect(getLogosAppsUrl("CodeBuddy")).toBeNull();
    expect(getLogosAppsUrl("DevEco Code")).toBeNull();
    expect(getLogosAppsUrl("Kiro CLI")).toBeNull();
    expect(getLogosAppsUrl("Qoder CLI")).toBeNull();
    expect(getLogosAppsUrl("QwenPaw")).toBeNull();
    expect(getLogosAppsUrl("Reasonix")).toBeNull();
    expect(getLogosAppsUrl("Oh-My-Pi")).toBeNull();
    expect(getLogosAppsUrl("Dim")).toBeNull();
    expect(getLogosAppsUrl("Allternit")).toBeNull();
  });
});
