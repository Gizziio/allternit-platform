import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useTaskRealtime(workspaceId: string) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!workspaceId) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('allternit_api_token') : null;
    const url = token
      ? `/api/v1/tasks/stream?workspace_id=${workspaceId}&token=${encodeURIComponent(token)}`
      : `/api/v1/tasks/stream?workspace_id=${workspaceId}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Invalidate tasks query to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });

        // If it's a comment event, also invalidate comments
        if (data.event_type === 'commented') {
          queryClient.invalidateQueries({ queryKey: ['task-comments', data.task_id] });
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      // Auto-reconnect is built into EventSource
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [workspaceId, queryClient]);

  return {
    isConnected: !!eventSourceRef.current,
  };
}
