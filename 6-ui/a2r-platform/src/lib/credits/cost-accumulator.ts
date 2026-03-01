/**
 * Cost accumulator for tracking AI API usage
 */

export interface CostEntry {
  type: "llm" | "api";
  modelOrTool: string;
  inputTokens?: number;
  outputTokens?: number;
  cost: number;
  metadata?: Record<string, unknown>;
}

export class CostAccumulator {
  entries: CostEntry[] = [];
  totalCost = 0;
  inputTokens = 0;
  outputTokens = 0;
  model: string;

  constructor(model = "unknown") {
    this.model = model;
  }

  /**
   * Add LLM API cost
   */
  addLLMCost(
    model: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number },
    operation = "default"
  ): void {
    const inputTokens = usage.promptTokens ?? 0;
    const outputTokens = usage.completionTokens ?? 0;
    // Simple cost calculation - can be replaced with actual pricing
    const cost = this.calculateLLMCost(model, inputTokens, outputTokens);

    this.entries.push({
      type: "llm",
      modelOrTool: model,
      inputTokens,
      outputTokens,
      cost,
      metadata: { operation },
    });

    this.inputTokens += inputTokens;
    this.outputTokens += outputTokens;
    this.totalCost += cost;
  }

  /**
   * Add API tool cost
   */
  addAPICost(tool: string, cost: number, metadata?: Record<string, unknown>): void {
    this.entries.push({
      type: "api",
      modelOrTool: tool,
      cost,
      metadata,
    });
    this.totalCost += cost;
  }

  /**
   * Calculate approximate LLM cost based on model
   */
  private calculateLLMCost(model: string, inputTokens: number, outputTokens: number): number {
    // Default pricing per 1M tokens (can be replaced with actual pricing)
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4": { input: 30, output: 60 },
      "gpt-4o": { input: 5, output: 15 },
      "gpt-4o-mini": { input: 0.15, output: 0.6 },
      "claude-3": { input: 3, output: 15 },
      "gemini": { input: 0.5, output: 1.5 },
      default: { input: 1, output: 2 },
    };

    const modelKey = Object.keys(pricing).find((k) => model.includes(k)) ?? "default";
    const { input, output } = pricing[modelKey];

    return (inputTokens * input + outputTokens * output) / 1_000_000;
  }

  /**
   * Get summary of costs
   */
  getSummary(): {
    totalCost: number;
    llmCost: number;
    apiCost: number;
    inputTokens: number;
    outputTokens: number;
  } {
    const llmCost = this.entries
      .filter((e) => e.type === "llm")
      .reduce((sum, e) => sum + e.cost, 0);
    const apiCost = this.entries
      .filter((e) => e.type === "api")
      .reduce((sum, e) => sum + e.cost, 0);

    return {
      totalCost: this.totalCost,
      llmCost,
      apiCost,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
    };
  }
}

export function createCostAccumulator(model: string): CostAccumulator {
  return new CostAccumulator(model);
}

export { createCostAccumulator as default };
