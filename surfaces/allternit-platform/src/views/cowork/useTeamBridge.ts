/**
 * Team Bridge Hook
 *
 * Bidirectional sync between solo cowork tasks and team board items.
 * When a task is created with a workspaceId, it syncs to the team board.
 * When a board item is updated, it syncs back to the task.
 *
 * Cycle-breaking strategy:
 * - A ref tracks keys we've already reacted to per direction
 * - Keys include the state that triggered the sync, so a genuine state change
 *   will have a new key and be processed
 * - createItem calls are tracked in-flight to prevent duplicates
 */

import { useEffect, useRef } from 'react';
import { useTaskStore, type Task } from './useTaskStore';
import { useBoardStore, type BoardItem } from '@/stores/board.store';

export function useTeamBridge(workspaceId: string | undefined) {
  const tasks = useTaskStore((s) => s.tasks);
  const updateTaskStatus = useTaskStore((s) => s.updateTaskStatus);
  const assignTask = useTaskStore((s) => s.assignTask);

  const boardItems = useBoardStore((s) => s.items);
  const createItem = useBoardStore((s) => s.createItem);
  const updateItem = useBoardStore((s) => s.updateItem);

  // Refs to track processed state keys and in-flight creates across renders
  const boardProcessedRef = useRef(new Set<string>());
  const taskProcessedRef = useRef(new Set<string>());
  const creatingRef = useRef(new Set<string>());

  // Forward: Board item changes → Task updates
  useEffect(() => {
    if (!workspaceId) return;

    const workspaceItems = boardItems.filter((item) => item.workspaceId === workspaceId);

    for (const item of workspaceItems) {
      const key = `board-${item.id}-${item.status}-${item.assigneeId || 'none'}-${item.updatedAt || ''}`;
      if (boardProcessedRef.current.has(key)) continue;
      boardProcessedRef.current.add(key);

      // Prune old keys to prevent unbounded growth
      if (boardProcessedRef.current.size > 500) {
        const toDelete = Array.from(boardProcessedRef.current).slice(0, 250);
        toDelete.forEach((k) => boardProcessedRef.current.delete(k));
      }

      const matchingTask = tasks.find(
        (t) => t.workspaceId === workspaceId && t.title === item.title
      );

      if (matchingTask) {
        // Sync status from board to task
        const statusMap: Record<string, Task['status']> = {
          backlog: 'pending',
          todo: 'pending',
          in_progress: 'in_progress',
          in_review: 'in_progress',
          done: 'completed',
          blocked: 'pending',
        };
        const newStatus = statusMap[item.status];
        if (newStatus && matchingTask.status !== newStatus) {
          updateTaskStatus(matchingTask.id, newStatus);
        }

        // Sync assignee from board to task
        if (item.assigneeType && item.assigneeId && !matchingTask.assigneeId) {
          assignTask(matchingTask.id, item.assigneeType, item.assigneeId, item.assigneeName || '');
        }
      }
    }
  }, [boardItems, workspaceId, tasks, updateTaskStatus, assignTask]);

  // Reverse: Task changes with workspaceId → Board item sync
  useEffect(() => {
    if (!workspaceId) return;

    const workspaceTasks = tasks.filter((t) => t.workspaceId === workspaceId);

    for (const task of workspaceTasks) {
      const key = `task-${task.id}-${task.status}-${task.assigneeId || 'none'}-${task.updatedAt || ''}`;
      if (taskProcessedRef.current.has(key)) continue;
      taskProcessedRef.current.add(key);

      // Prune old keys to prevent unbounded growth
      if (taskProcessedRef.current.size > 500) {
        const toDelete = Array.from(taskProcessedRef.current).slice(0, 250);
        toDelete.forEach((k) => taskProcessedRef.current.delete(k));
      }

      const existingItem = boardItems.find(
        (item) => item.workspaceId === workspaceId && item.title === task.title
      );

      if (!existingItem) {
        // Prevent duplicate createItem calls for the same task
        if (creatingRef.current.has(task.id)) continue;
        creatingRef.current.add(task.id);

        createItem(workspaceId, {
          title: task.title,
          status: mapTaskStatusToBoardStatus(task.status),
          assigneeType: task.assigneeType,
          priority: task.priority ?? 50,
        }).finally(() => {
          creatingRef.current.delete(task.id);
        });
      } else {
        // Sync task status back to board
        const boardStatus = mapTaskStatusToBoardStatus(task.status);
        if (existingItem.status !== boardStatus) {
          updateItem(existingItem.id, { status: boardStatus });
        }
      }
    }
  }, [tasks, workspaceId, boardItems, createItem, updateItem]);
}

function mapTaskStatusToBoardStatus(status: Task['status']): BoardItem['status'] {
  switch (status) {
    case 'pending': return 'todo';
    case 'in_progress': return 'in_progress';
    case 'completed': return 'done';
    case 'archived': return 'done';
    default: return 'backlog';
  }
}
