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

/** Raw cowork_approvals row shape returned by /api/v1/cowork/approvals. */
interface ApprovalRowShape {
  id?: string;
  content?: string;
  source?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Map a /api/v1/cowork/approvals row to the gate shape the permission store
 * expects. The allternit-api returns raw cowork_approvals rows whose payload
 * lives in the `content` JSON column — rows written by the agent-chat bridge
 * (source 'gizzi-permission') carry the same actionId/sessionId/riskLevel/
 * summary/details keys as approval-gate rows. An already-projected row (no
 * `content` string) is accepted as-is, and a row whose content is missing or
 * malformed is skipped — a broken row must never wedge the poller.
 */
export function parseGateApprovalRow(row: unknown): GatePendingApproval | null {
  if (!isRecord(row)) return null;
  let candidate: unknown = row;
  if (typeof row.content === 'string') {
    try {
      candidate = JSON.parse(row.content);
    } catch {
      return null;
    }
  }
  if (!isRecord(candidate) || typeof candidate.actionId !== 'string' || !candidate.actionId) {
    return null;
  }
  const details = isRecord(candidate.details) ? candidate.details : {};
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    actionId: candidate.actionId,
    sessionId: str(candidate.sessionId),
    riskLevel: str(candidate.riskLevel) || 'medium',
    summary: str(candidate.summary),
    details: {
      actionType: str(details.actionType),
      target: str(details.target),
      consequence: str(details.consequence),
    },
    requestedAt: str(candidate.requestedAt),
  };
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
        // Rows are raw cowork_approvals records — the gate payload is parsed
        // out of each row's content JSON (see parseGateApprovalRow).
        const data = (await res.json()) as {
          pending?: unknown[];
          approvals?: unknown[];
        };
        const rows = data.pending ?? data.approvals ?? [];
        const pending = rows
          .map((row) => ({ row, approval: parseGateApprovalRow(row) }))
          .filter(
            (entry): entry is { row: unknown; approval: GatePendingApproval } =>
              entry.approval !== null,
          );

        // Prune seen ids that are no longer pending so the set can't grow
        // unbounded and vanished approvals can be re-injected if they return.
        const returnedIds = new Set(pending.map((p) => p.approval.actionId));
        for (const id of Array.from(seenIds.current)) {
          if (!returnedIds.has(id)) seenIds.current.delete(id);
        }

        for (const { row, approval } of pending) {
          if (seenIds.current.has(approval.actionId)) continue;
          seenIds.current.add(approval.actionId);

          // Rows written by the agent-chat bridge answer a live gizzi
          // permission ask; everything else is an approval-gate row.
          const rowSource =
            isRecord(row) && typeof (row as ApprovalRowShape).source === 'string'
              ? (row as ApprovalRowShape).source
              : undefined;

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
              source: rowSource === 'gizzi-permission' ? 'gizzi-permission' : 'approval-gate',
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
