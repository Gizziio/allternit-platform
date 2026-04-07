/**
 * Cost Tracker
 */

export interface CostInfo {
  inputCost: number
  outputCost: number
  totalCost: number
}

export function calculateCost(tokens: number, model: string): number {
  return 0
}

export function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`
}
