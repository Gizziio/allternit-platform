import React, { useState } from 'react';
import { FileText, Table2, Code2 } from 'lucide-react';
import GlassSurface from '@/design/GlassSurface';

interface Draft {
  id: string;
  title: string;
  type: 'document' | 'table' | 'code';
  preview: string;
  lastEdited: string;
  wordCount: number;
}

const mockDrafts: Draft[] = [
  {
    id: '1',
    title: 'Q4 Product Strategy',
    type: 'document',
    preview: 'This document outlines our product roadmap for the fourth quarter, including key features, performance targets, and stakeholder alignment...',
    lastEdited: '2 hours ago',
    wordCount: 2847,
  },
  {
    id: '2',
    title: 'User Analytics Dashboard',
    type: 'table',
    preview: 'Comprehensive user metrics including monthly active users, retention rates, conversion funnels, and demographic breakdowns across all regions...',
    lastEdited: '5 hours ago',
    wordCount: 1203,
  },
  {
    id: '3',
    title: 'API Integration Module',
    type: 'code',
    preview: 'TypeScript/React integration layer for REST API communication. Includes request interceptors, error handling, and automatic retry logic with exponential backoff...',
    lastEdited: '1 day ago',
    wordCount: 542,
  },
  {
    id: '4',
    title: 'Market Research Notes',
    type: 'document',
    preview: 'Competitive analysis and market trends gathered from industry reports, customer interviews, and analyst publications. Identifies key opportunities and threats...',
    lastEdited: '3 days ago',
    wordCount: 3156,
  },
  {
    id: '5',
    title: 'Performance Metrics',
    type: 'table',
    preview: 'Real-time performance data including response times, error rates, CPU usage, memory allocation, and database query performance across all environments...',
    lastEdited: '12 hours ago',
    wordCount: 876,
  },
];

const getIcon = (type: Draft['type']) => {
  switch (type) {
    case 'document':
      return <FileText size={20} color="#3b82f6" />;
    case 'table':
      return <Table2 size={20} color="#8b5cf6" />;
    case 'code':
      return <Code2 size={20} color="#06b6d4" />;
    default:
      return <FileText size={20} />;
  }
};

export const DraftsView: React.FC = () => {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <FileText size={24} color="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Drafts</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Work in progress</p>
      </div>

      {/* Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: 'var(--spacing-lg)',
        }}
      >
        {mockDrafts.map((draft) => (
          <GlassSurface
            key={draft.id}
            style={{
              padding: 'var(--spacing-lg)',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            }}
          >
            {/* Icon and Title */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
              <div style={{ marginTop: '2px' }}>{getIcon(draft.type)}</div>
              <h3
                style={{
                  margin: 0,
                  color: 'var(--text-primary)',
                  fontSize: '15px',
                  fontWeight: 600,
                  lineHeight: '1.4',
                  flex: 1,
                }}
              >
                {draft.title}
              </h3>
            </div>

            {/* Preview */}
            <p
              style={{
                margin: '0 0 var(--spacing-md) 0',
                color: 'var(--text-tertiary)',
                fontSize: '13px',
                lineHeight: '1.5',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                flex: 1,
              }}
            >
              {draft.preview}
            </p>

            {/* Last Edited */}
            <p
              style={{
                margin: '0 0 var(--spacing-md) 0',
                color: 'var(--text-secondary)',
                fontSize: '12px',
              }}
            >
              Last edited {draft.lastEdited}
            </p>

            {/* Bottom Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 'var(--spacing-md)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                {draft.wordCount.toLocaleString()} words
              </span>
              <button
                onMouseEnter={() => setEditingId(draft.id)}
                onMouseLeave={() => setEditingId(null)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: editingId === draft.id ? '#af52de' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  borderBottom: editingId === draft.id ? '2px solid #af52de' : '2px solid transparent',
                }}
              >
                Continue editing
              </button>
            </div>
          </GlassSurface>
        ))}
      </div>
    </div>
  );
};

export default DraftsView;
