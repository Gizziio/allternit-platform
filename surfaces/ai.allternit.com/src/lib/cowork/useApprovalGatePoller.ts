'use client';

import { useEffect, useRef } from 'react';
import { usePermissionStore } from '@/lib/agents/permission-store';
import { useCoworkSessionStore } from '@/views/cowork/CoworkSessionStore';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';
import {
  detectRuntimeUnavailable,
  markRuntimeAvailable,
  markRuntimeUnavailable,
} from './useRuntimeAvailable';

interface GatePendingApproval {
  actionId: string;
  sessionId: string;
  riskLevel: string;
  summary: string;
  details: {
    actionType: string;
    target: string;
    consequence: string;
  };
  requestedAt: string;
}

const POLL_INTERVAL_MS = 5_000;

/**
 * A cowork session counts as "active" for polling purposes while it is
 * streaming, blocked on a gate (approval/question), or explicitly marked
 * active — idle/completed sessions don't need approval polls.
 */
function useHasActiveCoworkSession(): boolean {
  return useCoworkSessionStore((state) =>
    state.sessions.some(
      (s) =>
        state.streamingBySession[s.id]?.isStreaming === true ||
        s.isActive === true ||
        s.metadata?.executionStatus === 'pending' ||
        s.metadata?.executionStatus === 'running' ||
        s.metadata?.executionStatus === 'blocked',
    ),
  );
}

/**
 * Polls the ApprovalGate API and injects pending approvals into the permission store.
 * Mount this once in CoworkRoot when an active session is running.
 *
 * Polling only runs while at least one cowork session is active/in-progress —
 * an idle session list no longer burns a request every 5s.
 */
export function useApprovalGatePoller(active = true, surface: AgentModeSurface = 'cowork') {
  const seenIds = useRef(new Set<string>());
  // Number of consecutive 503 runtime_unavailable responses. One-off failures
  // stay silent; a persistent outage (2+) is surfaced once via the shared
  // runtime-availability store.
  const consecutiveUnavailableRef = useRef(0);
  const hasActiveSession = useHasActiveCoworkSession();
  const polling = active && hasActiveSession;

  useEffect(() => {
    if (!polling) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/v1/cowork/approvals');
        if (!res.ok) {
          const runtime = await detectRuntimeUnavailable(res);
          if (runtime.unavailable) {
            consecutiveUnavailableRef.current += 1;
            if (consecutiveUnavailableRef.current >= 2) {
              markRuntimeUnavailable(runtime.reason);
            }
          }
          return;
        }
        consecutiveUnavailableRef.current = 0;
        markRuntimeAvailable();
        // The allternit-api handler returns { approvals: [...] }; a newer
        // alias emits { pending: [...] }. Accept either, preferring pending.
        const data = (await res.json()) as {
          pending?: GatePendingApproval[];
          approvals?: GatePendingApproval[];
        };
        const pending = data.pending ?? data.approvals ?? [];

        // Prune seen ids that are no longer pending so the set can't grow
        // unbounded and vanished approvals can be re-injected if they return.
        const returnedIds = new Set(pending.map((a) => a.actionId));
        for (const id of Array.from(seenIds.current)) {
          if (!returnedIds.has(id)) seenIds.current.delete(id);
        }

        for (const approval of pending) {
          if (seenIds.current.has(approval.actionId)) continue;
          seenIds.current.add(approval.actionId);

          usePermissionStore.getState().addPermissionRequest({
            requestId: approval.actionId,
            sessionId: approval.sessionId,
            surface,
            permission: approval.details.actionType,
            patterns: [approval.details.target ?? ''],
            metadata: {
              riskLevel: approval.riskLevel,
              summary: approval.summary,
              consequence: approval.details.consequence,
              source: 'approval-gate',
            },
            always: [],
          });
        }
      } catch {
        // non-fatal
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [polling, surface]);
}
