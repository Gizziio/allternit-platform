/**
 * Viewport Container - Dynamic content display for Cowork mode
 * 
 * Supports:
 * - Browser previews (via a2r-browser-dev)
 * - Images (via kitty/iterm2/ASCII/browser)
 * - Markdown rendering
 * - Code display
 * - Diffs
 * - Artifacts
 * 
 * Usage:
 * <Viewport
 *   contentType="web"
 *   content="https://example.com"
 *   interactive={true}
 * />
 */

import { createSignal, createMemo, Show, For, onMount, createEffect } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { RGBA, TextAttributes } from "@opentui/core"
import { MarkdownRenderer, CodeRenderer, DiffRenderer, ImageRenderer, ArtifactRenderer } from "./renderers"

export type ViewportContentType = 
  | "empty"
  | "web"
  | "image"
  | "markdown"
  | "code"
  | "diff"
  | "artifact"
  | "loading"
  | "error"

export interface ViewportContent {
  type: ViewportContentType
  data?: any
  url?: string
  title?: string
  error?: string
}

export interface ViewportProps {
  content?: ViewportContent
  contentType?: ViewportContentType
  title?: string
  interactive?: boolean
  onOpenBrowser?: () => void
  onScreenshot?: () => void
  onClose?: () => void
}

export function Viewport(props: ViewportProps) {
  const { theme } = useTheme()
  const coworkAccent = RGBA.fromInts(154, 123, 170)
  
  const contentType = createMemo(() => props.content?.type || props.contentType || "empty")
  const content = createMemo(() => props.content)
  
  const [browserStatus, setBrowserStatus] = createSignal<"closed" | "opening" | "open" | "error">("closed")
  const [currentUrl, setCurrentUrl] = createSignal<string>("")
  
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      border={["left"]}
      borderColor={theme.border}
      backgroundColor={RGBA.fromInts(26, 29, 38)}
    >
      {/* Header */}
      <box
        padding={1}
        border={["bottom"]}
        borderColor={theme.border}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <text fg={coworkAccent} attributes={TextAttributes.BOLD}>
          {props.title || "VIEWPORT"}
        </text>
        <box flexDirection="row" gap={1}>
          <Show when={contentType() === "web"}>
            <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>
              {browserStatus()}
            </text>
          </Show>
        </box>
      </box>
      
      {/* Content Area */}
      <box flexGrow={1} padding={2} flexDirection="column">
        <Show
          when={content()}
          fallback={
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <box flexDirection="column" gap={2} padding={2}>
                <text fg={theme.textMuted} textAlign="center">
                  No content to display
                </text>
                <text fg={theme.textMuted} textAlign="center" style={{ fontSize: 0.8 }}>
                  Use commands to load content
                </text>
              </box>
            </box>
          }
        >
          {/* Loading State */}
          <Show when={contentType() === "loading"}>
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <box flexDirection="column" gap={2}>
                <text fg={coworkAccent}>⏳ Loading...</text>
              </box>
            </box>
          </Show>
          
          {/* Error State */}
          <Show when={contentType() === "error"}>
            <box flexGrow={1} justifyContent="center" alignItems="center">
              <box flexDirection="column" gap={2}>
                <text fg={RGBA.fromInts(252, 165, 165)}>⚠ Error</text>
                <text fg={theme.textMuted} wrap="wrap">
                  {content()?.error || "Unknown error"}
                </text>
              </box>
            </box>
          </Show>
          
          {/* Web Content */}
          <Show when={contentType() === "web"}>
            <box flexDirection="column" gap={1} flexGrow={1}>
              <box flexDirection="row" gap={1} alignItems="center">
                <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>URL:</text>
                <text fg={theme.text} style={{ fontSize: 0.8 }} wrap="wrap">
                  {content()?.url || currentUrl()}
                </text>
              </box>
              <box border={["bottom"]} borderColor={theme.border} />
              <box flexGrow={1} justifyContent="center" alignItems="center">
                <box flexDirection="column" gap={2}>
                  <text fg={theme.text} textAlign="center">
                    🌐 Browser Preview
                  </text>
                  <text fg={theme.textMuted} textAlign="center" style={{ fontSize: 0.8 }}>
                    {browserStatus() === "open" ? "Browser is open" : "Press 'o' to open browser"}
                  </text>
                  <text fg={theme.textMuted} textAlign="center" style={{ fontSize: 0.8 }}>
                    Press 's' for screenshot
                  </text>
                </box>
              </box>
            </box>
          </Show>
          
          {/* Image Content */}
          <Show when={contentType() === "image"}>
            <box flexDirection="column" gap={1} flexGrow={1}>
              <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>Image:</text>
              <box border={["bottom"]} borderColor={theme.border} />
              <box flexGrow={1}>
                <ImageRenderer 
                  src={content()?.src || ""} 
                  alt={content()?.title || "Image"} 
                />
              </box>
            </box>
          </Show>

          {/* Markdown Content */}
          <Show when={contentType() === "markdown"}>
            <box flexDirection="column" gap={1} flexGrow={1}>
              <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>Markdown:</text>
              <box border={["bottom"]} borderColor={theme.border} />
              <box flexGrow={1}>
                <MarkdownRenderer content={content()?.data || ""} />
              </box>
            </box>
          </Show>

          {/* Code Content */}
          <Show when={contentType() === "code"}>
            <box flexDirection="column" gap={1} flexGrow={1}>
              <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>Code:</text>
              <box border={["bottom"]} borderColor={theme.border} />
              <box flexGrow={1}>
                <CodeRenderer content={content()?.data || ""} language={content()?.language} />
              </box>
            </box>
          </Show>

          {/* Diff Content */}
          <Show when={contentType() === "diff"}>
            <box flexDirection="column" gap={1} flexGrow={1}>
              <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>Diff:</text>
              <box border={["bottom"]} borderColor={theme.border} />
              <box flexGrow={1}>
                <DiffRenderer diff={content()?.data || ""} />
              </box>
            </box>
          </Show>

          {/* Artifact Content */}
          <Show when={contentType() === "artifact"}>
            <box flexDirection="column" gap={1} flexGrow={1}>
              <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>Artifact:</text>
              <box border={["bottom"]} borderColor={theme.border} />
              <box flexGrow={1}>
                <ArtifactRenderer 
                  type={content()?.artifactType || "file"}
                  name={content()?.title || "Untitled"}
                  path={content()?.path}
                  description={content()?.description}
                />
              </box>
            </box>
          </Show>
        </Show>
      </box>
      
      {/* Footer - Status & Controls */}
      <box
        padding={1}
        border={["top"]}
        borderColor={theme.border}
        flexDirection="column"
        gap={1}
      >
        <Show when={contentType() === "web"}>
          <box flexDirection="row" justifyContent="space-between">
            <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>Browser:</text>
            <text 
              fg={
                browserStatus() === "open" ? RGBA.fromInts(134, 239, 172) :
                browserStatus() === "error" ? RGBA.fromInts(252, 165, 165) :
                theme.textMuted
              }
              style={{ fontSize: 0.8 }}
            >
              {browserStatus()}
            </text>
          </box>
        </Show>
        
        <box flexDirection="row" gap={2}>
          <Show when={props.onOpenBrowser}>
            <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>
              [o] Open Browser
            </text>
          </Show>
          <Show when={props.onScreenshot}>
            <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>
              [s] Screenshot
            </text>
          </Show>
          <Show when={props.onClose}>
            <text fg={theme.textMuted} style={{ fontSize: 0.8 }}>
              [c] Close
            </text>
          </Show>
        </box>
      </box>
    </box>
  )
}
