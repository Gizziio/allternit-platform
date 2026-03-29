'use client';

import React, { useState, useEffect } from 'react';
import { apiRequest, API_BASE_URL } from '@/lib/agents/api-config';
import {
  GitBranch,
  CaretDown,
  Circle,
  FileText,
  Chat,
  PaperPlaneTilt,
  GitDiff,
  Trash,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface Commit {
  hash: string;
  message: string;
  author: string;
  avatar: string;
  avatarColor: string;
  timestamp: string;
  branch?: string;
  isMerge: boolean;
}
type MockCommit = Commit;

interface StagedFile {
  filename: string;
  status: 'M' | 'A' | 'D';
}


export const GitView: React.FC = () => {
  const [commitMessage, setCommitMessage] = useState('');
  const [commits, setCommits] = useState<Commit[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  useEffect(() => {
    apiRequest<{ commits: Array<{ hash: string; shortHash?: string; message: string; author: string; date: string }> }>(
      `${API_BASE_URL}/git/log`,
      { method: 'POST', body: JSON.stringify({ path: '.', limit: 20 }) }
    )
      .then(({ commits: raw }) =>
        setCommits(raw.map((c) => ({
          hash: c.shortHash ?? c.hash.slice(0, 7),
          message: c.message,
          author: c.author,
          avatar: c.author.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
          avatarColor: '#3b82f6',
          timestamp: new Date(c.date).toLocaleDateString(),
          isMerge: c.message.toLowerCase().startsWith('merge'),
        })))
      )
      .catch(() => {});
    apiRequest<{ staged: StagedFile[] }>(`${API_BASE_URL}/git/status`, { method: 'POST', body: JSON.stringify({ path: '.' }) })
      .then((status) => setStagedFiles((status as any).staged ?? []))
      .catch(() => {});
  }, []);

  const handleCommit = () => {
    if (commitMessage.trim()) {
      setCommitMessage('');
    }
  };

  const getStatusBadgeColor = (status: 'M' | 'A' | 'D') => {
    switch (status) {
      case 'M':
        return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'M' };
      case 'A':
        return { bg: 'rgba(52, 199, 89, 0.15)', color: '#34c759', label: 'A' };
      case 'D':
        return { bg: 'rgba(255, 59, 48, 0.15)', color: '#ff3b30', label: 'D' };
    }
  };

  return (
    <GlassSurface>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-secondary)' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <GitBranch size={20} color="var(--accent-primary)" />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Git Graph</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Branch and commit history</div>
            </div>
          </div>

          {/* Branch Selector */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <GitBranch size={14} />
            <span>main</span>
            <CaretDown size={14} />
          </div>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {[
            { label: '3 branches', value: '3' },
            { label: '42 commits', value: '42' },
            { label: '2 open PRs', value: '2' },
          ].map((stat, idx) => (
            <div
              key={idx}
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'var(--text-tertiary)',
              }}
            >
              <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                {stat.value}
              </div>
              <div>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Commit Graph */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 0',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ position: 'relative', paddingLeft: '32px' }}>
            {commits.map((commit, idx) => (
              <div
                key={commit.hash}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px 16px',
                  borderLeft:
                    idx < commits.length - 1
                      ? '1px solid var(--border-subtle)'
                      : 'none',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                {/* Commit dot */}
                <div
                  style={{
                    position: 'absolute',
                    left: '-16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                  }}
                >
                  <Circle
                    size={12}
                    fill={commit.isMerge ? commit.avatarColor : 'var(--accent-primary)'}
                    color={commit.isMerge ? commit.avatarColor : 'var(--accent-primary)'}
                  />
                </div>

                {/* Commit details */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                      }}
                    >
                      {commit.hash}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {commit.message}
                    </span>
                    {commit.branch && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '2px 6px',
                          backgroundColor: 'var(--accent-primary)',
                          color: 'white',
                          borderRadius: '3px',
                          marginLeft: '6px',
                        }}
                      >
                        {commit.branch}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '12px',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    <div
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: commit.avatarColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '9px',
                        fontWeight: '700',
                      }}
                    >
                      {commit.avatar}
                    </div>
                    <span>{commit.author}</span>
                    <span style={{ marginLeft: 'auto' }}>{commit.timestamp}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staged Changes */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
            Staged Changes
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
            2 modified, 1 new
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {stagedFiles.map((file) => {
              const badge = getStatusBadgeColor(file.status);
              return (
                <div
                  key={file.filename}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '4px',
                    fontSize: '12px',
                  }}
                >
                  <span
                    style={{
                      padding: '2px 4px',
                      backgroundColor: badge.bg,
                      color: badge.color,
                      borderRadius: '2px',
                      fontWeight: '600',
                      fontSize: '10px',
                      minWidth: '18px',
                      textAlign: 'center',
                    }}
                  >
                    {badge.label}
                  </span>
                  <span
                    style={{
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      color: 'var(--text-primary)',
                    }}
                  >
                    {file.filename}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Commit Input */}
        <div style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Write commit message..."
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleCommit();
                }
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '13px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                outline: 'none',
                transition: 'all 0.2s ease',
              }}
              onFocus={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
                (e.target as HTMLElement).style.borderColor = 'var(--accent-primary)';
              }}
              onBlur={(e) => {
                (e.target as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                (e.target as HTMLElement).style.borderColor = 'var(--border-subtle)';
              }}
            />
            <button
              onClick={handleCommit}
              style={{
                padding: '8px 16px',
                backgroundColor: 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.opacity = '0.85';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.opacity = '1';
              }}
            >
              <PaperPlaneTilt size={14} />
              Commit
            </button>
          </div>
        </div>
      </div>
    </GlassSurface>
  );
};

export default GitView;
