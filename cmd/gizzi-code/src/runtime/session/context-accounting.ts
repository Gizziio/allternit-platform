import type { ModelMessage } from "ai"
import { Token } from "@/shared/util/token"

export interface ContextMeasurement {
  basis: "estimated" | "provider"
  inputTokens: number
  cachedTokens: number
  toolSchemaTokens: number
  systemTokens: number
  messageTokens: number
  reservedOutputTokens: number
  contextWindow: number
  remainingTokens: number
  utilization: number
}

function estimate(value: unknown) {
  try {
    return Token.estimate(typeof value === "string" ? value : JSON.stringify(value))
  } catch {
    return 0
  }
}

export namespace ContextAccounting {
  export function measure(input: {
    messages: ModelMessage[]
    system: string[]
    tools: Record<string, unknown>
    contextWindow: number
    reservedOutputTokens: number
    providerUsage?: { inputTokens: number; cachedTokens?: number }
  }): ContextMeasurement {
    const systemTokens = input.system.reduce((total, block) => total + estimate(block), 0)
    const messageTokens = input.messages.reduce((total, message) => total + estimate(message), 0)
    const toolSchemaTokens = Object.values(input.tools).reduce<number>((total, schema) => total + estimate(schema), 0)
    const estimatedInput = systemTokens + messageTokens + toolSchemaTokens
    const providerInput = input.providerUsage?.inputTokens
    const inputTokens = providerInput === undefined ? estimatedInput : Math.max(providerInput, estimatedInput)
    const cachedTokens = input.providerUsage?.cachedTokens ?? 0
    const occupied = inputTokens + input.reservedOutputTokens
    return {
      basis: providerInput === undefined ? "estimated" : "provider",
      inputTokens,
      cachedTokens,
      toolSchemaTokens,
      systemTokens,
      messageTokens,
      reservedOutputTokens: input.reservedOutputTokens,
      contextWindow: input.contextWindow,
      remainingTokens: Math.max(0, input.contextWindow - occupied),
      utilization: input.contextWindow > 0 ? Math.min(1, occupied / input.contextWindow) : 1,
    }
  }
}
