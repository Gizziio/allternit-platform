import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export class GraphExecutor {
  constructor(private repoRoot: string) {}

  async executeGraph(graphPath: string) {
    console.log('[GraphExecutor] Analyzing graph dependencies...');
    
    // Call our Python runner to get the topological order
    const runnerPath = path.join(this.repoRoot, 'bin', 'graph-runner.py');
    const orderRaw = execSync(`python3 ${runnerPath} ${graphPath}`).toString().trim();
    const taskOrder = orderRaw.split(' ');

    console.log('[GraphExecutor] Execution Sequence: ' + taskOrder.join(' -> '));

    const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
    const nodes = graph.nodes;

    for (const taskId of taskOrder) {
      const node = nodes.find((n: any) => n.task_id === taskId);
      console.log(`[GraphExecutor] Running Task ${taskId}: ${node.description}`);
      // Execution logic for each node type (governance, substrate, etc) would go here
    }

    console.log('[GraphExecutor] Graph execution complete.');
  }
}
