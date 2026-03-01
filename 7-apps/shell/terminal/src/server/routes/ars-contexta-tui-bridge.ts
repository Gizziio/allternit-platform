/**
 * Ars Contexta Server-TUI Bridge
 * 
 * Connects Ars Contexta server routes to TUI runtime visualization
 * Shows real-time progress of entity extraction and insight generation
 * 
 * WIH: GAP-78/GAP-79 TUI Integration
 */

import { getArsContextaRuntime } from "../../ui/a2r/ars-contexta-runtime"
import { Log } from "../../util/log"

const log = Log.create({ service: "ars-contexta-tui-bridge" })

/**
 * Wrap an async operation with TUI progress tracking
 */
export async function withProgressTracking<T>(
  operationType: "entity-extraction" | "insight-generation" | "content-enrichment",
  label: string,
  operation: (update: (progress: number, detail?: string) => void) => Promise<T>
): Promise<T> {
  const runtime = getArsContextaRuntime()
  const operationId = runtime.startOperation(operationType, undefined, "initializing...")
  
  try {
    // Update to running
    runtime.updateProgress(operationId, 10, "processing...")
    
    const result = await operation((progress, detail) => {
      runtime.updateProgress(operationId, progress, detail)
    })
    
    // Complete
    runtime.completeOperation(operationId)
    
    // Clean up after delay
    setTimeout(() => {
      runtime.removeOperation(operationId)
    }, 5000)
    
    return result
  } catch (error) {
    log.error("Operation failed", { operationType, error })
    runtime.failOperation(operationId, error instanceof Error ? error.message : "Unknown error")
    throw error
  }
}

/**
 * Track entity extraction progress
 */
export async function trackEntityExtraction<T>(
  operation: () => Promise<{ result: T; entityCount: number; processingTimeMs: number }>
): Promise<T> {
  return withProgressTracking(
    "entity-extraction",
    "Extracting entities",
    async (update) => {
      update(20, "loading NLP model...")
      
      const { result, entityCount, processingTimeMs } = await operation()
      
      update(80, `found ${entityCount} entities`)
      
      const runtime = getArsContextaRuntime()
      const [op] = runtime.getActiveOperations().slice(-1)
      if (op) {
        runtime.updateResults(op.id, { entityCount, processingTimeMs })
      }
      
      update(100, "complete")
      
      return result
    }
  )
}

/**
 * Track insight generation progress
 */
export async function trackInsightGeneration<T>(
  operation: () => Promise<{ result: T; insightCount: number; processingTimeMs: number }>
): Promise<T> {
  return withProgressTracking(
    "insight-generation",
    "Generating insights",
    async (update) => {
      update(20, "preparing context...")
      update(40, "querying LLM...")
      
      const { result, insightCount, processingTimeMs } = await operation()
      
      update(90, `generated ${insightCount} insights`)
      
      const runtime = getArsContextaRuntime()
      const [op] = runtime.getActiveOperations().slice(-1)
      if (op) {
        runtime.updateResults(op.id, { insightCount, processingTimeMs })
      }
      
      update(100, "complete")
      
      return result
    }
  )
}

/**
 * Track combined content enrichment
 */
export async function trackContentEnrichment<T>(
  operation: () => Promise<{ 
    result: T 
    entityCount: number 
    insightCount: number
    processingTimeMs: number 
  }>
): Promise<T> {
  return withProgressTracking(
    "content-enrichment",
    "Enriching content",
    async (update) => {
      update(10, "starting enrichment pipeline...")
      update(30, "extracting entities...")
      update(50, "generating insights...")
      update(70, "processing results...")
      
      const { result, entityCount, insightCount, processingTimeMs } = await operation()
      
      update(90, `found ${entityCount} entities, ${insightCount} insights`)
      
      const runtime = getArsContextaRuntime()
      const [op] = runtime.getActiveOperations().slice(-1)
      if (op) {
        runtime.updateResults(op.id, { entityCount, insightCount, processingTimeMs })
      }
      
      update(100, "complete")
      
      return result
    }
  )
}

/**
 * Express middleware to inject TUI tracking into Ars Contexta routes
 */
export function arsContextaTuiMiddleware() {
  return async (c: any, next: () => Promise<void>) => {
    // Store original json method
    const originalJson = c.json.bind(c)
    
    // Track operation start time
    const startTime = Date.now()
    
    // Override json method to capture results
    c.json = (data: any, init?: any) => {
      const duration = Date.now() - startTime
      
      // Log to TUI if there's an active operation
      const runtime = getArsContextaRuntime()
      const activeOps = runtime.getActiveOperations()
      
      if (activeOps.length > 0) {
        const op = activeOps[activeOps.length - 1]
        
        // Extract counts from response if available
        const entityCount = data?.entities?.length || data?.entityCount
        const insightCount = data?.insights?.length || data?.insightCount
        
        if (entityCount !== undefined || insightCount !== undefined) {
          runtime.updateResults(op.id, {
            entityCount,
            insightCount,
            processingTimeMs: duration,
          })
        }
      }
      
      return originalJson(data, init)
    }
    
    await next()
  }
}
