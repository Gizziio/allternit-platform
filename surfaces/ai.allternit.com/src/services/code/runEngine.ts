import { DagNode, Run } from '../../types/code/dag';
import { useDagState } from '../../state/useDagState';

export class RunEngine {
  private activeRun: Run | null = null;

  async startRun(run: Run) {
    this.activeRun = run;
    console.log('[RunEngine] Starting run:', run.id);
    
    // Mock execution flow
    for (const node of run.nodes) {
      if (node.status === 'pending') {
        await this.executeNode(node);
      }
    }
  }

  private async executeNode(node: DagNode) {
    const { updateNodeStatus } = useDagState.getState();
    
    console.log('[RunEngine] Executing node:', node.title);
    updateNodeStatus(node.id, 'running');
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    updateNodeStatus(node.id, 'completed');
    console.log('[RunEngine] Node completed:', node.title);
  }

  stopRun() {
    this.activeRun = null;
  }
}

export const runEngine = new RunEngine();
