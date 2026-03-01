import { UUID, ISODate, RiskTier } from './base';

export interface DiffLine {
  readonly id: string;
  type: 'context' | 'addition' | 'deletion';
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  isAccepted: boolean | null;
}

export interface DiffHunk {
  readonly id: string;
  fileChangeId: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  header?: string;
  isAccepted: boolean | null;
  acceptedCount: number;
  rejectedCount: number;
  pendingCount: number;
}

export interface FileChange {
  readonly id: UUID;
  readonly changeSetId: UUID;
  
  filePath: string;
  absolutePath: string;
  fileType: 'code' | 'config' | 'doc' | 'test' | 'other';
  changeType: 'add' | 'modify' | 'delete' | 'rename';
  oldFilePath?: string;
  
  oldContent?: string;
  newContent?: string;
  oldHash?: string;
  newHash?: string;
  
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  
  reviewState: 'pending' | 'accepted' | 'rejected' | 'partial';
  reviewedAt?: ISODate;
  reviewedBy?: string;
  
  riskTier: RiskTier;
  riskReason?: string;
  
  applyState: 'pending' | 'applying' | 'applied' | 'failed';
  applyError?: string;
  appliedAt?: ISODate;
}

export interface ChangeSet {
  readonly id: UUID;
  readonly projectId: UUID;
  readonly threadId: UUID;
  readonly messageId: UUID;
  
  changes: FileChange[];
  
  status: 'generating' | 'pending' | 'in_review' | 'partial' | 'approved' | 'rejected' | 'applying' | 'applied' | 'apply_failed' | 'stale';
  
  reviewProgress: {
    totalFiles: number;
    totalHunks: number;
    acceptedFiles: number;
    rejectedFiles: number;
    pendingFiles: number;
    acceptedHunks: number;
    rejectedHunks: number;
    pendingHunks: number;
  };
  
  userReview: {
    startedAt?: ISODate;
    completedAt?: ISODate;
    comment?: string;
    reviewedBy?: string;
  };
  
  riskAssessment: {
    overallRisk: RiskTier;
    maxFileRisk: RiskTier;
    destructiveChanges: boolean;
    securitySensitive: boolean;
    configChanges: boolean;
    testCoverage: 'full' | 'partial' | 'none' | 'unknown';
  };
  
  policy: {
    policyId: string;
    decision: 'auto_apply' | 'stage' | 'require_approval';
    autoApproved: boolean;
    autoApproveReason?: string;
    overriddenBy?: string;
    overriddenAt?: ISODate;
  };
  
  applyState: {
    startedAt?: ISODate;
    completedAt?: ISODate;
    appliedFiles: number;
    failedFiles: number;
    rollbackAvailable: boolean;
    rollbackSnapshotId?: string;
  };
  
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
  expiresAt?: ISODate;
  
  metadata: {
    generator: 'agent' | 'user' | 'tool' | 'import';
    toolCalls: UUID[];
    agentRunId?: UUID;
  };
}
