import React, { useMemo, useEffect } from 'react';
import { ChangeSetReview } from '../../components/changeset-review/ChangeSetReview';
import { useChangeSetStore } from '../../stores/changeset-store';
import { ChangeSet, FileChange, DiffHunk } from '../../core/contracts';

// Legacy mapping function
function convertToChangeSet(legacyDiffs: any[]): ChangeSet {
  const id = 'cs-legacy-patchgate';
  const now = new Date().toISOString();
  
  return {
    id,
    projectId: 'p1',
    threadId: 't1',
    messageId: 'm1',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    changes: legacyDiffs.map((d, i) => ({
      id: d.id,
      changeSetId: id,
      filePath: d.file,
      absolutePath: d.file,
      fileType: 'code',
      changeType: 'modify',
      additions: d.hunks.reduce((acc: number, h: any) => acc + (h.content.match(/^\+/gm) || []).length, 0),
      deletions: d.hunks.reduce((acc: number, h: any) => acc + (h.content.match(/^-/gm) || []).length, 0),
      reviewState: 'pending',
      applyState: 'pending',
      riskTier: 'low',
      hunks: d.hunks.map((h: any, j: number) => ({
        id: h.id,
        fileChangeId: d.id,
        oldStart: 0,
        oldLines: 0,
        newStart: 0,
        newLines: 0,
        header: '',
        isAccepted: null,
        acceptedCount: 0,
        rejectedCount: 0,
        pendingCount: 1,
        lines: h.content.split('\n').map((l: string, k: number) => ({
          id: `line-${j}-${k}`,
          type: l.startsWith('+') ? 'addition' : l.startsWith('-') ? 'deletion' : 'context',
          content: l.substring(1),
          oldLineNumber: k,
          newLineNumber: k,
          isAccepted: null
        }))
      }))
    })),
    reviewProgress: {
      totalFiles: legacyDiffs.length,
      totalHunks: legacyDiffs.reduce((acc, d) => acc + d.hunks.length, 0),
      acceptedFiles: 0,
      rejectedFiles: 0,
      pendingFiles: legacyDiffs.length,
      acceptedHunks: 0,
      rejectedHunks: 0,
      pendingHunks: legacyDiffs.reduce((acc, d) => acc + d.hunks.length, 0),
    },
    riskAssessment: {
      overallRisk: 'low',
      maxFileRisk: 'low',
      destructiveChanges: false,
      securitySensitive: false,
      configChanges: false,
      testCoverage: 'unknown'
    },
    policy: { policyId: 'default', decision: 'stage', autoApproved: false },
    applyState: { appliedFiles: 0, failedFiles: 0, rollbackAvailable: false },
    metadata: { generator: 'agent', toolCalls: [] }
  };
}

const MOCK_DIFFS = [
  {
    id: 'd1',
    file: 'src/views/code/CodeCanvas.tsx',
    status: 'modified',
    hunks: [
      { id: 'h1', content: '- <Rocket size={32} />\n+ <Rocket size={32} weight="duotone" />', status: 'pending' },
      { id: 'h2', content: '- color="blue"\n+ color="var(--accent-chat)"', status: 'pending' }
    ]
  },
  {
    id: 'd2',
    file: 'src/shell/ShellRail.tsx',
    status: 'modified',
    hunks: [
      { id: 'h3', content: '+ import { Code } from "@phosphor-icons/react";', status: 'pending' }
    ]
  }
];

export function PatchGate() {
  const { addChangeSet } = useChangeSetStore();
  const changeSet = useMemo(() => convertToChangeSet(MOCK_DIFFS), []);

  useEffect(() => {
    addChangeSet(changeSet);
  }, [addChangeSet, changeSet]);

  return <ChangeSetReview changeSetId={changeSet.id} />;
}
