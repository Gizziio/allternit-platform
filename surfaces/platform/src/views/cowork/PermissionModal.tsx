/**
 * PermissionModal — gate for gizzi-code permission requests
 *
 * Shown when the agent wants to perform an action that requires user approval.
 * The user can allow once, allow for the session, or deny.
 */

import React, { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, LockSimple, Prohibit, X } from '@phosphor-icons/react';
import { useNativeAgentStore, type PendingPermissionRequest } from '@/lib/agents/native-agent.store';

// ============================================================================
// Single permission request card
// ============================================================================

interface PermissionCardProps {
  request: PendingPermissionRequest;
}

const PermissionCard = memo(function PermissionCard({ request }: PermissionCardProps) {
  const replyPermission = useNativeAgentStore((s) => s.replyPermission);
  const [busy, setBusy] = useState(false);

  async function handle(reply: 'once' | 'always' | 'reject') {
    if (busy) return;
    setBusy(true);
    try {
      await replyPermission(request.requestId, reply);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="permission-card"
    >
      {/* Header */}
      <div className="permission-card-header">
        <LockSimple className="permission-card-icon" weight="bold" />
        <span className="permission-card-title">Permission Required</span>
      </div>

      {/* Permission name */}
      <div className="permission-card-body">
        <p className="permission-label">{request.permission}</p>

        {/* Patterns */}
        {request.patterns.length > 0 && (
          <div className="permission-patterns">
            {request.patterns.map((p, i) => (
              <code key={i} className="permission-pattern">{p}</code>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="permission-card-actions">
        <button
          className="permission-btn permission-btn-deny"
          onClick={() => handle('reject')}
          disabled={busy}
          title="Deny this action"
        >
          <Prohibit className="w-3.5 h-3.5" />
          Deny
        </button>
        <button
          className="permission-btn permission-btn-once"
          onClick={() => handle('once')}
          disabled={busy}
          title="Allow this one time"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Allow once
        </button>
        <button
          className="permission-btn permission-btn-always"
          onClick={() => handle('always')}
          disabled={busy}
          title="Always allow this permission"
        >
          <CheckCircle className="w-3.5 h-3.5" weight="fill" />
          Always allow
        </button>
      </div>
    </motion.div>
  );
});

// ============================================================================
// PermissionModal — renders all pending permission requests for a session
// ============================================================================

interface PermissionModalProps {
  sessionId: string;
}

export const PermissionModal = memo(function PermissionModal({ sessionId }: PermissionModalProps) {
  const pendingPermissions = useNativeAgentStore((s) => s.pendingPermissions);

  const requests = Object.values(pendingPermissions).filter(
    (r) => r.sessionId === sessionId,
  );

  return (
    <>
      <style>{styles}</style>
      <AnimatePresence mode="popLayout">
        {requests.map((req) => (
          <PermissionCard key={req.requestId} request={req} />
        ))}
      </AnimatePresence>
    </>
  );
});

// ============================================================================
// Styles
// ============================================================================

const styles = `
.permission-card {
  background: #1e1e1e;
  border: 1px solid rgba(212, 149, 106, 0.3);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.permission-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(212, 149, 106, 0.08);
  border-bottom: 1px solid rgba(212, 149, 106, 0.15);
}

.permission-card-icon {
  width: 14px;
  height: 14px;
  color: #d4956a;
  flex-shrink: 0;
}

.permission-card-title {
  font-size: 11px;
  font-weight: 600;
  color: #d4956a;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.permission-card-body {
  padding: 12px 14px;
}

.permission-label {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.85);
  margin: 0 0 8px;
  line-height: 1.4;
}

.permission-patterns {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.permission-pattern {
  font-size: 11px;
  font-family: 'Geist Mono', monospace;
  color: rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 2px 6px;
}

.permission-card-actions {
  display: flex;
  gap: 6px;
  padding: 10px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.permission-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid;
  transition: opacity 0.15s;
}

.permission-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.permission-btn-deny {
  color: #f87171;
  background: rgba(248, 113, 113, 0.08);
  border-color: rgba(248, 113, 113, 0.2);
}

.permission-btn-deny:hover:not(:disabled) {
  background: rgba(248, 113, 113, 0.15);
}

.permission-btn-once {
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.12);
  margin-left: auto;
}

.permission-btn-once:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}

.permission-btn-always {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.08);
  border-color: rgba(74, 222, 128, 0.2);
}

.permission-btn-always:hover:not(:disabled) {
  background: rgba(74, 222, 128, 0.15);
}
`;
