/**
 * Content Renderers for Cowork Viewport
 * 
 * Uses libraries already available in @opentui/core:
 * - marked (Markdown)
 * - tree-sitter (Code highlighting)
 * - diff (Diff rendering)
 */

import { Show } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { RGBA, TextAttributes } from "@opentui/core"
import { marked } from "marked"

// Markdown Renderer
export function MarkdownRenderer(props: { content: string }) {
  const { theme } = useTheme()
  
  // Parse markdown with marked
  const tokens = marked.lexer(props.content)
  
  return (
    <box flexDirection="column" gap={1}>
      {tokens.map((token: any) => {
        switch (token.type) {
          case "heading":
            return (
              <text 
                fg={theme.text} 
                attributes={TextAttributes.BOLD}
                style={{ fontSize: token.depth === 1 ? 1.2 : token.depth === 2 ? 1.1 : 1 }}
              >
                {token.text}
              </text>
            )
          case "paragraph":
            return (
              <text fg={theme.text} wrap="wrap">
                {token.text}
              </text>
            )
          case "code":
            return (
              <box 
                backgroundColor={RGBA.fromInts(0, 0, 0, 64)} 
                padding={1}
                flexDirection="column"
              >
                <text fg={theme.text} fontFamily="mono" wrap="wrap">
                  {token.text}
                </text>
              </box>
            )
          case "list":
            return (
              <box flexDirection="column" gap={0}>
                {token.items.map((item: any) => (
                  <box flexDirection="row" gap={1}>
                    <text fg={theme.text}>• </text>
                    <text fg={theme.text} wrap="wrap">{item.text}</text>
                  </box>
                ))}
              </box>
            )
          default:
            return null
        }
      })}
    </box>
  )
}

// Code Renderer with Syntax Highlighting
export function CodeRenderer(props: { content: string; language?: string }) {
  const { theme } = useTheme()
  
  // For now, display as monospace with basic highlighting
  // Full implementation would use tree-sitter for proper syntax highlighting
  
  const lines = props.content.split("\n")
  
  return (
    <box flexDirection="column" gap={0}>
      {lines.map((line, index) => (
        <box flexDirection="row">
          <text 
            fg={theme.textMuted} 
            style={{ fontSize: 0.8 }}
            minWidth={4}
            textAlign="right"
          >
            {index + 1}
          </text>
          <text fg={theme.text} fontFamily="mono">
            {" "}{line}
          </text>
        </box>
      ))}
    </box>
  )
}

// Diff Renderer
export function DiffRenderer(props: { diff: string }) {
  const { theme } = useTheme()
  
  const lines = props.diff.split("\n")
  
  return (
    <box flexDirection="column" gap={0}>
      {lines.map((line) => {
        let color = theme.text
        
        if (line.startsWith("+")) {
          color = RGBA.fromInts(134, 239, 172) // Green for additions
        } else if (line.startsWith("-")) {
          color = RGBA.fromInts(252, 165, 165) // Red for deletions
        } else if (line.startsWith("@")) {
          color = RGBA.fromInts(147, 197, 253) // Blue for hunk headers
        } else if (line.startsWith("diff")) {
          color = RGBA.fromInts(253, 214, 134) // Yellow for file headers
        }
        
        return (
          <text fg={color} fontFamily="mono" wrap="wrap">
            {line}
          </text>
        )
      })}
    </box>
  )
}

// Image Display (Browser-based for now)
export function ImageRenderer(props: { src: string; alt?: string }) {
  const { theme } = useTheme()
  
  return (
    <box flexDirection="column" gap={1} justifyContent="center" alignItems="center">
      <text fg={theme.text}>🖼️ {props.alt || "Image"}</text>
      <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>
        Source: {props.src}
      </text>
      <text fg={theme.textMuted} style={{ fontSize: 0.8 }} italic={true}>
        Open browser to view image
      </text>
    </box>
  )
}

// Artifact Display
export function ArtifactRenderer(props: { 
  type: string
  name: string
  path?: string
  description?: string
}) {
  const { theme } = useTheme()
  const coworkAccent = RGBA.fromInts(154, 123, 170)
  
  const icon = () => {
    switch (props.type) {
      case "image": return "🖼️"
      case "document": return "📄"
      case "code": return "💻"
      case "data": return "📊"
      default: return "📦"
    }
  }
  
  return (
    <box 
      flexDirection="column" 
      gap={1} 
      padding={2}
      border={["bottom"]}
      borderColor={theme.border}
    >
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={coworkAccent} style={{ fontSize: 1.2 }}>{icon()}</text>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          {props.name}
        </text>
      </box>
      <Show when={props.path}>
        <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>
          {props.path}
        </text>
      </Show>
      <Show when={props.description}>
        <text fg={theme.text} wrap="wrap">
          {props.description}
        </text>
      </Show>
    </box>
  )
}
