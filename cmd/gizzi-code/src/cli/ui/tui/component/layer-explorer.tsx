/**
 * LayerExplorer Component
 * 
 * Displays the 5-layer agent workspace structure in a collapsible tree format.
 * Integrated into the Shell UI sidebar for navigation and visibility.
 * 
 * Layers:
 * - L1-COGNITIVE: Task graph, memory, state (expanded by default)
 * - L2-IDENTITY: Identity, conventions, values
 * - L3-GOVERNANCE: Rules, playbooks, tools
 * - L4-SKILLS: Skill definitions
 * - L5-BUSINESS: Client/project context (optional)
 */

import { createSignal, For, Show, createMemo, createResource } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { AgentWorkspace } from "@/runtime/memory/memory"
import path from "path"
import { readdir } from "fs/promises"

export interface LayerExplorerProps {
  /** Current workspace path */
  workspacePath: string
  /** Callback when a file is selected */
  onFileSelect?: (filePath: string, layer: LayerId) => void
  /** Whether L5 business layer is enabled */
  enableL5?: boolean
}

export type LayerId = "L1" | "L2" | "L3" | "L4" | "L5"

interface LayerFile {
  name: string
  path: string
  type: "file" | "directory"
  children?: LayerFile[]
}

interface Layer {
  id: LayerId
  name: string
  description: string
  color: string
  files: LayerFile[]
}

async function scanLayerFiles(
  workspacePath: string,
  layerPath: string,
  depth: number = 0
): Promise<LayerFile[]> {
  if (depth > 2) return [] // Limit recursion depth
  
  try {
    const entries = await readdir(layerPath, { withFileTypes: true })
    const files: LayerFile[] = []
    
    for (const entry of entries) {
      const fullPath = path.join(layerPath, entry.name)
      const isDir = entry.isDirectory()
      
      const file: LayerFile = {
        name: entry.name,
        path: fullPath,
        type: isDir ? "directory" : "file",
      }
      
      if (isDir && depth < 2) {
        file.children = await scanLayerFiles(workspacePath, fullPath, depth + 1)
      }
      
      files.push(file)
    }
    
    // Sort: directories first, then files
    return files.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name)
      return a.type === "directory" ? -1 : 1
    })
  } catch {
    return []
  }
}

async function fetchWorkspaceLayers(
  workspacePath: string,
  enableL5: boolean
): Promise<Layer[]> {
  const paths = AgentWorkspace.getPaths(workspacePath)
  const manifest = await AgentWorkspace.readManifest(workspacePath)
  const l5Enabled = enableL5 || manifest?.layers?.l5_business?.enabled || false
  
  const layers: Layer[] = [
    {
      id: "L1",
      name: "L1-COGNITIVE",
      description: "Brain, memory, state",
      color: "#60A5FA", // Blue
      files: [
        { name: "BRAIN.md", path: paths.l1_brain_md, type: "file" },
        { name: "memory/", path: paths.l1_memory, type: "directory" },
        { name: "brain/", path: paths.l1_brain, type: "directory" },
      ],
    },
    {
      id: "L2",
      name: "L2-IDENTITY",
      description: "Identity, conventions",
      color: "#A78BFA", // Purple
      files: [
        { name: "IDENTITY.md", path: paths.l2_identity_md, type: "file" },
        { name: "CONVENTIONS.md", path: paths.l2_conventions_md, type: "file" },
        { name: "POLICY.md", path: paths.l2_policy_md, type: "file" },
        { name: "SOUL.md", path: paths.l2_soul_md, type: "file" },
        { name: "USER.md", path: paths.l2_user_md, type: "file" },
        { name: "VOICE.md", path: paths.l2_voice_md, type: "file" },
      ],
    },
    {
      id: "L3",
      name: "L3-GOVERNANCE",
      description: "Rules, playbooks",
      color: "#FBBF24", // Amber
      files: [
        { name: "PLAYBOOK.md", path: paths.l3_playbook_md, type: "file" },
        { name: "TOOLS.md", path: paths.l3_tools_md, type: "file" },
        { name: "HEARTBEAT.md", path: paths.l3_heartbeat_md, type: "file" },
        { name: "AUDIT.md", path: paths.l3_audit_md, type: "file" },
      ],
    },
    {
      id: "L4",
      name: "L4-SKILLS",
      description: "Skill registry",
      color: "#34D399", // Emerald
      files: [
        { name: "INDEX.md", path: paths.l4_index_md, type: "file" },
        { name: "skills/", path: paths.l4_skills_dir, type: "directory" },
      ],
    },
  ]
  
  if (l5Enabled) {
    layers.push({
      id: "L5",
      name: "L5-BUSINESS",
      description: "Client context",
      color: "#F87171", // Red
      files: [
        { name: "CLIENTS.md", path: paths.l5_clients_md, type: "file" },
        { name: "crm/", path: paths.l5_crm, type: "directory" },
        { name: "projects/", path: paths.l5_projects, type: "directory" },
        { name: "content/", path: paths.l5_content, type: "directory" },
      ],
    })
  }
  
  return layers
}

export function LayerExplorer(props: LayerExplorerProps) {
  const { theme } = useTheme()
  const [expanded, setExpanded] = createSignal<Record<LayerId, boolean>>({
    L1: true, // Expanded by default
    L2: false,
    L3: false,
    L4: false,
    L5: false,
  })
  
  const [layers] = createResource(
    () => props.workspacePath,
    (path) => fetchWorkspaceLayers(path, props.enableL5 ?? false)
  )
  
  const hasWorkspace = createMemo(async () => {
    if (!props.workspacePath) return false
    return await AgentWorkspace.exists(props.workspacePath)
  })
  
  const toggleLayer = (layerId: LayerId) => {
    setExpanded(prev => ({ ...prev, [layerId]: !prev[layerId] }))
  }
  
  const handleFileClick = (file: LayerFile, layerId: LayerId) => {
    if (props.onFileSelect) {
      props.onFileSelect(file.path, layerId)
    }
  }
  
  return (
    <box flexDirection="column" gap={1}>
      <box flexDirection="row" gap={1}>
        <text fg={theme.text}>
          <b>Agent Workspace</b>
        </text>
      </box>
      
      <Show when={layers.loading}>
        <text fg={theme.textMuted}>Loading...</text>
      </Show>
      
      <Show when={layers.error}>
        <text fg={theme.error}>Error loading workspace</text>
      </Show>
      
      <Show when={layers() && layers()!.length > 0}>
        <box flexDirection="column" gap={1}>
          <For each={layers()}>
            {(layer) => (
              <box flexDirection="column" gap={0}>
                {/* Layer Header */}
                <box
                  flexDirection="row"
                  gap={1}
                  onMouseDown={() => toggleLayer(layer.id)}
                >
                  <text fg={theme.text}>
                    {expanded()[layer.id] ? "▼" : "▶"}
                  </text>
                  <text fg={layer.color}>
                    <b>●</b>
                  </text>
                  <text fg={theme.text}>
                    <b>{layer.name}</b>
                  </text>
                </box>
                
                {/* Layer Content */}
                <Show when={expanded()[layer.id]}>
                  <box flexDirection="column" paddingLeft={2} gap={0}>
                    <text fg={theme.textMuted}>{layer.description}</text>
                    <box flexDirection="column" gap={0}>
                      <For each={layer.files}>
                        {(file) => (
                          <LayerFileItem
                            file={file}
                            layerId={layer.id}
                            theme={theme}
                            onClick={handleFileClick}
                          />
                        )}
                      </For>
                    </box>
                  </box>
                </Show>
              </box>
            )}
          </For>
        </box>
      </Show>
      
      <Show when={layers() && layers()!.length === 0}>
        <text fg={theme.textMuted}>No workspace found</text>
        <text fg={theme.textMuted}>.gizzi/ directory missing</text>
      </Show>
    </box>
  )
}

interface LayerFileItemProps {
  file: LayerFile
  layerId: LayerId
  theme: any
  depth?: number
  onClick: (file: LayerFile, layerId: LayerId) => void
}

function LayerFileItem(props: LayerFileItemProps) {
  const [expanded, setExpanded] = createSignal(false)
  const { theme, file, layerId, depth = 0 } = props
  
  const icon = () => {
    if (file.type === "directory") return expanded() ? "v" : ">"
    if (file.name.endsWith(".md")) return "●"
    return "○"
  }
  
  const handleClick = () => {
    if (file.type === "directory") {
      setExpanded(!expanded())
    } else {
      props.onClick(file, layerId)
    }
  }
  
  return (
    <box flexDirection="column">
      <box
        flexDirection="row"
        gap={1}
        paddingLeft={depth}
        onMouseDown={handleClick}
      >
        <text fg={theme.textMuted}>{icon()}</text>
        <text
          fg={file.type === "directory" ? theme.info : theme.text}
          wrapMode="word"
        >
          {file.name}
        </text>
      </box>
      
      <Show when={expanded() && file.children}>
        <box flexDirection="column">
          <For each={file.children}>
            {(child) => (
              <LayerFileItem
                file={child}
                layerId={layerId}
                theme={theme}
                depth={depth + 1}
                onClick={props.onClick}
              />
            )}
          </For>
        </box>
      </Show>
    </box>
  )
}
