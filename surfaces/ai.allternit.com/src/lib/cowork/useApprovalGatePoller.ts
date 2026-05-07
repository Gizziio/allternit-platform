'use client';

import { useEffect, useRef } from 'react';
import { usePermissionStore } from '@/lib/agents/permission-store';

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
 * Polls the ApprovalGate API and injects pending approvals into the permission store.
 * Mount this once in CoworkRoot when an active session is running.
 */
export function useApprovalGatePoller(active = true) {
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    if (!active) return;

    const poll = async () => {
      try {
        const res = await fetch('/api/v1/cowork/approvals');
        if (!res.ok) return;
        const data = (await res.json()) as { pending?: GatePendingApproval[] };
        const pending = data.pending ?? [];

        for (const approval of pending) {
          if (seenIds.current.has(approval.actionId)) continue;
          seenIds.current.add(approval.actionId);

          usePermissionStore.getState().addPermissionRequest({
            requestId: approval.actionId,
            sessionId: approval.sessionId,
            surface: 'cowork',
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
  }, [active]);
}
