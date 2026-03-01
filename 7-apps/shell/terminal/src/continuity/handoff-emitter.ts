/**
 * A2R Continuity - Handoff Emitter
 * 
 * Emits handoff batons in markdown format
 */

import { Log } from "@/util/log"
import type { SessionContext, HandoffBaton, ToolType } from "./types"

const log = Log.create({ service: "continuity.handoff" })

export namespace HandoffEmitter {
  export interface EmitOptions {
    context: SessionContext
    target_tool?: ToolType
    compact_reason: "manual" | "threshold" | "quota" | "error"
  }

  /**
   * Emit a handoff baton as markdown
   */
  export function emitMarkdown(options: EmitOptions): string {
    const { context } = options
    
    log.info("Emitting handoff baton", { 
      session_id: context.session_id,
      reason: options.compact_reason,
    })
    
    const sections: string[] = []
    
    // Header
    sections.push(generateHeader(context, options))
    
    // 1. Objective
    sections.push(generateSection("Objective", context.objective))
    
    // 2. Current Plan
    sections.push(generateSection(
      "Current Plan", 
      context.progress_summary.map(p => `- ${p}`).join("\n")
    ))
    
    // 3. Work Completed
    sections.push(generateSection(
      "Work Completed",
      context.progress_summary.map(p => `- ${p}`).join("\n")
    ))
    
    // 4. Files Changed
    sections.push(generateFilesChanged(context.files_changed))
    
    // 5. Commands Executed
    sections.push(generateCommands(context.commands_executed))
    
    // 6. Errors / Blockers
    sections.push(generateErrors(context.errors_seen, context.blockers))
    
    // 7. Decisions Made
    sections.push(generateSection(
      "Decisions Made",
      context.decisions.map(d => `- ${d}`).join("\n") || "- No explicit decisions recorded"
    ))
    
    // 8. Open TODOs
    sections.push(generateTODOs(context.open_todos))
    
    // 9. DAG Tasks (Workflow)
    sections.push(generateDAGTasks(context.dag_tasks))
    
    // 10. Next 5 Actions
    sections.push(generateNextActions(context.next_actions))
    
    // 11. A2R Conventions
    if (context.a2r_conventions) {
      sections.push(generateA2RConventions(context.a2r_conventions))
    }
    
    // 12. Evidence Pointers
    sections.push(generateEvidence(context))
    
    // 13. Limits Snapshot
    sections.push(generateLimits(context.limits))
    
    return sections.join("\n---\n\n")
  }
  
  /**
   * Emit a handoff baton as JSON
   */
  export function emitJSON(options: EmitOptions): HandoffBaton {
    return {
      version: "1.0.0",
      session_context: options.context,
      generated_at: Date.now(),
      target_tool: options.target_tool,
      compact_reason: options.compact_reason,
    }
  }
  
  function generateHeader(context: SessionContext, options: EmitOptions): string {
    return `# A2R Session Baton

**Session:** ${context.session_id}  
**Tool:** ${context.source_tool}  
**Workspace:** ${context.workspace_path}  
**Generated:** ${new Date().toISOString()}  
**Reason:** ${options.compact_reason}${options.target_tool ? `  \n**Target:** ${options.target_tool}` : ""}

---`
  }
  
  function generateSection(title: string, content: string): string {
    return `## ${title}

${content}`
  }
  
  function generateFilesChanged(files: SessionContext["files_changed"]): string {
    const lines = files.length > 0
      ? files.map(f => `- **${f.path}** (${f.action}): ${f.summary}`).join("\n")
      : "- No files modified"
    
    return `## Files Changed

${lines}`
  }
  
  function generateCommands(commands: SessionContext["commands_executed"]): string {
    const categories: Array<{ name: string; cmds: string[] }> = [
      { name: "Build", cmds: commands.build },
      { name: "Test", cmds: commands.test },
      { name: "Lint", cmds: commands.lint },
      { name: "Git", cmds: commands.git },
      { name: "Other", cmds: commands.other },
    ]
    
    const lines = categories
      .filter(c => c.cmds.length > 0)
      .map(c => {
        const cmdList = c.cmds.map(cmd => `  - \`${cmd}\``).join("\n")
        return `- **${c.name}:**\n${cmdList}`
      })
      .join("\n")
    
    return `## Commands Executed

${lines || "- No commands recorded"}`
  }
  
  function generateErrors(errors: SessionContext["errors_seen"], blockers: string[]): string {
    const errorLines = errors.map(e => 
      `- [${e.recoverable ? "Recoverable" : "Blocking"}] ${e.tool}: ${e.message}`
    )
    
    const blockerLines = blockers.map(b => `- **Blocker:** ${b}`)
    
    const allLines = [...errorLines, ...blockerLines]
    
    return `## Errors / Blockers

${allLines.length > 0 ? allLines.join("\n") : "- No errors or blockers"}`
  }
  
  function generateTODOs(todos: SessionContext["open_todos"]): string {
    if (todos.length === 0) {
      return `## Open TODOs

- No outstanding TODOs`
    }
    
    const lines = todos.map(t => 
      `- [${t.priority.toUpperCase()}${t.blocking ? ", BLOCKING" : ""}] ${t.task}`
    ).join("\n")
    
    return `## Open TODOs

${lines}`
  }
  
  function generateDAGTasks(tasks: SessionContext["dag_tasks"]): string {
    if (!tasks || tasks.length === 0) {
      return `## DAG Tasks (Workflow)

- No structured workflow tasks`
    }
    
    const byStatus = {
      completed: tasks.filter(t => t.status === "completed"),
      in_progress: tasks.filter(t => t.status === "in_progress"),
      pending: tasks.filter(t => t.status === "pending"),
      blocked: tasks.filter(t => t.status === "blocked" || t.status === "failed"),
    }
    
    const lines: string[] = []
    
    // Critical path (blocking tasks)
    const critical = tasks.filter(t => t.blocking)
    if (critical.length > 0) {
      lines.push(`### 🔴 Critical Path`)
      for (const t of critical) {
        lines.push(`- **[${t.status.toUpperCase()}]** ${t.name}${t.assigned_to ? ` (${t.assigned_to})` : ""}`)
      }
      lines.push("")
    }
    
    // In progress
    if (byStatus.in_progress.length > 0) {
      lines.push(`### 🟡 In Progress (${byStatus.in_progress.length})`)
      for (const t of byStatus.in_progress) {
        lines.push(`- ${t.name}: ${t.description.slice(0, 60)}${t.description.length > 60 ? "..." : ""}`)
        if (t.estimated_tokens) {
          lines.push(`  - Budget: ${t.actual_tokens ?? 0}/${t.estimated_tokens} tokens`)
        }
      }
      lines.push("")
    }
    
    // Pending with dependencies
    if (byStatus.pending.length > 0) {
      lines.push(`### ⏳ Pending (${byStatus.pending.length})`)
      for (const t of byStatus.pending) {
        const deps = t.dependencies.length > 0 ? ` [depends: ${t.dependencies.join(", ")}]` : ""
        lines.push(`- ${t.name}${deps}`)
      }
      lines.push("")
    }
    
    // Blocked/Failed
    if (byStatus.blocked.length > 0) {
      lines.push(`### 🔴 Blocked/Failed (${byStatus.blocked.length})`)
      for (const t of byStatus.blocked) {
        lines.push(`- **${t.name}** - REQUIRES ATTENTION`)
      }
    }
    
    // Summary
    const total = tasks.length
    const done = byStatus.completed.length
    lines.push(`\n---
**Progress:** ${done}/${total} completed (${Math.round(done/total*100)}%)`)
    
    return `## DAG Tasks (Workflow)

${lines.join("\n")}`
  }
  
  function generateA2RConventions(conventions: NonNullable<SessionContext["a2r_conventions"]>): string {
    const lines: string[] = []
    
    if (conventions.file_naming) {
      lines.push(`### File Naming`)
      lines.push(`- Pattern: \`${conventions.file_naming.pattern}\``)
      lines.push(`- Examples: ${conventions.file_naming.examples.map(e => `\`${e}\``).join(", ")}`)
      lines.push("")
    }
    
    if (conventions.code_style) {
      lines.push(`### Code Style`)
      if (conventions.code_style.formatter) lines.push(`- Formatter: ${conventions.code_style.formatter}`)
      if (conventions.code_style.linter) lines.push(`- Linter: ${conventions.code_style.linter}`)
      lines.push("")
    }
    
    if (conventions.directory_structure) {
      lines.push(`### Directory Structure`)
      lines.push(`- Root: ${conventions.directory_structure.root_dirs.map(d => `\`${d}\``).join(", ")}`)
      lines.push("")
    }
    
    if (conventions.testing) {
      lines.push(`### Testing`)
      lines.push(`- Framework: ${conventions.testing.framework}`)
      lines.push(`- Pattern: \`${conventions.testing.pattern}\``)
      if (conventions.testing.coverage_threshold) {
        lines.push(`- Coverage: ${conventions.testing.coverage_threshold}%`)
      }
      lines.push("")
    }
    
    if (conventions.git_workflow) {
      lines.push(`### Git Workflow`)
      lines.push(`- Strategy: ${conventions.git_workflow.branching_strategy}`)
      lines.push(`- Commits: ${conventions.git_workflow.commit_convention}`)
      lines.push("")
    }
    
    if (conventions.architecture) {
      lines.push(`### Architecture`)
      lines.push(`- Pattern: ${conventions.architecture.pattern}`)
      if (conventions.architecture.patterns_used.length > 0) {
        lines.push(`- Used: ${conventions.architecture.patterns_used.join(", ")}`)
      }
      if (conventions.architecture.forbidden_patterns.length > 0) {
        lines.push(`- Forbidden: ${conventions.architecture.forbidden_patterns.join(", ")}`)
      }
      lines.push("")
    }
    
    if (conventions.review_checklist && conventions.review_checklist.length > 0) {
      lines.push(`### Review Checklist`)
      for (const item of conventions.review_checklist) {
        lines.push(`- [ ] ${item}`)
      }
    }
    
    return `## A2R Conventions

${lines.join("\n")}`
  }
  
  function generateNextActions(actions: SessionContext["next_actions"]): string {
    const lines = actions.map((a, i) => {
      let line = `${i + 1}. **${a.action.toUpperCase()}:** ${a.description}`
      if (a.target) line += ` (\`${a.target}\`)`
      if (a.estimated_tokens) line += ` ~${a.estimated_tokens}t`
      return line
    }).join("\n")
    
    return `## Next ${actions.length} Actions

${lines}`
  }
  
  function generateEvidence(context: SessionContext): string {
    const lines = [
      `- **Session ID:** ${context.session_id}`,
      `- **Source Tool:** ${context.source_tool}`,
      `- **Workspace:** ${context.workspace_path}`,
    ]
    
    if (context.evidence) {
      if (context.evidence.receipt_offset) {
        lines.push(`- **Receipts:** Offset ${context.evidence.receipt_offset}`)
      }
      if (context.evidence.state_hash) {
        lines.push(`- **State Hash:** ${context.evidence.state_hash}`)
      }
      if (context.evidence.diff_refs && context.evidence.diff_refs.length > 0) {
        lines.push(`- **Diffs:** ${context.evidence.diff_refs.length} references`)
      }
    }
    
    lines.push(`- **Time Range:** ${new Date(context.time_start).toISOString()} - ${context.time_end ? new Date(context.time_end).toISOString() : "ongoing"}`)
    
    return `## Evidence Pointers

${lines.join("\n")}`
  }
  
  function generateLimits(limits?: SessionContext["limits"]): string {
    if (!limits) {
      return `## Limits Snapshot

- No usage data available`
    }
    
    const lines = [
      `- **Context Ratio:** ${(limits.context_ratio * 100).toFixed(1)}%`,
      `- **Quota Ratio:** ${(limits.quota_ratio * 100).toFixed(1)}%`,
      `- **Tokens:** ${limits.tokens_total.toLocaleString()} (${limits.tokens_input.toLocaleString()} in / ${limits.tokens_output.toLocaleString()} out)`,
      `- **Context Window:** ${limits.context_window.toLocaleString()}`,
    ]
    
    if (limits.cost_estimate) {
      lines.push(`- **Cost Estimate:** $${limits.cost_estimate.toFixed(4)}`)
    }
    
    if (limits.throttle_count > 0) {
      lines.push(`- **Throttles:** ${limits.throttle_count}`)
    }
    
    return `## Limits Snapshot

${lines.join("\n")}`
  }
}
