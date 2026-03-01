import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TaskStatus = 'Backlog' | 'Ready' | 'In Progress' | 'Blocked' | 'Review' | 'Done';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  deps: string[];
  owner: string;
  updatedAt: number;
}

interface TaskState {
  tasks: Task[];
  activeTaskId: string | null;
  addTask: (task: Omit<Task, 'id' | 'updatedAt'>) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => { success: boolean; error?: string };
  deleteTask: (id: string) => void;
  setActiveTask: (id: string | null) => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [
        { id: 't0', title: 'Baseline & Wiring', description: 'Setup routes', status: 'Done', deps: [], owner: 'user', updatedAt: Date.now() },
        { id: 't1', title: 'ConsoleDrawer Overlay', description: 'Core mechanics', status: 'Done', deps: ['t0'], owner: 'user', updatedAt: Date.now() },
        { id: 't2', title: 'Drawer Tabs Framework', description: 'Discrete tabs', status: 'In Progress', deps: ['t1'], owner: 'user', updatedAt: Date.now() },
      ],
      activeTaskId: null,

      addTask: (data) => set((state) => ({
        tasks: [...state.tasks, { ...data, id: Math.random().toString(36).substring(7), updatedAt: Date.now() }]
      })),

      updateTaskStatus: (id, newStatus) => {
        const { tasks } = get();
        const task = tasks.find(t => t.id === id);
        
        if (newStatus === 'Done' && task) {
          const unfinishedDeps = tasks.filter(t => task.deps.includes(t.id) && t.status !== 'Done');
          if (unfinishedDeps.length > 0) {
            return { 
              success: false, 
              error: 'Blocked by unfinished dependencies: ' + unfinishedDeps.map(d => d.title).join(', ')
            };
          }
        }

        set((state) => ({
          tasks: state.tasks.map(t => t.id === id ? { ...t, status: newStatus, updatedAt: Date.now() } : t)
        }));
        return { success: true };
      },

      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.filter(t => t.id !== id)
      })),

      setActiveTask: (id) => set({ activeTaskId: id })
    }),
    { name: 'a2r-task-storage' }
  )
);
