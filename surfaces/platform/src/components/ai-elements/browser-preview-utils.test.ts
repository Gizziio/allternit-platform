import { describe, expect, it } from "vitest";

import type { ExtendedUIPart } from "@/lib/ai/rust-stream-adapter-extended";

import {
  extractPreviewCandidatesFromToolPart,
  injectWebPreviewParts,
  isBrowserPreviewToolName,
} from "./browser-preview-utils";

describe("browser-preview-utils", () => {
  it("recognizes browser and search tool names", () => {
    expect(isBrowserPreviewToolName("web_search")).toBe(true);
    expect(isBrowserPreviewToolName("agentBrowser")).toBe(true);
    expect(isBrowserPreviewToolName("readDocument")).toBe(false);
  });

  it("extracts a preview candidate from tool results with URLs", () => {
    const part = {
      type: "dynamic-tool",
      toolCallId: "tool-1",
      toolName: "web_search",
      state: "output-available",
      input: { query: "ai sdk docs" },
      result: {
        results: [
          {
            title: "AI SDK Docs",
            url: "https://ai-sdk.dev/docs",
          },
        ],
      },
    } satisfies Extract<ExtendedUIPart, { type: "dynamic-tool" }>;

    expect(extractPreviewCandidatesFromToolPart(part)).toEqual([
      {
        title: "AI SDK Docs",
        url: "https://ai-sdk.dev/docs",
      },
    ]);
  });

  it("falls back to tool input URLs for browser open actions", () => {
    const part = {
      type: "dynamic-tool",
      toolCallId: "tool-2",
      toolName: "agentBrowser",
      state: "output-available",
      input: { url: "https://example.com/pricing" },
      result: "opened",
    } satisfies Extract<ExtendedUIPart, { type: "dynamic-tool" }>;

    expect(extractPreviewCandidatesFromToolPart(part)).toEqual([
      {
        title: "example.com",
        url: "https://example.com/pricing",
      },
    ]);
  });

  it("injects a synthetic web-preview part after eligible tool results", () => {
    const parts = [
      {
        type: "dynamic-tool",
        toolCallId: "tool-3",
        toolName: "web_search",
        state: "output-available",
        input: { query: "docs" },
        result: {
          results: [
            {
              title: "Reference",
              url: "https://example.com/reference",
            },
          ],
        },
      },
      {
        type: "text",
        text: "Done",
      },
    ] satisfies ExtendedUIPart[];

    const augmented = injectWebPreviewParts(parts);

    expect(augmented.map((part) => part.type)).toEqual([
      "dynamic-tool",
      "web-preview",
      "text",
    ]);
    expect(augmented[1]).toMatchObject({
      type: "web-preview",
      title: "Reference",
      url: "https://example.com/reference",
    });
  });
});
