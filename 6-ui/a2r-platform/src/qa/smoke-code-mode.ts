
import { useTaskStore } from '../views/code/TaskStore';
import { useAgentStore } from '../views/code/AgentStore';

export function runCodeModeSmokeTests() {
  console.log('[smoke] Starting Code Mode tests...');

  // 1. Kanban CRUD & DAG Rules
  const taskStore = useTaskStore.getState();
  const initialCount = taskStore.tasks.length;
  
  taskStore.addTask({
    title: 'Smoke Test Task',
    description: 'Testing DAG validation',
    status: 'Backlog',
    deps: [],
    owner: 'tester'
  });
  
  if (taskStore.tasks.length !== initialCount + 1) throw new Error('Task creation failed');
  const newTask = taskStore.tasks.find(t => t.title === 'Smoke Test Task')!;
  
  // Test valid transition
  const res1 = taskStore.updateTaskStatus(newTask.id, 'In Progress');
  if (!res1.success) throw new Error('Valid status transition failed');

  // Test blocked transition
  // Create a dependency
  taskStore.addTask({
    title: 'Blocking Dependency',
    description: 'Must be done first',
    status: 'In Progress',
    deps: [],
    owner: 'tester'
  });
  const blocker = taskStore.tasks.find(t => t.title === 'Blocking Dependency')!;
  
  // Create a blocked task
  taskStore.addTask({
    title: 'Blocked Task',
    description: 'Waiting for blocker',
    status: 'Backlog',
    deps: [blocker.id],
    owner: 'tester'
  });
  const blocked = taskStore.tasks.find(t => t.title === 'Blocked Task')!;

  // Try to move blocked task to Done
  const res2 = taskStore.updateTaskStatus(blocked.id, 'Done');
  if (res2.success) throw new Error('DAG validation failed: Blocked task allowed to complete');
  console.log('[smoke] Kanban DAG validation passed');

  // 2. Agent Assignment
  const agentStore = useAgentStore.getState();
  const architect = agentStore.agents.find(a => a.role === 'Planner')!;
  
  agentStore.assignAgent(architect.id, newTask.id);
  const updatedArchitect = useAgentStore.getState().agents.find(a => a.id === architect.id)!;
  
  if (updatedArchitect.currentTaskId !== newTask.id || updatedArchitect.status !== 'Working') {
    throw new Error('Agent assignment failed');
  }
  console.log('[smoke] Agent assignment passed');

  console.log('[smoke] All Code Mode tests passed ✓');
}

// Auto-run if executed directly (mocking browser env for zustand persistence)
if (typeof window === 'undefined') {
    // Stub localstorage for node environment if needed, or rely on existing mocks
}
