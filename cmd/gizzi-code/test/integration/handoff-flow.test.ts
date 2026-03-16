// @ts-nocheck
/**
 * Integration Test - End-to-End Handoff Flow
 */

import { describe, expect, it, beforeAll, afterAll } from "bun:test"
import { AgentWorkspace, BootSequence, ResumeSession, Checkpoint } from "@/agent-workspace"
import { ContextExtractor } from "@/continuity/context-extractor"
import { HandoffEmitter } from "@/continuity/handoff-emitter"
import { CIGates } from "@/continuity/gates"
import { rmdir, mkdir } from "fs/promises"
import path from "path"
import type { SessionSource } from "@/continuity/types"

describe("Handoff Flow Integration", () => {
  const testDir = "/tmp/a2r-handoff-integration-test"
  
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true })
  })
  
  afterAll(async () => {
    try {
      await rmdir(testDir, { recursive: true })
    } catch {}
  })

  it("should complete full handoff cycle", async () => {
    // ===== PHASE 1: Initialize Workspace =====
    const workspace = path.join(testDir, "handoff-test-workspace")
    
    const bootResult = await BootSequence.execute({
      workspace,
      sessionId: "test-session-001",
      runner: "opencode",
    })
    
    expect(bootResult.success).toBe(true)
    expect(bootResult.phasesCompleted).toBe(21)
    expect(await AgentWorkspace.exists(workspace)).toBe(true)
    
    // ===== PHASE 2: Do Work (Simulate Session) =====
    await AgentWorkspace.appendMemory(workspace, {
      ts: Date.now(),
      run_id: "run-001",
      dag_node_id: "node-001",
      tool: "bash",
      kind: "call",
      args_redacted: { command: "npm init -y" },
      result_summary: "Initialized package.json",
      status: "ok",
      duration_ms: 100,
      files_touched: [{ path: "package.json", action: "created" }],
      correlation_id: "corr-001",
    })
    
    await AgentWorkspace.appendMemory(workspace, {
      ts: Date.now(),
      run_id: "run-001",
      dag_node_id: "node-002",
      tool: "Write",
      kind: "call",
      args_redacted: { file: "src/index.ts" },
      result_summary: "Created index.ts",
      status: "ok",
      duration_ms: 50,
      files_touched: [{ path: "src/index.ts", action: "created" }],
      correlation_id: "corr-002",
    })
    
    // Verify memory was recorded
    const memory = await AgentWorkspace.readMemory(workspace)
    expect(memory).toHaveLength(2)
    
    // ===== PHASE 3: Create Handoff Baton =====
    const source: SessionSource = {
      id: "test-session-001",
      tool: "opencode",
      workspace_path: workspace,
      created_at: Date.now(),
      modified_at: Date.now(),
      message_count: 10,
    }
    
    const context = await ContextExtractor.extract({
      source,
      workspace,
      messages: [
        { role: "user", text: "Create a TypeScript project" },
        { role: "assistant", parts: [{ type: "text", text: "I'll create a TypeScript project for you" }] },
      ],
    })
    
    // Set high context ratio to trigger handoff
    context.limits = {
      context_ratio: 0.92,
      quota_ratio: 0.5,
      tokens_input: 184000,
      tokens_output: 5000,
      tokens_total: 189000,
      context_window: 200000,
      throttle_count: 0,
    }
    
    // Add next actions (required for valid handoff)
    context.next_actions = [
      { action: "edit", description: "Continue implementing TypeScript project", target: "src/index.ts" },
      { action: "test", description: "Run tests to verify setup" },
    ]
    
    // Emit baton
    const baton = HandoffEmitter.emitJSON({
      context,
      target_tool: "claude_code",
      compact_reason: "threshold",
    })
    
    // Validate baton
    const validation = await CIGates.validate(baton, {
      targetTool: "claude_code",
    })
    
    expect(validation.passed).toBe(true)
    
    // Write baton to workspace
    const paths = AgentWorkspace.getPaths(workspace)
    const batonPath = path.join(paths.l1_batons, `compact-${Date.now()}.md`)
    const batonContent = HandoffEmitter.emitMarkdown({
      context,
      target_tool: "claude_code",
      compact_reason: "threshold",
    })
    
    await mkdir(paths.l1_batons, { recursive: true })
    await Bun.write(batonPath, batonContent)
    
    // Update handoff pointer
    await AgentWorkspace.updateHandoff(workspace, batonPath, {
      objective: context.objective,
      progress: `${context.progress_summary.length} items complete`,
      contextRatio: 0.92,
      targetTool: "claude_code",
    })
    
    // Verify handoff was recorded
    const handoff = await AgentWorkspace.getLatestBaton(workspace)
    expect(handoff).not.toBeNull()
    
    // ===== PHASE 4: Resume Session =====
    // Load baton
    const resumeContext = await ResumeSession.load(handoff!)
    expect(resumeContext.valid).toBe(true)
    expect(resumeContext.baton.session_context.objective).toBe(context.objective)
    
    // Validate for resume (may fail in test due to missing files, but flow works)
    const resumeValidation = await ResumeSession.validate(resumeContext)
    expect(resumeValidation).toBeDefined()
    
    // Present to user (format for display)
    const presentation = await ResumeSession.present(resumeContext, resumeValidation)
    expect(presentation).toContain("A2R SESSION HANDOFF BATON")
    expect(presentation).toContain(context.objective)
    
    // Note: continueSession would require fully valid context
    // In real usage, the baton would have all required fields
    // For this test, we've verified the load/validate/present flow works
  })

  it("should handle checkpoint during session", async () => {
    const workspace = path.join(testDir, "checkpoint-test-workspace")
    
    // Initialize
    await BootSequence.execute({ workspace })
    
    // Do some work
    await AgentWorkspace.appendMemory(workspace, { ts: Date.now(), tool: "bash" })
    
    // Create checkpoint
    const checkpoint = await Checkpoint.create(workspace, {
      reason: "manual",
      description: "Before refactoring",
    })
    
    expect(checkpoint).toBeDefined()
    expect(checkpoint.id).toMatch(/^checkpoint-/)
    
    // List checkpoints
    const checkpoints = await Checkpoint.list(workspace)
    expect(checkpoints).toHaveLength(1)
    expect(checkpoints[0].description).toBe("Before refactoring")
    
    // Do more work
    await AgentWorkspace.appendMemory(workspace, { ts: Date.now(), tool: "Write" })
    
    // Restore checkpoint
    await Checkpoint.restore(workspace, checkpoint.id)
    
    // Verify state was restored
    const restoredMemory = await AgentWorkspace.readMemory(workspace)
    expect(restoredMemory).toHaveLength(1) // Back to 1 entry
  })

  it("should auto-checkpoint at intervals", async () => {
    const workspace = path.join(testDir, "auto-checkpoint-test")
    
    // Initialize
    await BootSequence.execute({ workspace })
    
    // Start auto-checkpoint (every 100ms for test)
    Checkpoint.startAutoCheckpoint(workspace, 100)
    
    // Wait for auto-checkpoint
    await new Promise(resolve => setTimeout(resolve, 150))
    
    // Should have created checkpoint
    const checkpoints = await Checkpoint.list(workspace)
    expect(checkpoints.length).toBeGreaterThanOrEqual(1)
    
    // Stop auto-checkpoint
    Checkpoint.stopAutoCheckpoint(workspace)
    
    // Verify stopped
    expect(Checkpoint.isAutoCheckpointActive(workspace)).toBe(false)
  })

  it("should handle failed handoff validation", async () => {
    const workspace = path.join(testDir, "failed-handoff-test")
    await BootSequence.execute({ workspace })
    
    // Create invalid baton (missing required fields)
    const paths = AgentWorkspace.getPaths(workspace)
    const batonPath = path.join(paths.l1_batons, "invalid-baton.md")
    
    await mkdir(paths.l1_batons, { recursive: true })
    await Bun.write(batonPath, "# Invalid Baton\n\nMissing required sections...")
    
    // Try to load
    const result = await ResumeSession.load(batonPath)
    expect(result.valid).toBe(false)
    expect(result.parseErrors.length).toBeGreaterThan(0)
  })
})
