/**
 * PermissionModal — gate for agent permission requests
 *
 * Shown when the agent wants to perform an action that requires user approval.
 * The user can allow once, allow for the session, or deny.
 */

import React, { memo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, LockSimple, Prohibit } from '@phosphor-icons/react';
import { usePermissionStore, usePendingPermissions, type PendingPermissionRequest } from '@/lib/agents/permission-store';

// Human-readable labels and descriptions for known permission types
const PERMISSION_LABELS: Record<string, string> = {
  bash: 'Run shell command',
  bash_tool: 'Run shell command',
  tool_use: 'Use a tool',
  read_file: 'Read file',
  write_file: 'Write or edit file',
  computer_use: 'Control the computer',
  web_search: 'Search the web',
  network: 'Make a network request',
  execute: 'Execute code',
};

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  bash: 'The agent wants to run a terminal command on your machine.',
  bash_tool: 'The agent wants to run a terminal command on your machine.',
  computer_use: 'The agent wants to control mouse, keyboard, or screen.',
  write_file: 'The agent wants to create or modify a file.',
  web_search: 'The agent wants to search the web for information.',
};

// ============================================================================
// Single permission request card
// ============================================================================

interface PermissionCardProps {
  request: PendingPermissionRequest;
}

const PermissionCard = memo(function PermissionCard({ request }: PermissionCardProps) {
  const replyPermission = usePermissionStore((s) => s.replyPermission);
  const [busy, setBusy] = useState(false);

  async function handle(reply: 'once' | 'always' | 'reject') {
    if (busy) return;
    setBusy(true);
    try {
      replyPermission(request.requestId, reply);
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

      {/* Permission details */}
      <div className="permission-card-body">
        <p className="permission-label">
          {PERMISSION_LABELS[request.permission] ?? `Allow: ${request.permission}`}
        </p>
        {PERMISSION_DESCRIPTIONS[request.permission] && (
          <p className="permission-sublabel">{PERMISSION_DESCRIPTIONS[request.permission]}</p>
        )}

        {/* Patterns */}
        {request.patterns.length > 0 && (
          <div className="permission-patterns">
            {request.patterns.map((p, i) => (
              <code key={`permissionmodal-${i}`} className="permission-pattern">{p}</code>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="permission-card-actions">
        <button type="button"
          className="permission-btn permission-btn-deny"
          onClick={() => handle('reject')}
          disabled={busy}
          title="Deny this action"
        >
          <Prohibit className="size-3.5 " />
          Deny
        </button>
        <button type="button"
          className="permission-btn permission-btn-once"
          onClick={() => handle('once')}
          disabled={busy}
          title="Allow this one time"
        >
          <CheckCircle className="size-3.5 " />
          Allow once
        </button>
        <button type="button"
          className="permission-btn permission-btn-always"
          onClick={() => handle('always')}
          disabled={busy}
          title="Always allow this permission"
        >
          <CheckCircle className="size-3.5 " weight="fill" />
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
  const requests = usePendingPermissions(sessionId);

  if (requests.length === 0) return null;

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
  background: var(--surface-floating, #1a1714);
  border: 1px solid rgba(200, 169, 110, 0.28);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(200,169,110,0.06);
}

.permission-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(200, 169, 110, 0.07);
  border-bottom: 1px solid rgba(200, 169, 110, 0.12);
}

.permission-card-icon {
  width: 14px;
  height: 14px;
  color: var(--accent-cowork, #c8a96e);
  flex-shrink: 0;
}

.permission-card-title {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent-cowork, #c8a96e);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  flex: 1;
}

.permission-card-body {
  padding: 14px 14px 10px;
}

.permission-label {
  font-size: 13px;
  font-weight: 500;
  color: rgba(236, 236, 236, 0.88);
  margin: 0 0 10px;
  line-height: 1.5;
}

.permission-sublabel {
  font-size: 11px;
  color: rgba(236, 236, 236, 0.38);
  margin: -6px 0 10px;
  line-height: 1.4;
}

.permission-patterns {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.permission-pattern {
  font-size: 11px;
  font-family: var(--font-mono, monospace);
  color: rgba(200, 169, 110, 0.65);
  background: rgba(200, 169, 110, 0.07);
  border: 1px solid rgba(200, 169, 110, 0.15);
  border-radius: 4px;
  padding: 2px 7px;
}

.permission-card-actions {
  display: flex;
  gap: 6px;
  padding: 10px 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  flex-wrap: wrap;
}

.permission-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  transition: background 0.13s, border-color 0.13s;
}

.permission-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.permission-btn-deny {
  color: var(--status-error);
  background: color-mix(in srgb, var(--status-error) 7%, transparent);
  border-color: color-mix(in srgb, var(--status-error) 22%, transparent);
}

.permission-btn-deny:hover:not(:disabled) {
  background: color-mix(in srgb, var(--status-error) 14%, transparent);
  border-color: color-mix(in srgb, var(--status-error) 35%, transparent);
}

.permission-btn-once {
  color: rgba(236, 236, 236, 0.72);
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.10);
  margin-left: auto;
}

.permission-btn-once:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.18);
}

.permission-btn-always {
  color: var(--status-success);
  background: color-mix(in srgb, var(--status-success) 7%, transparent);
  border-color: color-mix(in srgb, var(--status-success) 22%, transparent);
}

.permission-btn-always:hover:not(:disabled) {
  background: color-mix(in srgb, var(--status-success) 14%, transparent);
  border-color: color-mix(in srgb, var(--status-success) 38%, transparent);
}
`;
