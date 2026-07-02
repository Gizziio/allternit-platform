import { UUID, ISODate, RiskTier } from './base';
import { FileChange } from './changeset';

type ApprovalCondition =
  | { type: 'risk-tier'; tier: RiskTier; operator: 'eq' | 'gte' }
  | { type: 'file-pattern'; pattern: string; negate?: boolean }
  | { type: 'change-type'; changeType: FileChange['changeType']; negate?: boolean }
  | { type: 'file-type'; fileType: FileChange['fileType']; negate?: boolean }
  | { type: 'tool-name'; toolName: string; negate?: boolean }
  | { type: 'command-pattern'; pattern: string; negate?: boolean }
  | { type: 'has-tests'; value: boolean }
  | { type: 'file-size'; maxBytes: number }
  | { type: 'line-count'; maxLines: number };

interface ApprovalRule {
  readonly id: UUID;
  name: string;
  description?: string;
  priority: number;
  conditions: ApprovalCondition[];
  action: 'auto_apply' | 'stage' | 'require_approval';
  requireConfirmation?: boolean;
  confirmationMessage?: string;
  notifyOnApply?: boolean;
  notifyChannels: ('ui' | 'notification' | 'sound')[];
}

interface ApprovalPolicy {
  readonly id: UUID;
  name: string;
  description?: string;
  projectId: UUID | null; // null = global
  isDefault: boolean;
  rules: ApprovalRule[];
  defaultAction: 'auto_apply' | 'stage' | 'require_approval';
  settings: {
    allowOverride: boolean;
    requireReasonForOverride: boolean;
    maxAutoApplySize: number;
    batchApplyEnabled: boolean;
    reviewTimeout: number;
  };
  isActive: boolean;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  createdBy: string;
}
