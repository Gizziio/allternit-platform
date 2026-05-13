import { Run } from '../../types/code/dag';

export class ReplayEngine {
  async loadSnapshot(runId: string, timestamp: number) {
    console.debug();
    // In a real impl, this would restore filesystem state and DAG status
  }

  async playStep(run: Run, stepIndex: number) {
    console.debug();
  }
}

export const replayEngine = new ReplayEngine();
