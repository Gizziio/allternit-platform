export function detectCycles(tasks: { id: string; dependencies: string[] }[]): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(nodeId: string, path: string[]) {
    visited.add(nodeId);
    recStack.add(nodeId);
    const task = tasks.find((t) => t.id === nodeId);
    if (task) {
      for (const depId of task.dependencies) {
        if (!visited.has(depId)) {
          dfs(depId, [...path, depId]);
        } else if (recStack.has(depId)) {
          const cycleStart = path.indexOf(depId);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart).concat([depId]));
          }
        }
      }
    }
    recStack.delete(nodeId);
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, [task.id]);
    }
  }

  return cycles;
}

export function getDependencyDepth(tasks: { id: string; dependencies: string[] }[], taskId: string): number {
  const memo = new Map<string, number>();

  function depth(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    const task = tasks.find((t) => t.id === id);
    if (!task || task.dependencies.length === 0) {
      memo.set(id, 0);
      return 0;
    }
    const maxDepDepth = Math.max(...task.dependencies.map((depId) => depth(depId)));
    const d = maxDepDepth + 1;
    memo.set(id, d);
    return d;
  }

  return depth(taskId);
}

export function getTopologicalOrder(tasks: { id: string; dependencies: string[] }[]): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adj.set(task.id, []);
  }

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (adj.has(depId)) {
        adj.get(depId)!.push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) || []) {
      const newDeg = (inDegree.get(next) || 0) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  return order;
}
