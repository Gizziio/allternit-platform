/**
 * Ars Contexta TUI Runtime Integration
 * 
 * Provides runtime lane visualization for:
 * - Entity extraction progress
 * - LLM insight generation
 * - Knowledge graph operations
 * 
 * WIH: GAP-78/GAP-79 TUI Integration
 */

import type { RuntimeLaneToolSnapshot, RuntimeLaneStatus } from "./runtime-lane"

export type ArsContextaOperationType = 
  | "entity-extraction"
  | "insight-generation"
  | "content-enrichment"
  | "knowledge-graph-update"

export interface ArsContextaOperation {
  id: string
  type: ArsContextaOperationType
  status: RuntimeLaneStatus
  label: string
  detail?: string
  progress?: number // 0-100
  entityCount?: number
  insightCount?: number
  processingTimeMs?: number
}

/**
 * Create a runtime lane snapshot for Ars Contexta operations
 */
export function createArsContextaSnapshot(
  operation: ArsContextaOperation
): RuntimeLaneToolSnapshot {
  const baseLabel = getOperationLabel(operation.type)
  
  return {
    callID: operation.id,
    tool: `ars-contexta-${operation.type}`,
    status: operation.status,
    label: baseLabel,
    detail: operation.detail || getDefaultDetail(operation),
    meta: formatMeta(operation),
    web: false,
  }
}

/**
 * Get human-readable label for operation type
 */
function getOperationLabel(type: ArsContextaOperationType): string {
  switch (type) {
    case "entity-extraction":
      return "extracting entities"
    case "insight-generation":
      return "generating insights"
    case "content-enrichment":
      return "enriching content"
    case "knowledge-graph-update":
      return "updating knowledge graph"
    default:
      return "processing"
  }
}

/**
 * Get default detail text based on operation state
 */
function getDefaultDetail(operation: ArsContextaOperation): string {
  switch (operation.status) {
    case "pending":
      return "waiting to start..."
    case "running":
      if (operation.type === "entity-extraction" && operation.progress !== undefined) {
        return `analyzing text (${operation.progress}%)`
      }
      if (operation.type === "insight-generation") {
        return "consulting LLM..."
      }
      return "processing..."
    case "completed":
      if (operation.entityCount !== undefined && operation.insightCount !== undefined) {
        return `found ${operation.entityCount} entities, ${operation.insightCount} insights`
      }
      if (operation.entityCount !== undefined) {
        return `found ${operation.entityCount} entities`
      }
      if (operation.insightCount !== undefined) {
        return `generated ${operation.insightCount} insights`
      }
      return "completed"
    case "error":
      return "processing failed"
    default:
      return ""
  }
}

/**
 * Format operation metadata
 */
function formatMeta(operation: ArsContextaOperation): string | undefined {
  const parts: string[] = []
  
  if (operation.progress !== undefined && operation.status === "running") {
    parts.push(`${operation.progress}%`)
  }
  
  if (operation.processingTimeMs !== undefined) {
    parts.push(`${(operation.processingTimeMs / 1000).toFixed(1)}s`)
  }
  
  if (operation.entityCount !== undefined && operation.status === "completed") {
    parts.push(`${operation.entityCount} entities`)
  }
  
  if (operation.insightCount !== undefined && operation.status === "completed") {
    parts.push(`${operation.insightCount} insights`)
  }
  
  return parts.length > 0 ? parts.join(" | ") : undefined
}

/**
 * Ars Contexta runtime state manager
 * Tracks active operations and generates lane snapshots
 */
export class ArsContextaRuntime {
  private operations = new Map<string, ArsContextaOperation>()
  private listeners = new Set<(operations: ArsContextaOperation[]) => void>()

  /**
   * Start a new operation
   */
  startOperation(
    type: ArsContextaOperationType,
    id?: string,
    detail?: string
  ): string {
    const operationId = id || `ac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    
    const operation: ArsContextaOperation = {
      id: operationId,
      type,
      status: "running",
      label: getOperationLabel(type),
      detail,
      progress: 0,
    }
    
    this.operations.set(operationId, operation)
    this.notifyListeners()
    
    return operationId
  }

  /**
   * Update operation progress
   */
  updateProgress(id: string, progress: number, detail?: string): void {
    const operation = this.operations.get(id)
    if (!operation) return
    
    operation.progress = Math.min(100, Math.max(0, progress))
    if (detail) operation.detail = detail
    
    this.notifyListeners()
  }

  /**
   * Update operation results
   */
  updateResults(
    id: string,
    results: {
      entityCount?: number
      insightCount?: number
      processingTimeMs?: number
    }
  ): void {
    const operation = this.operations.get(id)
    if (!operation) return
    
    if (results.entityCount !== undefined) operation.entityCount = results.entityCount
    if (results.insightCount !== undefined) operation.insightCount = results.insightCount
    if (results.processingTimeMs !== undefined) operation.processingTimeMs = results.processingTimeMs
    
    this.notifyListeners()
  }

  /**
   * Complete an operation
   */
  completeOperation(id: string): void {
    const operation = this.operations.get(id)
    if (!operation) return
    
    operation.status = "completed"
    operation.progress = 100
    
    this.notifyListeners()
  }

  /**
   * Mark operation as failed
   */
  failOperation(id: string, detail?: string): void {
    const operation = this.operations.get(id)
    if (!operation) return
    
    operation.status = "error"
    if (detail) operation.detail = detail
    
    this.notifyListeners()
  }

  /**
   * Remove a completed/failed operation
   */
  removeOperation(id: string): void {
    this.operations.delete(id)
    this.notifyListeners()
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): ArsContextaOperation[] {
    return Array.from(this.operations.values()).filter(
      op => op.status === "pending" || op.status === "running"
    )
  }

  /**
   * Get all operations
   */
  getAllOperations(): ArsContextaOperation[] {
    return Array.from(this.operations.values())
  }

  /**
   * Get runtime lane snapshots for active operations
   */
  getRuntimeSnapshots(): RuntimeLaneToolSnapshot[] {
    return this.getActiveOperations().map(createArsContextaSnapshot)
  }

  /**
   * Subscribe to operation changes
   */
  subscribe(callback: (operations: ArsContextaOperation[]) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notifyListeners(): void {
    const ops = this.getAllOperations()
    this.listeners.forEach(cb => cb(ops))
  }

  /**
   * Clear all completed operations
   */
  clearCompleted(): void {
    for (const [id, op] of this.operations) {
      if (op.status === "completed" || op.status === "error") {
        this.operations.delete(id)
      }
    }
    this.notifyListeners()
  }
}

// Global runtime instance
let globalRuntime: ArsContextaRuntime | null = null

/**
 * Get or create global Ars Contexta runtime
 */
export function getArsContextaRuntime(): ArsContextaRuntime {
  if (!globalRuntime) {
    globalRuntime = new ArsContextaRuntime()
  }
  return globalRuntime
}

/**
 * Reset global runtime (useful for testing)
 */
export function resetArsContextaRuntime(): void {
  globalRuntime = null
}
