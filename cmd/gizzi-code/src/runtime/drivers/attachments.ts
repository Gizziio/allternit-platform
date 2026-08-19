import type { Attachment } from "@/runtime/runtime-driver"

export type AcpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }

const TEXT_FILE_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".json",
  ".jsonl",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".html",
  ".htm",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".xml",
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  ".cfg",
  ".conf",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".py",
  ".rb",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".php",
  ".sql",
  ".graphql",
  ".gql",
]

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function looksLikeTextAttachment(att: Attachment): boolean {
  const mimeType = att.mimeType.toLowerCase()
  if (mimeType.startsWith("text/")) return true
  const lowerName = att.filename.toLowerCase()
  return TEXT_FILE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
}

/**
 * Convert task attachments into ACP content blocks.
 *
 * - Text attachments are sent as text blocks.
 * - Image attachments are sent as image blocks (base64-encoded when binary).
 * - Other binary attachment types are rejected explicitly rather than dropped.
 */
export function attachmentsToAcpContent(attachments: Attachment[]): AcpContentBlock[] {
  const blocks: AcpContentBlock[] = []
  for (const att of attachments) {
    if (looksLikeTextAttachment(att)) {
      const text = typeof att.content === "string" ? att.content : new TextDecoder().decode(att.content)
      blocks.push({ type: "text", text })
      continue
    }

    const mimeType = att.mimeType.toLowerCase()
    if (mimeType.startsWith("image/")) {
      const data = typeof att.content === "string" ? att.content : bytesToBase64(att.content)
      blocks.push({ type: "image", data, mimeType: att.mimeType })
      continue
    }

    throw new Error(
      `Attachment "${att.filename}" has unsupported mime type "${att.mimeType}" for ACP transport. ` +
        `Only text/* and image/* attachments are currently supported.`,
    )
  }
  return blocks
}
