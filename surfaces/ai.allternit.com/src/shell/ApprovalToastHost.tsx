/**
 * Approval card host (consumer-packaged Cowork P2.4).
 *
 * Listens for `allternit:approval-requested` events (dispatched by the chat
 * session store when the A:// narration stream reports a pending approval)
 * and renders an actionable card: grant or deny against the fabric
 * approvals endpoints, with the decided-by user recorded server-side. The
 * card lives in the app chrome so it works across chat surfaces without
 * rewiring the message renderer.
 */

import { useEffect, useState } from 'react';
import { buildAuthHeaders } from '@/lib/agents/api-config';

const apiV1Base = () => {
  const origin = (window as unknown as { location?: Location }).location?.origin ?? '';
  return `${origin}/api/v1`;
};

interface ApprovalRequest {
  approvalId: string;
  runId: string;
  capability?: string;
  target?: string;
  status: string;
  decidedBy?: string;
}

interface ApprovalState extends ApprovalRequest {
  deciding?: boolean;
  outcome?: string;
  error?: string;
}

async function decide(approval: ApprovalState, grant: boolean): Promise<void> {
  const res = await fetch(
    `${apiV1Base()}/fabric/transport/approvals/${encodeURIComponent(approval.approvalId)}/${grant ? 'grant' : 'deny'}`,
    { method: 'POST', headers: { ...(await buildAuthHeaders()) } },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
}

export function ApprovalToastHost() {
  const [approvals, setApprovals] = useState<ApprovalState[]>([]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ApprovalRequest>).detail;
      if (!detail?.approvalId) return;
      setApprovals((current) => {
        if (current.some((a) => a.approvalId === detail.approvalId && !a.outcome)) return current;
        return [...current, detail];
      });
    };
    window.addEventListener('allternit:approval-requested', handler);
    return () => window.removeEventListener('allternit:approval-requested', handler);
  }, []);

  if (approvals.length === 0) return null;

  const act = (approval: ApprovalState, grant: boolean) => {
    setApprovals((current) =>
      current.map((a) => (a.approvalId === approval.approvalId ? { ...a, deciding: true } : a)),
    );
    decide(approval, grant)
      .then(() => {
        setApprovals((current) =>
          current.map((a) =>
            a.approvalId === approval.approvalId
              ? { ...a, deciding: false, status: grant ? 'granted' : 'denied', outcome: grant ? 'Granted' : 'Denied' }
              : a,
          ),
        );
      })
      .catch((error) => {
        setApprovals((current) =>
          current.map((a) =>
            a.approvalId === approval.approvalId ? { ...a, deciding: false, error: (error as Error).message } : a,
          ),
        );
      });
  };

  return (
    <div style={{ position: 'fixed', bottom: 12, right: 12, zIndex: 190, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {approvals.map((approval) => (
        <div
          key={approval.approvalId}
          style={{
            minWidth: 260,
            maxWidth: 340,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--ui-bg-elevated, rgba(20,20,22,0.92))',
            border: '1px solid var(--ui-border, rgba(255,255,255,0.14))',
            color: 'var(--ui-text, #e5e5e5)',
            fontSize: 12,
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Approval requested</div>
          <div style={{ opacity: 0.85, marginBottom: 6 }}>
            <div>Capability: {approval.capability ?? 'protected action'}</div>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Target: {approval.target ?? approval.runId}
            </div>
            {approval.decidedBy ? <div>Decided by: {approval.decidedBy}</div> : null}
          </div>
          {approval.outcome || approval.error ? (
            <div style={{ color: approval.error ? 'var(--status-danger, #ef4444)' : 'var(--status-success, #22c55e)' }}>
              {approval.error ?? approval.outcome}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={approval.deciding}
                onClick={() => act(approval, true)}
                style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'var(--status-success, #22c55e)', color: '#0b0b0c', fontWeight: 600,
                  opacity: approval.deciding ? 0.6 : 1,
                }}
              >
                Grant
              </button>
              <button
                type="button"
                disabled={approval.deciding}
                onClick={() => act(approval, false)}
                style={{
                  flex: 1, padding: '5px 0', borderRadius: 6, border: '1px solid var(--ui-border, rgba(255,255,255,0.2))',
                  cursor: 'pointer', background: 'transparent', color: 'var(--ui-text, #e5e5e5)',
                  opacity: approval.deciding ? 0.6 : 1,
                }}
              >
                Deny
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ApprovalToastHost;
