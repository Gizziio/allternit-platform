import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { useSync } from "@/cli/ui/tui/context/sync"
import { createMemo, createResource, createSignal, Show, Switch, Match, type JSX } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useSDK } from "@/cli/ui/tui/context/sdk"
import { useLocal } from "@/cli/ui/tui/context/local"
import { DialogPrompt } from "@/cli/ui/tui/ui/dialog-prompt"
import { GIZZICopy, sanitizeBrandSurface } from "@/shared/brand"
import * as AgentWorkspaceBridge from "@/runtime/kernel/bridge"

interface WorkspaceAgentConfig {
  name: string
  config?: {
    purpose?: string
    permissions?: {
      spawn_agents?: boolean
    }
    authority_level?: string
  }
}

interface WorkspaceInfo {
  type: string
  path: string
  identity?: {
    name: string
    systemPrompt?: string
  }
}

export function DialogAgentManager() {
  const dialog = useDialog()
  const sync = useSync()
  const { theme } = useTheme()
  const sdk = useSDK()
  const local = useLocal()

  const [toDelete, setToDelete] = createSignal<string>()
  const [showWorkspaceAgents, setShowWorkspaceAgents] = createSignal(false)

  const agents = createMemo<any[]>(() => sync.data.agent as any[])
  const config = createMemo<any>(() => sync.data.config as any)

  // Detect workspace context
  const [workspace] = createResource<WorkspaceInfo | null>(async () => {
    return await AgentWorkspaceBridge.detectWorkspace()
  })

  // Load workspace agents
  const [workspaceAgents] = createResource(workspace, async (ws) => {
    if (!ws) return []
    return await AgentWorkspaceBridge.getWorkspaceAgents(ws.path, ws.type as "gizzi" | "openclaw")
  })

  const options = createMemo<DialogSelectOption<string>[]>(() =>
    agents().map((agent: any) => {
      const isDeleting = toDelete() === agent.name
      const isDefault = config()?.default_agent === agent.name
      return {
        title: isDeleting 
          ? `Press again to delete "${agent.name}"` 
          : `${agent.name}${isDefault ? " (default)" : ""}`,
        description: sanitizeBrandSurface(agent.description || (agent.native ? "Built-in agent" : "Custom agent")),
        value: agent.name,
        bg: isDeleting ? theme.error : undefined,
        fg: agent.native ? theme.textMuted : undefined,
      }
    })
  )

  const handleCreate = async () => {
    // Check for workspace context first
    const ws = await AgentWorkspaceBridge.detectWorkspace()
    
    // Step 1: Get agent name
    const name = await DialogPrompt.show(dialog, "Agent Name", {
      placeholder: "my-custom-agent (lowercase, alphanumeric, hyphens, underscores)",
      description: () => (
        <Show when={ws?.identity}>
          <text fg={theme.success}>
            Workspace: {ws!.identity!.name} ({ws!.type})
          </text>
        </Show>
      ) as unknown as JSX.Element,
    })
    
    if (!name || !/^[a-z0-9_-]+$/.test(name)) {
      dialog.replace(() => <DialogAgentManager />)
      return
    }

    // Step 2: Get description
    const description = await DialogPrompt.show(dialog, "Agent Description", {
      placeholder: "What this agent does...",
      description: () => (
        <text fg={theme.textMuted}>Brief description of the agent's purpose</text>
      ) as unknown as JSX.Element,
    })
    
    if (description === null) {
      dialog.replace(() => <DialogAgentManager />)
      return
    }

    // Step 3: Get system prompt (with workspace context if available)
    let defaultPrompt = ""
    if (ws?.identity?.systemPrompt) {
      defaultPrompt = await AgentWorkspaceBridge.generateWorkspaceAwarePrompt("", ws)
    }

    const prompt = await DialogPrompt.show(dialog, "System Prompt", {
      placeholder: "Instructions for the agent...",
      value: defaultPrompt,
      description: () => (
        <Switch>
          <Match when={ws?.identity?.systemPrompt}>
            <text fg={theme.success}>✓ Pre-filled from workspace identity</text>
          </Match>
          <Match when={true}>
            <text fg={theme.textMuted}>Detailed instructions that define the agent's behavior</text>
          </Match>
        </Switch>
      ) as unknown as JSX.Element,
    })
    
    if (prompt === null) {
      dialog.replace(() => <DialogAgentManager />)
      return
    }

    // Step 4: Select mode
    const mode = await new Promise<"primary" | "subagent" | "all" | null>((resolve) => {
      dialog.replace(
        () => (
          <DialogSelect
            title="Agent Mode"
            options={[
              { 
                title: "primary", 
                value: "primary" as const,
                description: "Main agent for direct user interaction"
              },
              { 
                title: "subagent", 
                value: "subagent" as const,
                description: "Specialized agent for delegated tasks"
              },
              { 
                title: "all", 
                value: "all" as const,
                description: "Can be used as both primary and subagent"
              },
            ]}
            onSelect={(opt) => resolve(opt.value)}
          />
        ),
        () => resolve(null)
      )
    })

    if (!mode) {
      dialog.replace(() => <DialogAgentManager />)
      return
    }

    // Create the agent with workspace context
    try {
      // Enhance prompt with workspace context if not already done
      let finalPrompt = prompt
      if (ws && !ws.identity?.systemPrompt) {
        finalPrompt = await AgentWorkspaceBridge.generateWorkspaceAwarePrompt(prompt, ws)
      }

      await sdk.client.agent.create({
        name,
        description: description || undefined,
        prompt: finalPrompt || undefined,
        mode,
        options: {
          workspace: ws ? {
            type: ws.type,
            path: ws.path,
            identity: ws.identity?.name,
          } : undefined,
        },
      })
    } catch (e) {
      // Error will be handled by SDK
    }

    dialog.replace(() => <DialogAgentManager />)
  }

  const handleImportWorkspaceAgent = async (agentConfig: WorkspaceAgentConfig) => {
    try {
      const ws = workspace()
      if (!ws) return

      // Generate workspace-aware prompt
      const basePrompt = agentConfig.config?.purpose 
        ? `Purpose: ${agentConfig.config.purpose}` 
        : ""
      const enhancedPrompt = await AgentWorkspaceBridge.generateWorkspaceAwarePrompt(basePrompt, ws as any)

      // Create permissions from config
      const permissions = agentConfig.config?.permissions || {}
      
      await sdk.client.agent.create({
        name: agentConfig.name.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
        description: agentConfig.config?.purpose || `Imported from ${ws.type} workspace`,
        prompt: enhancedPrompt,
        mode: agentConfig.config?.authority_level === "highest" ? "all" : "subagent",
        permission: {
          "*": permissions.spawn_agents ? "allow" : "ask",
          bash: permissions.spawn_agents ? "allow" : "ask",
          agent: permissions.spawn_agents ? "allow" : "deny",
        },
        options: {
          imported_from: ws.type,
          original_config: agentConfig.config,
        },
      })
    } catch (e) {
      // Error will be handled by SDK
    }

    dialog.replace(() => <DialogAgentManager />)
  }

  return (
    <>
    <DialogSelect
      title={workspace()?.identity ? `Agent Manager (${workspace()!.identity!.name})` : "Agent Manager"}
      options={[
        ...options(),
        {
          title: "+ Create new agent",
          value: "__create__",
          description: workspace()?.identity 
            ? `Create with ${workspace()!.identity!.name} workspace context` 
            : "Create a custom agent with custom permissions",
        },
        ...(workspaceAgents() && workspaceAgents()!.length > 0 ? [{
          title: "↓ Import workspace agents",
          value: "__workspace__",
          description: `${workspaceAgents()!.length} agents from ${workspace()?.type} workspace`,
        }] : []),
      ]}
      current={(local.agent.current() as any)?.name}
      onMove={() => setToDelete(undefined)}
      onSelect={(option) => {
        if (option.value === "__create__") {
          handleCreate()
          return
        }
        if (option.value === "__workspace__") {
          setShowWorkspaceAgents(true)
          return
        }
        // Select agent for use
        local.agent.set(option.value)
        dialog.clear()
      }}
    />
    <Show when={showWorkspaceAgents() && workspaceAgents()}>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <text fg={theme.textMuted}>Workspace Agents:</text>
        {workspaceAgents()?.map((agent: WorkspaceAgentConfig) => (
          <box 
            flexDirection="row" 
            gap={1}
            onMouseUp={() => handleImportWorkspaceAgent(agent)}
          >
            <text fg={theme.accent}>↓</text>
            <text fg={theme.text}>{agent.name}</text>
            <text fg={theme.textMuted}>
              {agent.config?.purpose?.slice(0, 40)}...
            </text>
          </box>
        ))}
      </box>
    </Show>
    </>
  )
}
