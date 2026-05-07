import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface Task {
  id: string;
  workspace_id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in-progress' | 'in-review' | 'done';
  priority: number;
  estimatedMinutes?: number;
  deadline?: string;
  assigneeType?: 'human' | 'agent';
  assigneeId?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  dependencies: string[];
  optimizeRank?: number;
  risk?: 'low' | 'medium' | 'high';
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskRequest {
  title: string;
  workspace_id: string;
  description?: string;
  status?: string;
  priority?: number;
  estimatedMinutes?: number;
  deadline?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: string;
  priority?: number;
  estimatedMinutes?: number;
  deadline?: string;
  assigneeType?: 'human' | 'agent';
  assigneeId?: string;
  assigneeName?: string;
}

export interface Comment {
  id: string;
  taskId: string;
  author: string;
  authorAvatar?: string;
  body: string;
  createdAt: string;
}

export function useTasksAPI(workspaceId: string) {
  const queryClient = useQueryClient();
  const queryKey = ['tasks', workspaceId];

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/v1/tasks?workspace_id=${workspaceId}&limit=100`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      return (Array.isArray(data) ? data : data.tasks ?? []) as Task[];
    },
    enabled: !!workspaceId,
  });

  const createTask = useMutation({
    mutationFn: async (req: CreateTaskRequest) => {
      const res = await fetch('/api/v1/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error('Failed to create task');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...req }: UpdateTaskRequest & { id: string }) => {
      const res = await fetch(`/api/v1/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/tasks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const assignTask = useMutation({
    mutationFn: async ({ id, assigneeType, assigneeId, assigneeName }: { id: string; assigneeType?: string; assigneeId?: string; assigneeName?: string }) => {
      const res = await fetch(`/api/v1/tasks/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeType, assigneeId, assigneeName }),
      });
      if (!res.ok) throw new Error('Failed to assign task');
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const addComment = useMutation({
    mutationFn: async ({ taskId, author, body }: { taskId: string; author: string; body: string }) => {
      const res = await fetch(`/api/v1/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, body }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: (_, vars) => queryClient.invalidateQueries({ queryKey: ['task-comments', vars.taskId] }),
  });

  const listComments = async (taskId: string) => {
    return queryClient.fetchQuery<Comment[]>({
      queryKey: ['task-comments', taskId],
      queryFn: async () => {
        const res = await fetch(`/api/v1/tasks/${taskId}/comments`);
        if (!res.ok) throw new Error('Failed to fetch comments');
        const data = await res.json();
        return data.comments as Comment[];
      },
    });
  };

  return {
    tasks,
    isLoading,
    error,
    createTask: createTask.mutateAsync,
    updateTask: updateTask.mutateAsync,
    deleteTask: deleteTask.mutateAsync,
    assignTask: assignTask.mutateAsync,
    addComment: addComment.mutateAsync,
    listComments,
  };
}
