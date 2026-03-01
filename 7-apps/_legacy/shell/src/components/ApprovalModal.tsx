import * as React from 'react';
import type { ActionSpec } from '../../../types/capsule-spec';

interface ApprovalModalProps {
  action: ActionSpec;
  capsuleTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const getRiskCopy = (tier: string): string => {
  switch (tier) {
    case 'read':
      return 'This action will read data without modifying state.';
    case 'write':
      return 'This action will modify system state.';
    case 'exec':
      return 'This action will execute a command or workflow.';
    case 'danger':
      return 'This action carries elevated risk and may be irreversible.';
    default:
      return 'Review the details before approving this action.';
  }
};

export const ApprovalModal: React.FC<ApprovalModalProps> = ({
  action,
  capsuleTitle,
  onConfirm,
  onCancel,
}) => {
  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const safetyTier = action.safetyTier || 'read';
  const schema =
    action.inputSchema && Object.keys(action.inputSchema).length > 0
      ? JSON.stringify(action.inputSchema, null, 2)
      : null;

  return (
    <div className="approval-overlay" onClick={onCancel} role="presentation">
      <div
        className="approval-card"
        role="dialog"
        aria-modal="true"
        aria-label="Approval required"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="approval-header">
          <div>
            <span className="approval-badge">Safety Contract</span>
            <h3 className="approval-title">Approval required</h3>
          </div>
          <span className={`approval-tier approval-tier-${safetyTier}`}>
            {safetyTier}
          </span>
        </div>
        <div className="approval-body">
          <div className="approval-row">
            <span className="approval-label">Action</span>
            <span className="approval-value">{action.label}</span>
          </div>
          <div className="approval-row">
            <span className="approval-label">Capsule</span>
            <span className="approval-value">{capsuleTitle}</span>
          </div>
          {action.toolRef && (
            <div className="approval-row">
              <span className="approval-label">Tool</span>
              <span className="approval-value">{action.toolRef}</span>
            </div>
          )}
          <div className="approval-risk">{getRiskCopy(safetyTier)}</div>
          {schema && <pre className="approval-schema">{schema}</pre>}
        </div>
        <div className="approval-footer">
          <button className="approval-btn approval-btn-secondary" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="approval-btn approval-btn-danger" onClick={onConfirm} type="button">
            Approve and run
          </button>
        </div>
      </div>
    </div>
  );
};
