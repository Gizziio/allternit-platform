/**
 * Keeps the code canvas in sync with orchestrator executor sessions:
 * managed sessions (assigned via the platform) and discovered external ao-*
 * tmux sessions. New running sessions for this workspace appear as executor
 * tiles; state transitions stream in over SSE with a slow polling safety net.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CANVAS_TILE_DEFAULT_SIZE,
  useCodeModeStore,
} from '@/views/code/CodeModeStore';
import {
  listExecutorSessions,
  listDiscoveredExecutors,
  subscribeOrchestratorEvents,
  type ExecutorSession,
} from '@/views/code/orchestrator.service';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useOrchestratorCanvasSync');

let spawnCascade = 0;

export function useOrchestratorCanvasSync(
  workspaceId: string | undefined,
  workspacePath: string | undefined,
): Map<string, ExecutorSession> {
  const [executors, setExecutors] = useState<Map<string, ExecutorSession>>(new Map());
  const addCanvasTile = useCodeModeStore((s) => s.addCanvasTile);

  const reconcile = useCallback(async () => {
    if (!workspaceId || !workspacePath) return;

    const [managed, discovered] = await Promise.all([
      listExecutorSessions().catch((err: unknown) => {
        logger.warn({ err }, 'Failed to list executor sessions');
        return [] as ExecutorSession[];
      }),
      listDiscoveredExecutors().catch(() => [] as ExecutorSession[]),
    ]);

    const sessions = [...managed, ...discovered];
    setExecutors(new Map(sessions.map((s) => [s.slug, s])));

    const workspace = useCodeModeStore
      .getState()
      .workspaces.find((w) => w.workspace_id === workspaceId);
    const tiles = workspace?.canvasTiles ?? [];

    for (const session of sessions) {
      if (session.workdir !== workspacePath) continue;
      if (session.state !== 'spawning' && session.state !== 'running') continue;
      const exists = tiles.some((t) => t.type === 'executor' && t.executorSlug === session.slug);
      if (exists) continue;
      const offset = (spawnCascade++ % 5) * 32;
      addCanvasTile(workspaceId, {
        type: 'executor',
        executorSlug: session.slug,
        x: 96 + offset,
        y: 96 + offset,
        width: CANVAS_TILE_DEFAULT_SIZE.executor.width,
        height: CANVAS_TILE_DEFAULT_SIZE.executor.height,
        zIndex: Date.now(),
        label: `${session.vendor} · ${session.slug}`,
      });
    }
  }, [workspaceId, workspacePath, addCanvasTile]);

  useEffect(() => {
    void reconcile();
    const unsubscribe = subscribeOrchestratorEvents(() => {
      void reconcile();
    });
    // Discovery of external tmux sessions emits no SSE events — poll as a
    // safety net so adopted ao-* sessions appear without a refresh.
    const interval = window.setInterval(() => void reconcile(), 15000);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
    };
  }, [reconcile]);

  return executors;
}
