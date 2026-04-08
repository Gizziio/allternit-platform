import React from 'react';
import { useChangeSetStore } from '../../stores/changeset-store';
import { FileChangeCard } from './FileChangeCard';
import { GitDiff, CheckCircle, XCircle, Rocket } from '@phosphor-icons/react';

interface ChangeSetReviewProps {
  changeSetId: string;
}

export function ChangeSetReview({ changeSetId }: ChangeSetReviewProps) {
  const changeSet = useChangeSetStore(s => s.changeSets[changeSetId]);
  
  if (!changeSet) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-tertiary)' }}>
        ChangeSet {changeSetId} not found.
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GitDiff size={20} color="var(--accent-chat)" />
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Review Changes</div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>{changeSet.changes.length} files modified</div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{ 
            padding: '6px 12px', 
            borderRadius: 6, 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-subtle)',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer'
          }}>
            Reject All
          </button>
          <button style={{ 
            padding: '6px 12px', 
            borderRadius: 6, 
            background: 'var(--accent-chat)', 
            color: 'white',
            border: 'none',
            fontSize: 12,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer'
          }}>
            <Rocket size={14} weight="fill" /> Apply ChangeSet
          </button>
        </div>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {changeSet.changes.map(change => (
          <FileChangeCard 
            key={change.id} 
            change={change} 
            changeSetId={changeSetId}
          />
        ))}
      </div>
    </div>
  );
}
