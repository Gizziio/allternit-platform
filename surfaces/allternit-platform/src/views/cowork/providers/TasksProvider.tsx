import React, { createContext, useContext, ReactNode } from 'react';
import { useTasksAPI, Task, CreateTaskRequest, UpdateTaskRequest, Comment } from '../hooks/useTasksAPI';
import { useTaskRealtime } from '../hooks/useTaskRealtime';

interface TasksContextValue {
  tasks: Task[];
  isLoading: boolean;
  error: Error | null;
  createTask: (req: CreateTaskRequest) => Promise<unknown>;
  updateTask: (req: UpdateTaskRequest & { id: string }) => Promise<unknown>;
  deleteTask: (id: string) => Promise<void>;
  assignTask: (req: { id: string; assigneeType?: string; assigneeId?: string; assigneeName?: string }) => Promise<unknown>;
  addComment: (req: { taskId: string; author: string; body: string }) => Promise<unknown>;
  listComments: (taskId: string) => Promise<Comment[]>;
  isConnected: boolean;
}

const TasksContext = createContext<TasksContextValue | undefined>(undefined);

interface TasksProviderProps {
  workspaceId: string;
  children: ReactNode;
}

export function TasksProvider({ workspaceId, children }: TasksProviderProps) {
  const api = useTasksAPI(workspaceId);
  const realtime = useTaskRealtime(workspaceId);

  const value: TasksContextValue = {
    tasks: api.tasks,
    isLoading: api.isLoading,
    error: api.error,
    createTask: api.createTask,
    updateTask: api.updateTask,
    deleteTask: api.deleteTask,
    assignTask: api.assignTask,
    addComment: api.addComment,
    listComments: api.listComments,
    isConnected: realtime.isConnected,
  };

  return (
    <TasksContext.Provider value={value}>
      {children}
    </TasksContext.Provider>
  );
}

export function useTasksContext() {
  const context = useContext(TasksContext);
  if (!context) {
    throw new Error('useTasksContext must be used within a TasksProvider');
  }
  return context;
}
