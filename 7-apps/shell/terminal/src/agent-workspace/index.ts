/**
 * Agent Workspace Module
 * 
 * Client-side workspace management for the A2R platform.
 * 
 * Architecture:
 *   KERNEL (Rust) ←→ MARKDOWN (Distillation) ←→ AGENT WORKSPACE (This Module) ←→ AGENT
 * 
 * The kernel maintains authoritative state (ledger, receipts, deterministic execution).
 * The agent_workspace maintains a distilled markdown view that:
 *   - Is human-readable
 *   - Can be rehydrated by agents at context boundaries
 *   - Syncs with kernel state
 * 
 * 5-Layer Structure:
 *   L1-COGNITIVE: BRAIN.md, memory.jsonl, state.json (thinking/memory)
 *   L2-IDENTITY: IDENTITY.md, CONVENTIONS.md, POLICY.md (who we are)
 *   L3-GOVERNANCE: PLAYBOOK.md, TOOLS.md, HEARTBEAT.md (how we work)
 *   L4-SKILLS: INDEX.md, skills/ (what we can do)
 *   L5-BUSINESS: CLIENTS.md, crm/, projects/ (who we serve)
 */

export { AgentWorkspace } from "./artifacts"
export * as AgentWorkspaceBridge from "./bridge"
export { BootSequence } from "./boot"
export { PolicyEngine } from "./policy"
export { ContextPackBuilder } from "./context"
export { ResumeSession, ResumeError } from "./resume"
export { Checkpoint } from "./checkpoint"
export { KernelSync } from "./kernel-sync"
export { KernelClient } from "./kernel-client"
export { SessionPersistence } from "./session-persistence"

// Re-export types from namespaces
export type WorkspacePaths = import("./artifacts").AgentWorkspace.WorkspacePaths
export type BootPhase = import("./boot").BootSequence.BootPhase
export type BootOptions = import("./boot").BootSequence.BootOptions
export type BootResult = import("./boot").BootSequence.BootResult
export type Policy = import("./policy").PolicyEngine.Policy
export type PolicyResult = import("./policy").PolicyEngine.PolicyResult
export type ToolCall = import("./policy").PolicyEngine.ToolCall
export type ContextPack = import("./context").ContextPackBuilder.ContextPack
export type ContextLayer = import("./context").ContextPackBuilder.ContextLayer
export type ContextFile = import("./context").ContextPackBuilder.ContextFile
export type BuildOptions = import("./context").ContextPackBuilder.BuildOptions
export type { ResumeContext, ValidationResult, ResumeOptions, SessionResumeInfo } from "./resume"
export type { CheckpointData, CheckpointOptions, PruneOptions, FileSnapshot } from "./checkpoint"
export type { SyncOptions, SyncState } from "./kernel-sync"
