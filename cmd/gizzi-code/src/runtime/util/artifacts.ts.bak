/**
 * Artifact System
 * 
 * Detects and parses artifact markers in message content.
 * Artifacts are code examples, previews, diagrams, etc. that agents
 * can include in their responses for users to view and interact with.
 * 
 * Format:
 * <artifact type="code" language="typescript" title="Example">
 * export function example() { ... }
 * </artifact>
 */

export type ArtifactType = "code" | "preview" | "diagram" | "diff" | "text"

export interface Artifact {
  id: string
  type: ArtifactType
  content: string
  language?: string
  title?: string
  description?: string
  sourceMessageId?: string
  timestamp: number
  // For diffs
  filePath?: string
  additions?: number
  deletions?: number
  // For previews
  mimeType?: string
}

interface ArtifactMatch {
  fullMatch: string
  attributes: Record<string, string>
  content: string
  startIndex: number
  endIndex: number
}

/**
 * Parse artifact attributes from the opening tag
 */
function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRegex = /(\w+)=["']([^"']*)["']/g
  let match
  while ((match = attrRegex.exec(tag)) !== null) {
    attrs[match[1]] = match[2]
  }
  return attrs
}

/**
 * Extract all artifacts from message content
 */
export function extractArtifacts(content: string): Artifact[] {
  const artifacts: Artifact[] = []
  const artifactRegex = /<artifact\s+([^>]*)>([\s\S]*?)<\/artifact>/gi
  
  let match
  while ((match = artifactRegex.exec(content)) !== null) {
    const [fullMatch, attrString, artifactContent] = match
    const attributes = parseAttributes(attrString)
    
    const type = (attributes.type as ArtifactType) || "code"
    const artifact: Artifact = {
      id: generateArtifactId(),
      type: validateType(type),
      content: artifactContent.trim(),
      language: attributes.language,
      title: attributes.title,
      description: attributes.description,
      timestamp: Date.now(),
    }
    
    // Add type-specific fields
    if (type === "diff") {
      artifact.filePath = attributes.filePath || attributes.path
      artifact.additions = parseInt(attributes.additions || "0", 10)
      artifact.deletions = parseInt(attributes.deletions || "0", 10)
    }
    
    if (type === "preview") {
      artifact.mimeType = attributes.mimeType || "text/html"
    }
    
    artifacts.push(artifact)
  }
  
  return artifacts
}

/**
 * Validate artifact type
 */
function validateType(type: string): ArtifactType {
  const validTypes: ArtifactType[] = ["code", "preview", "diagram", "diff", "text"]
  return validTypes.includes(type as ArtifactType) ? (type as ArtifactType) : "code"
}

/**
 * Generate unique artifact ID
 */
function generateArtifactId(): string {
  return `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Check if content has any artifacts
 */
export function hasArtifacts(content: string): boolean {
  return /<artifact\s+/i.test(content)
}

/**
 * Remove artifact tags from content, leaving just the content
 * Useful for displaying the message without the raw artifact markup
 */
export function stripArtifacts(content: string): string {
  return content.replace(/<artifact\s+[^>]*>[\s\S]*?<\/artifact>/gi, "")
}

/**
 * Replace artifact tags with placeholders
 * Useful for showing "[Artifact: Title]" in the message flow
 */
export function replaceArtifactsWithPlaceholders(content: string): string {
  return content.replace(/<artifact\s+([^>]*)>[\s\S]*?<\/artifact>/gi, (match, attrs) => {
    const attributes = parseAttributes(attrs)
    const title = attributes.title || "Artifact"
    const type = attributes.type || "code"
    return `[📎 ${type}: ${title}]`
  })
}

/**
 * Get artifact language from filename or content
 */
export function detectLanguage(filename?: string, content?: string): string {
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      "ts": "typescript",
      "tsx": "typescript",
      "js": "javascript",
      "jsx": "javascript",
      "py": "python",
      "rs": "rust",
      "go": "go",
      "java": "java",
      "kt": "kotlin",
      "rb": "ruby",
      "php": "php",
      "cs": "csharp",
      "cpp": "cpp",
      "c": "c",
      "h": "c",
      "swift": "swift",
      "scala": "scala",
      "r": "r",
      "sh": "bash",
      "bash": "bash",
      "zsh": "bash",
      "fish": "bash",
      "json": "json",
      "yaml": "yaml",
      "yml": "yaml",
      "toml": "toml",
      "xml": "xml",
      "html": "html",
      "css": "css",
      "scss": "scss",
      "sass": "sass",
      "less": "less",
      "sql": "sql",
      "md": "markdown",
      "markdown": "markdown",
      "dockerfile": "dockerfile",
      "makefile": "makefile",
    }
    if (ext && langMap[ext]) return langMap[ext]
  }
  
  // Try to detect from content
  if (content) {
    if (content.includes("interface ") || content.includes("type ")) return "typescript"
    if (content.includes("import ") && content.includes("from ")) return "typescript"
    if (content.includes("function ") || content.includes("const ") || content.includes("let ")) {
      return content.includes(":") ? "typescript" : "javascript"
    }
    if (content.includes("def ") || content.includes("import ") && !content.includes("from ")) {
      return "python"
    }
    if (content.includes("fn ") || content.includes("impl ") || content.includes("pub ")) {
      return "rust"
    }
  }
  
  return "text"
}

/**
 * Format artifact for display
 */
export function formatArtifactTitle(artifact: Artifact): string {
  if (artifact.title) return artifact.title
  if (artifact.filePath) return artifact.filePath.split("/").pop() || artifact.filePath
  if (artifact.language) return `${artifact.language} example`
  return "Untitled Artifact"
}

/**
 * Get icon for artifact type
 */
export function getArtifactIcon(type: ArtifactType): string {
  const icons: Record<ArtifactType, string> = {
    code: "📝",
    preview: "👁️",
    diagram: "📊",
    diff: "🔄",
    text: "📄",
  }
  return icons[type] || "📎"
}

/**
 * Serialize artifacts for storage
 */
export function serializeArtifacts(artifacts: Artifact[]): string {
  return JSON.stringify(artifacts)
}

/**
 * Deserialize artifacts from storage
 */
export function deserializeArtifacts(data: string): Artifact[] {
  try {
    return JSON.parse(data) as Artifact[]
  } catch {
    return []
  }
}
