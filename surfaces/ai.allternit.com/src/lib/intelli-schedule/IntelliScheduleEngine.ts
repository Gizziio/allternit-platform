import { GreedyStrategy } from './strategies/GreedyStrategy';
import { OptimizationStrategy } from './strategies/OptimizationStrategy';
import type { IntelliScheduleInput, IntelliScheduleOutput } from './types';

export class IntelliScheduleEngine {
  private strategy: OptimizationStrategy;

  constructor(strategy?: OptimizationStrategy) {
    this.strategy = strategy ?? new GreedyStrategy();
  }

  setStrategy(strategy: OptimizationStrategy): void {
    this.strategy = strategy;
  }

  getStrategyName(): string {
    return this.strategy.name;
  }

  optimize(input: IntelliScheduleInput): IntelliScheduleOutput {
    return this.strategy.optimize(input);
  }
}
