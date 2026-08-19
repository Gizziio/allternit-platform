import { describe, expect, test } from "bun:test"
import { attachmentsToAcpContent } from "@/runtime/drivers/attachments"

describe("attachmentsToAcpContent", () => {
  test("maps string text attachments to text blocks", () => {
    const blocks = attachmentsToAcpContent([
      { filename: "notes.txt", mimeType: "text/plain", content: "hello world" },
    ])
    expect(blocks).toEqual([{ type: "text", text: "hello world" }])
  })

  test("decodes Uint8Array text attachments", () => {
    const content = new TextEncoder().encode("hello world")
    const blocks = attachmentsToAcpContent([
      { filename: "notes.txt", mimeType: "text/plain", content },
    ])
    expect(blocks).toEqual([{ type: "text", text: "hello world" }])
  })

  test("infers text from common code extensions", () => {
    const blocks = attachmentsToAcpContent([
      { filename: "main.ts", mimeType: "application/typescript", content: "const x = 1" },
    ])
    expect(blocks).toEqual([{ type: "text", text: "const x = 1" }])
  })

  test("maps image attachments to image blocks", () => {
    const content = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    const blocks = attachmentsToAcpContent([
      { filename: "shot.png", mimeType: "image/png", content },
    ])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ type: "image", mimeType: "image/png" })
    expect(typeof (blocks[0] as any).data).toBe("string")
  })

  test("accepts base64 image strings", () => {
    const blocks = attachmentsToAcpContent([
      { filename: "shot.png", mimeType: "image/png", content: "aGVsbG8=" },
    ])
    expect(blocks).toEqual([{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }])
  })

  test("rejects unsupported binary attachment types", () => {
    expect(() =>
      attachmentsToAcpContent([
        { filename: "doc.pdf", mimeType: "application/pdf", content: new Uint8Array([1, 2, 3]) },
      ]),
    ).toThrow('unsupported mime type "application/pdf"')
  })
})
