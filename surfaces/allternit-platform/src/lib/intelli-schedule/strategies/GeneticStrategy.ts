import { OptimizationStrategy } from './OptimizationStrategy';
import type { IntelliScheduleInput, IntelliScheduleOutput } from '../types';
import { GreedyStrategy } from './GreedyStrategy';

interface Chromosome {
  order: string[];
  fitness: number;
}

export class GeneticStrategy extends OptimizationStrategy {
  readonly name = 'genetic';
  private populationSize = 30;
  private generations = 50;
  private mutationRate = 0.15;

  optimize(input: IntelliScheduleInput): IntelliScheduleOutput {
    const greedy = new GreedyStrategy();
    const baseResult = greedy.optimize(input);

    if (input.tasks.length < 3) return baseResult;

    let population = this.initPopulation(input.tasks.map((t) => t.id));

    for (let gen = 0; gen < this.generations; gen++) {
      const scored = population.map((order) => ({
        order,
        fitness: this.evaluate(order, input),
      }));
      scored.sort((a, b) => b.fitness - a.fitness);

      const elites = scored.slice(0, 5);
      const nextGen: string[][] = elites.map((e) => [...e.order]);

      while (nextGen.length < this.populationSize) {
        const p1 = this.tournamentSelect(scored);
        const p2 = this.tournamentSelect(scored);
        const child = this.crossover(p1, p2);
        if (Math.random() < this.mutationRate) this.mutate(child);
        nextGen.push(child);
      }
      population = nextGen;
    }

    const best = population
      .map((order) => ({ order, fitness: this.evaluate(order, input) }))
      .sort((a, b) => b.fitness - a.fitness)[0];

    return this.buildResult(best.order, input);
  }

  private initPopulation(taskIds: string[]): string[][] {
    const pop: string[][] = [];
    for (let i = 0; i < this.populationSize; i++) {
      pop.push(this.shuffle([...taskIds]));
    }
    return pop;
  }

  private shuffle(arr: string[]): string[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  private evaluate(order: string[], input: IntelliScheduleInput): number {
    const result = this.buildResult(order, input);
    let score = result.orderedTasks.length * 100;
    for (const s of result.schedule) {
      if (s.risk === 'low') score += 10;
      else if (s.risk === 'medium') score += 5;
    }
    score -= result.unrunnable.length * 50;
    return score;
  }

  private tournamentSelect(scored: Chromosome[]): string[] {
    const a = scored[Math.floor(Math.random() * scored.length)];
    const b = scored[Math.floor(Math.random() * scored.length)];
    return (a.fitness > b.fitness ? a : b).order;
  }

  private crossover(p1: string[], p2: string[]): string[] {
    const point = Math.floor(Math.random() * (p1.length - 1)) + 1;
    const child = p1.slice(0, point);
    for (const id of p2) {
      if (!child.includes(id)) child.push(id);
    }
    return child;
  }

  private mutate(order: string[]): void {
    const i = Math.floor(Math.random() * order.length);
    const j = Math.floor(Math.random() * order.length);
    [order[i], order[j]] = [order[j], order[i]];
  }

  private buildResult(order: string[], input: IntelliScheduleInput): IntelliScheduleOutput {
    const { constraints } = input;
    const taskMap = new Map(input.tasks.map((t) => [t.id, t]));
    const dayAllocations: Record<string, number> = {};
    const scheduledMap = new Map<string, { startTime: Date; endTime: Date }>();
    const orderedTasks: string[] = [];
    const schedule: IntelliScheduleOutput['schedule'] = [];
    const unrunnable: string[] = [];

    const startRef = constraints.startTime.getTime();
    const hoursPerDay = constraints.availableHoursPerDay;
    const bufferMs = constraints.bufferMinutes * 60 * 1000;

    for (const taskId of order) {
      const task = taskMap.get(taskId);
      if (!task) continue;
      const result = this.allocateTask(task, startRef, hoursPerDay, bufferMs, dayAllocations, scheduledMap);
      if (result) {
        const risk = this.calculateRisk(result.endTime, task.deadline);
        scheduledMap.set(task.id, result);
        orderedTasks.push(task.id);
        schedule.push({ taskId: task.id, startTime: result.startTime, endTime: result.endTime, risk });
      } else {
        unrunnable.push(task.id);
      }
    }

    return { orderedTasks, schedule, unrunnable };
  }
}
