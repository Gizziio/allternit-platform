export interface BudgetSnapshot {
  totalTokens: number;
  toolCalls: number;
  startTime: number;
}

export class BudgetManager {
  private totalTokens = 0;
  private toolCalls = 0;
  private startTime = Date.now();

  private MAX_TOKENS = 1_000_000;
  private MAX_TOOL_CALLS = 100;

  getSnapshot(): BudgetSnapshot {
    return {
      totalTokens: this.totalTokens,
      toolCalls: this.toolCalls,
      startTime: this.startTime
    };
  }

  recordUsage(tokens: number) {
    this.totalTokens += tokens;
  }

  recordToolCall() {
    this.toolCalls += 1;
  }

  isExceeded(): boolean {
    return this.totalTokens > this.MAX_TOKENS || this.toolCalls > this.MAX_TOOL_CALLS;
  }
}
