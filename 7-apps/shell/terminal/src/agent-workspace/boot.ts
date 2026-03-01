/**
 * Agent Workspace - Boot Sequence
 * 
 * 21-phase deterministic initialization of the 5-layer workspace.
 * Each phase creates or validates a component of the workspace.
 */

import { Log } from "@/util/log"
import { AgentWorkspace } from "./artifacts"

const log = Log.create({ service: "agent_workspace.boot" })

export namespace BootSequence {
  export interface BootPhase {
    phase: number
    name: string
    layer: number
    action: () => Promise<void>
  }

  export interface BootOptions {
    workspace: string
    sessionId?: string
    runner?: string
    enableL5?: boolean
    skipIfExists?: boolean
  }

  export interface BootResult {
    success: boolean
    phasesCompleted: number
    totalPhases: number
    errors: string[]
    paths?: AgentWorkspace.WorkspacePaths
  }

  /**
   * Execute 21-phase boot sequence
   * 
   * Phases 1-6:  Foundation (L1 - Cognitive)
   * Phases 7-14: Identity (L2 - Identity)
   * Phases 15-18: Governance (L3 - Governance)
   * Phase 19:    Skills (L4 - Skills)
   * Phase 20:    Business (L5 - Business)
   * Phase 21:    Handoff Discovery
   */
  export async function execute(options: BootOptions): Promise<BootResult> {
    log.info("Starting 21-phase boot sequence", { workspace: options.workspace })

    const errors: string[] = []
    let phasesCompleted = 0

    try {
      // Check if already initialized
      if (options.skipIfExists && await AgentWorkspace.exists(options.workspace)) {
        log.info("Workspace already initialized, skipping")
        return {
          success: true,
          phasesCompleted: 0,
          totalPhases: 21,
          errors: [],
          paths: AgentWorkspace.getPaths(options.workspace),
        }
      }

      // Execute all phases through AgentWorkspace.initialize
      // The initialize function handles phases 1-20 internally
      const paths = await AgentWorkspace.initialize(options.workspace, {
        sessionId: options.sessionId,
        runner: options.runner,
        enableL5: options.enableL5,
      })

      phasesCompleted = options.enableL5 ? 20 : 19

      // Phase 21: Handoff Discovery
      await phase21_HandoffDiscovery(options.workspace)
      phasesCompleted = 21

      log.info("Boot sequence complete", { phasesCompleted })

      return {
        success: true,
        phasesCompleted,
        totalPhases: 21,
        errors,
        paths,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      errors.push(errorMsg)
      log.error("Boot sequence failed", { error: errorMsg })

      return {
        success: false,
        phasesCompleted,
        totalPhases: 21,
        errors,
      }
    }
  }

  /**
   * Phase 21: Handoff Discovery
   * 
   * Check for existing handoff and offer resume.
   */
  async function phase21_HandoffDiscovery(workspace: string): Promise<void> {
    log.debug("Phase 21: Handoff Discovery")

    const baton = await AgentWorkspace.getLatestBaton(workspace)
    if (baton) {
      log.info("Existing handoff found", { baton })
      // TODO: Offer resume to user
      // This would integrate with TUI or CLI
    }
  }

  /**
   * Get boot phase definitions
   * 
   * Returns the list of phases for progress reporting.
   */
  export function getPhases(enableL5: boolean = false): BootPhase[] {
    const phases: BootPhase[] = [
      // Phase 1-6: Foundation (L1)
      { phase: 1, name: "Create L1 structure", layer: 1, action: async () => {} },
      { phase: 2, name: "Initialize state.json", layer: 1, action: async () => {} },
      { phase: 3, name: "Create memory.jsonl", layer: 1, action: async () => {} },
      { phase: 4, name: "Write BRAIN.md", layer: 1, action: async () => {} },
      { phase: 5, name: "Write MEMORY.md", layer: 1, action: async () => {} },
      { phase: 6, name: "Create batons directory", layer: 1, action: async () => {} },

      // Phase 7-14: Identity (L2)
      { phase: 7, name: "Create L2 structure", layer: 2, action: async () => {} },
      { phase: 8, name: "Write IDENTITY.md", layer: 2, action: async () => {} },
      { phase: 9, name: "Write POLICY.md", layer: 2, action: async () => {} },
      { phase: 10, name: "Write CONVENTIONS.md", layer: 2, action: async () => {} },
      { phase: 11, name: "Write SOUL.md", layer: 2, action: async () => {} },
      { phase: 12, name: "Write USER.md", layer: 2, action: async () => {} },
      { phase: 13, name: "Write VOICE.md", layer: 2, action: async () => {} },
      { phase: 14, name: "Finalize L2", layer: 2, action: async () => {} },

      // Phase 15-18: Governance (L3)
      { phase: 15, name: "Create L3 structure", layer: 3, action: async () => {} },
      { phase: 16, name: "Write PLAYBOOK.md", layer: 3, action: async () => {} },
      { phase: 17, name: "Write TOOLS.md", layer: 3, action: async () => {} },
      { phase: 18, name: "Write HEARTBEAT.md", layer: 3, action: async () => {} },

      // Phase 19: Skills (L4)
      { phase: 19, name: "Create L4 structure", layer: 4, action: async () => {} },

      // Phase 20: Business (L5) - optional
      { phase: 20, name: "Create L5 structure", layer: 5, action: async () => {} },

      // Phase 21: Handoff Discovery
      { phase: 21, name: "Handoff Discovery", layer: 0, action: async () => {} },
    ]

    if (!enableL5) {
      return phases.filter(p => p.phase !== 20)
    }

    return phases
  }
}
