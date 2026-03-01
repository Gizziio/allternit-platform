/**
 * Agent Workspace - 5-Layer Artifacts Manager
 * 
 * Client-side workspace management for the A2R platform.
 * Manages .a2r/ directory structure with 5-layer architecture:
 * - L1-COGNITIVE: Task graph, memory, state
 * - L2-IDENTITY: Identity, conventions, values  
 * - L3-GOVERNANCE: Rules, playbooks, tools
 * - L4-SKILLS: Skill definitions
 * - L5-BUSINESS: Client/project context
 * 
 * This is the CLIENT-SIDE companion to the kernel. The kernel maintains
 * authoritative state; this module maintains the distilled markdown view.
 */

import path from "path"
import { Log } from "@/util/log"
import { Filesystem } from "@/util/filesystem"

const log = Log.create({ service: "agent_workspace.artifacts" })

export namespace AgentWorkspace {
  /**
   * 5-Layer directory structure
   */
  export interface WorkspacePaths {
    root: string
    manifest: string
    
    // L1: Cognitive
    l1_cognitive: string
    l1_brain: string
    l1_brain_md: string
    l1_state: string
    l1_taskgraph: string
    l1_batons: string
    l1_memory: string
    l1_memory_md: string
    l1_memory_jsonl: string
    l1_handoff: string
    l1_checkpoints: string
    l1_usage: string
    
    // L2: Identity
    l2_identity: string
    l2_identity_md: string
    l2_soul_md: string
    l2_user_md: string
    l2_voice_md: string
    l2_policy_md: string
    l2_conventions_md: string
    
    // L3: Governance
    l3_governance: string
    l3_playbook_md: string
    l3_tools_md: string
    l3_heartbeat_md: string
    l3_audit_md: string
    
    // L4: Skills
    l4_skills: string
    l4_index_md: string
    l4_skills_dir: string
    
    // L5: Business
    l5_business: string
    l5_clients_md: string
    l5_crm: string
    l5_projects: string
    l5_content: string
    
    // State
    state_dir: string
    state_locks: string
    state_index: string
    state_cache: string
  }

  /**
   * Get all 5-layer paths for a workspace
   */
  export function getPaths(workspace: string): WorkspacePaths {
    const root = path.join(workspace, ".a2r")
    
    return {
      root,
      manifest: path.join(root, "manifest.json"),
      
      // L1: Cognitive
      l1_cognitive: path.join(root, "L1-COGNITIVE"),
      l1_brain: path.join(root, "L1-COGNITIVE", "brain"),
      l1_brain_md: path.join(root, "L1-COGNITIVE", "BRAIN.md"),
      l1_state: path.join(root, "L1-COGNITIVE", "brain", "state.json"),
      l1_taskgraph: path.join(root, "L1-COGNITIVE", "brain", "taskgraph.json"),
      l1_batons: path.join(root, "L1-COGNITIVE", "brain", "batons"),
      l1_memory: path.join(root, "L1-COGNITIVE", "memory"),
      l1_memory_md: path.join(root, "L1-COGNITIVE", "memory", "MEMORY.md"),
      l1_memory_jsonl: path.join(root, "L1-COGNITIVE", "memory", "memory.jsonl"),
      l1_handoff: path.join(root, "L1-COGNITIVE", "memory", "handoff.md"),
      l1_checkpoints: path.join(root, "L1-COGNITIVE", "memory", "checkpoints"),
      l1_usage: path.join(root, "L1-COGNITIVE", "memory", "usage"),
      
      // L2: Identity
      l2_identity: path.join(root, "L2-IDENTITY"),
      l2_identity_md: path.join(root, "L2-IDENTITY", "IDENTITY.md"),
      l2_soul_md: path.join(root, "L2-IDENTITY", "SOUL.md"),
      l2_user_md: path.join(root, "L2-IDENTITY", "USER.md"),
      l2_voice_md: path.join(root, "L2-IDENTITY", "VOICE.md"),
      l2_policy_md: path.join(root, "L2-IDENTITY", "POLICY.md"),
      l2_conventions_md: path.join(root, "L2-IDENTITY", "CONVENTIONS.md"),
      
      // L3: Governance
      l3_governance: path.join(root, "L3-GOVERNANCE"),
      l3_playbook_md: path.join(root, "L3-GOVERNANCE", "PLAYBOOK.md"),
      l3_tools_md: path.join(root, "L3-GOVERNANCE", "TOOLS.md"),
      l3_heartbeat_md: path.join(root, "L3-GOVERNANCE", "HEARTBEAT.md"),
      l3_audit_md: path.join(root, "L3-GOVERNANCE", "AUDIT.md"),
      
      // L4: Skills
      l4_skills: path.join(root, "L4-SKILLS"),
      l4_index_md: path.join(root, "L4-SKILLS", "INDEX.md"),
      l4_skills_dir: path.join(root, "L4-SKILLS", "skills"),
      
      // L5: Business
      l5_business: path.join(root, "L5-BUSINESS"),
      l5_clients_md: path.join(root, "L5-BUSINESS", "CLIENTS.md"),
      l5_crm: path.join(root, "L5-BUSINESS", "crm"),
      l5_projects: path.join(root, "L5-BUSINESS", "projects"),
      l5_content: path.join(root, "L5-BUSINESS", "content"),
      
      // State
      state_dir: path.join(root, "state"),
      state_locks: path.join(root, "state", "locks"),
      state_index: path.join(root, "state", "index"),
      state_cache: path.join(root, "state", "cache"),
    }
  }

  /**
   * Initialize complete 5-layer structure (21-phase boot)
   */
  /**
   * Initialize Agent Workspace (21-phase boot)
   * 
   * Creates the 5-layer structure that mirrors the kernel architecture.
   * Each layer is both human-readable (.md) and machine-readable (.json).
   */
  export async function initialize(
    workspace: string,
    options?: {
      sessionId?: string
      runner?: string
      enableL5?: boolean
    }
  ): Promise<WorkspacePaths> {
    const paths = getPaths(workspace)
    const sessionId = options?.sessionId ?? generateSessionId()
    
    log.info("Initializing Agent Workspace (5-layer)", { workspace, sessionId })

    // Phase 1: Foundation (L0-L1)
    await initializePhase1_Foundation(paths)
    
    // Phase 2: Identity (L2)
    await initializePhase2_Identity(paths)
    
    // Phase 3: Governance (L3)
    await initializePhase3_Governance(paths)
    
    // Phase 4: Skills (L4)
    await initializePhase4_Skills(paths)
    
    // Phase 5: Business (L5) - optional
    if (options?.enableL5) {
      await initializePhase5_Business(paths)
    }

    // Write manifest
    await writeManifest(paths, {
      sessionId,
      runner: options?.runner ?? "unknown",
      enableL5: options?.enableL5 ?? false,
    })

    log.info("Agent Workspace initialized", { sessionId })
    return paths
  }

  /**
   * Phase 1: Foundation (Layers 0-1)
   */
  async function initializePhase1_Foundation(paths: WorkspacePaths): Promise<void> {
    log.debug("Boot Phase 1: Foundation")
    
    // 01-06: Create L1 structure
    await Filesystem.mkdir(paths.l1_cognitive)
    await Filesystem.mkdir(paths.l1_brain)
    await Filesystem.mkdir(paths.l1_batons)
    await Filesystem.mkdir(paths.l1_memory)
    await Filesystem.mkdir(paths.l1_checkpoints)
    await Filesystem.mkdir(paths.l1_usage)
    
    // Write initial files
    await Filesystem.write(paths.l1_state, JSON.stringify({
      dag: { current_node_id: null, root_node_id: null, depth: 0 },
      outputs: {},
      context: {},
      initialized_at: Date.now(),
    }, null, 2))
    
    await Filesystem.write(paths.l1_memory_jsonl, "")
    
    await Filesystem.write(paths.l1_brain_md, `# A2R Brain - Task Graph

**Status:** Initialized  
**Updated:** ${new Date().toISOString()}

## Task Graph

*No tasks yet*
`)
    
    await Filesystem.write(paths.l1_memory_md, `# A2R Memory Index

**Session Log:** memory.jsonl  
**Checkpoints:** checkpoints/  
**Usage:** usage/

*Session initialized*
`)
  }

  /**
   * Phase 2: Identity (Layer 2)
   */
  async function initializePhase2_Identity(paths: WorkspacePaths): Promise<void> {
    log.debug("Boot Phase 2: Identity")
    
    await Filesystem.mkdir(paths.l2_identity)
    
    await Filesystem.write(paths.l2_identity_md, `# Agent Identity

**Role:** AI Coding Assistant  
**Framework:** A2R Platform  
**Initialized:** ${new Date().toISOString()}

## Purpose
Help users write, understand, and maintain code.

## Capabilities
- Code reading and analysis
- File creation and modification
- Testing and debugging
- Documentation
`)
    
    await Filesystem.write(paths.l2_policy_md, `# Base Policy

## Core Rules
1. Always verify before destructive operations
2. Respect user preferences from USER.md
3. Follow conventions from CONVENTIONS.md
4. Log all actions to memory.jsonl
`)
    
    await Filesystem.write(paths.l2_conventions_md, `# Project Conventions

*Conventions will be inferred from project structure*
`)
    
    // Create placeholder files
    await Filesystem.write(paths.l2_soul_md, "# Core Values\n\n*To be defined*\n")
    await Filesystem.write(paths.l2_user_md, "# User Preferences\n\n*To be defined*\n")
    await Filesystem.write(paths.l2_voice_md, "# Communication Style\n\n*To be defined*\n")
  }

  /**
   * Phase 3: Governance (Layer 3)
   */
  async function initializePhase3_Governance(paths: WorkspacePaths): Promise<void> {
    log.debug("Boot Phase 3: Governance")
    
    await Filesystem.mkdir(paths.l3_governance)
    
    await Filesystem.write(paths.l3_playbook_md, `# Operating Playbook

## Standard Procedures

### Starting a Task
1. Read BRAIN.md for context
2. Check CONVENTIONS.md for standards
3. Review relevant memory.jsonl entries
4. Update BRAIN.md with new task

### Making Changes
1. Log intent to memory.jsonl
2. Make changes
3. Verify with tests
4. Update BRAIN.md progress
`)
    
    await Filesystem.write(paths.l3_tools_md, `# Tool Definitions

## Available Tools
See skill registry in L4-SKILLS/
`)
    
    await Filesystem.write(paths.l3_heartbeat_md, `# Agent Heartbeat

**Last Update:** ${new Date().toISOString()}  
**Status:** Healthy

## Metrics
- Context Ratio: 0%
- Tokens Used: 0
- Tasks Complete: 0
`)
    
    await Filesystem.write(paths.l3_audit_md, `# Audit Log

See memory.jsonl for detailed activity log.
`)
  }

  /**
   * Phase 4: Skills (Layer 4)
   */
  async function initializePhase4_Skills(paths: WorkspacePaths): Promise<void> {
    log.debug("Boot Phase 4: Skills")
    
    await Filesystem.mkdir(paths.l4_skills)
    await Filesystem.mkdir(paths.l4_skills_dir)
    
    await Filesystem.write(paths.l4_index_md, `# Skill Registry

## Available Skills

*Skills will be discovered and indexed here*

## Structure
Each skill in skills/ directory contains:
- SKILL.md: Definition
- contract.json: Contract schema
`)
  }

  /**
   * Phase 5: Business (Layer 5) - Optional
   */
  async function initializePhase5_Business(paths: WorkspacePaths): Promise<void> {
    log.debug("Boot Phase 5: Business")
    
    await Filesystem.mkdir(paths.l5_business)
    await Filesystem.mkdir(paths.l5_crm)
    await Filesystem.mkdir(paths.l5_projects)
    await Filesystem.mkdir(paths.l5_content)
    
    await Filesystem.write(paths.l5_clients_md, `# Client Registry

*No clients configured*
`)
  }

  /**
   * Write manifest.json
   */
  async function writeManifest(
    paths: WorkspacePaths,
    params: { sessionId: string; runner: string; enableL5: boolean }
  ): Promise<void> {
    const manifest = {
      agent_workspace_version: "1.0.0",
      manifest_version: "1.0.0",
      platform: "a2r",
      workspace: {
        root: path.dirname(paths.root),
        created_at: Date.now(),
      },
      session: {
        session_id: params.sessionId,
        runner: params.runner,
        started_at: Date.now(),
        parent_session: null,
      },
      layers: {
        l1_cognitive: { enabled: true, path: "L1-COGNITIVE/" },
        l2_identity: { enabled: true, path: "L2-IDENTITY/" },
        l3_governance: { enabled: true, path: "L3-GOVERNANCE/" },
        l4_skills: { enabled: true, path: "L4-SKILLS/" },
        l5_business: { enabled: params.enableL5, path: "L5-BUSINESS/" },
      },
      thresholds: {
        warn_context_ratio: 0.70,
        compact_context_ratio: 0.85,
        handoff_context_ratio: 0.92,
        max_context_tokens: 200000,
      },
      features: {
        guard_enabled: true,
        telemetry_enabled: true,
        auto_compact: true,
        ci_gates_enabled: true,
        checkpoint_interval_ms: 300000,
      },
    }
    
    await Filesystem.write(paths.manifest, JSON.stringify(manifest, null, 2))
  }

  /**
   * Check if 5-layer structure exists
   */
  export async function exists(workspace: string): Promise<boolean> {
    const paths = getPaths(workspace)
    try {
      const manifestExists = await Filesystem.exists(paths.manifest)
      const l1Exists = await Filesystem.exists(paths.l1_cognitive)
      const l2Exists = await Filesystem.exists(paths.l2_identity)
      return manifestExists && l1Exists && l2Exists
    } catch {
      return false
    }
  }

  /**
   * Read manifest
   */
  export async function readManifest(workspace: string): Promise<any | null> {
    const paths = getPaths(workspace)
    try {
      const content = await Filesystem.readText(paths.manifest)
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * Get latest baton path from handoff.md
   */
  export async function getLatestBaton(workspace: string): Promise<string | null> {
    const paths = getPaths(workspace)
    try {
      const content = await Filesystem.readText(paths.l1_handoff)
      // Parse markdown to find baton path
      const match = content.match(/## Current Baton\s*\n+[`"]?(\S+\.md)[`"]?/)
      if (match) {
        return path.join(workspace, ".a2r", match[1].replace(/^\.a2r\//, ""))
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Write memory entry (receipt)
   */
  export async function appendMemory(workspace: string, entry: object): Promise<void> {
    const paths = getPaths(workspace)
    const line = JSON.stringify(entry) + "\n"
    await Filesystem.append(paths.l1_memory_jsonl, line)
  }

  /**
   * Read memory entries
   */
  export async function readMemory(
    workspace: string,
    options?: { since?: number; limit?: number }
  ): Promise<object[]> {
    const paths = getPaths(workspace)
    try {
      const content = await Filesystem.readText(paths.l1_memory_jsonl)
      const lines = content.split("\n").filter(Boolean)
      
      let entries: any[] = lines.map(line => JSON.parse(line))
      
      if (options?.since) {
        entries = entries.filter(e => e.ts && e.ts >= options.since!)
      }
      
      if (options?.limit) {
        entries = entries.slice(-options.limit)
      }
      
      return entries
    } catch {
      return []
    }
  }

  /**
   * Update handoff pointer
   */
  export async function updateHandoff(
    workspace: string,
    batonPath: string,
    metadata?: {
      objective?: string
      progress?: string
      contextRatio?: number
      targetTool?: string
    }
  ): Promise<void> {
    const paths = getPaths(workspace)
    const batonRelPath = path.relative(paths.root, batonPath)
    
    const content = `# A2R Handoff Pointer

**Generated:** ${new Date().toISOString()}

## Current Baton

\`${batonRelPath}\`

## Quick Resume

**Objective:** ${metadata?.objective ?? "Continue session"}  
**Progress:** ${metadata?.progress ?? "Unknown"}  
**Blockers:** None  
**Next Action:** See baton for details

## Context Window
- **Used:** ${metadata?.contextRatio ? Math.round(metadata.contextRatio * 100) : "?"}%
- **Status:** ${metadata?.contextRatio && metadata.contextRatio > 0.9 ? "🔴 HANDOFF REQUIRED" : "🟢 OK"}

## Target Tool
${metadata?.targetTool ? `Preferred: \`${metadata.targetTool}\`` : "Any compatible runner"}
`
    
    await Filesystem.write(paths.l1_handoff, content)
    log.info("Handoff pointer updated", { workspace, baton: batonRelPath })
  }

  /**
   * Sync with kernel
   * 
   * The kernel is the source of truth. This method pulls authoritative
   * state and updates the markdown distillation.
   * 
   * Performs a one-time sync operation that:
   * 1. Pulls new entries from the kernel ledger
   * 2. Updates memory.jsonl with tool calls
   * 3. Updates state.json with state changes
   * 4. Regenerates BRAIN.md from task graph
   * 5. Updates HEARTBEAT.md with current status
   * 
   * @param workspace - Path to the workspace directory
   * @param options - Optional sync configuration (endpoint, apiKey, timeout)
   */
  export async function syncWithKernel(
    workspace: string,
    options?: { ledgerEndpoint?: string; apiKey?: string; timeout?: number }
  ): Promise<void> {
    log.info("Starting kernel sync", { workspace, endpoint: options?.ledgerEndpoint })

    try {
      // Import kernel-sync dynamically to avoid circular dependencies
      const { KernelSync } = await import("./kernel-sync")

      const syncState = await KernelSync.syncOnce(workspace, {
        ledgerEndpoint: options?.ledgerEndpoint,
        apiKey: options?.apiKey,
        timeout: options?.timeout,
      })

      if (syncState.errors.length > 0) {
        log.warn("Kernel sync completed with errors", {
          workspace,
          errors: syncState.errors,
          entriesProcessed: syncState.pendingUpdates,
        })
      } else {
        log.info("Kernel sync completed successfully", {
          workspace,
          entriesProcessed: syncState.pendingUpdates,
          sequence: syncState.ledgerSequence,
        })
      }
    } catch (error) {
      log.error("Kernel sync failed", {
        workspace,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - sync is best-effort, workspace should remain functional
    }
  }

  /**
   * Generate session ID
   */
  function generateSessionId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `sess-${timestamp}-${random}`
  }
}
