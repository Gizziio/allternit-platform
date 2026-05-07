import { Session } from "@/runtime/session"
import { SessionPrompt } from "@/runtime/session/prompt"
import { Log } from "@/shared/util/log"

const log = Log.create({ service: "parallel-executor" })

export interface ParallelVariant {
  variantId: string
  modelId: string
  label?: string
}

export interface ParallelVariantResult {
  variantId: string
  modelId: string
  status: "completed" | "failed" | "timeout"
  result?: string
  error?: string
}

function parseModel(modelId: string): { providerID: string; modelID: string } {
  const slash = modelId.indexOf("/")
  if (slash > 0) {
    return { providerID: modelId.slice(0, slash), modelID: modelId.slice(slash + 1) }
  }
  return { providerID: "claude-cli", modelID: modelId }
}

export async function runParallelVariants(
  parentSessionId: string,
  goal: string,
  variants: ParallelVariant[],
): Promise<ParallelVariantResult[]> {
  const maxConcurrency = 5
  const concurrency = Math.min(variants.length, maxConcurrency)

  log.info("Starting parallel variant execution", {
    parentSessionId,
    variantCount: variants.length,
    concurrency,
  })

  // Execute variants with limited concurrency
  const executing = new Set<Promise<ParallelVariantResult>>()
  const results: ParallelVariantResult[] = []
  const queue = [...variants]

  async function executeVariant(variant: ParallelVariant): Promise<ParallelVariantResult> {
    const { providerID, modelID } = parseModel(variant.modelId)
    let childSessionId: string | undefined

    try {
      // Fork the parent session so each variant has the same starting context
      const childSession = await Session.fork({ sessionID: parentSessionId })
      childSessionId = childSession.id

      // Run the agent loop with the goal
      const promptResult = await SessionPrompt.prompt({
        sessionID: childSessionId,
        parts: [{ type: "text", text: goal }],
        model: { providerID, modelID },
      })

      // Extract text result from the assistant message
      const textParts =
        promptResult.parts?.filter((p: any) => p.type === "text" || p.type === "content") ?? []
      const resultText = textParts.map((p: any) => p.text ?? p.content ?? "").join("\n")

      return {
        variantId: variant.variantId,
        modelId: variant.modelId,
        status: "completed",
        result: resultText || "Done",
      }
    } catch (err) {
      log.error("Variant execution failed", {
        variantId: variant.variantId,
        error: err instanceof Error ? err.message : String(err),
      })
      return {
        variantId: variant.variantId,
        modelId: variant.modelId,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  function startNext(): Promise<ParallelVariantResult> | null {
    const variant = queue.shift()
    if (!variant) return null
    const promise = executeVariant(variant)
    executing.add(promise)
    promise.finally(() => {
      executing.delete(promise)
    })
    return promise
  }

  // Seed initial concurrency pool
  for (let i = 0; i < concurrency; i++) {
    const p = startNext()
    if (!p) break
  }

  // Drain the queue
  while (executing.size > 0 || queue.length > 0) {
    const finished = await Promise.race(executing)
    results.push(finished)
    const next = startNext()
    if (!next && executing.size === 0) break
  }

  log.info("Parallel variant execution complete", {
    parentSessionId,
    completed: results.filter((r) => r.status === "completed").length,
    failed: results.filter((r) => r.status === "failed").length,
  })

  return results
}
