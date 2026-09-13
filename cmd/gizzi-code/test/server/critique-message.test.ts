import { describe, expect, test } from "bun:test"

import {
  panelistMessage,
  supportsVisionParts,
  type Panelist,
} from "../../src/runtime/server/routes/critique"
import { SubprocessLanguageModel } from "../../src/runtime/providers/adapters/loaders/subprocess"

const PANELIST: Panelist = {
  role: "Visual design",
  dimensions: ["Visual hierarchy"],
  stance: "You are a designer.",
}

function modelWith(image: boolean): any {
  return {
    providerID: "openai",
    id: "gpt-test",
    capabilities: {
      input: { text: true, image, audio: false, video: false, pdf: false },
    },
  }
}

describe("supportsVisionParts", () => {
  test("false when the model does not advertise image input", () => {
    expect(supportsVisionParts(modelWith(false), {})).toBe(false)
  })

  test("false for a subprocess CLI brain even when image input is advertised", () => {
    const cli = new SubprocessLanguageModel("claude-cli", "claude-sonnet")
    expect(supportsVisionParts(modelWith(true), cli)).toBe(false)
  })

  test("true for an API brain with image input", () => {
    expect(supportsVisionParts(modelWith(true), {})).toBe(true)
  })

  test("false when capabilities are missing entirely", () => {
    expect(supportsVisionParts({} as any, {})).toBe(false)
  })
})

describe("panelistMessage", () => {
  const dataUrl = "data:image/png;base64,AAAABBBB"

  test("text-only brain keeps markdown image refs in the single text turn", () => {
    const { content } = panelistMessage(PANELIST, "<html></html>", [dataUrl], false)
    expect(typeof content).toBe("string")
    expect(content as string).toContain(`![attached-image-1](${dataUrl})`)
    expect(content as string).toContain(PANELIST.stance)
  })

  test("vision brain gets real image parts and labels instead of embedded refs", () => {
    const { content } = panelistMessage(PANELIST, "<html></html>", [dataUrl, "https://x/y.png"], true)
    expect(Array.isArray(content)).toBe(true)
    const parts = content as Array<{ type: string; [k: string]: unknown }>
    expect(parts[0]).toMatchObject({ type: "text" })
    expect(parts.slice(1)).toEqual([
      { type: "image", image: dataUrl },
      { type: "image", image: "https://x/y.png" },
    ])
    // The text turn must NOT embed the (potentially multi-MB) data URL.
    expect(String(parts[0]!.text)).not.toContain(dataUrl)
    expect(String(parts[0]!.text)).toContain("[attached-image-1]")
    expect(String(parts[0]!.text)).toContain("[attached-image-2]")
  })

  test("vision brain with no usable images stays a single text turn", () => {
    const { content } = panelistMessage(PANELIST, "<html></html>", [], true)
    expect(typeof content).toBe("string")
  })

  test("non-image data URLs and excess images are dropped either way", () => {
    const many = Array.from({ length: 8 }, (_, i) => `data:image/png;base64,${i}`)
    const bad = ["data:text/plain;base64,AAAA", "ftp://nope/x.png", ...many]
    const { content } = panelistMessage(PANELIST, "<html></html>", bad, true)
    const parts = content as Array<{ type: string; image?: string }>
    const imageParts = parts.filter((p) => p.type === "image")
    expect(imageParts).toHaveLength(6)
  })
})
