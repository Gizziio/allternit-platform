import React from 'react';
import { ChangeSetReview } from '../../components/changeset-review/ChangeSetReview';
import { useChangeSetStore } from '../../stores/changeset-store';

export function PatchGate() {
  const activeChangeSetId = useChangeSetStore((state) => state.activeChangeSetId);

  if (!activeChangeSetId) {
    return (
      <div style={{ padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
        No pending changes
      </div>
    );
  }

  return <ChangeSetReview changeSetId={activeChangeSetId} />;
}
