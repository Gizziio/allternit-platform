import React from 'react';
import { FileChange, DiffHunk } from '../../core/contracts';
import { useChangeSetStore } from '../../stores/changeset-store';
import { GlassCard } from '../../design/GlassCard';
import { FileCode, Check, X, CaretDown, CaretRight } from '@phosphor-icons/react';

interface FileChangeCardProps {
  change: FileChange;
  changeSetId: string;
}

export function FileChangeCard({ change, changeSetId }: FileChangeCardProps) {
  const [expanded, setExpanded] = React.useState(true);
  
  return (
    <div>
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8, 
          fontSize: 13, 
          fontWeight: 600, 
          marginBottom: 8, 
          color: 'var(--text-primary)',
          cursor: 'pointer'
        }}
      >
        {expanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
        <FileCode size={16} color="var(--accent-code)" />
        {change.filePath}
        <div style={{ fontSize: 10, opacity: 0.4, fontWeight: 400 }}>
          +{change.additions} -{change.deletions}
        </div>
      </div>
      
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginLeft: 22 }}>
          {change.hunks.map(hunk => (
            <DiffHunkView 
              key={hunk.id} 
              hunk={hunk} 
              fileChangeId={change.id}
              changeSetId={changeSetId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DiffHunkView({ hunk, fileChangeId, changeSetId }: { hunk: DiffHunk, fileChangeId: string, changeSetId: string }) {
  const { acceptHunk, rejectHunk } = useChangeSetStore();
  
  return (
    <GlassCard style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
      <div style={{ 
        padding: '4px 12px', 
        background: 'rgba(255,255,255,0.03)', 
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: 10,
        fontFamily: 'monospace',
        opacity: 0.5
      }}>
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@ {hunk.header}
      </div>
      
      <div style={{ 
        padding: 12, 
        background: 'rgba(0,0,0,0.1)', 
        fontFamily: 'monospace', 
        fontSize: 12, 
        whiteSpace: 'pre', 
        lineHeight: 1.6,
        overflowX: 'auto'
      }}>
        {hunk.lines.map((line, i) => (
          <div 
            key={`${line.oldLineNumber}-${line.newLineNumber}-${line.type}-${i}`} 
            style={{ 
              display: 'flex',
              background: line.type === 'addition' ? 'rgba(52, 199, 89, 0.1)' : line.type === 'deletion' ? 'rgba(255, 59, 48, 0.1)' : 'transparent',
              margin: '0 -12px',
              padding: '0 12px'
            }}
          >
            <div style={{ width: 30, opacity: 0.3, userSelect: 'none', textAlign: 'right', paddingRight: 8 }}>
              {line.oldLineNumber}
            </div>
            <div style={{ width: 30, opacity: 0.3, userSelect: 'none', textAlign: 'right', paddingRight: 8 }}>
              {line.newLineNumber}
            </div>
            <div style={{ 
              color: line.type === 'addition' ? '#34c759' : line.type === 'deletion' ? '#ff3b30' : 'inherit',
              paddingLeft: 4
            }}>
              {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
              {line.content}
            </div>
          </div>
        ))}
      </div>
      
      <div style={{ display: 'flex', borderTop: '1px solid var(--border-subtle)' }}>
        <button 
          onClick={() => rejectHunk(changeSetId, fileChangeId, hunk.id)}
          style={{ 
            flex: 1, 
            padding: 8, 
            background: 'transparent', 
            border: 'none', 
            borderRight: '1px solid var(--border-subtle)', 
            cursor: 'pointer', 
            color: 'var(--text-tertiary)', 
            fontSize: 11, 
            fontWeight: 600, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 6 
          }}
        >
          <X size={12} weight="bold" /> Reject
        </button>
        <button 
          onClick={() => acceptHunk(changeSetId, fileChangeId, hunk.id)}
          style={{ 
            flex: 1, 
            padding: 8, 
            background: 'transparent', 
            border: 'none', 
            cursor: 'pointer', 
            color: 'var(--accent-chat)', 
            fontSize: 11, 
            fontWeight: 600, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: 6 
          }}
        >
          <Check size={12} weight="bold" /> Accept
        </button>
      </div>
    </GlassCard>
  );
}
