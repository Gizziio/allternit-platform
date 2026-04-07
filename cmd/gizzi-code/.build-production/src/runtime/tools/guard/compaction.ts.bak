import { Log } from "@/shared/util/log"
import { GuardArtifacts } from "@/runtime/tools/guard/artifacts"
import { GuardPolicy } from "@/runtime/tools/guard/policy"
import type { SessionUsage } from "@/runtime/session/usage"
import type { MessageV2 } from "@/runtime/session/message-v2"

export namespace GuardCompaction {
  const log = Log.create({ service: "guard.compaction" })

  export interface CompactionInput {
    session_id: string
    run_id: string
    dag_node_id?: string
    workspace: string
    messages: MessageV2.WithParts[]
    receipts: object[]
    usage_summary: SessionUsage.SessionUsageSummary | null
    objective?: string
    model: string
    provider: string
    runner: string
  }

  export interface CompactionOutput {
    baton_path: string
    compact_path: string
    context: object
  }

  /**
   * Emit a compacted baton (state summary)
   */
  export async function emit(input: CompactionInput): Promise<CompactionOutput> {
    log.info("Emitting compaction baton", {
      session_id: input.session_id,
      message_count: input.messages.length,
    })

    // Ensure GIZZI structure exists
    const paths = await GuardArtifacts.initialize(input.workspace)

    // Generate baton content
    const baton = generateBaton(input)
    
    // Write compact file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const compactPath = `${paths.compact}/compact-${timestamp}.md`
    const { Filesystem } = await import("@/shared/util/filesystem")
    await Filesystem.write(compactPath, baton)

    // Update handoff pointer
    await GuardArtifacts.updateHandoff(input.workspace, compactPath)

    // Update state
    await GuardArtifacts.updateState(input.workspace, {
      session_id: input.session_id,
      run_id: input.run_id,
      dag_node_id: input.dag_node_id,
      last_compact: Date.now(),
      compact_path: compactPath,
      message_count: input.messages.length,
    })

    log.info("Compaction complete", { compact_path: compactPath })

    return {
      baton_path: compactPath,
      compact_path: compactPath,
      context: parseBatonContext(baton),
    }
  }

  /**
   * Generate baton markdown with 11 required sections
   */
  function generateBaton(input: CompactionInput): string {
    const { messages, receipts, usage_summary, objective } = input
    
    // Extract data from messages
    const userMessages = messages.filter(m => m.info.role === "user")
    const assistantMessages = messages.filter(m => m.info.role === "assistant")
    
    // Get files changed from receipts
    const filesChanged = extractFilesChanged(receipts)
    
    // Get commands from receipts
    const commands = extractCommands(receipts)
    
    // Get errors from receipts
    const errors = extractErrors(receipts)
    
    // Determine objective if not provided
    const mainObjective = objective ?? userMessages[0]?.parts[0]?.type === "text" 
      ? (userMessages[0].parts[0] as any).text?.slice(0, 100) ?? "Continue session"
      : "Continue session"

    // Build sections
    const sections: string[] = []
    
    // 1. Objective
    sections.push(`## Objective\n\n${mainObjective}\n`)
    
    // 2. Current Plan
    sections.push(`## Current Plan\n\n${generatePlan(messages)}\n`)
    
    // 3. Work Completed
    sections.push(`## Work Completed\n\n${generateWorkCompleted(messages, receipts)}\n`)
    
    // 4. Files Changed
    sections.push(`## Files Changed\n\n${filesChanged.map(f => `- ${f.path}: ${f.summary}`).join("\n")}\n`)
    
    // 5. Commands Executed
    sections.push(`## Commands Executed\n\n${formatCommands(commands)}\n`)
    
    // 6. Errors / Blockers
    sections.push(`## Errors / Blockers\n\n${errors.length > 0 ? errors.map(e => `- ${e}`).join("\n") : "- None\n"}\n`)
    
    // 7. Decisions Made
    sections.push(`## Decisions Made\n\n${generateDecisions(messages)}\n`)
    
    // 8. Open TODOs
    sections.push(`## Open TODOs\n\n${generateTODOs(messages)}\n`)
    
    // 9. Next 5 Actions
    sections.push(`## Next 5 Actions\n\n${generateNextActions(messages)}\n`)
    
    // 10. Evidence Pointers
    sections.push(`## Evidence Pointers\n\n- Receipts: ${input.workspace}/.gizzi/receipts/receipt.jsonl\n- State: ${input.workspace}/.gizzi/state/state.json\n- Messages: ${messages.length} total\n`)
    
    // 11. Limits Snapshot
    sections.push(`## Limits Snapshot\n\n${generateLimitsSnapshot(usage_summary)}\n`)
    
    // Header
    const header = `# GIZZI Session Baton\n\n**Session:** ${input.session_id}  \n**Run:** ${input.run_id}  \n**Node:** ${input.dag_node_id ?? "unknown"}  \n**Generated:** ${new Date().toISOString()}  \n**Tool:** ${input.runner}\n\n---\n\n`

    return header + sections.join("\n---\n\n")
  }

  function extractFilesChanged(receipts: object[]): Array<{ path: string; summary: string }> {
    const files = new Map<string, string>()
    
    for (const receipt of receipts) {
      const r = receipt as any
      if (r.files_touched) {
        for (const file of r.files_touched) {
          files.set(file.path, file.action ?? "modified")
        }
      }
    }
    
    return Array.from(files.entries()).map(([path, action]) => ({
      path,
      summary: `${action} during session`,
    }))
  }

  function extractCommands(receipts: object[]): Array<{ category: string; command: string }> {
    const commands: Array<{ category: string; command: string }> = []
    
    for (const receipt of receipts) {
      const r = receipt as any
      if (r.tool === "bash" && r.args_redacted?.command) {
        const cmd = r.args_redacted.command as string
        let category = "other"
        if (cmd.match(/^(npm|yarn|pnpm|bun)/)) category = "build"
        else if (cmd.match(/^(git)/)) category = "git"
        else if (cmd.match(/^(test|spec|\.\/test)/)) category = "test"
        
        commands.push({ category, command: cmd })
      }
    }
    
    return commands
  }

  function extractErrors(receipts: object[]): string[] {
    return receipts
      .filter(r => (r as any).status === "fail" || (r as any).kind === "error")
      .map(r => (r as any).error?.message ?? "Unknown error")
  }

  function formatCommands(commands: Array<{ category: string; command: string }>): string {
    const byCategory: Record<string, string[]> = { build: [], test: [], git: [], other: [] }
    
    for (const cmd of commands) {
      byCategory[cmd.category].push(cmd.command)
    }
    
    return Object.entries(byCategory)
      .filter(([, cmds]) => cmds.length > 0)
      .map(([cat, cmds]) => `- **${cat}:**\n${cmds.map(c => `  - \`${c}\``).join("\n")}`)
      .join("\n")
  }

  function generatePlan(messages: MessageV2.WithParts[]): string {
    // Extract plan from recent assistant messages
    const recent = messages.slice(-3)
    const plans: string[] = []
    
    for (const msg of recent) {
      const textParts = msg.parts.filter(p => p.type === "text") as any[]
      for (const part of textParts) {
        if (part.text.includes("plan") || part.text.includes("Plan")) {
          const lines = part.text.split("\n").slice(0, 5)
          plans.push(...lines.filter((l: string) => l.trim().startsWith("-") || l.trim().startsWith("*")))
        }
      }
    }
    
    return plans.length > 0 ? plans.join("\n") : "- Continue current objective"
  }

  function generateWorkCompleted(messages: MessageV2.WithParts[], receipts: object[]): string {
    const completed: string[] = []
    
    // Count successful tool executions
    const successCount = receipts.filter(r => (r as any).status === "ok").length
    if (successCount > 0) {
      completed.push(`- ${successCount} tool executions completed`)
    }
    
    // Count files modified
    const filesModified = new Set<string>()
    for (const r of receipts) {
      const files = (r as any).files_touched ?? []
      for (const f of files) filesModified.add(f.path)
    }
    if (filesModified.size > 0) {
      completed.push(`- ${filesModified.size} files modified`)
    }
    
    completed.push(`- ${messages.filter(m => m.info.role === "assistant").length} responses generated`)
    
    return completed.join("\n")
  }

  function generateDecisions(messages: MessageV2.WithParts[]): string {
    // Look for explicit decisions in messages
    const decisions: string[] = []
    
    for (const msg of messages) {
      const textParts = msg.parts.filter(p => p.type === "text") as any[]
      for (const part of textParts) {
        if (part.text.includes("decided") || part.text.includes("Decision:")) {
          const line = part.text.split("\n").find((l: string) => 
            l.toLowerCase().includes("decided") || l.toLowerCase().includes("decision")
          )
          if (line) decisions.push(`- ${line.trim()}`)
        }
      }
    }
    
    return decisions.length > 0 ? decisions.join("\n") : "- No explicit decisions recorded"
  }

  function generateTODOs(messages: MessageV2.WithParts[]): string {
    const todos: string[] = []
    
    for (const msg of messages) {
      const textParts = msg.parts.filter(p => p.type === "text") as any[]
      for (const part of textParts) {
        const lines = part.text.split("\n")
        for (const line of lines) {
          if (line.toLowerCase().includes("todo") || line.toLowerCase().includes("to do")) {
            todos.push(`- ${line.trim()}`)
          }
        }
      }
    }
    
    return todos.length > 0 ? todos.join("\n") : "- No outstanding TODOs"
  }

  function generateNextActions(messages: MessageV2.WithParts[]): string {
    const actions: string[] = []
    
    // Try to extract from last assistant message
    const lastAssistant = messages.filter(m => m.info.role === "assistant").pop()
    if (lastAssistant) {
      const textParts = lastAssistant.parts.filter(p => p.type === "text") as any[]
      const fullText = textParts.map(p => p.text).join("\n")
      
      // Look for explicit next steps
      const nextMatch = fullText.match(/next (step|action)s?:?(.+?)(?=\n\n|$)/is)
      if (nextMatch) {
        const steps = nextMatch[2].split(/\n/).filter(s => s.trim())
        for (let i = 0; i < Math.min(5, steps.length); i++) {
          actions.push(`${i + 1}. ${steps[i].trim().replace(/^[-*]\s*/, "")}`)
        }
      }
    }
    
    // Default actions if none found
    if (actions.length === 0) {
      actions.push(
        "1. Review current progress",
        "2. Continue with next task",
        "3. Verify changes are correct"
      )
    }
    
    return actions.join("\n")
  }

  function generateLimitsSnapshot(usage: SessionUsage.SessionUsageSummary | null): string {
    if (!usage) return "- No usage data available"
    
    const totalTokens = usage.total.tokens
    return [
      `- Context ratio: ${usage.total.tokens > 0 ? "unknown" : "0% (need model context window)"}`,
      `- Quota ratio: 0% (not tracked)`,
      `- Tokens total: ${totalTokens.toLocaleString()}`,
      `- Messages: ${usage.messageCount}`,
      `- Cost: $${usage.total.cost.toFixed(4)}`,
    ].join("\n")
  }

  function parseBatonContext(baton: string): object {
    // Simple parsing to extract key fields
    const lines = baton.split("\n")
    const context: Record<string, string> = {}
    
    for (const line of lines) {
      if (line.startsWith("**Session:**")) {
        context.session_id = line.replace("**Session:**", "").trim()
      }
      if (line.startsWith("**Run:**")) {
        context.run_id = line.replace("**Run:**", "").trim()
      }
    }
    
    return context
  }
}
